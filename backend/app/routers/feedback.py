from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.feedback import Feedback
from app.models.user import User, UserRole
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


def _to_response(fb: Feedback) -> FeedbackResponse:
    user_name = fb.user.name if fb.user else "Unknown"
    if fb.user and getattr(fb.user, "surname", None):
        user_name += " " + fb.user.surname
    return FeedbackResponse(
        id=fb.id,
        user_id=fb.user_id,
        user_name=user_name,
        user_email=fb.user.email if fb.user else "",
        feedback_type=fb.feedback_type,
        source_module=fb.source_module,
        message=fb.message,
        created_at=fb.created_at,
    )


@router.post("/", response_model=FeedbackResponse, status_code=201)
def create_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fb = Feedback(
        user_id=current_user.id,
        feedback_type=data.feedback_type,
        source_module=data.source_module,
        message=data.message,
        created_at=datetime.utcnow(),
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return _to_response(fb)


@router.get("/", response_model=list[FeedbackResponse])
def list_feedback(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    items = db.query(Feedback).order_by(Feedback.created_at.desc()).all()
    return [_to_response(fb) for fb in items]


@router.get("/{feedback_id}", response_model=FeedbackResponse)
def get_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return _to_response(fb)


@router.delete("/{feedback_id}", status_code=204)
def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    fb = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    db.delete(fb)
    db.commit()
    return None
