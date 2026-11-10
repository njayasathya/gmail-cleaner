import asyncio
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import delete
from ..database import AsyncSessionLocal
from ..models import Sender, ScannedMessage
from ..schemas import (
    BulkDeleteRequest, BulkSenderActionRequest, BulkReadRequest,
    BulkImportantRequest, BulkLabelRequest
)
from ..gmail_service import GmailService
from ..jobs import JobManager
from ..auth import is_authenticated
from ..utils import get_logger

logger = get_logger("action_routes")
router = APIRouter(prefix="/actions", tags=["bulk actions"])


async def _apply_gmail_action(
    gmail: GmailService,
    action_type: str,
    message_ids: List[str],
    is_read: bool,
    is_important: bool,
    label_id: Optional[str],
    label_action: str
) -> None:
    """Applies the requested Gmail API bulk label or deletion operation."""
    if not message_ids:
        return
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
    elif action_type == "label" and label_id:
        if label_action == "apply":
            await gmail.batch_modify(message_ids, add_labels=[label_id])
        else:
            await gmail.batch_modify(message_ids, remove_labels=[label_id])


async def _update_sender_after_action(
    email: str,
    action_type: str,
    affected_count: Optional[int],
    is_read: bool
) -> None:
    """Updates cached sender counts and deletes trashed/deleted cached messages in a self-contained DB transaction."""
    async with AsyncSessionLocal() as session:
        sender_rec = await session.get(Sender, email)
        if sender_rec:
            if action_type in ("trash", "permanent_delete"):
                sender_rec.message_count = (
                    0 if affected_count is None else max(0, sender_rec.message_count - affected_count)
                )
                sender_rec.unread_count = 0
                if sender_rec.message_count == 0:
                    sender_rec.total_size_bytes = 0
                await session.execute(
                    delete(ScannedMessage).where(ScannedMessage.sender_email == email)
                )
            elif action_type == "read":
                sender_rec.unread_count = 0 if is_read else sender_rec.message_count
        await session.commit()


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
    demo_mode = not is_authenticated()

    await JobManager.update_job_progress(
        job_id,
        processed=0,
        total=total_senders,
        status="running",
        message=f"Starting {'demo ' if demo_mode else ''}{action_type} for {total_senders} senders..."
    )

    gmail = None if demo_mode else GmailService()
    current_email = "unknown"

    try:
        for idx, email in enumerate(senders):
            current_email = email
            if JobManager.is_cancelled(job_id):
                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_senders,
                    status="cancelled",
                    message="Action cancelled by user."
                )
                return

            if demo_mode:
                await asyncio.sleep(0.12)
                await _update_sender_after_action(email, action_type, None, is_read)
                processed_senders = idx + 1
                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_senders,
                    total=total_senders,
                    success_inc=1,
                    current_item=email,
                    message=f"Processed {email} ({processed_senders}/{total_senders})"
                )
                continue

            await JobManager.update_job_progress(
                job_id,
                processed=processed_senders,
                current_item=email,
                message=f"Processing {email} ({processed_senders + 1}/{total_senders})..."
            )

            query = f"from:{email}"
            if filter_query:
                query += f" {filter_query}"

            message_ids = await gmail.list_message_ids(query=query)
            email_count = len(message_ids)

            if email_count > 0:
                await _apply_gmail_action(
                    gmail, action_type, message_ids, is_read, is_important, label_id, label_action
                )
                total_emails_affected += email_count

            await _update_sender_after_action(email, action_type, email_count, is_read)

            processed_senders += 1
            await JobManager.update_job_progress(
                job_id,
                processed=processed_senders,
                success_inc=1,
                current_item=email,
                message=f"Processed {email}: {email_count} emails affected."
            )

        summary_msg = (
            f"Completed {action_type} on {total_senders} senders!"
            if demo_mode
            else f"Completed {action_type}! {total_emails_affected} total emails modified across {total_senders} senders."
        )
        await JobManager.update_job_progress(
            job_id,
            processed=total_senders,
            total=total_senders,
            status="completed",
            message=summary_msg
        )

    except Exception as e:
        logger.exception("Bulk %s failed on sender %s", action_type, current_email)
        await JobManager.update_job_progress(
            job_id,
            processed=processed_senders,
            status="failed",
            message=f"Operation failed on sender {current_email}",
            error_details=str(e)
        )


@router.post("/trash")
async def trash_senders(req: BulkSenderActionRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("trash", total_items=len(req.senders), message="Preparing to trash emails...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type="trash",
        senders=req.senders,
        filter_query=req.filter_query,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/delete")
async def delete_senders(req: BulkDeleteRequest, bg: BackgroundTasks):
    action_type = "permanent_delete" if req.permanent else "trash"
    job = await JobManager.create_job(action_type, total_items=len(req.senders), message="Preparing to delete emails...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type=action_type,
        senders=req.senders,
        filter_query=req.filter_query,
        permanent_delete=req.permanent,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/archive")
async def archive_senders(req: BulkSenderActionRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("archive", total_items=len(req.senders), message="Preparing to archive emails...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type="archive",
        senders=req.senders,
        filter_query=req.filter_query,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/read")
async def mark_read_senders(req: BulkReadRequest, bg: BackgroundTasks):
    action = "mark_read" if req.read else "mark_unread"
    job = await JobManager.create_job(action, total_items=len(req.senders), message="Preparing to update read status...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type="read",
        senders=req.senders,
        filter_query=req.filter_query,
        is_read=req.read,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/important")
async def mark_important_senders(req: BulkImportantRequest, bg: BackgroundTasks):
    action = "mark_important" if req.important else "unmark_important"
    job = await JobManager.create_job(action, total_items=len(req.senders), message="Preparing to update importance...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type="important",
        senders=req.senders,
        filter_query=req.filter_query,
        is_important=req.important,
    )
    return {"job_id": job.id, "status": "queued"}


@router.post("/label")
async def label_senders(req: BulkLabelRequest, bg: BackgroundTasks):
    job = await JobManager.create_job("label", total_items=len(req.senders), message=f"Applying label {req.label_id}...")
    bg.add_task(
        execute_bulk_action_worker,
        job_id=job.id,
        action_type="label",
        senders=req.senders,
        filter_query=req.filter_query,
        label_id=req.label_id,
        label_action=req.action,
    )
    return {"job_id": job.id, "status": "queued"}
