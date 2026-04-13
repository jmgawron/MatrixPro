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
    position: int | None = None


class SkillLevelContentUpdate(BaseModel):
    level: int | None = None
    type: SkillLevelContentType | None = None
    title: str | None = None
    description: str | None = None
    url: str | None = None
    position: int | None = None


class ReorderItem(BaseModel):
    id: int
    position: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


class SkillLevelContentResponse(BaseModel):
    id: int
    skill_id: int
    level: int
    type: SkillLevelContentType
    title: str
    description: str | None = None
    url: str | None = None
    position: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgInfo(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class DomainInfo(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class ShiftInfo(BaseModel):
    id: int
    name: str
    domain_name: str = ""

    model_config = {"from_attributes": True}


class CertificateInfo(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class CampaignInfo(BaseModel):
    id: int
    name: str
    is_mandatory: bool = False

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    name: str
    description: str | None = None
    is_future: bool = False
    team_ids: list[int] = []
    tag_names: list[str] = []
    organisation_ids: list[int] = []
    domain_ids: list[int] = []
    shift_ids: list[int] = []
    certificate_ids: list[int] = []
    campaign_ids: list[int] = []


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_future: bool | None = None
    is_archived: bool | None = None
    team_ids: list[int] | None = None
    tag_names: list[str] | None = None
    organisation_ids: list[int] | None = None
    domain_ids: list[int] | None = None
    shift_ids: list[int] | None = None
    certificate_ids: list[int] | None = None
    campaign_ids: list[int] | None = None


class TeamInfo(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class SkillResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    is_future: bool
    is_archived: bool
    catalog_version: int
    created_at: datetime
    updated_at: datetime | None = None
    tags: list[TagResponse] = []
    teams: list[TeamInfo] = []
    organisations: list[OrgInfo] = []
    domains: list[DomainInfo] = []
    shifts: list[ShiftInfo] = []
    certificates: list[CertificateInfo] = []
    campaigns: list[CampaignInfo] = []

    model_config = {"from_attributes": True}


class ExplorerEngineerResult(BaseModel):
    engineer_id: int
    engineer_name: str
    team_id: int | None = None
    team_name: str | None = None
    skill_name: str
    status: str
    proficiency_level: int | None = None


class ExplorerResponse(BaseModel):
    results: list[ExplorerEngineerResult]
    total: int


class CompareSkillInfo(BaseModel):
    id: int
    name: str
    is_overlap: bool = False


class CompareTeamResult(BaseModel):
    team_id: int
    team_name: str
    skills: list[CompareSkillInfo]


class CompareResponse(BaseModel):
    team_a: CompareTeamResult
    team_b: CompareTeamResult
    overlap_count: int
    overlap_percent: float
