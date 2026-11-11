import asyncio
import os
import shutil
import tempfile
from pathlib import Path
import pytest

# Configure isolated temporary data & SQLite DB before importing any app modules
_TEST_TMP_DIR = Path(tempfile.mkdtemp(prefix="gmail_cleaner_pytest_"))
os.environ["DATA_PATH"] = str(_TEST_TMP_DIR)
os.environ["DB_URL"] = f"sqlite+aiosqlite:///{_TEST_TMP_DIR / 'test_cleaner.db'}"
os.environ["TOKEN_PATH"] = str(_TEST_TMP_DIR / "token.json")
os.environ["CREDENTIALS_PATH"] = str(_TEST_TMP_DIR / "credentials.json")

from app.database import init_db, engine  # noqa: E402

_db_initialized = False


@pytest.fixture(autouse=True)
async def ensure_isolated_test_db():
    """Initializes SQLite schema once per test session in an isolated temporary DB."""
    global _db_initialized
    if not _db_initialized:
        await init_db()
        _db_initialized = True
    yield


def pytest_unconfigure(config):
    """Closes async SQLite connections and removes temporary test directory."""
    try:
        asyncio.run(engine.dispose())
    except Exception:
        pass
    shutil.rmtree(_TEST_TMP_DIR, ignore_errors=True)
