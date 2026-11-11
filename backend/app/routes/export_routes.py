import csv
import io
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import ScannedMessage, Sender

router = APIRouter(prefix="/export", tags=["export"])


def _sanitize_csv_cell(value: Any) -> Any:
    """Neutralizes spreadsheet formula injection on untrusted string fields."""
    if isinstance(value, str) and value and value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


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
        sender_stmt = select(Sender)
        if senders and not include_all:
            sender_list = [s.strip().lower() for s in senders.split(",") if s.strip()]
            sender_stmt = sender_stmt.where(Sender.email.in_(sender_list))
        s_res = await db.execute(sender_stmt)
        for s in s_res.scalars().all():
            writer.writerow([
                "SUMMARY",
                _sanitize_csv_cell(s.name),
                _sanitize_csv_cell(s.email),
                _sanitize_csv_cell(s.sample_subject or "N/A"),
                s.total_size_bytes,
                "YES" if s.has_unsubscribe else "NO",
                _sanitize_csv_cell(s.unsubscribe_url or s.unsubscribe_mailto or ""),
                f"{s.message_count} total messages, {s.unread_count} unread"
            ])
    else:
        for m in messages:
            writer.writerow([
                m.id,
                _sanitize_csv_cell(m.sender_name),
                _sanitize_csv_cell(m.sender_email),
                _sanitize_csv_cell(m.subject),
                m.size_estimate,
                "YES" if m.has_unsubscribe else "NO",
                _sanitize_csv_cell(m.unsubscribe_url or m.unsubscribe_mailto or ""),
                _sanitize_csv_cell(m.snippet)
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gmail_cleaner_metadata.csv"}
    )
