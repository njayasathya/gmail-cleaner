import asyncio
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db, AsyncSessionLocal
from ..models import Sender, ScannedMessage
from ..schemas import (
    BulkDeleteRequest, BulkSenderActionRequest, BulkReadRequest,
    BulkImportantRequest, BulkLabelRequest
)
from ..gmail_service import GmailService
from ..jobs import JobManager
from ..auth import is_authenticated

router = APIRouter(prefix="/actions", tags=["bulk actions"])

async def execute_bulk_action_worker(
    job_id: str,
    action_type: str,
    senders: List[str],
    filter_query: Optional[str] = None,
    permanent_delete: bool = False,
    is_read: bool = True,
    is_important: bool = True,
    label_id: Optional[str] = None,
    label_action: str = "apply"
):
    total_senders = len(senders)
    processed_senders = 0
    total_emails_affected = 0

    if not is_authenticated():
        # Demo simulation for testing without Google Cloud credentials
        await JobManager.update_job_progress(
            job_id,
            processed=0,
            total=total_senders,
            status="running",
            message=f"Starting demo {action_type} for {total_senders} senders..."
        )
        async with AsyncSessionLocal() as session:
            for i, email in enumerate(senders):
                if JobManager.is_cancelled(job_id):
                    await JobManager.update_job_progress(job_id, processed=i, status="cancelled", message="Cancelled.")
                    return
                await asyncio.sleep(0.12)
                sender_rec = await session.get(Sender, email)
                if sender_rec:
                    if action_type in ["trash", "permanent_delete"]:
                        sender_rec.message_count = 0
                        sender_rec.unread_count = 0
                    elif action_type == "read" and is_read:
                        sender_rec.unread_count = 0
                await JobManager.update_job_progress(
                    job_id,
                    processed=i + 1,
                    total=total_senders,
                    success_inc=1,
                    current_item=email,
                    message=f"Processed {email} ({i + 1}/{total_senders})"
                )
            await session.commit()

        await JobManager.update_job_progress(
            job_id,
            processed=total_senders,
            total=total_senders,
            status="completed",
            message=f"Completed {action_type} on {total_senders} senders!"
        )
        return

    gmail = GmailService()

    await JobManager.update_job_progress(
        job_id,
        processed=0,
        total=total_senders,
        status="running",
        message=f"Starting {action_type} for {total_senders} senders..."
    )

    try:
        async with AsyncSessionLocal() as session:
            for email in senders:
                if JobManager.is_cancelled(job_id):
                    await JobManager.update_job_progress(
                        job_id,
                        processed=processed_senders,
                        status="cancelled",
                        message="Action cancelled by user."
                    )
                    return

                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_senders,
                    current_item=email,
                    message=f"Processing {email} ({processed_senders + 1}/{total_senders})..."
                )

                # Query messages for this sender
                query = f"from:{email}"
                if filter_query:
                    query += f" {filter_query}"

                message_ids = await gmail.list_message_ids(query=query)
                email_count = len(message_ids)

                if email_count > 0:
                    if action_type == "trash":
                        await gmail.batch_modify(message_ids, add_labels=["TRASH"], remove_labels=["INBOX"])
                    elif action_type == "permanent_delete":
                        await gmail.batch_delete(message_ids)
                    elif action_type == "archive":
                        await gmail.batch_modify(message_ids, remove_labels=["INBOX"])
                    elif action_type == "read":
                        if is_read:
                            await gmail.batch_modify(message_ids, remove_labels=["UNREAD"])
                        else:
                            await gmail.batch_modify(message_ids, add_labels=["UNREAD"])
                    elif action_type == "important":
                        if is_important:
                            await gmail.batch_modify(message_ids, add_labels=["IMPORTANT"])
                        else:
                            await gmail.batch_modify(message_ids, remove_labels=["IMPORTANT"])
                    elif action_type == "label":
                        if label_id:
                            if label_action == "apply":
                                await gmail.batch_modify(message_ids, add_labels=[label_id])
                            else:
                                await gmail.batch_modify(message_ids, remove_labels=[label_id])

                    total_emails_affected += email_count

                # Update database sender stats
                sender_rec = await session.get(Sender, email)
                if sender_rec:
                    if action_type in ["trash", "permanent_delete"]:
                        sender_rec.message_count = max(0, sender_rec.message_count - email_count)
                        sender_rec.unread_count = 0
                    elif action_type == "read" and is_read:
                        sender_rec.unread_count = 0

                processed_senders += 1
                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_senders,
                    success_inc=1,
                    current_item=email,
                    message=f"Processed {email}: {email_count} emails affected."
                )

            await session.commit()

        await JobManager.update_job_progress(
            job_id,
            processed=total_senders,
            total=total_senders,
            status="completed",
            message=f"Completed {action_type}! {total_emails_affected} total emails modified across {total_senders} senders."
        )

    except Exception as e:
        await JobManager.update_job_progress(
            job_id,
            processed=processed_senders,
            status="failed",
            message=f"Operation failed on sender {email if 'email' in locals() else 'unknown'}",
            error_details=str(e)
        )

@router.post("/trash")
async def trash_senders(req: BulkSenderActionRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("trash", total_items=len(req.senders), message="Preparing to trash emails...")
    bg.add_task(execute_bulk_action_worker, job.id, "trash", req.senders, req.filter_query)
    return {"job_id": job.id, "status": "queued"}

@router.post("/delete")
async def delete_senders(req: BulkDeleteRequest, bg: BackgroundTasks):
    action_type = "permanent_delete" if req.permanent else "trash"
    job = await JobManager.create_job(action_type, total_items=len(req.senders), message="Preparing to delete emails...")
    bg.add_task(execute_bulk_action_worker, job.id, action_type, req.senders, req.filter_query, req.permanent)
    return {"job_id": job.id, "status": "queued"}

@router.post("/archive")
async def archive_senders(req: BulkSenderActionRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("archive", total_items=len(req.senders), message="Preparing to archive emails...")
    bg.add_task(execute_bulk_action_worker, job.id, "archive", req.senders, req.filter_query)
    return {"job_id": job.id, "status": "queued"}

@router.post("/read")
async def mark_read_senders(req: BulkReadRequest, bg: BackgroundTasks):
    action = "mark_read" if req.read else "mark_unread"
    job = await JobManager.create_job(action, total_items=len(req.senders), message="Preparing to update read status...")
    bg.add_task(execute_bulk_action_worker, job.id, "read", req.senders, req.filter_query, False, req.read)
    return {"job_id": job.id, "status": "queued"}

@router.post("/important")
async def mark_important_senders(req: BulkImportantRequest, bg: BackgroundTasks):
    action = "mark_important" if req.important else "unmark_important"
    job = await JobManager.create_job(action, total_items=len(req.senders), message="Preparing to update importance...")
    bg.add_task(execute_bulk_action_worker, job.id, "important", req.senders, req.filter_query, False, True, req.important)
    return {"job_id": job.id, "status": "queued"}

@router.post("/label")
async def label_senders(req: BulkLabelRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("label", total_items=len(req.senders), message=f"Applying label {req.label_id}...")
    bg.add_task(
        execute_bulk_action_worker,
        job.id, "label", req.senders, req.filter_query,
        False, True, True, req.label_id, req.action
    )
    return {"job_id": job.id, "status": "queued"}
