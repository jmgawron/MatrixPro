from datetime import datetime

from pydantic import BaseModel

from app.models.feedback import FeedbackType


class FeedbackCreate(BaseModel):
    feedback_type: FeedbackType
    source_module: str
    message: str


class FeedbackResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    feedback_type: FeedbackType
    source_module: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}
