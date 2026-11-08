import asyncio
import json
from typing import List
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from ..schemas import JobResponse
from ..jobs import JobManager

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("", response_model=List[JobResponse])
async def list_jobs(limit: int = 15):
    return await JobManager.list_recent_jobs(limit=limit)

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    job = await JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/{job_id}/stream")
async def stream_job_progress(job_id: str, request: Request):
    job = await JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    queue = JobManager.subscribe(job_id)

    async def event_generator():
        # First send the initial current state
        initial_job = await JobManager.get_job(job_id)
        if initial_job:
            yield {
                "event": "progress",
                "data": json.dumps(initial_job.model_dump(mode="json"))
            }

        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield {
                        "event": "progress",
                        "data": json.dumps(data)
                    }

                    if data.get("status") in ["completed", "failed", "cancelled"]:
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat
                    yield {"event": "ping", "data": "keep-alive"}
        finally:
            JobManager.unsubscribe(job_id, queue)

    return EventSourceResponse(event_generator())

@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    JobManager.cancel_job(job_id)
    return {"status": "cancellation_requested", "job_id": job_id}
