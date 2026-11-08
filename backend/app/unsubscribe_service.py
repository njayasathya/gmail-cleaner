import urllib.parse
from datetime import datetime
from typing import Optional
import httpx
from .models import Sender
from .gmail_service import GmailService
from .schemas import UnsubscribeResult

class UnsubscribeService:
    def __init__(self, gmail_service: Optional[GmailService] = None):
        self.gmail = gmail_service or GmailService()

    async def execute_unsubscribe(self, sender: Sender, trash_existing: bool = False) -> UnsubscribeResult:
        if not sender.has_unsubscribe:
            return UnsubscribeResult(
                email=sender.email,
                status="failed",
                method="none",
                message="No unsubscribe header found for this sender."
            )

        # 1. Try RFC 8058 One-Click POST if supported
        if sender.has_one_click and sender.unsubscribe_url:
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    resp = await client.post(
                        sender.unsubscribe_url,
                        data={"List-Unsubscribe": "One-Click"},
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GmailCleaner/1.0",
                            "Content-Type": "application/x-www-form-urlencoded"
                        }
                    )
                    if resp.status_code in [200, 202, 204]:
                        await self._post_unsub_cleanup(sender, trash_existing)
                        return UnsubscribeResult(
                            email=sender.email,
                            status="success",
                            method="one-click",
                            message="Successfully unsubscribed via RFC 8058 One-Click POST."
                        )
            except Exception as e:
                print(f"One-click POST error for {sender.email}: {e}")

        # 2. Try mailto: unsubscribe if available
        if sender.unsubscribe_mailto:
            try:
                mailto_str = sender.unsubscribe_mailto
                if mailto_str.lower().startswith("mailto:"):
                    mailto_str = mailto_str[7:]

                parsed = urllib.parse.urlsplit(mailto_str)
                recipient = parsed.path
                query_params = urllib.parse.parse_qs(parsed.query)

                subject = query_params.get("subject", ["Unsubscribe"])[0]
                body = query_params.get("body", ["Please unsubscribe me from your mailing list."])[0]

                success = await self.gmail.send_email(to=recipient, subject=subject, body=body)
                if success:
                    await self._post_unsub_cleanup(sender, trash_existing)
                    return UnsubscribeResult(
                        email=sender.email,
                        status="success",
                        method="mailto",
                        message=f"Sent automated unsubscribe email to {recipient}."
                    )
            except Exception as e:
                print(f"Mailto error for {sender.email}: {e}")

        # 3. Try standard HTTP GET request
        if sender.unsubscribe_url:
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    resp = await client.get(
                        sender.unsubscribe_url,
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GmailCleaner/1.0"}
                    )
                    if resp.status_code in [200, 204]:
                        await self._post_unsub_cleanup(sender, trash_existing)
                        return UnsubscribeResult(
                            email=sender.email,
                            status="success",
                            method="http-get",
                            message="Dispatched unsubscribe request to sender's unsubscribe URL.",
                            manual_url=sender.unsubscribe_url
                        )
                    else:
                        return UnsubscribeResult(
                            email=sender.email,
                            status="manual_required",
                            method="http-get",
                            message=f"Direct request returned status {resp.status_code}. Opening URL may be required.",
                            manual_url=sender.unsubscribe_url
                        )
            except Exception as e:
                return UnsubscribeResult(
                    email=sender.email,
                    status="manual_required",
                    method="manual",
                    message=f"Could not automatically send request: {str(e)}",
                    manual_url=sender.unsubscribe_url
                )

        return UnsubscribeResult(
            email=sender.email,
            status="failed",
            method="none",
            message="No viable unsubscribe mechanism found."
        )

    async def _post_unsub_cleanup(self, sender: Sender, trash_existing: bool):
        if trash_existing:
            message_ids = await self.gmail.list_message_ids(query=f"from:{sender.email}")
            if message_ids:
                await self.gmail.batch_modify(message_ids, add_labels=["TRASH"], remove_labels=["INBOX"])
