from datetime import datetime

from pydantic import BaseModel

from app.models.skill import SkillLevelContentType


class TagResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class SkillLevelContentCreate(BaseModel):
    level: int
    type: SkillLevelContentType
    title: str
    description: str | None = None
    url: str | None = None


class SkillLevelContentResponse(BaseModel):
    id: int
    skill_id: int
    level: int
    type: SkillLevelContentType
    title: str
    description: str | None = None
    url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    domain_id: int
    is_future: bool = False
    team_ids: list[int] = []
    tag_names: list[str] = []


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_future: bool | None = None
    is_archived: bool | None = None
    team_ids: list[int] | None = None
    tag_names: list[str] | None = None


class SkillResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    domain_id: int
    is_future: bool
    is_archived: bool
    catalog_version: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
