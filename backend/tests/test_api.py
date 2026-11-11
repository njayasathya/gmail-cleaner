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
    from unittest.mock import patch
    from app.routes.action_routes import execute_bulk_action_worker
    from app.jobs import JobManager

    with patch("app.routes.action_routes.is_authenticated", return_value=False):
        job = await JobManager.create_job("trash", total_items=3, message="Test action")
        await execute_bulk_action_worker(
            job_id=job.id,
            action_type="trash",
            senders=["__test1@example.com", "__test2@example.com", "__test3@example.com"]
        )
        status = await JobManager.get_job(job.id)
        assert status.status == "completed"
        assert status.processed_items == 3


def test_parse_label_ids_and_gmail_message():
    from app.utils import parse_label_ids
    from app.gmail_service import GmailService
    from app.routes.scan_routes import _parse_gmail_message

    assert parse_label_ids('["INBOX", "UNREAD"]') == ["INBOX", "UNREAD"]
    assert parse_label_ids("['INBOX', 'CATEGORY_UPDATES']") == ["INBOX", "CATEGORY_UPDATES"]
    assert parse_label_ids("invalid") == []
    assert parse_label_ids(None) == []

    gmail = GmailService()
    msg_data = {
        "id": "msg_test_1",
        "threadId": "thr_1",
        "sizeEstimate": 4096,
        "labelIds": ["INBOX", "UNREAD", "CATEGORY_PROMOTIONS"],
        "internalDate": "1794186932000",
        "snippet": "Save 20% today",
        "payload": {
            "headers": [
                {"name": "From", "value": "Deals <deals@shop.example.com>"},
                {"name": "Subject", "value": "Flash Sale"},
                {"name": "List-Unsubscribe", "value": "<https://shop.example.com/unsub>"},
                {"name": "List-Unsubscribe-Post", "value": "List-Unsubscribe=One-Click"},
            ]
        },
    }
    parsed = _parse_gmail_message(msg_data, gmail)
    assert parsed is not None
    meta, record = parsed
    assert meta["email_addr"] == "deals@shop.example.com"
    assert meta["is_unread"] is True
    assert meta["has_one_click"] is True
    assert record.id == "msg_test_1"
    assert record.subject == "Flash Sale"


def test_csv_formula_sanitization():
    from app.routes.export_routes import _sanitize_csv_cell

    assert _sanitize_csv_cell("=CMD|'/C calc'!A0") == "'=CMD|'/C calc'!A0"
    assert _sanitize_csv_cell("+1+1") == "'+1+1"
    assert _sanitize_csv_cell("-2+3") == "'-2+3"
    assert _sanitize_csv_cell("@SUM(1+1)") == "'@SUM(1+1)"
    assert _sanitize_csv_cell("Normal Subject") == "Normal Subject"
    assert _sanitize_csv_cell(42) == 42


@pytest.mark.asyncio
async def test_spa_path_traversal_blocked():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/../../backend/app/config.py")
        # Must never return backend Python source code (falls back to SPA index or 404)
        assert "GOOGLE_CLIENT_SECRET" not in resp.text


