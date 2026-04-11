from datetime import datetime

from pydantic import BaseModel

from app.models.plan import PlanSkillStatus
from app.models.skill import SkillLevelContentType


class TrainingLogCreate(BaseModel):
    title: str
    type: SkillLevelContentType
    completed_at: datetime | None = None
    notes: str | None = None


class TrainingLogResponse(BaseModel):
    id: int
    plan_skill_id: int
    title: str
    type: SkillLevelContentType
    completed_at: datetime | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class PlanSkillCreate(BaseModel):
    skill_id: int
    status: PlanSkillStatus = PlanSkillStatus.in_pipeline
    proficiency_level: int | None = None
    notes: str | None = None


class PlanSkillUpdate(BaseModel):
    status: PlanSkillStatus | None = None
    proficiency_level: int | None = None
    notes: str | None = None


class PlanSkillResponse(BaseModel):
    id: int
    plan_id: int
    skill_id: int
    skill_name: str
    status: PlanSkillStatus
    proficiency_level: int | None = None
    notes: str | None = None
    skill_version_at_add: int
    added_at: datetime
    updated_at: datetime | None = None
    training_logs: list[TrainingLogResponse] = []

    model_config = {"from_attributes": True}


class PlanResponse(BaseModel):
    id: int
    engineer_id: int
    engineer_name: str
    created_at: datetime
    skills: list[PlanSkillResponse] = []

    model_config = {"from_attributes": True}


# --- User Content Completion ---


class ContentCompletionToggle(BaseModel):
    notes: str | None = None


class ContentCompletionResponse(BaseModel):
    id: int
    user_id: int
    plan_skill_id: int
    content_id: int
    completed: bool
    completed_at: datetime | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- User Content Override ---


class ContentOverrideCreate(BaseModel):
    override_description: str


class ContentOverrideResponse(BaseModel):
    id: int
    user_id: int
    plan_skill_id: int
    content_id: int
    override_description: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Merged Content Item (catalog + user completion + user override) ---


class MergedContentItem(BaseModel):
    """A single catalog content item merged with user-specific completion and override data."""

    id: int
    skill_id: int
    level: int
    type: SkillLevelContentType
    title: str
    description: str | None = None
    url: str | None = None
    position: int
    # User-specific fields
    completed: bool = False
    completed_at: datetime | None = None
    completion_notes: str | None = None
    has_override: bool = False
    override_description: str | None = None


class PlanSkillContentResponse(BaseModel):
    """Full content for a plan skill: catalog items merged with user progress."""

    plan_skill_id: int
    skill_id: int
    skill_name: str
    proficiency_level: int | None = None
    items: list[MergedContentItem] = []
    total_items: int = 0
    completed_items: int = 0
