from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

class Sender(Base):
    __tablename__ = "senders"

    email: Mapped[str] = mapped_column(String(255), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    domain: Mapped[str] = mapped_column(String(255), index=True, default="")
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    
    # Unsubscribe info
    has_unsubscribe: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    unsubscribe_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unsubscribe_mailto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    has_one_click: Mapped[bool] = mapped_column(Boolean, default=False)
    is_unsubscribed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Metadata
    categories: Mapped[str] = mapped_column(String(255), default="")  # e.g. "promotions,updates"
    sample_subject: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_received_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ScannedMessage(Base):
    __tablename__ = "scanned_messages"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    thread_id: Mapped[str] = mapped_column(String(128), default="")
    sender_email: Mapped[str] = mapped_column(String(255), index=True)
    sender_name: Mapped[str] = mapped_column(String(255), default="")
    subject: Mapped[str] = mapped_column(Text, default="")
    snippet: Mapped[str] = mapped_column(Text, default="")
    date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    size_estimate: Mapped[int] = mapped_column(Integer, default=0)
    label_ids: Mapped[str] = mapped_column(Text, default="[]")  # JSON encoded list
    
    # Unsubscribe
    has_unsubscribe: Mapped[bool] = mapped_column(Boolean, default=False)
    unsubscribe_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unsubscribe_mailto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    has_one_click: Mapped[bool] = mapped_column(Boolean, default=False)

class JobRecord(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    action: Mapped[str] = mapped_column(String(64))  # trash, permanent_delete, archive, mark_read, etc.
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, running, completed, failed, cancelled
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    processed_items: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    current_item: Mapped[str] = mapped_column(String(255), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    error_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    picture: Mapped[str] = mapped_column(String(512), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scan_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_scanned_emails: Mapped[int] = mapped_column(Integer, default=0)
    total_freed_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
