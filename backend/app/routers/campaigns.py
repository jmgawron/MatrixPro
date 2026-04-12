from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models.catalog import Campaign, SkillCampaign
from app.models.org import Domain, Organisation
from app.models.user import User, UserRole
from app.schemas.catalog import CampaignCreate, CampaignResponse, CampaignUpdate

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("/", response_model=list[CampaignResponse])
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    return db.query(Campaign).order_by(Campaign.start_date.desc()).all()


@router.post("/", response_model=CampaignResponse, status_code=201)
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    org = db.query(Organisation).filter(Organisation.id == data.organisation_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")

    domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")

    if data.end_date <= data.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    campaign = Campaign(
        name=data.name,
        description=data.description,
        organisation_id=data.organisation_id,
        domain_id=data.domain_id,
        start_date=data.start_date,
        end_date=data.end_date,
        is_mandatory=data.is_mandatory,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.put("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if data.name is not None:
        campaign.name = data.name
    if data.description is not None:
        campaign.description = data.description
    if data.organisation_id is not None:
        org = (
            db.query(Organisation)
            .filter(Organisation.id == data.organisation_id)
            .first()
        )
        if org is None:
            raise HTTPException(status_code=404, detail="Organisation not found")
        campaign.organisation_id = data.organisation_id
    if data.domain_id is not None:
        domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
        if domain is None:
            raise HTTPException(status_code=404, detail="Domain not found")
        campaign.domain_id = data.domain_id
    if data.start_date is not None:
        campaign.start_date = data.start_date
    if data.end_date is not None:
        campaign.end_date = data.end_date
    if data.is_mandatory is not None:
        campaign.is_mandatory = data.is_mandatory

    effective_start = data.start_date or campaign.start_date
    effective_end = data.end_date or campaign.end_date
    if effective_end <= effective_start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")

    skill_count = (
        db.query(SkillCampaign).filter(SkillCampaign.campaign_id == campaign_id).count()
    )
    if skill_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete campaign with {skill_count} assigned skill(s)",
        )

    db.delete(campaign)
    db.commit()
    return {"detail": "Campaign deleted"}
