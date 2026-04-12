from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import require_role
from app.models.org import Domain, Organisation, Team
from app.models.user import User, UserRole
from app.schemas.org import DomainCreate, DomainResponse

router = APIRouter(prefix="/api/domains", tags=["domains"])


@router.get("/", response_model=list[DomainResponse])
def list_domains(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    return db.query(Domain).order_by(Domain.name).all()


@router.post("/", response_model=DomainResponse)
def create_domain(
    data: DomainCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    org = db.query(Organisation).filter(Organisation.id == data.organisation_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    domain = Domain(
        name=data.name,
        organisation_id=data.organisation_id,
        is_technical=data.is_technical,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@router.get("/{domain_id}", response_model=DomainResponse)
def get_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.put("/{domain_id}", response_model=DomainResponse)
def update_domain(
    domain_id: int,
    data: DomainCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    if data.organisation_id is not None:
        org = (
            db.query(Organisation)
            .filter(Organisation.id == data.organisation_id)
            .first()
        )
        if org is None:
            raise HTTPException(status_code=404, detail="Organisation not found")
        domain.organisation_id = data.organisation_id
    if data.name is not None:
        domain.name = data.name
    if data.is_technical is not None:
        domain.is_technical = data.is_technical
    db.commit()
    db.refresh(domain)
    return domain


@router.delete("/{domain_id}")
def delete_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    team_count = db.query(Team).filter(Team.domain_id == domain_id).count()
    if team_count > 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete domain with active teams"
        )
    db.delete(domain)
    db.commit()
    return {"detail": "Domain deleted"}
