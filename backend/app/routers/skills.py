from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.catalog import Certificate, SkillCertificate
from app.models.org import Domain, Team
from app.models.plan import (
    DevelopmentPlan,
    HiddenCatalogContent,
    PlanSkill,
    UserCatalogDisplayOrder,
    UserContentCompletion,
    UserContentOverride,
)
from app.models.skill import (
    Skill,
    SkillCategory,
    SkillCategoryAssignment,
    SkillLevelContent,
    SkillTag,
    SkillTeam,
    Tag,
)
from app.models.user import User, UserRole
from app.schemas.catalog import SkillAssignmentRequest
from app.schemas.skill import (
    CategoryInfo,
    CategoryResponse,
    CertificateInfo,
    CompareResponse,
    CompareSkillInfo,
    CompareTeamResult,
    ExplorerEngineerResult,
    ExplorerResponse,
    ReorderRequest,
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
        selectinload(Skill.skill_certificates).selectinload(
            SkillCertificate.certificate
        ),
        selectinload(Skill.skill_categories).selectinload(
            SkillCategoryAssignment.category
        ),
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
        icon=skill.icon,
        is_archived=skill.is_archived,
        is_orphaned=getattr(skill, "is_orphaned", False),
        catalog_version=skill.catalog_version,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=[TagResponse.model_validate(st.tag) for st in skill.skill_tags],
        teams=[
            TeamInfo(id=st.team.id, name=st.team.name, shift=st.team.shift)
            for st in skill.skill_teams
        ],
        certificates=[
            CertificateInfo(
                id=sc.certificate.id, name=sc.certificate.name, icon=sc.certificate.icon
            )
            for sc in skill.skill_certificates
        ],
        categories=[
            CategoryInfo(
                id=sca.category.id,
                slug=sca.category.slug,
                name=sca.category.name,
                sort_order=sca.category.sort_order,
            )
            for sca in skill.skill_categories
        ],
    )


def _sync_certificate_m2m(db: Session, skill_id: int, certificate_ids: list[int]):
    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete()
    for cid in certificate_ids:
        db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))


def _sync_category_m2m(db: Session, skill_id: int, category_ids: list[int]):
    db.query(SkillCategoryAssignment).filter(
        SkillCategoryAssignment.skill_id == skill_id
    ).delete()
    for cat_id in category_ids:
        if not db.query(SkillCategory).filter(SkillCategory.id == cat_id).first():
            raise HTTPException(
                status_code=400, detail=f"Category {cat_id} not found"
            )
        db.add(SkillCategoryAssignment(skill_id=skill_id, category_id=cat_id))


def _manager_accessible_team_ids(current_user: User, db: Session) -> set[int]:
    """Teams a manager may attach skills to: own team + teams of direct reports."""
    allowed: set[int] = set()
    if current_user.team_id is not None:
        allowed.add(current_user.team_id)
    report_team_ids = (
        db.query(User.team_id)
        .filter(User.manager_id == current_user.id, User.team_id.isnot(None))
        .distinct()
        .all()
    )
    allowed.update(row[0] for row in report_team_ids)
    return allowed


def _existing_skill_team_ids(db: Session, skill_id: int) -> set[int]:
    rows = (
        db.query(SkillTeam.team_id)
        .filter(SkillTeam.skill_id == skill_id)
        .all()
    )
    return {row[0] for row in rows}


def _check_manager_team_access(current_user: User, team_ids: list[int], db: Session):
    """Strict check for create / net-new team assignments."""
    if current_user.role == UserRole.admin:
        return
    if current_user.role != UserRole.manager:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if not team_ids:
        return
    allowed = _manager_accessible_team_ids(current_user, db)
    invalid = [tid for tid in team_ids if tid not in allowed]
    if invalid:
        raise HTTPException(
            status_code=403,
            detail=f"Not authorized to assign skills to team(s): {invalid}",
        )


def _check_manager_skill_edit_access(current_user: User, skill_id: int, db: Session):
    """Managers may edit skills assigned to at least one team they manage."""
    if current_user.role == UserRole.admin:
        return
    if current_user.role != UserRole.manager:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    allowed = _manager_accessible_team_ids(current_user, db)
    existing = _existing_skill_team_ids(db, skill_id)
    if existing and not existing.intersection(allowed):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to edit this skill",
        )


def _resolve_manager_team_ids(
    current_user: User,
    skill_id: int,
    requested: list[int],
    db: Session,
) -> list[int]:
    """Merge team assignments: managers control only their teams; other shifts stay."""
    allowed = _manager_accessible_team_ids(current_user, db)
    existing = _existing_skill_team_ids(db, skill_id)
    requested_set = set(requested)
    forbidden_new = requested_set - allowed - existing
    if forbidden_new:
        raise HTTPException(
            status_code=403,
            detail=f"Not authorized to assign skills to team(s): {sorted(forbidden_new)}",
        )
    preserved = existing - allowed
    final = preserved | (requested_set & allowed)
    return sorted(final)


@router.get("/", response_model=list[SkillResponse])
def list_skills(
    search: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    domain_id: Optional[int] = Query(None),
    include_archived: bool = Query(False),
    cert_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Skill).options(*_skill_eager_options())

    # Exclude custom (own) skills from catalog listing
    query = query.filter(Skill.is_custom == False)  # noqa: E712

    if not include_archived:
        query = query.filter(Skill.is_archived == False)  # noqa: E712

    if team_id is not None:
        query = query.join(SkillTeam, Skill.id == SkillTeam.skill_id).filter(
            SkillTeam.team_id == team_id
        )

    if domain_id is not None:
        domain = db.query(Domain).filter(Domain.id == domain_id).first()
        if domain and not domain.is_technical:
            # Non-technical domains: return skills with no team assignments
            assigned_skill_ids = db.query(SkillTeam.skill_id).distinct()
            query = query.filter(Skill.id.notin_(assigned_skill_ids))
        else:
            query = (
                query.join(SkillTeam, Skill.id == SkillTeam.skill_id)
                .join(Team, SkillTeam.team_id == Team.id)
                .filter(Team.domain_id == domain_id)
            )

    if cert_id is not None:
        query = query.join(
            SkillCertificate, Skill.id == SkillCertificate.skill_id
        ).filter(SkillCertificate.certificate_id == cert_id)

    if category_id is not None:
        query = query.join(
            SkillCategoryAssignment, Skill.id == SkillCategoryAssignment.skill_id
        ).filter(SkillCategoryAssignment.category_id == category_id)

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
    team_ids = list(data.team_ids)

    if data.is_non_technical:
        ntech_team_ids = [
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        ]
        if not ntech_team_ids:
            raise HTTPException(
                status_code=400,
                detail="Non-Technical team (NTECH-GEN) not found in catalog",
            )
        if team_ids:
            invalid = [tid for tid in team_ids if tid not in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Non-technical skill must only be assigned to NTECH-GEN "
                        f"teams; invalid team_ids: {invalid}"
                    ),
                )
        else:
            team_ids = ntech_team_ids

    _check_manager_team_access(current_user, team_ids, db)

    if team_ids:
        found_ids = {
            t.id for t in db.query(Team).filter(Team.id.in_(team_ids)).all()
        }
        missing = [tid for tid in team_ids if tid not in found_ids]
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Team(s) not found: {missing}"
            )

    skill = Skill(
        name=data.name,
        description=data.description,
        icon=data.icon,
        is_archived=False,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

    for tid in team_ids:
        db.add(SkillTeam(skill_id=skill.id, team_id=tid))

    for tag_name in data.tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        db.add(SkillTag(skill_id=skill.id, tag_id=tag.id))

    _sync_certificate_m2m(db, skill.id, data.certificate_ids)
    category_ids = [] if data.is_non_technical else data.category_ids
    _sync_category_m2m(db, skill.id, category_ids)

    db.commit()

    loaded = _eager_load_skill(db, skill.id)
    return _to_skill_response(loaded)


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SkillCategory)
        .order_by(SkillCategory.sort_order, SkillCategory.name)
        .all()
    )


@router.get("/ntech-teams")
def list_ntech_teams(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    teams = (
        db.query(Team)
        .filter(Team.name.like("TAC-NTECH-GEN-%"))
        .order_by(Team.name)
        .all()
    )
    return [
        {"id": t.id, "name": t.name, "shift": t.shift}
        for t in teams
    ]


@router.get("/explorer", response_model=ExplorerResponse)
def explorer_search(
    q: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
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

    if team_id is not None:
        query = query.filter(User.team_id == team_id)

    if status is not None:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if len(status_list) == 1:
            query = query.filter(PlanSkill.status == status_list[0])
        elif status_list:
            query = query.filter(PlanSkill.status.in_(status_list))

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

    _check_manager_skill_edit_access(current_user, skill_id, db)

    updated = False

    # Handle is_non_technical reclassification BEFORE team_ids processing so the
    # NTECH-aware team list flows through the same SkillTeam replace path below.
    if data.is_non_technical is not None:
        ntech_team_ids = [
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        ]
        if not ntech_team_ids:
            raise HTTPException(
                status_code=400,
                detail="Non-Technical team (NTECH-GEN) not found in catalog",
            )
        current_team_ids = [
            st.team_id
            for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
        ]
        current_is_ntech = any(tid in ntech_team_ids for tid in current_team_ids)

        if data.is_non_technical and not current_is_ntech:
            # Flip Technical -> Non-Technical: replace with all NTECH-GEN teams
            # unless caller supplied an explicit subset.
            if data.team_ids:
                invalid = [tid for tid in data.team_ids if tid not in ntech_team_ids]
                if invalid:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Non-technical skill must only be assigned to NTECH-GEN "
                            f"teams; invalid team_ids: {invalid}"
                        ),
                    )
            else:
                data.team_ids = ntech_team_ids
        elif (not data.is_non_technical) and current_is_ntech:
            # Flip Non-Technical -> Technical: caller MUST provide regular team_ids
            if not data.team_ids:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Reclassifying to Technical requires team_ids for the new "
                        "regular team assignments"
                    ),
                )
            invalid = [tid for tid in data.team_ids if tid in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Technical skill cannot be assigned to NTECH-GEN teams; "
                        f"invalid team_ids: {invalid}"
                    ),
                )
        elif data.is_non_technical and current_is_ntech and data.team_ids:
            # Already Non-Technical, validate any new team_ids stay within NTECH.
            invalid = [tid for tid in data.team_ids if tid not in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Non-technical skill must only be assigned to NTECH-GEN "
                        f"teams; invalid team_ids: {invalid}"
                    ),
                )

        if data.is_non_technical:
            # Non-technical skills are not grouped by proficiency categories.
            data.category_ids = []

    if data.name is not None:
        skill.name = data.name
        updated = True

    if data.description is not None:
        skill.description = data.description
        updated = True

    if data.icon is not None:
        skill.icon = data.icon
        updated = True

    if data.is_archived is not None:
        skill.is_archived = data.is_archived
        updated = True

    if data.team_ids is not None:
        team_ids = data.team_ids
        if current_user.role == UserRole.manager:
            team_ids = _resolve_manager_team_ids(
                current_user, skill_id, team_ids, db
            )
        for tid in team_ids:
            if not db.query(Team).filter(Team.id == tid).first():
                raise HTTPException(status_code=400, detail=f"Team {tid} not found")
        db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
        for tid in team_ids:
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

    if data.certificate_ids is not None:
        _sync_certificate_m2m(db, skill_id, data.certificate_ids)
        updated = True

    if data.category_ids is not None:
        ntech_team_ids = {
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        }
        current_team_ids = [
            st.team_id
            for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
        ]
        is_ntech = (
            data.is_non_technical
            if data.is_non_technical is not None
            else any(tid in ntech_team_ids for tid in current_team_ids)
        )
        _sync_category_m2m(db, skill_id, [] if is_ntech else data.category_ids)
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
        db.query(SkillCertificate).filter(
            SkillCertificate.skill_id == skill_id
        ).delete()
        db.query(SkillCategoryAssignment).filter(
            SkillCategoryAssignment.skill_id == skill_id
        ).delete()
        db.query(SkillLevelContent).filter(
            SkillLevelContent.skill_id == skill_id
        ).delete()
        db.delete(skill)
        db.commit()
        return {"detail": "Skill deleted"}


@router.get("/{skill_id}/cascade-preview")
def cascade_preview(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    from app.models.plan import PlanSkillTrainingLog

    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    plan_skill_ids = [
        ps.id
        for ps in db.query(PlanSkill.id)
        .filter(PlanSkill.skill_id == skill_id)
        .all()
    ]

    engineer_ids = (
        db.query(PlanSkill.plan_id)
        .filter(PlanSkill.skill_id == skill_id)
        .distinct()
        .count()
    )

    training_log_count = 0
    if plan_skill_ids:
        training_log_count = (
            db.query(PlanSkillTrainingLog)
            .filter(PlanSkillTrainingLog.plan_skill_id.in_(plan_skill_ids))
            .count()
        )

    return {
        "skill_id": skill_id,
        "skill_name": skill.name,
        "engineers_affected": engineer_ids,
        "plan_skills_affected": len(plan_skill_ids),
        "training_logs_preserved": training_log_count,
        "already_orphaned": bool(getattr(skill, "is_orphaned", False)),
    }


@router.get("/{skill_id}/reclassify-preview")
def reclassify_preview(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    ntech_team_ids = {
        t.id
        for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
    }
    current_team_ids = [
        st.team_id
        for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
    ]
    current_is_non_technical = any(tid in ntech_team_ids for tid in current_team_ids)

    engineers_affected = (
        db.query(PlanSkill.plan_id)
        .filter(PlanSkill.skill_id == skill_id)
        .distinct()
        .count()
    )

    return {
        "skill_id": skill_id,
        "skill_name": skill.name,
        "current_is_non_technical": current_is_non_technical,
        "engineers_affected": engineers_affected,
        "current_team_count": len(current_team_ids),
    }


@router.delete("/{skill_id}/cascade")
def cascade_delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    plan_skill_count = (
        db.query(PlanSkill).filter(PlanSkill.skill_id == skill_id).count()
    )

    db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
    db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
    db.query(SkillCertificate).filter(
        SkillCertificate.skill_id == skill_id
    ).delete()
    db.query(SkillCategoryAssignment).filter(
        SkillCategoryAssignment.skill_id == skill_id
    ).delete()
    db.query(SkillLevelContent).filter(
        SkillLevelContent.skill_id == skill_id
    ).delete()

    if plan_skill_count > 0:
        skill.is_archived = True
        skill.is_orphaned = True
        skill.catalog_version += 1
        skill.updated_at = datetime.utcnow()
        db.commit()
        return {
            "detail": "Skill cascade-deleted, kept as tombstone for active plans",
            "plan_skills_affected": plan_skill_count,
            "tombstone": True,
        }
    else:
        db.delete(skill)
        db.commit()
        return {
            "detail": "Skill cascade-deleted (hard delete, no active plans)",
            "plan_skills_affected": 0,
            "tombstone": False,
        }


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

    db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
    for tid in data.team_ids:
        db.add(SkillTeam(skill_id=skill_id, team_id=tid))

    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete()
    for cid in data.certificate_ids:
        db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))

    if data.tag_names is not None:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        for tag_name in data.tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(SkillTag(skill_id=skill_id, tag_id=tag.id))

    skill.catalog_version += 1
    skill.updated_at = datetime.utcnow()

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

    _check_manager_skill_edit_access(current_user, skill_id, db)

    if data.level not in (1, 2, 3, 4, 5):
        raise HTTPException(status_code=400, detail="Level must be between 1 and 5")

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

    _check_manager_skill_edit_access(current_user, skill_id, db)

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

    _check_manager_skill_edit_access(current_user, skill_id, db)

    if data.level is not None:
        if data.level not in (1, 2, 3, 4, 5):
            raise HTTPException(status_code=400, detail="Level must be between 1 and 5")
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


def _purge_catalog_content_plan_refs(db: Session, content_id: int) -> None:
    """Remove plan-side rows that FK to a catalog content item before hard-delete."""
    db.query(UserContentCompletion).filter(
        UserContentCompletion.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(UserContentOverride).filter(
        UserContentOverride.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(HiddenCatalogContent).filter(
        HiddenCatalogContent.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(UserCatalogDisplayOrder).filter(
        UserCatalogDisplayOrder.content_id == content_id
    ).delete(synchronize_session=False)


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

    _check_manager_skill_edit_access(current_user, skill_id, db)

    _purge_catalog_content_plan_refs(db, content_id)
    db.delete(content)
    db.commit()
    return {"detail": "Content item deleted"}
