import asyncio
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..database import get_db, AsyncSessionLocal
from ..models import Sender, ScannedMessage
from ..schemas import UnsubscribeRequest, UnsubscribeResult, BulkSenderActionRequest
from ..unsubscribe_service import UnsubscribeService
from ..jobs import JobManager
from ..auth import is_authenticated

router = APIRouter(prefix="/unsubscribe", tags=["unsubscribe"])

@router.post("", response_model=UnsubscribeResult)
async def unsubscribe_single(req: UnsubscribeRequest, db: AsyncSession = Depends(get_db)):
    sender = await db.get(Sender, req.email)
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found in scan database")

    if not is_authenticated():
        sender.is_unsubscribed = True
        sender.unsubscribed_at = datetime.utcnow()
        if req.trash_existing:
            sender.message_count = 0
            sender.unread_count = 0
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
        sender.is_unsubscribed = True
        sender.unsubscribed_at = datetime.utcnow()
        if req.trash_existing:
            sender.message_count = 0
            sender.unread_count = 0
        await db.commit()

    return result

async def run_bulk_unsubscribe_worker(job_id: str, emails: List[str], trash_existing: bool):
    service = UnsubscribeService()
    total = len(emails)
    processed = 0
    success = 0
    errors = 0

    await JobManager.update_job_progress(
        job_id,
        processed=0,
        total=total,
        status="running",
        message=f"Starting bulk unsubscribe for {total} senders..."
    )

    for email in emails:
        if JobManager.is_cancelled(job_id):
            await JobManager.update_job_progress(job_id, processed=processed, status="cancelled", message="Bulk unsubscribe cancelled.")
            return

        await JobManager.update_job_progress(
            job_id,
            processed=processed,
            current_item=email,
            message=f"Unsubscribing from {email}..."
        )

        res = None
        sender_found = False
        async with AsyncSessionLocal() as session:
            sender = await session.get(Sender, email)
            if sender:
                sender_found = True
                res = await service.execute_unsubscribe(sender, trash_existing=trash_existing)
                if res.status == "success":
                    sender.is_unsubscribed = True
                    sender.unsubscribed_at = datetime.utcnow()
                    if trash_existing:
                        sender.message_count = 0
                        sender.unread_count = 0
                        await session.execute(
                            delete(ScannedMessage).where(ScannedMessage.sender_email == email)
                        )
                    success += 1
                else:
                    errors += 1
            else:
                errors += 1
            await session.commit()

        processed += 1
        await JobManager.update_job_progress(
            job_id,
            processed=processed,
            success_inc=1 if sender_found and res and res.status == "success" else 0,
            error_inc=1 if not sender_found or (res and res.status != "success") else 0,
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
