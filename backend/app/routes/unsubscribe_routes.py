import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from ..database import get_db, AsyncSessionLocal
from ..models import Sender, ScannedMessage
from ..schemas import UnsubscribeRequest, UnsubscribeResult, BulkSenderActionRequest
from ..unsubscribe_service import UnsubscribeService
from ..jobs import JobManager
from ..auth import is_authenticated
from ..utils import utc_now

router = APIRouter(prefix="/unsubscribe", tags=["unsubscribe"])


async def _mark_sender_unsubscribed(
    session: AsyncSession,
    sender: Sender,
    trash_existing: bool
) -> None:
    """Marks sender unsubscribed and clears cached email counts/rows if trashed."""
    sender.is_unsubscribed = True
    sender.unsubscribed_at = utc_now()
    if trash_existing:
        sender.message_count = 0
        sender.unread_count = 0
        sender.total_size_bytes = 0
        await session.execute(
            delete(ScannedMessage).where(ScannedMessage.sender_email == sender.email)
        )


@router.post("", response_model=UnsubscribeResult)
async def unsubscribe_single(req: UnsubscribeRequest, db: AsyncSession = Depends(get_db)):
    sender = await db.get(Sender, req.email)
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found in scan database")

    if not is_authenticated():
        await _mark_sender_unsubscribed(db, sender, req.trash_existing)
        await db.commit()
        return UnsubscribeResult(
            email=sender.email,
            status="success",
            method="one-click",
            message=f"Successfully unsubscribed from {sender.name or sender.email}!"
        )

    service = UnsubscribeService()
    result = await service.execute_unsubscribe(sender, trash_existing=req.trash_existing)

    if result.status == "success":
        await _mark_sender_unsubscribed(db, sender, req.trash_existing)
        await db.commit()

    return result


async def run_bulk_unsubscribe_worker(job_id: str, emails: List[str], trash_existing: bool):
    service = UnsubscribeService()
    total = len(emails)
    processed = 0
    success = 0
    errors = 0
    demo_mode = not is_authenticated()

    await JobManager.update_job_progress(
        job_id,
        processed=0,
        total=total,
        status="running",
        message=f"Starting bulk unsubscribe for {total} senders..."
    )

    for email in emails:
        if JobManager.is_cancelled(job_id):
            await JobManager.update_job_progress(
                job_id, processed=processed, status="cancelled", message="Bulk unsubscribe cancelled."
            )
            return

        await JobManager.update_job_progress(
            job_id,
            processed=processed,
            current_item=email,
            message=f"Unsubscribing from {email}..."
        )

        # Fetch sender outside network HTTP call so DB connections aren't held idle
        async with AsyncSessionLocal() as session:
            sender = await session.get(Sender, email)

        succeeded = False
        if sender:
            if demo_mode:
                await asyncio.sleep(0.1)
                succeeded = True
            else:
                res = await service.execute_unsubscribe(sender, trash_existing=trash_existing)
                succeeded = res.status == "success"

            if succeeded:
                async with AsyncSessionLocal() as session:
                    sender_rec = await session.get(Sender, email)
                    if sender_rec:
                        await _mark_sender_unsubscribed(session, sender_rec, trash_existing)
                    await session.commit()
                success += 1
            else:
                errors += 1
        else:
            errors += 1

        processed += 1
        await JobManager.update_job_progress(
            job_id,
            processed=processed,
            success_inc=1 if succeeded else 0,
            error_inc=0 if succeeded else 1,
            current_item=email,
            message=f"Completed {email} ({processed}/{total})"
        )

    await JobManager.update_job_progress(
        job_id,
        processed=total,
        total=total,
        status="completed",
        message=f"Bulk unsubscribe complete: {success} succeeded, {errors} manual/skipped."
    )


@router.post("/bulk")
async def unsubscribe_bulk(req: BulkSenderActionRequest, bg: BackgroundTasks, trash_existing: bool = False):
    job = await JobManager.create_job("bulk_unsubscribe", total_items=len(req.senders), message="Preparing bulk unsubscribe...")
    bg.add_task(run_bulk_unsubscribe_worker, job.id, req.senders, trash_existing)
    return {"job_id": job.id, "status": "queued"}
