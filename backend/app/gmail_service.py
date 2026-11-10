import asyncio
import base64
import email
import email.utils
from email.message import EmailMessage
import json
import random
import re
import uuid
from typing import Callable, List, Dict, Any, Optional, Tuple
import httpx
from .auth import get_credentials
from .utils import get_logger

logger = get_logger("gmail_service")
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

class GmailService:
    def __init__(self):
        self.creds = get_credentials()

    def _ensure_token(self) -> str:
        creds = get_credentials()
        if not creds or not creds.valid:
            raise Exception("User is not authenticated with Gmail")
        return creds.token

    def _get_headers(self) -> Dict[str, str]:
        token = self._ensure_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    async def list_message_ids(self, query: str = "", max_results: Optional[int] = None) -> List[str]:
        headers = self._get_headers()
        message_ids = []
        page_token = None
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                params = {
                    "maxResults": min(max_results - len(message_ids), 500) if max_results else 500,
                }
                if query:
                    params["q"] = query
                if page_token:
                    params["pageToken"] = page_token

                resp = await client.get(f"{GMAIL_API_BASE}/messages", headers=headers, params=params)
                if resp.status_code != 200:
                    break

                data = resp.json()
                messages = data.get("messages", [])
                message_ids.extend([m["id"] for m in messages])

                page_token = data.get("nextPageToken")
                if not page_token:
                    break
                if max_results and len(message_ids) >= max_results:
                    break

        return message_ids

    async def fetch_message_metadata(self, client: httpx.AsyncClient, message_id: str) -> Optional[Dict[str, Any]]:
        url = f"{GMAIL_API_BASE}/messages/{message_id}"
        params = [
            ("format", "metadata"),
            ("metadataHeaders", "From"),
            ("metadataHeaders", "Subject"),
            ("metadataHeaders", "Date"),
            ("metadataHeaders", "List-Unsubscribe"),
            ("metadataHeaders", "List-Unsubscribe-Post"),
            ("fields", "id,threadId,labelIds,sizeEstimate,internalDate,snippet,payload/headers"),
        ]
        headers = self._get_headers()
        
        for attempt in range(5):
            try:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 429 or (resp.status_code == 403 and "rateLimitExceeded" in resp.text):
                    # Exponential backoff on Gmail quota throttling
                    await asyncio.sleep(2 ** attempt + 0.5)
                    continue
                else:
                    return None
            except Exception:
                await asyncio.sleep(1)
        return None

    async def batch_fetch_messages_metadata(
        self,
        client: httpx.AsyncClient,
        message_ids: List[str],
        on_rate_limit: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetches metadata for multiple messages using Google's Batch API (multipart/mixed).
        Inspects each sub-request status code, and automatically retries with exponential backoff
        if throttled by per-user concurrency (429) or per-minute quota limits (403).
        Guarantees zero silent message drops.
        """
        if not message_ids:
            return []

        pending_ids = list(message_ids)
        all_results = []
        backoff_delay = 2.0
        max_attempts = 6
        attempt = 0

        while pending_ids and attempt < max_attempts:
            attempt += 1
            token = self._ensure_token()
            boundary = f"batch_{uuid.uuid4().hex}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": f"multipart/mixed; boundary={boundary}"
            }

            parts = []
            for mid in pending_ids:
                part = (
                    f"--{boundary}\r\n"
                    f"Content-Type: application/http\r\n"
                    f"Content-ID: <{mid}>\r\n\r\n"
                    f"GET /gmail/v1/users/me/messages/{mid}?format=metadata"
                    f"&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date"
                    f"&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post"
                    f"&fields=id,threadId,labelIds,sizeEstimate,internalDate,snippet,payload/headers\r\n"
                )
                parts.append(part)
            body = "\r\n".join(parts) + f"\r\n--{boundary}--\r\n"

            try:
                resp = await client.post(
                    "https://gmail.googleapis.com/batch/gmail/v1",
                    headers=headers,
                    content=body.encode("utf-8")
                )

                if resp.status_code == 200:
                    raw_msg = email.message_from_bytes(
                        f"Content-Type: {resp.headers.get('content-type', '')}\r\n\r\n".encode("utf-8") + resp.content
                    )
                    succeeded_ids = set()

                    for part in raw_msg.get_payload():
                        payload = part.get_payload()
                        if isinstance(payload, str):
                            sections = payload.split("\r\n\r\n", 1)
                            if len(sections) == 2:
                                http_header, http_body = sections
                                status_line = http_header.split("\r\n")[0]
                                if "200 OK" in status_line:
                                    try:
                                        data = json.loads(http_body)
                                        all_results.append(data)
                                        succeeded_ids.add(data.get("id"))
                                    except Exception:
                                        pass
                                elif "404" in status_line:
                                    # Message was deleted in Gmail while scanning
                                    cid = part.get("Content-ID", "")
                                    mid = cid.strip("<>").replace("response-", "")
                                    succeeded_ids.add(mid)

                    pending_ids = [mid for mid in pending_ids if mid not in succeeded_ids]
                    if pending_ids:
                        backoff_delay = await self._wait_rate_limit(backoff_delay, len(pending_ids), on_rate_limit)
                elif resp.status_code in (429, 403):
                    backoff_delay = await self._wait_rate_limit(backoff_delay, len(pending_ids), on_rate_limit)
                else:
                    logger.warning("Batch fetch returned unexpected HTTP %s", resp.status_code)
                    break
            except Exception as err:
                logger.warning("Batch fetch attempt %s failed: %s", attempt, err)
                await asyncio.sleep(backoff_delay)
                backoff_delay = min(backoff_delay * 2, 25.0)

        return all_results

    async def _wait_rate_limit(
        self,
        backoff_delay: float,
        pending_count: int,
        on_rate_limit: Optional[Any]
    ) -> float:
        """Notifies listeners, sleeps with jitter, and returns the next capped backoff interval."""
        jitter = random.uniform(0.1, 0.4)
        if on_rate_limit:
            try:
                await on_rate_limit(pending_count, backoff_delay)
            except Exception:
                pass
        await asyncio.sleep(backoff_delay + jitter)
        return min(backoff_delay * 2, 25.0)

    def parse_sender_info(self, from_header: str) -> Tuple[str, str, str]:
        """
        Parses "John Doe <john@example.com>" into (name, email, domain)
        """
        name, email_address = email.utils.parseaddr(from_header)
        email_address = email_address.strip().lower()
        if not email_address and "@" in from_header:
            email_address = from_header.strip().lower()
            
        domain = email_address.split("@")[-1] if "@" in email_address else ""
        if not name:
            name = email_address.split("@")[0] if "@" in email_address else from_header
        return name, email_address, domain

    def parse_unsubscribe_header(self, unsub_header: str, unsub_post_header: str = "") -> Tuple[Optional[str], Optional[str], bool]:
        """
        Parses List-Unsubscribe header: "<https://example.com/unsub>, <mailto:unsub@example.com>"
        Returns (http_url, mailto_uri, has_one_click)
        """
        if not unsub_header:
            return None, None, False

        urls = re.findall(r'<([^>]+)>', unsub_header)
        http_url = None
        mailto_uri = None

        for item in urls:
            item = item.strip()
            if item.lower().startswith("http://") or item.lower().startswith("https://"):
                if not http_url:
                    http_url = item
            elif item.lower().startswith("mailto:"):
                if not mailto_uri:
                    mailto_uri = item

        has_one_click = bool(unsub_post_header and "List-Unsubscribe=One-Click" in unsub_post_header)
        return http_url, mailto_uri, has_one_click

    async def _post_batch_chunks(
        self,
        endpoint: str,
        message_ids: List[str],
        build_payload: Callable[[List[str]], Dict[str, Any]]
    ) -> int:
        """Dispatches chunked POST requests (up to 1000 IDs/request) to Gmail batch endpoints."""
        if not message_ids:
            return 0

        headers = self._get_headers()
        chunk_size = 1000
        affected_count = 0

        async with httpx.AsyncClient(timeout=45.0) as client:
            for i in range(0, len(message_ids), chunk_size):
                chunk = message_ids[i:i + chunk_size]
                resp = await client.post(
                    f"{GMAIL_API_BASE}/messages/{endpoint}",
                    headers=headers,
                    json=build_payload(chunk)
                )
                if resp.status_code in (200, 204):
                    affected_count += len(chunk)
                else:
                    logger.error("%s failed with HTTP %s: %s", endpoint, resp.status_code, resp.text)

        return affected_count

    async def batch_modify(
        self,
        message_ids: List[str],
        add_labels: Optional[List[str]] = None,
        remove_labels: Optional[List[str]] = None
    ) -> int:
        """Modifies labels on up to 1000 messages per request using Gmail batchModify."""
        return await self._post_batch_chunks(
            "batchModify",
            message_ids,
            lambda chunk: {
                "ids": chunk,
                "addLabelIds": add_labels or [],
                "removeLabelIds": remove_labels or []
            }
        )

    async def batch_delete(self, message_ids: List[str]) -> int:
        """Permanently deletes messages using Gmail batchDelete."""
        return await self._post_batch_chunks(
            "batchDelete",
            message_ids,
            lambda chunk: {"ids": chunk}
        )

    async def list_labels(self) -> List[Dict[str, Any]]:
        headers = self._get_headers()
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(f"{GMAIL_API_BASE}/labels", headers=headers)
            if resp.status_code == 200:
                return resp.json().get("labels", [])
        return []

    async def create_label(self, name: str) -> Optional[Dict[str, Any]]:
        headers = self._get_headers()
        body = {
            "name": name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show"
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(f"{GMAIL_API_BASE}/labels", headers=headers, json=body)
            if resp.status_code in [200, 201]:
                return resp.json()
        return None

    async def delete_label(self, label_id: str) -> bool:
        headers = self._get_headers()
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.delete(f"{GMAIL_API_BASE}/labels/{label_id}", headers=headers)
            return resp.status_code in [200, 204]

    async def send_email(self, to: str, subject: str, body: str) -> bool:
        """
        Sends an email using Gmail API (useful for mailto: unsubscribe links)
        """
        headers = self._get_headers()
        msg = EmailMessage()
        msg.set_content(body)
        msg["To"] = to
        msg["Subject"] = subject

        encoded_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        payload = {"raw": encoded_message}

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(f"{GMAIL_API_BASE}/messages/send", headers=headers, json=payload)
            return resp.status_code in [200, 201]
