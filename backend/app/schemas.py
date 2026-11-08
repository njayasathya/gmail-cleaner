from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class SenderResponse(BaseModel):
    email: str
    name: str
    domain: str
    message_count: int
    unread_count: int
    total_size_bytes: int
    has_unsubscribe: bool
    unsubscribe_url: Optional[str] = None
    unsubscribe_mailto: Optional[str] = None
    has_one_click: bool = False
    is_unsubscribed: bool = False
    unsubscribed_at: Optional[datetime] = None
    categories: str = ""
    sample_subject: Optional[str] = None
    last_received_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SenderListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    senders: List[SenderResponse]

class StatsResponse(BaseModel):
    total_senders: int
    total_emails: int
    total_unread: int
    total_size_bytes: int
    newsletters_count: int
    unsubscribed_count: int
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_picture: Optional[str] = None
    is_authenticated: bool = False
    is_demo_mode: bool = False
    last_scan_at: Optional[datetime] = None

class BulkSenderActionRequest(BaseModel):
    senders: List[str] = Field(..., description="List of sender email addresses")
    filter_query: Optional[str] = Field(None, description="Optional extra Gmail query string like older_than:30d")

class BulkDeleteRequest(BulkSenderActionRequest):
    permanent: bool = Field(False, description="If true, uses batchDelete (permanent). If false, moves to Trash.")

class BulkLabelRequest(BulkSenderActionRequest):
    label_id: str
    label_name: Optional[str] = None
    action: str = Field("apply", description="'apply' or 'remove'")

class BulkImportantRequest(BulkSenderActionRequest):
    important: bool = Field(True, description="True to mark important, False to unmark")

class BulkReadRequest(BulkSenderActionRequest):
    read: bool = Field(True, description="True to mark as read, False to mark as unread")

class UnsubscribeRequest(BaseModel):
    email: str
    trash_existing: bool = Field(False, description="Whether to also move existing emails from this sender to trash")

class UnsubscribeResult(BaseModel):
    email: str
    status: str
    method: str  # "one-click", "http-get", "mailto", or "manual"
    message: str
    manual_url: Optional[str] = None

class JobResponse(BaseModel):
    id: str
    action: str
    status: str
    total_items: int
    processed_items: int
    success_count: int
    error_count: int
    current_item: str
    message: str
    error_details: Optional[str] = None
    percentage: float = 0.0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SmartFilterPreset(BaseModel):
    id: str
    name: str
    description: str
    query: str
    category: str
    recommended_action: str

class LabelInfo(BaseModel):
    id: str
    name: str
    type: str  # "system" or "user"
    messages_total: Optional[int] = 0
    messages_unread: Optional[int] = 0

class CreateLabelRequest(BaseModel):
    name: str

class GoogleCredentialsConfig(BaseModel):
    client_id: str
    client_secret: str
