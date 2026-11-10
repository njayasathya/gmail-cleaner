import ast
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional


def configure_logging(level: int = logging.INFO) -> None:
    """Configures structured application logging without duplicating handlers."""
    root = logging.getLogger("gmail_cleaner")
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    """Returns a namespaced logger under gmail_cleaner."""
    configure_logging()
    return logging.getLogger(f"gmail_cleaner.{name}")


def utc_now() -> datetime:
    """Returns naive UTC datetime compatible with existing SQLite DateTime columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def safe_parse_internal_date(internal_ms: Any) -> Optional[datetime]:
    """
    Safely converts Gmail internalDate (milliseconds since epoch) to a datetime object.
    Uses UTC delta to avoid Windows C-runtime OSError([Errno 22] Invalid argument)
    for negative, zero, or edge-case historical timestamps.
    """
    if not internal_ms:
        return None
    try:
        ts = float(internal_ms) / 1000.0
        if ts < -62135596800:
            return datetime(1970, 1, 1)
        if ts > 253402300799:
            return datetime(2099, 12, 31)
        return datetime(1970, 1, 1) + timedelta(seconds=ts)
    except Exception:
        return None


def parse_label_ids(raw_labels: Optional[str]) -> List[str]:
    """Safely parses serialized label_ids (JSON list or legacy Python list literal)."""
    if not raw_labels or not raw_labels.startswith("["):
        return []
    try:
        parsed = ast.literal_eval(raw_labels) if "'" in raw_labels else json.loads(raw_labels)
        return [str(lbl) for lbl in parsed] if isinstance(parsed, list) else []
    except Exception:
        return []
