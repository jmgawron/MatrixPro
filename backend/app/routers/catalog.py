from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.catalog import Campaign, CertificationDomain, Shift
from app.models.org import Domain, Organisation, Team
from app.models.user import User
from app.schemas.catalog import (
    CampaignDomainNode,
    CampaignNode,
    CampaignOrgNode,
    CertDomainNode,
    CertNode,
    DomainNode,
    OrgNode,
    ShiftNode,
    TeamNode,
)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/org-tree", response_model=list[OrgNode])
def org_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orgs = (
        db.query(Organisation)
        .options(
            selectinload(Organisation.domains).selectinload(Domain.teams),
            selectinload(Organisation.domains).selectinload(Domain.shifts),
        )
        .order_by(Organisation.name)
        .all()
    )

    return [
        OrgNode(
            id=org.id,
            name=org.name,
            domains=[
                DomainNode(
                    id=d.id,
                    name=d.name,
                    is_technical=d.is_technical,
                    teams=[TeamNode(id=t.id, name=t.name) for t in d.teams],
                    shifts=[ShiftNode(id=s.id, name=s.name) for s in d.shifts],
                )
                for d in org.domains
            ],
        )
        for org in orgs
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
            certificates=[CertNode(id=c.id, name=c.name) for c in cd.certificates],
        )
        for cd in cert_domains
    ]


@router.get("/campaign-tree", response_model=list[CampaignOrgNode])
def campaign_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orgs = (
        db.query(Organisation)
        .options(selectinload(Organisation.domains))
        .order_by(Organisation.name)
        .all()
    )

    domain_ids = []
    for org in orgs:
        domain_ids.extend([d.id for d in org.domains])

    campaigns = (
        db.query(Campaign)
        .filter(Campaign.domain_id.in_(domain_ids))
        .order_by(Campaign.name)
        .all()
    )

    campaigns_by_domain: dict[int, list[Campaign]] = {}
    for c in campaigns:
        campaigns_by_domain.setdefault(c.domain_id, []).append(c)

    result = []
    for org in orgs:
        domain_nodes = []
        for d in org.domains:
            domain_campaigns = campaigns_by_domain.get(d.id, [])
            if domain_campaigns:
                domain_nodes.append(
                    CampaignDomainNode(
                        id=d.id,
                        name=d.name,
                        campaigns=[
                            CampaignNode(
                                id=c.id,
                                name=c.name,
                                is_mandatory=c.is_mandatory,
                            )
                            for c in domain_campaigns
                        ],
                    )
                )
        if domain_nodes:
            result.append(
                CampaignOrgNode(id=org.id, name=org.name, domains=domain_nodes)
            )

    return result
