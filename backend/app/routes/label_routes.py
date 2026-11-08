from fastapi import APIRouter, HTTPException
from typing import List
from ..schemas import LabelInfo, CreateLabelRequest
from ..gmail_service import GmailService
from ..auth import is_authenticated

router = APIRouter(prefix="/labels", tags=["labels"])

@router.get("", response_model=List[LabelInfo])
async def list_labels():
    if not is_authenticated():
        # Demo fallback labels
        return [
            LabelInfo(id="INBOX", name="INBOX", type="system"),
            LabelInfo(id="UNREAD", name="UNREAD", type="system"),
            LabelInfo(id="STARRED", name="STARRED", type="system"),
            LabelInfo(id="IMPORTANT", name="IMPORTANT", type="system"),
            LabelInfo(id="CATEGORY_PROMOTIONS", name="Promotions", type="system"),
            LabelInfo(id="CATEGORY_SOCIAL", name="Social", type="system"),
            LabelInfo(id="CATEGORY_UPDATES", name="Updates", type="system"),
            LabelInfo(id="Label_1", name="Newsletters", type="user"),
            LabelInfo(id="Label_2", name="Receipts", type="user"),
            LabelInfo(id="Label_3", name="Read Later", type="user")
        ]

    gmail = GmailService()
    try:
        raw_labels = await gmail.list_labels()
        result = []
        for l in raw_labels:
            result.append(
                LabelInfo(
                    id=l.get("id"),
                    name=l.get("name"),
                    type=l.get("type", "user").lower(),
                    messages_total=l.get("messagesTotal", 0),
                    messages_unread=l.get("messagesUnread", 0)
                )
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=LabelInfo)
async def create_label(req: CreateLabelRequest):
    gmail = GmailService()
    try:
        created = await gmail.create_label(req.name)
        if not created:
            raise HTTPException(status_code=400, detail="Failed to create label")
        return LabelInfo(
            id=created.get("id"),
            name=created.get("name"),
            type="user",
            messages_total=0,
            messages_unread=0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{label_id}")
async def delete_label(label_id: str):
    gmail = GmailService()
    try:
        success = await gmail.delete_label(label_id)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to delete label")
        return {"status": "deleted", "id": label_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
