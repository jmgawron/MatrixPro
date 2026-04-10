from datetime import datetime

from pydantic import BaseModel


class OrgCreate(BaseModel):
    name: str


class OrgResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DomainCreate(BaseModel):
    name: str
    organisation_id: int


class DomainResponse(BaseModel):
    id: int
    name: str
    organisation_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamCreate(BaseModel):
    name: str
    domain_id: int


class TeamResponse(BaseModel):
    id: int
    name: str
    domain_id: int
    domain_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
