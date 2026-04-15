from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalog import CertificationDomain
from app.models.org import Domain
from app.models.user import User
from app.schemas.catalog import (
    CertDomainNode,
    CertNode,
    DomainNode,
    TeamNode,
)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/org-tree", response_model=list[DomainNode])
def org_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domains = (
        db.query(Domain).options(selectinload(Domain.teams)).order_by(Domain.name).all()
    )

    return [
        DomainNode(
            id=d.id,
            name=d.name,
            is_technical=d.is_technical,
            icon=d.icon,
            teams=[
                TeamNode(id=t.id, name=t.name, shift=t.shift, icon=t.icon)
                for t in d.teams
            ],
        )
        for d in domains
    ]


@router.get("/cert-tree", response_model=list[CertDomainNode])
def cert_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cert_domains = (
        db.query(CertificationDomain)
        .options(selectinload(CertificationDomain.certificates))
        .order_by(CertificationDomain.name)
        .all()
    )

    return [
        CertDomainNode(
            id=cd.id,
            name=cd.name,
            icon=cd.icon,
            certificates=[
                CertNode(id=c.id, name=c.name, icon=c.icon) for c in cd.certificates
            ],
        )
        for cd in cert_domains
    ]
