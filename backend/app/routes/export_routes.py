import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import ScannedMessage, Sender

router = APIRouter(prefix="/export", tags=["export"])

@router.get("/csv")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    senders: Optional[str] = Query(None, description="Comma-separated list of sender emails"),
    include_all: bool = Query(False, description="If true, exports all scanned messages")
):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Message ID",
        "Sender Name",
        "Sender Email",
        "Subject",
        "Size (Bytes)",
        "Has Unsubscribe",
        "Unsubscribe Link",
        "Snippet"
    ])

    stmt = select(ScannedMessage)
    if senders and not include_all:
        sender_list = [s.strip().lower() for s in senders.split(",") if s.strip()]
        stmt = stmt.where(ScannedMessage.sender_email.in_(sender_list))

    result = await db.execute(stmt)
    messages = result.scalars().all()

    if not messages:
        # If no detailed messages cached, export Sender summary
        sender_stmt = select(Sender)
        if senders and not include_all:
            sender_list = [s.strip().lower() for s in senders.split(",") if s.strip()]
            sender_stmt = sender_stmt.where(Sender.email.in_(sender_list))
        s_res = await db.execute(sender_stmt)
        s_list = s_res.scalars().all()
        for s in s_list:
            writer.writerow([
                "SUMMARY",
                s.name,
                s.email,
                s.sample_subject or "N/A",
                s.total_size_bytes,
                "YES" if s.has_unsubscribe else "NO",
                s.unsubscribe_url or s.unsubscribe_mailto or "",
                f"{s.message_count} total messages, {s.unread_count} unread"
            ])
    else:
        for m in messages:
            writer.writerow([
                m.id,
                m.sender_name,
                m.sender_email,
                m.subject,
                m.size_estimate,
                "YES" if m.has_unsubscribe else "NO",
                m.unsubscribe_url or m.unsubscribe_mailto or "",
                m.snippet
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gmail_cleaner_metadata.csv"}
    )
