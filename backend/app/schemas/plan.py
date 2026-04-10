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
