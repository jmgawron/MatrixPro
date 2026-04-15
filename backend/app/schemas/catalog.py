from datetime import datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Certification Domains
# ---------------------------------------------------------------------------


class CertDomainCreate(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None


class CertDomainUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    icon: str | None = None


class CertDomainResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    icon: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Certificates
# ---------------------------------------------------------------------------


class CertificateCreate(BaseModel):
    name: str
    description: str | None = None
    certification_domain_id: int
    icon: str | None = None


class CertificateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    certification_domain_id: int | None = None
    icon: str | None = None


class CertificateResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    certification_domain_id: int
    icon: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Catalog Tree Responses
# ---------------------------------------------------------------------------


class TeamNode(BaseModel):
    id: int
    name: str
    shift: int
    icon: str | None = None


class DomainNode(BaseModel):
    id: int
    name: str
    is_technical: bool
    icon: str | None = None
    teams: list[TeamNode] = []


class CertNode(BaseModel):
    id: int
    name: str
    icon: str | None = None


class CertDomainNode(BaseModel):
    id: int
    name: str
    icon: str | None = None
    certificates: list[CertNode] = []


# ---------------------------------------------------------------------------
# Skill Assignment (Bulk M2M)
# ---------------------------------------------------------------------------


class SkillAssignmentRequest(BaseModel):
    team_ids: list[int] = []
    certificate_ids: list[int] = []
    tag_names: list[str] = []
