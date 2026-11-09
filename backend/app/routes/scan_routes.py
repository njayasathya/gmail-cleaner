import asyncio
import json
import ast
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, case, delete
import httpx
from ..database import get_db, AsyncSessionLocal
from ..models import Sender, ScannedMessage, UserSession
from ..schemas import (
    SenderListResponse, SenderResponse, StatsResponse,
    SenderMessagesResponse, EmailMessageItem, IndividualMessageActionRequest
)
from ..gmail_service import GmailService
from ..jobs import JobManager
from ..auth import is_authenticated

router = APIRouter(prefix="", tags=["scan & senders"])

async def run_scan_worker(job_id: str, query: str, max_emails: int):
    if not is_authenticated():
        # Demo simulation mode when Google OAuth is not yet connected
        demo_total = min(max_emails, 500)
        for i in range(0, demo_total + 1, 50):
            if JobManager.is_cancelled(job_id):
                await JobManager.update_job_progress(job_id, processed=i, status="cancelled", message="Scan cancelled.")
                return
            await asyncio.sleep(0.1)
            await JobManager.update_job_progress(
                job_id,
                processed=i,
                total=demo_total,
                status="running",
                current_item=f"Simulating Gmail batch {i//50 + 1}",
                message=f"Demo scan in progress: {i} of {demo_total} emails..."
            )
        async with AsyncSessionLocal() as session:
            from .auth_routes import seed_demo_data
            await seed_demo_data(session)

        await JobManager.update_job_progress(
            job_id,
            processed=demo_total,
            total=demo_total,
            status="completed",
            message=f"Demo scan complete! Cataloged {demo_total} sample emails."
        )
        return

    gmail = GmailService()
    try:
        # Default query targets incoming mail, excluding user's own sent emails and drafts
        effective_query = query.strip()
        if not effective_query:
            effective_query = "-in:sent -in:draft"
        elif effective_query.lower() in ["all", "in:all"]:
            effective_query = ""

        # Fetch active user's email to avoid treating the user as their own spam sender
        user_email = ""
        async with AsyncSessionLocal() as session:
            sess_res = await session.execute(select(UserSession).where(UserSession.is_active == True))
            u_sess = sess_res.scalar_one_or_none()
            if u_sess and u_sess.email:
                user_email = u_sess.email.strip().lower()

        await JobManager.update_job_progress(
            job_id,
            processed=0,
            total=100,
            status="running",
            message="Connecting to Gmail and fetching email list..."
        )

        message_ids = await gmail.list_message_ids(query=effective_query, max_results=max_emails)
        total_found = len(message_ids)

        if total_found == 0:
            await JobManager.update_job_progress(
                job_id,
                processed=100,
                total=100,
                status="completed",
                message="No emails found matching query."
            )
            return

        await JobManager.update_job_progress(
            job_id,
            processed=0,
            total=total_found,
            message=f"Found {total_found} emails. Fetching headers..."
        )

        batch_size = 25
        processed_count = 0
        semaphore = asyncio.Semaphore(5)

        # Temporary aggregations
        sender_aggr: dict = {}
        message_records: list = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            for i in range(0, total_found, batch_size):
                if JobManager.is_cancelled(job_id):
                    await JobManager.update_job_progress(job_id, processed=processed_count, status="cancelled", message="Scan cancelled by user.")
                    return

                chunk = message_ids[i:i + batch_size]
                
                async def fetch_meta(mid):
                    async with semaphore:
                        return await gmail.fetch_message_metadata(client, mid)

                results = await asyncio.gather(*[fetch_meta(mid) for mid in chunk])
                await asyncio.sleep(0.8)

                for msg_data in results:
                    if not msg_data:
                        continue
                    
                    mid = msg_data.get("id")
                    thread_id = msg_data.get("threadId", "")
                    size_estimate = int(msg_data.get("sizeEstimate", 0))
                    label_ids = msg_data.get("labelIds", [])
                    is_unread = "UNREAD" in label_ids

                    headers = {h["name"].lower(): h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
                    from_header = headers.get("from", "")
                    subject = headers.get("subject", "(No Subject)")
                    date_header = headers.get("date", "")
                    unsub_header = headers.get("list-unsubscribe", "")
                    unsub_post_header = headers.get("list-unsubscribe-post", "")

                    name, email_addr, domain = gmail.parse_sender_info(from_header)
                    if not email_addr:
                        continue
                    if user_email and email_addr.lower() == user_email:
                        continue

                    http_url, mailto_uri, has_one_click = gmail.parse_unsubscribe_header(unsub_header, unsub_post_header)

                    if email_addr not in sender_aggr:
                        sender_aggr[email_addr] = {
                            "name": name,
                            "domain": domain,
                            "count": 0,
                            "unread_count": 0,
                            "size": 0,
                            "has_unsub": bool(http_url or mailto_uri),
                            "unsub_url": http_url,
                            "unsub_mailto": mailto_uri,
                            "has_one_click": has_one_click,
                            "sample_subject": subject,
                            "categories": set()
                        }

                    s = sender_aggr[email_addr]
                    s["count"] += 1
                    if is_unread:
                        s["unread_count"] += 1
                    s["size"] += size_estimate

                    # Check labels for categories
                    for lbl in label_ids:
                        if lbl.startswith("CATEGORY_"):
                            s["categories"].add(lbl.replace("CATEGORY_", "").lower())

                    internal_ms = msg_data.get("internalDate")
                    msg_date = datetime.fromtimestamp(int(internal_ms) / 1000) if internal_ms else None

                    message_records.append(
                        ScannedMessage(
                            id=mid,
                            thread_id=thread_id,
                            sender_email=email_addr,
                            sender_name=name,
                            subject=subject,
                            snippet=msg_data.get("snippet", ""),
                            date=msg_date,
                            size_estimate=size_estimate,
                            label_ids=json.dumps(label_ids),
                            has_unsubscribe=bool(http_url or mailto_uri),
                            unsubscribe_url=http_url,
                            unsubscribe_mailto=mailto_uri,
                            has_one_click=has_one_click
                        )
                    )

                processed_count += len(chunk)
                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_count,
                    total=total_found,
                    current_item=f"{len(sender_aggr)} unique senders discovered",
                    message=f"Processed {processed_count} of {total_found} emails..."
                )

        # Commit aggregated senders & messages to DB
        async with AsyncSessionLocal() as session:
            for email_addr, data in sender_aggr.items():
                existing = await session.get(Sender, email_addr)
                cats_str = ",".join(sorted(list(data["categories"])))
                if existing:
                    existing.name = data["name"] or existing.name
                    existing.domain = data["domain"] or existing.domain
                    existing.message_count = data["count"]
                    existing.unread_count = data["unread_count"]
                    existing.total_size_bytes = data["size"]
                    if data["has_unsub"]:
                        existing.has_unsubscribe = True
                        existing.unsubscribe_url = data["unsub_url"] or existing.unsubscribe_url
                        existing.unsubscribe_mailto = data["unsub_mailto"] or existing.unsubscribe_mailto
                        existing.has_one_click = data["has_one_click"] or existing.has_one_click
                    existing.categories = cats_str
                    existing.sample_subject = data["sample_subject"] or existing.sample_subject
                    existing.updated_at = datetime.utcnow()
                else:
                    new_sender = Sender(
                        email=email_addr,
                        name=data["name"],
                        domain=data["domain"],
                        message_count=data["count"],
                        unread_count=data["unread_count"],
                        total_size_bytes=data["size"],
                        has_unsubscribe=data["has_unsub"],
                        unsubscribe_url=data["unsub_url"],
                        unsubscribe_mailto=data["unsub_mailto"],
                        has_one_click=data["has_one_click"],
                        categories=cats_str,
                        sample_subject=data["sample_subject"],
                        last_received_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    session.add(new_sender)

            # Insert or update messages (ignore duplicates)
            for m in message_records[:5000]:  # Cap stored individual messages to 5000
                m_existing = await session.get(ScannedMessage, m.id)
                if not m_existing:
                    session.add(m)
                else:
                    m_existing.subject = m.subject
                    m_existing.snippet = m.snippet
                    m_existing.date = m.date
                    m_existing.size_estimate = m.size_estimate
                    m_existing.label_ids = m.label_ids

            # Update UserSession scan stats
            sess_res = await session.execute(select(UserSession).where(UserSession.is_active == True))
            u_sess = sess_res.scalar_one_or_none()
            if u_sess:
                u_sess.last_scan_at = datetime.utcnow()
                u_sess.total_scanned_emails = total_found

            await session.commit()

        await JobManager.update_job_progress(
            job_id,
            processed=total_found,
            total=total_found,
            status="completed",
            message=f"Scan complete! Discovered {len(sender_aggr)} unique senders across {total_found} emails."
        )

    except Exception as e:
        await JobManager.update_job_progress(
            job_id,
            processed=0,
            status="failed",
            message="Scan failed.",
            error_details=str(e)
        )

@router.post("/scan")
async def trigger_scan(
    background_tasks: BackgroundTasks,
    query: str = Query("", description="Gmail search query, e.g. 'in:inbox' or 'category:promotions'"),
    max_emails: int = Query(1000, ge=50, le=10000, description="Max emails to scan")
):
    job = await JobManager.create_job("scan", total_items=max_emails, message="Initializing scanner...")
    background_tasks.add_task(run_scan_worker, job.id, query, max_emails)
    return {"job_id": job.id, "status": "queued"}

@router.get("/senders", response_model=SenderListResponse)
async def list_senders(
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = None,
    category: Optional[str] = None,
    has_unsubscribe: Optional[bool] = None,
    is_unsubscribed: Optional[bool] = None,
    sort_by: str = Query("count", pattern="^(count|size|unread|domain|name)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    stmt = select(Sender)

    if q:
        search_pattern = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                Sender.email.ilike(search_pattern),
                Sender.name.ilike(search_pattern),
                Sender.domain.ilike(search_pattern),
                Sender.sample_subject.ilike(search_pattern)
            )
        )

    if category:
        stmt = stmt.where(Sender.categories.ilike(f"%{category.lower()}%"))

    if has_unsubscribe is not None:
        stmt = stmt.where(Sender.has_unsubscribe == has_unsubscribe)

    if is_unsubscribed is not None:
        stmt = stmt.where(Sender.is_unsubscribed == is_unsubscribed)

    # Count total matching
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Sorting
    sort_col = Sender.message_count
    if sort_by == "size":
        sort_col = Sender.total_size_bytes
    elif sort_by == "unread":
        sort_col = Sender.unread_count
    elif sort_by == "domain":
        sort_col = Sender.domain
    elif sort_by == "name":
        sort_col = Sender.name

    if order == "desc":
        stmt = stmt.order_by(desc(sort_col))
    else:
        stmt = stmt.order_by(asc(sort_col))

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    senders = result.scalars().all()

    return SenderListResponse(
        total=total,
        page=page,
        page_size=page_size,
        senders=[SenderResponse.model_validate(s) for s in senders]
    )

@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db)):
    # Aggregates from DB
    res = await db.execute(
        select(
            func.count(Sender.email),
            func.coalesce(func.sum(Sender.message_count), 0),
            func.coalesce(func.sum(Sender.unread_count), 0),
            func.coalesce(func.sum(Sender.total_size_bytes), 0),
            func.coalesce(func.sum(case((Sender.has_unsubscribe == True, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Sender.is_unsubscribed == True, 1), else_=0)), 0),
        )
    )
    senders_cnt, emails_cnt, unread_cnt, size_bytes, news_cnt, unsub_cnt = res.one()

    # User session details
    sess_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    user_sess = sess_res.scalar_one_or_none()

    return StatsResponse(
        total_senders=senders_cnt,
        total_emails=emails_cnt,
        total_unread=unread_cnt,
        total_size_bytes=size_bytes,
        newsletters_count=news_cnt,
        unsubscribed_count=unsub_cnt,
        user_email=user_sess.email if user_sess else None,
        user_name=user_sess.name if user_sess else None,
        user_picture=user_sess.picture if user_sess else None,
        is_authenticated=is_authenticated(),
        last_scan_at=user_sess.last_scan_at if user_sess else None
    )

@router.api_route("/scan/reset", methods=["GET", "POST"])
async def reset_scan_database(db: AsyncSession = Depends(get_db)):
    """
    Clears all scanned senders and messages from the local SQLite cache so you can perform a fresh sweep.
    """
    await db.execute(delete(ScannedMessage))
    await db.execute(delete(Sender))
    sess_res = await db.execute(select(UserSession).where(UserSession.is_active == True))
    user_sess = sess_res.scalar_one_or_none()
    if user_sess:
        user_sess.total_scanned_emails = 0
        user_sess.total_freed_bytes = 0
        user_sess.last_scan_at = None
    await db.commit()
    return {"status": "cleared"}

@router.get("/sender-messages", response_model=SenderMessagesResponse)
async def get_sender_messages(
    email: str = Query(..., description="Sender email address"),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    import json
    clean_email = email.strip().lower()
    sender = await db.get(Sender, clean_email)
    sender_name = sender.name if sender else clean_email

    # Query cached messages in SQLite
    stmt = (
        select(ScannedMessage)
        .where(ScannedMessage.sender_email == clean_email)
        .order_by(ScannedMessage.id.desc())
    )
    result = await db.execute(stmt)
    cached_messages = result.scalars().all()

    # If few cached messages and user is authenticated, fetch live messages from Gmail
    if len(cached_messages) < 10 and is_authenticated():
        try:
            gmail = GmailService()
            msg_ids = await gmail.list_message_ids(query=f"from:{clean_email}", max_results=30)
            if msg_ids:
                semaphore = asyncio.Semaphore(15)
                async with httpx.AsyncClient(timeout=20.0) as client:
                    async def fetch_meta(mid):
                        async with semaphore:
                            return await gmail.fetch_message_metadata(client, mid)
                    raw_results = await asyncio.gather(*[fetch_meta(mid) for mid in msg_ids])

                    for msg_data in raw_results:
                        if not msg_data:
                            continue
                        mid = msg_data.get("id")
                        existing = await db.get(ScannedMessage, mid)
                        if not existing:
                            headers = {h["name"].lower(): h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
                            from_h = headers.get("from", "")
                            s_name, s_email, _ = gmail.parse_sender_info(from_h)
                            subject = headers.get("subject", "(No Subject)")
                            unsub_h = headers.get("list-unsubscribe", "")
                            unsub_post_h = headers.get("list-unsubscribe-post", "")
                            http_url, mailto_uri, has_one_click = gmail.parse_unsubscribe_header(unsub_h, unsub_post_h)
                            lbl_ids = msg_data.get("labelIds", [])
                            internal_ms = msg_data.get("internalDate")
                            msg_date = datetime.fromtimestamp(int(internal_ms) / 1000) if internal_ms else None

                            new_m = ScannedMessage(
                                id=mid,
                                thread_id=msg_data.get("threadId", mid),
                                sender_email=clean_email,
                                sender_name=s_name or sender_name,
                                subject=subject,
                                snippet=msg_data.get("snippet", ""),
                                date=msg_date,
                                size_estimate=int(msg_data.get("sizeEstimate", 0)),
                                label_ids=json.dumps(lbl_ids),
                                has_unsubscribe=bool(http_url or mailto_uri),
                                unsubscribe_url=http_url,
                                unsubscribe_mailto=mailto_uri,
                                has_one_click=has_one_click
                            )
                            db.add(new_m)
                    await db.commit()

                # Re-query
                res2 = await db.execute(stmt)
                cached_messages = res2.scalars().all()
        except Exception as e:
            print(f"Error fetching live messages for {clean_email}: {e}")

    # Build response items
    items = []
    for m in cached_messages:
        try:
            if m.label_ids and m.label_ids.startswith("["):
                labels_list = ast.literal_eval(m.label_ids) if "'" in m.label_ids else json.loads(m.label_ids)
            else:
                labels_list = []
        except Exception:
            labels_list = []
        is_unread = "UNREAD" in labels_list

        items.append(
            EmailMessageItem(
                id=m.id,
                thread_id=m.thread_id or m.id,
                sender_email=m.sender_email,
                sender_name=m.sender_name or sender_name,
                subject=m.subject or "(No Subject)",
                snippet=m.snippet or "",
                date=m.date,
                size_estimate=m.size_estimate,
                label_ids=labels_list,
                is_unread=is_unread,
                has_unsubscribe=m.has_unsubscribe,
                gmail_url=f"https://mail.google.com/mail/u/0/#all/{m.thread_id or m.id}"
            )
        )

    # Slice for pagination
    start = (page - 1) * page_size
    paged_items = items[start:start + page_size]

    return SenderMessagesResponse(
        sender_email=clean_email,
        sender_name=sender_name,
        total=len(items),
        messages=paged_items
    )

@router.post("/messages/trash")
async def trash_specific_messages(req: IndividualMessageActionRequest, db: AsyncSession = Depends(get_db)):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        await gmail.batch_modify(req.message_ids, add_labels=["TRASH"], remove_labels=["INBOX"])
    await db.execute(delete(ScannedMessage).where(ScannedMessage.id.in_(req.message_ids)))
    await db.commit()
    return {"status": "trashed", "count": len(req.message_ids)}

@router.post("/messages/delete")
async def delete_specific_messages(req: IndividualMessageActionRequest, db: AsyncSession = Depends(get_db)):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        await gmail.batch_delete(req.message_ids)
    await db.execute(delete(ScannedMessage).where(ScannedMessage.id.in_(req.message_ids)))
    await db.commit()
    return {"status": "permanently_deleted", "count": len(req.message_ids)}

@router.post("/messages/read")
async def mark_read_specific_messages(req: IndividualMessageActionRequest, read: bool = True, db: AsyncSession = Depends(get_db)):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        if read:
            await gmail.batch_modify(req.message_ids, remove_labels=["UNREAD"])
        else:
            await gmail.batch_modify(req.message_ids, add_labels=["UNREAD"])
    return {"status": "updated", "count": len(req.message_ids)}
