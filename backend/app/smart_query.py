from datetime import datetime, timedelta
import re
import shlex
from typing import Dict, List, Optional
from sqlalchemy import and_, not_, or_, select
from sqlalchemy.sql.elements import ColumnElement

from .models import ScannedMessage
from .utils import utc_now

_SIZE_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*([kmg])?b?$", re.IGNORECASE)
_AGE_RE = re.compile(r"^(\d+)\s*([dwmy])$", re.IGNORECASE)

_SIZE_MULTIPLIERS: Dict[str, int] = {
    "k": 1024,
    "m": 1024 ** 2,
    "g": 1024 ** 3,
}

_AGE_DAYS: Dict[str, int] = {
    "d": 1,
    "w": 7,
    "m": 30,
    "y": 365,
}

_STANDARD_CATEGORIES = ("promotions", "social", "updates", "forums")


def parse_size_bytes(raw: str) -> Optional[int]:
    """Converts Gmail size literals such as '5M', '10MB', or '500K' into bytes."""
    match = _SIZE_RE.match(raw.strip())
    if not match:
        return None
    amount = float(match.group(1))
    unit = (match.group(2) or "").lower()
    multiplier = _SIZE_MULTIPLIERS.get(unit, 1)
    return int(amount * multiplier)


def parse_age_days(raw: str) -> Optional[int]:
    """Converts Gmail relative date tokens such as '30d', '2w', '6m', or '1y' into days."""
    match = _AGE_RE.match(raw.strip())
    if not match:
        return None
    amount = int(match.group(1))
    unit = match.group(2).lower()
    return amount * _AGE_DAYS[unit]


def _tokenize_query(query: str) -> List[str]:
    try:
        return shlex.split(query)
    except ValueError:
        return query.split()


def _category_clause(cat_name: str) -> Optional[ColumnElement[bool]]:
    cat = cat_name.strip().lower()
    if not cat:
        return None
    if cat == "primary":
        non_primary = [
            ScannedMessage.label_ids.like(f'%"CATEGORY_{c.upper()}"%')
            for c in _STANDARD_CATEGORIES
        ]
        return or_(
            ScannedMessage.label_ids.like('%"CATEGORY_PERSONAL"%'),
            not_(or_(*non_primary)),
        )
    if cat in _STANDARD_CATEGORIES or cat == "personal":
        return ScannedMessage.label_ids.like(f'%"CATEGORY_{cat.upper()}"%')
    return None


def _build_token_clause(token: str, now: datetime) -> Optional[ColumnElement[bool]]:
    lower = token.lower()

    if lower in ("-in:sent", "-in:draft", "-in:drafts"):
        lbl = "SENT" if "sent" in lower else "DRAFT"
        return not_(ScannedMessage.label_ids.like(f'%"{lbl}"%'))

    if ":" not in token:
        pat = f"%{token}%"
        return or_(
            ScannedMessage.subject.ilike(pat),
            ScannedMessage.snippet.ilike(pat),
            ScannedMessage.sender_email.ilike(pat),
            ScannedMessage.sender_name.ilike(pat),
        )

    op, val = token.split(":", 1)
    op = op.lower()
    val = val.strip()
    if not val:
        return None

    if op == "category":
        return _category_clause(val)
    if op == "older_than":
        days = parse_age_days(val)
        if days is None:
            return None
        cutoff = now - timedelta(days=days)
        return and_(ScannedMessage.date.isnot(None), ScannedMessage.date <= cutoff)
    if op == "newer_than":
        days = parse_age_days(val)
        if days is None:
            return None
        cutoff = now - timedelta(days=days)
        return and_(ScannedMessage.date.isnot(None), ScannedMessage.date >= cutoff)
    if op in ("larger", "size"):
        min_bytes = parse_size_bytes(val)
        return ScannedMessage.size_estimate >= min_bytes if min_bytes is not None else None
    if op == "smaller":
        max_bytes = parse_size_bytes(val)
        return ScannedMessage.size_estimate <= max_bytes if max_bytes is not None else None
    if op == "is":
        if val.lower() == "unread":
            return ScannedMessage.label_ids.like('%"UNREAD"%')
        if val.lower() == "read":
            return not_(ScannedMessage.label_ids.like('%"UNREAD"%'))
        return None
    if op == "subject":
        return ScannedMessage.subject.ilike(f"%{val}%")
    if op == "from":
        pat = f"%{val}%"
        return or_(
            ScannedMessage.sender_email.ilike(pat),
            ScannedMessage.sender_name.ilike(pat),
        )
    if op == "in":
        val_u = val.upper()
        if val_u == "ALL":
            return None
        return ScannedMessage.label_ids.like(f'%"{val_u}"%')

    # Gmail server-side operators without dedicated SQLite columns (e.g. filename:, has:)
    return None


def build_message_filter_clauses(
    query: Optional[str],
    now: Optional[datetime] = None,
) -> List[ColumnElement[bool]]:
    """Parses a Gmail-style search string into SQLAlchemy clauses against ScannedMessage."""
    if not query or not query.strip():
        return []

    ref_now = now or utc_now()
    tokens = _tokenize_query(query.strip())
    clauses: List[ColumnElement[bool]] = []
    pending_or = False

    for raw_tok in tokens:
        cleaned = raw_tok.strip()
        if not cleaned or cleaned in ("(", ")"):
            continue
        if cleaned.upper() == "AND":
            continue
        if cleaned.upper() == "OR":
            pending_or = True
            continue

        clause = _build_token_clause(cleaned, ref_now)
        if clause is None:
            pending_or = False
            continue

        if pending_or and clauses:
            clauses[-1] = or_(clauses[-1], clause)
        else:
            clauses.append(clause)
        pending_or = False

    return clauses


def count_matching_messages_stmt(query: Optional[str], now: Optional[datetime] = None):
    """Builds a SELECT COUNT(id) statement for messages matching a smart filter query."""
    from sqlalchemy import func

    stmt = select(func.count(ScannedMessage.id))
    clauses = build_message_filter_clauses(query, now=now)
    if clauses:
        stmt = stmt.where(*clauses)
    return stmt
