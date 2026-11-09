import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_auth_status_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/auth/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "is_authenticated" in data
        assert "is_configured" in data

@pytest.mark.asyncio
async def test_stats_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_senders" in data
        assert "total_emails" in data
        assert "total_unread" in data

@pytest.mark.asyncio
async def test_senders_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/senders?page=1&page_size=10")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "senders" in data
        assert isinstance(data["senders"], list)

@pytest.mark.asyncio
async def test_sender_messages_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/sender-messages?email=return@amazon.com&page=1&page_size=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "messages" in data
        assert "total" in data
        assert data["sender_email"] == "return@amazon.com"

@pytest.mark.asyncio
async def test_export_csv():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/export/csv")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert "Sender Email" in resp.text
        assert "Subject" in resp.text

def test_safe_parse_internal_date_edge_cases():
    from app.routes.scan_routes import safe_parse_internal_date
    from datetime import datetime

    # Negative timestamps (pre-1970) that crash Windows fromtimestamp with [Errno 22]
    d1 = safe_parse_internal_date(-1000)
    assert d1 is not None
    assert d1.year == 1969

    # Astronomical or corrupt values
    d2 = safe_parse_internal_date(999999999999999999)
    assert d2 is not None
    assert d2.year == 2099

    # Standard timestamp
    d3 = safe_parse_internal_date(1794186932000)
    assert d3 is not None
    assert d3.year == 2026

    # None and invalid
    assert safe_parse_internal_date(None) is None
    assert safe_parse_internal_date("invalid_string") is None

@pytest.mark.asyncio
async def test_bulk_action_worker_no_database_lock():
    from app.routes.action_routes import execute_bulk_action_worker
    from app.jobs import JobManager

    job = await JobManager.create_job("trash", total_items=3, message="Test action")
    # Run with multiple senders in demo mode to ensure concurrent sessions don't lock SQLite
    await execute_bulk_action_worker(
        job_id=job.id,
        action_type="trash",
        senders=["test1@example.com", "test2@example.com", "test3@example.com"]
    )
    status = await JobManager.get_job(job.id)
    assert status.status == "completed"
    assert status.processed_items == 3
