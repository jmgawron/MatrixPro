from datetime import date, datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shifts
# ---------------------------------------------------------------------------


class ShiftCreate(BaseModel):
    name: str
    domain_id: int


class ShiftUpdate(BaseModel):
    name: str | None = None
    domain_id: int | None = None


class ShiftResponse(BaseModel):
    id: int
    name: str
    domain_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Certification Domains
# ---------------------------------------------------------------------------


class CertDomainCreate(BaseModel):
    name: str
    description: str | None = None


class CertDomainUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CertDomainResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Certificates
# ---------------------------------------------------------------------------


class CertificateCreate(BaseModel):
    name: str
    description: str | None = None
    certification_domain_id: int


class CertificateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    certification_domain_id: int | None = None


class CertificateResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    certification_domain_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    organisation_id: int
    domain_id: int
    start_date: date
    end_date: date
    is_mandatory: bool = False


class CampaignUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    organisation_id: int | None = None
    domain_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_mandatory: bool | None = None


class CampaignResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    organisation_id: int
    domain_id: int
    start_date: date
    end_date: date
    is_mandatory: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Catalog Tree Responses
# ---------------------------------------------------------------------------


class ShiftNode(BaseModel):
    id: int
    name: str


class TeamNode(BaseModel):
    id: int
    name: str


class DomainNode(BaseModel):
    id: int
    name: str
    is_technical: bool
    teams: list[TeamNode] = []
    shifts: list[ShiftNode] = []


class OrgNode(BaseModel):
    id: int
    name: str
    domains: list[DomainNode] = []


class CertNode(BaseModel):
    id: int
    name: str


class CertDomainNode(BaseModel):
    id: int
    name: str
    certificates: list[CertNode] = []


class CampaignNode(BaseModel):
    id: int
    name: str
    is_mandatory: bool
    start_date: date
    end_date: date


class CampaignDomainNode(BaseModel):
    id: int
    name: str
    campaigns: list[CampaignNode] = []


class CampaignOrgNode(BaseModel):
    id: int
    name: str
    domains: list[CampaignDomainNode] = []


# ---------------------------------------------------------------------------
# Skill Assignment (Bulk M2M)
# ---------------------------------------------------------------------------


class SkillAssignmentRequest(BaseModel):
    organisation_ids: list[int] = []
    domain_ids: list[int] = []
    team_ids: list[int] = []
    shift_ids: list[int] = []
    certificate_ids: list[int] = []
    campaign_ids: list[int] = []
