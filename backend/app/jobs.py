import asyncio
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable, Set
from sqlalchemy import select, update, delete
from .database import AsyncSessionLocal
from .models import JobRecord, Sender, ScannedMessage
from .gmail_service import GmailService
from .schemas import JobResponse

# Active running jobs in memory for real-time streaming
active_subscribers: Dict[str, Set[asyncio.Queue]] = {}
cancelled_jobs: Set[str] = set()

class JobManager:
    @staticmethod
    def create_job_id() -> str:
        return str(uuid.uuid4())[:8]

    @staticmethod
    async def create_job(action: str, total_items: int = 0, message: str = "") -> JobRecord:
        job_id = JobManager.create_job_id()
        async with AsyncSessionLocal() as session:
            job = JobRecord(
                id=job_id,
                action=action,
                status="pending",
                total_items=total_items,
                processed_items=0,
                success_count=0,
                error_count=0,
                current_item="",
                message=message,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(job)
            await session.commit()
            await session.refresh(job)
            return job

    @staticmethod
    async def update_job_progress(
        job_id: str,
        processed: int,
        total: Optional[int] = None,
        success_inc: int = 0,
        error_inc: int = 0,
        current_item: str = "",
        message: str = "",
        status: Optional[str] = None,
        error_details: Optional[str] = None
    ):
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(JobRecord).where(JobRecord.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                return

            if total is not None:
                job.total_items = total
            job.processed_items = processed
            job.success_count += success_inc
            job.error_count += error_inc
            if current_item:
                job.current_item = current_item
            if message:
                job.message = message
            if status:
                job.status = status
            if error_details:
                job.error_details = (job.error_details or "") + "\n" + error_details
            job.updated_at = datetime.utcnow()

            await session.commit()
            await session.refresh(job)

            # Broadcast to SSE queues
            percentage = round((job.processed_items / max(job.total_items, 1)) * 100, 1) if job.total_items > 0 else 0
            payload = {
                "id": job.id,
                "action": job.action,
                "status": job.status,
                "total_items": job.total_items,
                "processed_items": job.processed_items,
                "success_count": job.success_count,
                "error_count": job.error_count,
                "current_item": job.current_item,
                "message": job.message,
                "error_details": job.error_details,
                "percentage": percentage,
                "updated_at": job.updated_at.isoformat()
            }
            JobManager._broadcast(job_id, payload)

    @staticmethod
    def cancel_job(job_id: str):
        cancelled_jobs.add(job_id)

    @staticmethod
    def is_cancelled(job_id: str) -> bool:
        return job_id in cancelled_jobs

    @staticmethod
    def subscribe(job_id: str) -> asyncio.Queue:
        if job_id not in active_subscribers:
            active_subscribers[job_id] = set()
        queue = asyncio.Queue()
        active_subscribers[job_id].add(queue)
        return queue

    @staticmethod
    def unsubscribe(job_id: str, queue: asyncio.Queue):
        if job_id in active_subscribers and queue in active_subscribers[job_id]:
            active_subscribers[job_id].remove(queue)
            if not active_subscribers[job_id]:
                del active_subscribers[job_id]

    @staticmethod
    def _broadcast(job_id: str, payload: dict):
        if job_id in active_subscribers:
            for q in list(active_subscribers[job_id]):
                try:
                    q.put_nowait(payload)
                except asyncio.QueueFull:
                    pass

    @staticmethod
    async def get_job(job_id: str) -> Optional[JobResponse]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(JobRecord).where(JobRecord.id == job_id))
            job = result.scalar_one_or_none()
            if not job:
                return None
            percentage = round((job.processed_items / max(job.total_items, 1)) * 100, 1) if job.total_items > 0 else 0
            res = JobResponse.model_validate(job)
            res.percentage = percentage
            return res

    @staticmethod
    async def list_recent_jobs(limit: int = 15) -> List[JobResponse]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(JobRecord).order_by(JobRecord.created_at.desc()).limit(limit)
            )
            jobs = result.scalars().all()
            output = []
            for j in jobs:
                pct = round((j.processed_items / max(j.total_items, 1)) * 100, 1) if j.total_items > 0 else 0
                item = JobResponse.model_validate(j)
                item.percentage = pct
                output.append(item)
            return output
