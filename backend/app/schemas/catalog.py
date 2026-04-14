from datetime import datetime

from pydantic import BaseModel


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
# Catalog Tree Responses
# ---------------------------------------------------------------------------


class TeamNode(BaseModel):
    id: int
    name: str
    shift: int


class DomainNode(BaseModel):
    id: int
    name: str
    is_technical: bool
    teams: list[TeamNode] = []


class CertNode(BaseModel):
    id: int
    name: str


class CertDomainNode(BaseModel):
    id: int
    name: str
    certificates: list[CertNode] = []


# ---------------------------------------------------------------------------
# Skill Assignment (Bulk M2M)
# ---------------------------------------------------------------------------


class SkillAssignmentRequest(BaseModel):
    team_ids: list[int] = []
    certificate_ids: list[int] = []
    tag_names: list[str] = []
