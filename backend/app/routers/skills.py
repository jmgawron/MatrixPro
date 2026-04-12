from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.catalog import (
    Campaign,
    Certificate,
    CertificationDomain,
    Shift,
    SkillCampaign,
    SkillCertificate,
    SkillDomain,
    SkillOrganisation,
    SkillShift,
)
from app.models.org import Domain, Organisation, Team
from app.models.plan import DevelopmentPlan, PlanSkill
from app.models.skill import Skill, SkillLevelContent, SkillTag, SkillTeam, Tag
from app.models.user import User, UserRole
from app.schemas.catalog import SkillAssignmentRequest
from app.schemas.skill import (
    CampaignInfo,
    CertificateInfo,
    CompareResponse,
    CompareSkillInfo,
    CompareTeamResult,
    DomainInfo,
    ExplorerEngineerResult,
    ExplorerResponse,
    OrgInfo,
    ReorderRequest,
    ShiftInfo,
    SkillCreate,
    SkillLevelContentCreate,
    SkillLevelContentResponse,
    SkillLevelContentUpdate,
    SkillResponse,
    SkillUpdate,
    TagResponse,
    TeamInfo,
)

router = APIRouter(prefix="/api/skills", tags=["skills"])


def _skill_eager_options():
    return [
        selectinload(Skill.skill_tags).selectinload(SkillTag.tag),
        selectinload(Skill.skill_teams).selectinload(SkillTeam.team),
        selectinload(Skill.skill_organisations).selectinload(
            SkillOrganisation.organisation
        ),
        selectinload(Skill.skill_domains).selectinload(SkillDomain.domain),
        selectinload(Skill.skill_shifts).selectinload(SkillShift.shift),
        selectinload(Skill.skill_certificates).selectinload(
            SkillCertificate.certificate
        ),
        selectinload(Skill.skill_campaigns).selectinload(SkillCampaign.campaign),
    ]


def _eager_load_skill(db: Session, skill_id: int) -> Optional[Skill]:
    return (
        db.query(Skill)
        .options(*_skill_eager_options())
        .filter(Skill.id == skill_id)
        .first()
    )


def _to_skill_response(skill: Skill) -> SkillResponse:
    return SkillResponse(
        id=skill.id,
        name=skill.name,
        description=skill.description,
        is_future=skill.is_future,
        is_archived=skill.is_archived,
        catalog_version=skill.catalog_version,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=[TagResponse.model_validate(st.tag) for st in skill.skill_tags],
        teams=[TeamInfo(id=st.team.id, name=st.team.name) for st in skill.skill_teams],
        organisations=[
            OrgInfo(id=so.organisation.id, name=so.organisation.name)
            for so in skill.skill_organisations
        ],
        domains=[
            DomainInfo(id=sd.domain.id, name=sd.domain.name)
            for sd in skill.skill_domains
        ],
        shifts=[
            ShiftInfo(id=ss.shift.id, name=ss.shift.name) for ss in skill.skill_shifts
        ],
        certificates=[
            CertificateInfo(id=sc.certificate.id, name=sc.certificate.name)
            for sc in skill.skill_certificates
        ],
        campaigns=[
            CampaignInfo(id=sc.campaign.id, name=sc.campaign.name)
            for sc in skill.skill_campaigns
        ],
    )


def _sync_m2m(db: Session, skill_id: int, data: SkillCreate | SkillUpdate):
    if hasattr(data, "organisation_ids") and (
        isinstance(data, SkillCreate) or data.organisation_ids is not None
    ):
        ids = (
            data.organisation_ids
            if isinstance(data, SkillCreate)
            else (data.organisation_ids or [])
        )
        db.query(SkillOrganisation).filter(
            SkillOrganisation.skill_id == skill_id
        ).delete()
        for oid in ids:
            db.add(SkillOrganisation(skill_id=skill_id, organisation_id=oid))

    if hasattr(data, "domain_ids") and (
        isinstance(data, SkillCreate) or data.domain_ids is not None
    ):
        ids = (
            data.domain_ids
            if isinstance(data, SkillCreate)
            else (data.domain_ids or [])
        )
        db.query(SkillDomain).filter(SkillDomain.skill_id == skill_id).delete()
        for did in ids:
            db.add(SkillDomain(skill_id=skill_id, domain_id=did))

    if hasattr(data, "shift_ids") and (
        isinstance(data, SkillCreate) or data.shift_ids is not None
    ):
        ids = (
            data.shift_ids if isinstance(data, SkillCreate) else (data.shift_ids or [])
        )
        db.query(SkillShift).filter(SkillShift.skill_id == skill_id).delete()
        for sid in ids:
            db.add(SkillShift(skill_id=skill_id, shift_id=sid))

    if hasattr(data, "certificate_ids") and (
        isinstance(data, SkillCreate) or data.certificate_ids is not None
    ):
        ids = (
            data.certificate_ids
            if isinstance(data, SkillCreate)
            else (data.certificate_ids or [])
        )
        db.query(SkillCertificate).filter(
            SkillCertificate.skill_id == skill_id
        ).delete()
        for cid in ids:
            db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))

    if hasattr(data, "campaign_ids") and (
        isinstance(data, SkillCreate) or data.campaign_ids is not None
    ):
        ids = (
            data.campaign_ids
            if isinstance(data, SkillCreate)
            else (data.campaign_ids or [])
        )
        db.query(SkillCampaign).filter(SkillCampaign.skill_id == skill_id).delete()
        for cid in ids:
            db.add(SkillCampaign(skill_id=skill_id, campaign_id=cid))


@router.get("/", response_model=list[SkillResponse])
def list_skills(
    search: Optional[str] = Query(None),
    domain_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    is_future: Optional[bool] = Query(None),
    include_archived: bool = Query(False),
    org_id: Optional[int] = Query(None),
    shift_id: Optional[int] = Query(None),
    cert_id: Optional[int] = Query(None),
    campaign_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Skill).options(*_skill_eager_options())

    if not include_archived:
        query = query.filter(Skill.is_archived == False)  # noqa: E712

    if is_future is not None:
        query = query.filter(Skill.is_future == is_future)

    if org_id is not None:
        query = query.join(
            SkillOrganisation, Skill.id == SkillOrganisation.skill_id
        ).filter(SkillOrganisation.organisation_id == org_id)

    if domain_id is not None:
        query = query.join(SkillDomain, Skill.id == SkillDomain.skill_id).filter(
            SkillDomain.domain_id == domain_id
        )

    if team_id is not None:
        query = query.join(SkillTeam, Skill.id == SkillTeam.skill_id).filter(
            SkillTeam.team_id == team_id
        )

    if shift_id is not None:
        query = query.join(SkillShift, Skill.id == SkillShift.skill_id).filter(
            SkillShift.shift_id == shift_id
        )

    if cert_id is not None:
        query = query.join(
            SkillCertificate, Skill.id == SkillCertificate.skill_id
        ).filter(SkillCertificate.certificate_id == cert_id)

    if campaign_id is not None:
        query = query.join(SkillCampaign, Skill.id == SkillCampaign.skill_id).filter(
            SkillCampaign.campaign_id == campaign_id
        )

    if search:
        search_term = f"%{search.lower()}%"
        from sqlalchemy import or_, select

        tag_skill_ids = (
            select(SkillTag.skill_id)
            .join(Tag, SkillTag.tag_id == Tag.id)
            .where(Tag.name.ilike(search_term))
        )
        query = query.filter(
            or_(
                Skill.name.ilike(search_term),
                Skill.description.ilike(search_term),
                Skill.id.in_(tag_skill_ids),
            )
        )

    skills = query.all()
    return [_to_skill_response(s) for s in skills]


@router.post("/", response_model=SkillResponse)
def create_skill(
    data: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    for tid in data.team_ids:
        if not db.query(Team).filter(Team.id == tid).first():
            raise HTTPException(status_code=400, detail=f"Team {tid} not found")

    skill = Skill(
        name=data.name,
        description=data.description,
        is_future=data.is_future,
        is_archived=False,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

    for tid in data.team_ids:
        db.add(SkillTeam(skill_id=skill.id, team_id=tid))

    for tag_name in data.tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        db.add(SkillTag(skill_id=skill.id, tag_id=tag.id))

    _sync_m2m(db, skill.id, data)

    db.commit()

    loaded = _eager_load_skill(db, skill.id)
    return _to_skill_response(loaded)


@router.get("/explorer", response_model=ExplorerResponse)
def explorer_search(
    q: Optional[str] = Query(None),
    domain_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(PlanSkill, Skill, User, Team)
        .join(Skill, PlanSkill.skill_id == Skill.id)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .join(User, DevelopmentPlan.engineer_id == User.id)
        .outerjoin(Team, User.team_id == Team.id)
    )

    if q:
        query = query.filter(Skill.name.ilike(f"%{q}%"))

    if domain_id is not None:
        query = query.join(SkillDomain, Skill.id == SkillDomain.skill_id).filter(
            SkillDomain.domain_id == domain_id
        )

    if status is not None:
        query = query.filter(PlanSkill.status == status)

    query = query.order_by(Skill.name, User.name)
    rows = query.all()

    results = [
        ExplorerEngineerResult(
            engineer_id=user.id,
            engineer_name=user.name,
            team_id=team.id if team else None,
            team_name=team.name if team else None,
            skill_name=skill.name,
            status=plan_skill.status.value,
            proficiency_level=plan_skill.proficiency_level,
        )
        for plan_skill, skill, user, team in rows
    ]

    return ExplorerResponse(results=results, total=len(results))


@router.get("/compare", response_model=CompareResponse)
def compare_teams(
    team_a: Optional[int] = Query(None),
    team_b: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if team_a is None or team_b is None:
        raise HTTPException(
            status_code=400, detail="Both team_a and team_b are required"
        )

    team_a_obj = db.query(Team).filter(Team.id == team_a).first()
    if team_a_obj is None:
        raise HTTPException(status_code=404, detail=f"Team {team_a} not found")

    team_b_obj = db.query(Team).filter(Team.id == team_b).first()
    if team_b_obj is None:
        raise HTTPException(status_code=404, detail=f"Team {team_b} not found")

    skills_a = (
        db.query(Skill)
        .join(SkillTeam, Skill.id == SkillTeam.skill_id)
        .filter(SkillTeam.team_id == team_a, Skill.is_archived == False)  # noqa: E712
        .all()
    )

    skills_b = (
        db.query(Skill)
        .join(SkillTeam, Skill.id == SkillTeam.skill_id)
        .filter(SkillTeam.team_id == team_b, Skill.is_archived == False)  # noqa: E712
        .all()
    )

    ids_a = {s.id for s in skills_a}
    ids_b = {s.id for s in skills_b}
    overlap_ids = ids_a & ids_b
    union_count = len(ids_a | ids_b)
    overlap_count = len(overlap_ids)
    overlap_percent = (
        round((overlap_count / union_count) * 100, 1) if union_count > 0 else 0.0
    )

    return CompareResponse(
        team_a=CompareTeamResult(
            team_id=team_a_obj.id,
            team_name=team_a_obj.name,
            skills=[
                CompareSkillInfo(id=s.id, name=s.name, is_overlap=s.id in overlap_ids)
                for s in skills_a
            ],
        ),
        team_b=CompareTeamResult(
            team_id=team_b_obj.id,
            team_name=team_b_obj.name,
            skills=[
                CompareSkillInfo(id=s.id, name=s.name, is_overlap=s.id in overlap_ids)
                for s in skills_b
            ],
        ),
        overlap_count=overlap_count,
        overlap_percent=overlap_percent,
    )


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skill = _eager_load_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return _to_skill_response(skill)


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: int,
    data: SkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    updated = False

    if data.name is not None:
        skill.name = data.name
        updated = True

    if data.description is not None:
        skill.description = data.description
        updated = True

    if data.is_future is not None:
        skill.is_future = data.is_future
        updated = True

    if data.is_archived is not None:
        skill.is_archived = data.is_archived
        updated = True

    if data.team_ids is not None:
        for tid in data.team_ids:
            if not db.query(Team).filter(Team.id == tid).first():
                raise HTTPException(status_code=400, detail=f"Team {tid} not found")
        db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
        for tid in data.team_ids:
            db.add(SkillTeam(skill_id=skill_id, team_id=tid))
        updated = True

    if data.tag_names is not None:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        for tag_name in data.tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(SkillTag(skill_id=skill_id, tag_id=tag.id))
        updated = True

    m2m_changed = any(
        getattr(data, f) is not None
        for f in (
            "organisation_ids",
            "domain_ids",
            "shift_ids",
            "certificate_ids",
            "campaign_ids",
        )
    )
    if m2m_changed:
        _sync_m2m(db, skill_id, data)
        updated = True

    if updated:
        skill.catalog_version += 1
        skill.updated_at = datetime.utcnow()

    db.commit()

    loaded = _eager_load_skill(db, skill_id)
    return _to_skill_response(loaded)


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    in_plan = db.query(PlanSkill).filter(PlanSkill.skill_id == skill_id).first()

    if in_plan:
        skill.is_archived = True
        skill.catalog_version += 1
        skill.updated_at = datetime.utcnow()
        db.commit()
        return {"detail": "Skill archived"}
    else:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
        db.query(SkillOrganisation).filter(
            SkillOrganisation.skill_id == skill_id
        ).delete()
        db.query(SkillDomain).filter(SkillDomain.skill_id == skill_id).delete()
        db.query(SkillShift).filter(SkillShift.skill_id == skill_id).delete()
        db.query(SkillCertificate).filter(
            SkillCertificate.skill_id == skill_id
        ).delete()
        db.query(SkillCampaign).filter(SkillCampaign.skill_id == skill_id).delete()
        db.query(SkillLevelContent).filter(
            SkillLevelContent.skill_id == skill_id
        ).delete()
        db.delete(skill)
        db.commit()
        return {"detail": "Skill deleted"}


@router.post("/{skill_id}/assignments")
def update_skill_assignments(
    skill_id: int,
    data: SkillAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    db.query(SkillOrganisation).filter(SkillOrganisation.skill_id == skill_id).delete()
    for oid in data.organisation_ids:
        db.add(SkillOrganisation(skill_id=skill_id, organisation_id=oid))

    db.query(SkillDomain).filter(SkillDomain.skill_id == skill_id).delete()
    for did in data.domain_ids:
        db.add(SkillDomain(skill_id=skill_id, domain_id=did))

    db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
    for tid in data.team_ids:
        db.add(SkillTeam(skill_id=skill_id, team_id=tid))

    db.query(SkillShift).filter(SkillShift.skill_id == skill_id).delete()
    for sid in data.shift_ids:
        db.add(SkillShift(skill_id=skill_id, shift_id=sid))

    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete()
    for cid in data.certificate_ids:
        db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))

    db.query(SkillCampaign).filter(SkillCampaign.skill_id == skill_id).delete()
    for cid in data.campaign_ids:
        db.add(SkillCampaign(skill_id=skill_id, campaign_id=cid))

    skill.catalog_version += 1
    from datetime import datetime as dt

    skill.updated_at = dt.utcnow()

    db.commit()
    return {"status": "success"}


@router.post("/{skill_id}/content", response_model=SkillLevelContentResponse)
def add_skill_content(
    skill_id: int,
    data: SkillLevelContentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    if data.level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")

    if data.position is not None:
        position = data.position
    else:
        from sqlalchemy import func

        max_pos = (
            db.query(func.max(SkillLevelContent.position))
            .filter(
                SkillLevelContent.skill_id == skill_id,
                SkillLevelContent.level == data.level,
            )
            .scalar()
        )
        position = (max_pos or 0) + 1

    content = SkillLevelContent(
        skill_id=skill_id,
        level=data.level,
        type=data.type,
        title=data.title,
        description=data.description,
        url=data.url,
        position=position,
        created_at=datetime.utcnow(),
    )
    db.add(content)
    db.commit()
    db.refresh(content)
    return content


@router.get("/{skill_id}/content", response_model=list[SkillLevelContentResponse])
def list_skill_content(
    skill_id: int,
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    query = db.query(SkillLevelContent).filter(SkillLevelContent.skill_id == skill_id)
    if level is not None:
        query = query.filter(SkillLevelContent.level == level)

    return query.order_by(
        SkillLevelContent.level, SkillLevelContent.position, SkillLevelContent.id
    ).all()


@router.put("/{skill_id}/content/reorder")
def reorder_skill_content(
    skill_id: int,
    data: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    for item in data.items:
        content = (
            db.query(SkillLevelContent)
            .filter(
                SkillLevelContent.id == item.id, SkillLevelContent.skill_id == skill_id
            )
            .first()
        )
        if content is None:
            raise HTTPException(
                status_code=404, detail=f"Content item {item.id} not found"
            )
        content.position = item.position

    db.commit()
    return {"detail": "Reorder successful"}


@router.put(
    "/{skill_id}/content/{content_id}", response_model=SkillLevelContentResponse
)
def update_skill_content(
    skill_id: int,
    content_id: int,
    data: SkillLevelContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id, SkillLevelContent.skill_id == skill_id
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    if data.level is not None:
        if data.level not in (1, 2, 3):
            raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")
        content.level = data.level

    if data.type is not None:
        content.type = data.type
    if data.title is not None:
        content.title = data.title
    if data.description is not None:
        content.description = data.description
    if data.url is not None:
        content.url = data.url
    if data.position is not None:
        content.position = data.position

    db.commit()
    db.refresh(content)
    return content


@router.delete("/{skill_id}/content/{content_id}")
def delete_skill_content(
    skill_id: int,
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id, SkillLevelContent.skill_id == skill_id
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    db.delete(content)
    db.commit()
    return {"detail": "Content item deleted"}
