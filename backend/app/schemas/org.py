from datetime import datetime

from pydantic import BaseModel

from app.models.plan import PlanSkillStatus


class DomainCreate(BaseModel):
    name: str
    is_technical: bool = True
    icon: str | None = None


class DomainResponse(BaseModel):
    id: int
    name: str
    is_technical: bool
    icon: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamCreate(BaseModel):
    name: str
    domain_id: int
    shift: int
    icon: str | None = None


class TeamResponse(BaseModel):
    id: int
    name: str
    domain_id: int
    domain_name: str | None = None
    shift: int
    icon: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatrixSkillInfo(BaseModel):
    id: int
    name: str


class MatrixCellInfo(BaseModel):
    status: str
    proficiency_level: int | None = None
    last_updated_at: datetime | None = None
    last_training_at: datetime | None = None


class MatrixEngineerRow(BaseModel):
    id: int
    name: str
    cells: dict[str, MatrixCellInfo]


class TeamMatrixResponse(BaseModel):
    team_id: int
    team_name: str
    skills: list[MatrixSkillInfo]
    engineers: list[MatrixEngineerRow]


# --- Team Stats ---


class SkillStatusCounts(BaseModel):
    planned: int = 0
    developing: int = 0
    mastered: int = 0
    not_in_plan: int = 0


class PerSkillStat(BaseModel):
    skill_id: int
    skill_name: str
    engineers_with_skill: int
    total_engineers: int
    coverage_pct: float
    avg_proficiency: float | None = None
    status_counts: SkillStatusCounts
    last_activity_at: datetime | None = None


class PerEngineerStat(BaseModel):
    engineer_id: int
    engineer_name: str
    total_skills_in_plan: int
    skills_in_development: int
    skills_proficient: int
    skills_in_pipeline: int
    last_activity_at: datetime | None = None


class TeamStatsResponse(BaseModel):
    team_id: int
    team_name: str
    total_engineers: int
    total_skills: int
    coverage_pct: float
    critical_gaps: int
    active_developments: int
    completions_30d: int
    per_skill_stats: list[PerSkillStat]
    per_engineer_stats: list[PerEngineerStat]


# --- Activity Feed ---


class ActivityItem(BaseModel):
    id: int
    type: str
    actor_name: str
    target_engineer_name: str | None = None
    skill_name: str | None = None
    title: str
    occurred_at: datetime


class TeamActivityResponse(BaseModel):
    team_id: int
    items: list[ActivityItem]
    total: int


# --- Bulk Assign ---


class BulkAssignRequest(BaseModel):
    engineer_ids: list[int]
    skill_id: int
    status: PlanSkillStatus = PlanSkillStatus.planned
    notes: str | None = None
    skip_existing: bool = True


class BulkAssignResultItem(BaseModel):
    engineer_id: int
    engineer_name: str
    result: str  # "assigned" | "skipped_existing" | "error"
    detail: str | None = None


class BulkAssignResponse(BaseModel):
    skill_id: int
    skill_name: str
    results: list[BulkAssignResultItem]
    assigned_count: int
    skipped_count: int
    error_count: int
