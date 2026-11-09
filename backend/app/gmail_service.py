import asyncio
import base64
import email.utils
from email.message import EmailMessage
from datetime import datetime
import re
from typing import List, Dict, Any, Optional, Tuple
import httpx
from .auth import get_credentials

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

    async def batch_modify(self, message_ids: List[str], add_labels: List[str] = None, remove_labels: List[str] = None) -> int:
        """
        Modifies labels on up to 1000 messages per request using Gmail batchModify
        """
        if not message_ids:
            return 0

        headers = self._get_headers()
        chunk_size = 1000
        modified_count = 0

        async with httpx.AsyncClient(timeout=45.0) as client:
            for i in range(0, len(message_ids), chunk_size):
                chunk = message_ids[i:i + chunk_size]
                body = {
                    "ids": chunk,
                    "addLabelIds": add_labels or [],
                    "removeLabelIds": remove_labels or []
                }
                resp = await client.post(f"{GMAIL_API_BASE}/messages/batchModify", headers=headers, json=body)
                if resp.status_code in [200, 204]:
                    modified_count += len(chunk)
                else:
                    print(f"batchModify failed with {resp.status_code}: {resp.text}")

        return modified_count

    async def batch_delete(self, message_ids: List[str]) -> int:
        """
        Permanently deletes messages using Gmail batchDelete
        """
        if not message_ids:
            return 0

        headers = self._get_headers()
        chunk_size = 1000
        deleted_count = 0

        async with httpx.AsyncClient(timeout=45.0) as client:
            for i in range(0, len(message_ids), chunk_size):
                chunk = message_ids[i:i + chunk_size]
                body = {"ids": chunk}
                resp = await client.post(f"{GMAIL_API_BASE}/messages/batchDelete", headers=headers, json=body)
                if resp.status_code in [200, 204]:
                    deleted_count += len(chunk)
                else:
                    print(f"batchDelete failed with {resp.status_code}: {resp.text}")

        return deleted_count

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
