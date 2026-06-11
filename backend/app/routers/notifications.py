from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.notifications import list_notifications

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
def get_notifications(
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = list_notifications(db, current_user.id, limit=limit)
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in rows]
    )
