import asyncio
import json
from typing import Optional, List, Dict, Any, Tuple, Set
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc, or_, case, delete
import httpx

from ..config import settings
from ..database import get_db, AsyncSessionLocal
from ..models import Sender, ScannedMessage, UserSession
from ..schemas import (
    SenderListResponse, SenderResponse, StatsResponse,
    SenderMessagesResponse, EmailMessageItem, IndividualMessageActionRequest
)
from ..gmail_service import GmailService
from ..jobs import JobManager
from ..auth import is_authenticated
from ..utils import get_logger, utc_now, safe_parse_internal_date, parse_label_ids

logger = get_logger("scan_routes")
router = APIRouter(prefix="", tags=["scan & senders"])


def _parse_gmail_message(
    msg_data: Dict[str, Any],
    gmail: GmailService,
    forced_sender_email: Optional[str] = None,
    fallback_sender_name: str = ""
) -> Optional[Tuple[Dict[str, Any], ScannedMessage]]:
    """Extracts normalized metadata and constructs a ScannedMessage ORM instance."""
    mid = msg_data.get("id")
    if not mid:
        return None

    thread_id = msg_data.get("threadId", "") or mid
    size_estimate = int(msg_data.get("sizeEstimate", 0))
    label_ids = msg_data.get("labelIds", []) or []

    headers = {
        h["name"].lower(): h["value"]
        for h in msg_data.get("payload", {}).get("headers", [])
    }
    from_header = headers.get("from", "")
    subject = headers.get("subject", "(No Subject)")
    unsub_header = headers.get("list-unsubscribe", "")
    unsub_post_header = headers.get("list-unsubscribe-post", "")

    name, parsed_email, domain = gmail.parse_sender_info(from_header)
    email_addr = forced_sender_email or parsed_email
    if not email_addr:
        email_addr = "unknown@unknown.domain"
        name = name or "Unknown Sender"
        domain = "unknown.domain"
    elif forced_sender_email and not domain and "@" in forced_sender_email:
        domain = forced_sender_email.split("@")[-1]

    resolved_name = name or fallback_sender_name
    http_url, mailto_uri, has_one_click = gmail.parse_unsubscribe_header(
        unsub_header, unsub_post_header
    )
    msg_date = safe_parse_internal_date(msg_data.get("internalDate"))

    record = ScannedMessage(
        id=mid,
        thread_id=thread_id,
        sender_email=email_addr,
        sender_name=resolved_name,
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
    meta = {
        "email_addr": email_addr,
        "name": resolved_name,
        "domain": domain,
        "subject": subject,
        "size_estimate": size_estimate,
        "label_ids": label_ids,
        "is_unread": "UNREAD" in label_ids,
        "has_unsub": bool(http_url or mailto_uri),
        "unsub_url": http_url,
        "unsub_mailto": mailto_uri,
        "has_one_click": has_one_click,
    }
    return meta, record


async def _upsert_scanned_messages(session: AsyncSession, messages: List[ScannedMessage]) -> None:
    """Inserts new ScannedMessage records or refreshes mutable metadata on existing ones."""
    for m in messages:
        existing = await session.get(ScannedMessage, m.id)
        if not existing:
            session.add(m)
        else:
            existing.subject = m.subject
            existing.snippet = m.snippet
            existing.date = m.date
            existing.size_estimate = m.size_estimate
            existing.label_ids = m.label_ids


async def _sync_sender_stats_from_messages(
    session: AsyncSession,
    target_emails: Optional[Set[str]] = None
) -> None:
    """Recomputes Sender counts and sizes from ScannedMessage as the single source of truth."""
    cnt_query = select(
        ScannedMessage.sender_email,
        func.count(ScannedMessage.id),
        func.sum(case((ScannedMessage.label_ids.like('%"UNREAD"%'), 1), else_=0)),
        func.sum(ScannedMessage.size_estimate)
    ).group_by(ScannedMessage.sender_email)

    if target_emails:
        cnt_query = cnt_query.where(ScannedMessage.sender_email.in_(target_emails))

    cnt_res = await session.execute(cnt_query)
    stats_map = {
        s_email: (m_cnt, u_cnt or 0, s_bytes or 0)
        for s_email, m_cnt, u_cnt, s_bytes in cnt_res.all()
    }

    emails_to_update = target_emails if target_emails else set(stats_map.keys())
    for s_email in emails_to_update:
        s_obj = await session.get(Sender, s_email)
        if s_obj:
            m_cnt, u_cnt, s_bytes = stats_map.get(s_email, (0, 0, 0))
            s_obj.message_count = m_cnt
            s_obj.unread_count = u_cnt
            s_obj.total_size_bytes = s_bytes


async def _commit_senders_and_sync(
    sender_aggr: Dict[str, Dict[str, Any]],
    batch_messages: List[ScannedMessage],
    fallback_count: int
) -> int:
    """Flushes pending messages, upserts discovered senders, and syncs totals cleanly."""
    now = utc_now()
    async with AsyncSessionLocal() as session:
        if batch_messages:
            await _upsert_scanned_messages(session, batch_messages)
            batch_messages.clear()

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
                existing.updated_at = now
            else:
                session.add(
                    Sender(
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
                        last_received_at=now,
                        updated_at=now
                    )
                )

        await session.commit()

        await _sync_sender_stats_from_messages(session)

        total_cataloged_res = await session.execute(select(func.count(ScannedMessage.id)))
        total_cataloged = total_cataloged_res.scalar() or fallback_count

        sess_res = await session.execute(select(UserSession).where(UserSession.is_active == True))
        u_sess = sess_res.scalar_one_or_none()
        if u_sess:
            u_sess.last_scan_at = now
            u_sess.total_scanned_emails = total_cataloged

        await session.commit()
        return total_cataloged


async def _run_demo_scan(job_id: str, max_emails: int) -> None:
    """Simulates a Gmail scan and populates realistic sample data when unauthenticated."""
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
            current_item=f"Simulating Gmail batch {i // 50 + 1}",
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


async def run_scan_worker(job_id: str, query: str, max_emails: int):
    if not is_authenticated():
        await _run_demo_scan(job_id, max_emails)
        return

    gmail = GmailService()
    try:
        effective_query = query.strip()
        if not effective_query:
            effective_query = "-in:sent -in:draft"
        elif effective_query.lower() in ["all", "in:all"]:
            effective_query = ""

        # Fetch active user's email to avoid indexing the user as their own sender
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
        sender_aggr: Dict[str, Dict[str, Any]] = {}
        batch_messages: List[ScannedMessage] = []

        limits = httpx.Limits(max_keepalive_connections=50, max_connections=100)
        async with httpx.AsyncClient(timeout=35.0, limits=limits) as client:
            for i in range(0, total_found, batch_size):
                if JobManager.is_cancelled(job_id):
                    await _commit_senders_and_sync(sender_aggr, batch_messages, processed_count)
                    await JobManager.update_job_progress(
                        job_id,
                        processed=processed_count,
                        status="cancelled",
                        message="Scan cancelled by user."
                    )
                    return

                chunk = message_ids[i:i + batch_size]

                async def on_batch_rate_limit(num_pending: int, delay: float):
                    await JobManager.update_job_progress(
                        job_id,
                        processed=processed_count,
                        total=total_found,
                        current_item=f"{len(sender_aggr)} senders discovered",
                        message=f"Gmail rate limit reached. Pausing {delay:.0f}s for quota window to reset ({num_pending} pending in batch)..."
                    )

                results = await gmail.batch_fetch_messages_metadata(client, chunk, on_rate_limit=on_batch_rate_limit)

                for msg_data in results:
                    if not msg_data:
                        continue
                    try:
                        parsed = _parse_gmail_message(msg_data, gmail)
                        if not parsed:
                            continue
                        meta, record = parsed
                        email_addr = meta["email_addr"]
                        if user_email and email_addr.lower() == user_email:
                            continue

                        if email_addr not in sender_aggr:
                            sender_aggr[email_addr] = {
                                "name": meta["name"],
                                "domain": meta["domain"],
                                "count": 0,
                                "unread_count": 0,
                                "size": 0,
                                "has_unsub": meta["has_unsub"],
                                "unsub_url": meta["unsub_url"],
                                "unsub_mailto": meta["unsub_mailto"],
                                "has_one_click": meta["has_one_click"],
                                "sample_subject": meta["subject"],
                                "categories": set()
                            }

                        s = sender_aggr[email_addr]
                        s["count"] += 1
                        if meta["is_unread"]:
                            s["unread_count"] += 1
                        s["size"] += meta["size_estimate"]

                        for lbl in meta["label_ids"]:
                            if lbl.startswith("CATEGORY_"):
                                s["categories"].add(lbl.replace("CATEGORY_", "").lower())

                        batch_messages.append(record)
                    except Exception as err:
                        logger.warning("Failed parsing message %s: %s", msg_data.get("id", "unknown"), err)
                        continue

                processed_count += len(results)

                if len(batch_messages) >= 100:
                    async with AsyncSessionLocal() as session:
                        await _upsert_scanned_messages(session, batch_messages)
                        await session.commit()
                    batch_messages.clear()

                await JobManager.update_job_progress(
                    job_id,
                    processed=processed_count,
                    total=total_found,
                    current_item=f"{len(sender_aggr)} unique senders discovered",
                    message=f"Processed {processed_count} of {total_found} emails..."
                )

                # Gentle pacing between batches of 25 to stay within Gmail's per-user minute quota
                await asyncio.sleep(0.5)

        total_cataloged = await _commit_senders_and_sync(sender_aggr, batch_messages, processed_count)

        await JobManager.update_job_progress(
            job_id,
            processed=total_found,
            total=total_found,
            status="completed",
            message=f"Scan complete! Discovered {len(sender_aggr)} unique senders across {total_cataloged} cataloged emails."
        )

    except Exception as e:
        logger.exception("Inbox scan failed for job %s", job_id)
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

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    sort_col_map = {
        "size": Sender.total_size_bytes,
        "unread": Sender.unread_count,
        "domain": Sender.domain,
        "name": Sender.name,
        "count": Sender.message_count,
    }
    sort_col = sort_col_map.get(sort_by, Sender.message_count)
    stmt = stmt.order_by(desc(sort_col) if order == "desc" else asc(sort_col))

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
        is_demo_mode=settings.DEMO_MODE,
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
    clean_email = email.strip().lower()
    sender = await db.get(Sender, clean_email)
    sender_name = sender.name if sender else clean_email

    stmt = (
        select(ScannedMessage)
        .where(ScannedMessage.sender_email == clean_email)
        .order_by(desc(ScannedMessage.date).nulls_last(), desc(ScannedMessage.id))
    )
    result = await db.execute(stmt)
    cached_messages = result.scalars().all()

    # If few cached messages and authenticated, backfill recent ones live from Gmail
    if len(cached_messages) < 10 and is_authenticated():
        try:
            gmail = GmailService()
            msg_ids = await gmail.list_message_ids(query=f"from:{clean_email}", max_results=30)
            if msg_ids:
                semaphore = asyncio.Semaphore(15)
                async with httpx.AsyncClient(timeout=20.0) as client:
                    async def fetch_meta(mid: str):
                        async with semaphore:
                            return await gmail.fetch_message_metadata(client, mid)

                    raw_results = await asyncio.gather(*[fetch_meta(mid) for mid in msg_ids])
                    new_records: List[ScannedMessage] = []
                    for msg_data in raw_results:
                        if not msg_data:
                            continue
                        mid = msg_data.get("id")
                        if not mid or await db.get(ScannedMessage, mid):
                            continue
                        parsed = _parse_gmail_message(
                            msg_data,
                            gmail,
                            forced_sender_email=clean_email,
                            fallback_sender_name=sender_name,
                        )
                        if parsed:
                            new_records.append(parsed[1])

                    if new_records:
                        for record in new_records:
                            db.add(record)
                        await db.commit()
                        res2 = await db.execute(stmt)
                        cached_messages = res2.scalars().all()
        except Exception as e:
            logger.warning("Failed fetching live messages for %s: %s", clean_email, e)

    items = []
    for m in cached_messages:
        labels_list = parse_label_ids(m.label_ids)
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
                is_unread="UNREAD" in labels_list,
                has_unsubscribe=m.has_unsubscribe,
                gmail_url=f"https://mail.google.com/mail/u/0/#all/{m.thread_id or m.id}"
            )
        )

    start = (page - 1) * page_size
    paged_items = items[start:start + page_size]

    return SenderMessagesResponse(
        sender_email=clean_email,
        sender_name=sender_name,
        total=len(items),
        messages=paged_items
    )


async def _delete_cached_messages_and_sync(
    db: AsyncSession, message_ids: List[str]
) -> None:
    """Removes deleted/trashed messages from cache and resyncs affected sender totals."""
    res = await db.execute(
        select(ScannedMessage.sender_email).where(ScannedMessage.id.in_(message_ids))
    )
    affected_emails = {row[0] for row in res.all() if row[0]}
    await db.execute(delete(ScannedMessage).where(ScannedMessage.id.in_(message_ids)))
    await db.flush()
    if affected_emails:
        await _sync_sender_stats_from_messages(db, affected_emails)
    await db.commit()


@router.post("/messages/trash")
async def trash_specific_messages(req: IndividualMessageActionRequest, db: AsyncSession = Depends(get_db)):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        await gmail.batch_modify(req.message_ids, add_labels=["TRASH"], remove_labels=["INBOX"])
    await _delete_cached_messages_and_sync(db, req.message_ids)
    return {"status": "trashed", "count": len(req.message_ids)}


@router.post("/messages/delete")
async def delete_specific_messages(req: IndividualMessageActionRequest, db: AsyncSession = Depends(get_db)):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        await gmail.batch_delete(req.message_ids)
    await _delete_cached_messages_and_sync(db, req.message_ids)
    return {"status": "permanently_deleted", "count": len(req.message_ids)}


@router.post("/messages/read")
async def mark_read_specific_messages(
    req: IndividualMessageActionRequest,
    read: bool = True,
    db: AsyncSession = Depends(get_db)
):
    if not req.message_ids:
        return {"count": 0}
    if is_authenticated():
        gmail = GmailService()
        if read:
            await gmail.batch_modify(req.message_ids, remove_labels=["UNREAD"])
        else:
            await gmail.batch_modify(req.message_ids, add_labels=["UNREAD"])

    res = await db.execute(select(ScannedMessage).where(ScannedMessage.id.in_(req.message_ids)))
    affected_emails: Set[str] = set()
    for msg in res.scalars().all():
        labels = parse_label_ids(msg.label_ids)
        if read:
            labels = [lbl for lbl in labels if lbl != "UNREAD"]
        elif "UNREAD" not in labels:
            labels.append("UNREAD")
        msg.label_ids = json.dumps(labels)
        if msg.sender_email:
            affected_emails.add(msg.sender_email)

    await db.flush()
    if affected_emails:
        await _sync_sender_stats_from_messages(db, affected_emails)
    await db.commit()
    return {"status": "updated", "count": len(req.message_ids)}
