from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audit import AuditLog
from app.logging_config import get_logger
from app.models.plan import (
    DevelopmentPlan,
    HiddenCatalogContent,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserContentOverride,
    UserLevelContent,
    UserCatalogDisplayOrder,
)
from app.models.org import Team
from app.models.skill import Skill, SkillCategory, SkillCategoryAssignment, SkillLevelContent, SkillLevelContentType, SkillTeam
from app.models.user import User, UserRole
from app.schemas.org import BulkAssignRequest, BulkAssignResponse, BulkAssignResultItem
from app.schemas.plan import (
    ContentOrderRequest,
    ContentCompletionResponse,
    ContentCompletionToggle,
    ContentOverrideCreate,
    ContentOverrideResponse,
    MergedContentItem,
    OwnSkillCreate,
    OwnSkillUpdate,
    PlanResponse,
    PlanSkillCategoryInfo,
    PlanSkillContentResponse,
    PlanSkillCreate,
    PlanSkillDomainInfo,
    PlanSkillResponse,
    PlanSkillUpdate,
    TrainingLogCreate,
    TrainingLogResponse,
    UserContentCreate,
    UserContentResponse,
    UserContentUpdate,
)

router = APIRouter(prefix="/api/plans", tags=["plans"])
audit_logger = get_logger("audit.plan")


def _audit_log(
    db: Session,
    entity_type: str,
    entity_id: int,
    field: str,
    old_value: Optional[str],
    new_value: Optional[str],
    changed_by: int,
) -> None:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        field=field,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by,
        changed_at=datetime.utcnow(),
    )
    db.add(entry)
    audit_logger.info(
        "plan_change | entity=%s/%s | field=%s | old=%s | new=%s | by=%s",
        entity_type,
        entity_id,
        field,
        old_value,
        new_value,
        changed_by,
    )


def _append_training_log(
    db: Session,
    plan_skill_id: int,
    title: str,
    log_type: SkillLevelContentType = SkillLevelContentType.action,
    notes: str | None = None,
) -> None:
    db.add(
        PlanSkillTrainingLog(
            plan_skill_id=plan_skill_id,
            title=title,
            type=log_type,
            completed_at=datetime.utcnow(),
            notes=notes,
        )
    )


def _check_plan_access(current_user: User, engineer_id: int, db: Session) -> User:
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")

    if current_user.role == UserRole.admin:
        return engineer

    if current_user.role == UserRole.manager:
        if engineer.manager_id == current_user.id:
            return engineer
        raise HTTPException(status_code=403, detail="Not the manager of this engineer")

    if current_user.id == engineer_id:
        return engineer

    raise HTTPException(status_code=403, detail="Access denied")


def _require_owner(current_user: User, engineer_id: int, db: Session) -> User:
    """Decision 2C: user-content mutations are owner-only. Admin retained for ops.

    Managers cannot create/edit/delete/toggle a report's personalized items even
    when they can view the report's plan.
    """
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    if current_user.role == UserRole.admin:
        return engineer
    if current_user.id == engineer_id:
        return engineer
    raise HTTPException(
        status_code=403,
        detail="Only the owner can modify personalized content",
    )


def _plan_list_eager_options():
    return [
        selectinload(DevelopmentPlan.engineer),
        selectinload(DevelopmentPlan.skills)
        .selectinload(PlanSkill.skill)
        .selectinload(Skill.skill_teams)
        .selectinload(SkillTeam.team)
        .selectinload(Team.domain),
        selectinload(DevelopmentPlan.skills)
        .selectinload(PlanSkill.skill)
        .selectinload(Skill.level_content),
        selectinload(DevelopmentPlan.skills)
        .selectinload(PlanSkill.skill)
        .selectinload(Skill.skill_categories)
        .selectinload(SkillCategoryAssignment.category),
        selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.training_log),
    ]


def _eager_load_plan(db: Session, plan_id: int) -> Optional[DevelopmentPlan]:
    return (
        db.query(DevelopmentPlan)
        .options(*_plan_list_eager_options())
        .filter(DevelopmentPlan.id == plan_id)
        .first()
    )


def _to_plan_response(plan: DevelopmentPlan) -> PlanResponse:
    skill_responses = []
    for ps in plan.skills:
        seen_domains = {}
        for st in ps.skill.skill_teams or []:
            d = st.team.domain
            if d and d.id not in seen_domains:
                seen_domains[d.id] = PlanSkillDomainInfo(id=d.id, name=d.name)

        content_types = list({lc.type.value for lc in (ps.skill.level_content or [])})

        categories = [
            PlanSkillCategoryInfo(
                id=sca.category.id,
                slug=sca.category.slug,
                name=sca.category.name,
                sort_order=sca.category.sort_order,
            )
            for sca in sorted(
                ps.skill.skill_categories or [],
                key=lambda x: x.category.sort_order if x.category else 0,
            )
            if sca.category is not None
        ]

        skill_responses.append(
            PlanSkillResponse(
                id=ps.id,
                plan_id=ps.plan_id,
                skill_id=ps.skill_id,
                skill_name=ps.skill.name,
                skill_icon=ps.skill.icon,
                is_custom=ps.skill.is_custom,
                is_orphaned=getattr(ps.skill, "is_orphaned", False),
                status=ps.status,
                proficiency_level=ps.proficiency_level,
                focus_area=ps.focus_area,
                notes=ps.notes,
                skill_version_at_add=ps.skill_version_at_add,
                added_at=ps.added_at,
                updated_at=ps.updated_at,
                training_logs=[
                    TrainingLogResponse.model_validate(log) for log in ps.training_log
                ],
                domains=list(seen_domains.values()),
                content_types=content_types,
                categories=categories,
            )
        )
    return PlanResponse(
        id=plan.id,
        engineer_id=plan.engineer_id,
        engineer_name=plan.engineer.name,
        created_at=plan.created_at,
        skills=skill_responses,
    )


def _get_or_create_plan(
    db: Session, engineer_id: int, *, commit: bool = True
) -> DevelopmentPlan:
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer_id)
        .first()
    )
    if plan is None:
        plan = DevelopmentPlan(
            engineer_id=engineer_id,
            created_at=datetime.utcnow(),
        )
        db.add(plan)
        if commit:
            db.commit()
            db.refresh(plan)
        else:
            db.flush()
    return plan


@router.get("/", response_model=list[PlanResponse])
def list_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if current_user.role == UserRole.admin:
        plans = db.query(DevelopmentPlan).options(*_plan_list_eager_options()).all()
    else:
        report_ids = [
            row[0]
            for row in db.query(User.id)
            .filter(User.manager_id == current_user.id)
            .all()
        ]
        plans = (
            db.query(DevelopmentPlan)
            .options(*_plan_list_eager_options())
            .filter(DevelopmentPlan.engineer_id.in_(report_ids))
            .all()
        )

    return [_to_plan_response(p) for p in plans]


@router.post("/bulk-assign", response_model=BulkAssignResponse)
def bulk_assign_skill(
    data: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    skill = db.query(Skill).filter(Skill.id == data.skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_archived:
        raise HTTPException(status_code=400, detail="Skill is archived")
    if skill.is_custom:
        raise HTTPException(
            status_code=400,
            detail="Personal skills cannot be assigned from the catalog",
        )

    results: list[BulkAssignResultItem] = []
    assigned_count = 0
    skipped_count = 0
    error_count = 0

    engineer_ids = list(data.engineer_ids)
    engineers_by_id = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(engineer_ids)).all()
    }
    existing_plans = {
        p.engineer_id: p
        for p in db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
        .all()
    }

    for eng_id in engineer_ids:
        engineer = engineers_by_id.get(eng_id)
        if engineer is None:
            results.append(
                BulkAssignResultItem(
                    engineer_id=eng_id,
                    engineer_name="Unknown",
                    result="error",
                    detail="Engineer not found",
                )
            )
            error_count += 1
            continue

        if current_user.role == UserRole.manager:
            if engineer.manager_id != current_user.id:
                results.append(
                    BulkAssignResultItem(
                        engineer_id=eng_id,
                        engineer_name=engineer.name,
                        result="error",
                        detail="Not your direct report",
                    )
                )
                error_count += 1
                continue

        plan = existing_plans.get(eng_id)
        if plan is None:
            plan = DevelopmentPlan(
                engineer_id=eng_id,
                created_at=datetime.utcnow(),
            )
            db.add(plan)
            db.flush()
            existing_plans[eng_id] = plan

        existing = (
            db.query(PlanSkill)
            .filter(PlanSkill.plan_id == plan.id, PlanSkill.skill_id == data.skill_id)
            .first()
        )
        if existing:
            if data.skip_existing:
                results.append(
                    BulkAssignResultItem(
                        engineer_id=eng_id,
                        engineer_name=engineer.name,
                        result="skipped_existing",
                        detail="Skill already in plan",
                    )
                )
                skipped_count += 1
                continue
            else:
                results.append(
                    BulkAssignResultItem(
                        engineer_id=eng_id,
                        engineer_name=engineer.name,
                        result="error",
                        detail="Skill already in plan",
                    )
                )
                error_count += 1
                continue

        plan_skill = PlanSkill(
            plan_id=plan.id,
            skill_id=data.skill_id,
            status=data.status,
            notes=data.notes,
            skill_version_at_add=skill.catalog_version,
            added_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(plan_skill)
        db.flush()

        _audit_log(
            db,
            entity_type="plan_skill",
            entity_id=plan_skill.id,
            field="bulk_assign",
            old_value=None,
            new_value=f"{skill.name} → {engineer.name}",
            changed_by=current_user.id,
        )

        results.append(
            BulkAssignResultItem(
                engineer_id=eng_id,
                engineer_name=engineer.name,
                result="assigned",
            )
        )
        assigned_count += 1

    db.commit()

    return BulkAssignResponse(
        skill_id=data.skill_id,
        skill_name=skill.name,
        results=results,
        assigned_count=assigned_count,
        skipped_count=skipped_count,
        error_count=error_count,
    )


@router.post("/{engineer_id}/own-skills", response_model=PlanResponse)
def create_own_skill(
    engineer_id: int,
    data: OwnSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    if not data.name or not data.name.strip():
        raise HTTPException(status_code=400, detail="Skill name is required")

    if not data.category_id:
        raise HTTPException(status_code=400, detail="Category is required")

    cat = db.query(SkillCategory).filter(SkillCategory.id == data.category_id).first()
    if cat is None:
        raise HTTPException(status_code=400, detail=f"Category {data.category_id} not found")

    skill = Skill(
        name=data.name.strip(),
        description=data.description,
        icon="personal",
        is_archived=False,
        is_custom=True,
        owner_id=engineer_id,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

    db.add(SkillCategoryAssignment(skill_id=skill.id, category_id=data.category_id))

    plan = _get_or_create_plan(db, engineer_id)

    if data.proficiency_level is not None and data.proficiency_level not in (
        1,
        2,
        3,
        4,
        5,
    ):
        raise HTTPException(
            status_code=400, detail="Proficiency level must be between 1 and 5"
        )

    plan_skill = PlanSkill(
        plan_id=plan.id,
        skill_id=skill.id,
        status=data.status,
        proficiency_level=data.proficiency_level,
        notes=data.notes,
        skill_version_at_add=1,
        added_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(plan_skill)
    db.flush()

    _audit_log(
        db,
        entity_type="plan_skill",
        entity_id=plan_skill.id,
        field="own_skill_created",
        old_value=None,
        new_value=skill.name,
        changed_by=current_user.id,
    )

    db.commit()

    loaded = _eager_load_plan(db, plan.id)
    return _to_plan_response(loaded)


@router.put("/{engineer_id}/own-skills/{skill_id}", response_model=PlanResponse)
def update_own_skill(
    engineer_id: int,
    skill_id: int,
    data: OwnSkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    skill = (
        db.query(Skill)
        .filter(
            Skill.id == skill_id, Skill.is_custom == True, Skill.owner_id == engineer_id
        )
        .first()
    )
    if skill is None:
        raise HTTPException(status_code=404, detail="Own skill not found")

    updated = False
    if data.name is not None:
        if not data.name.strip():
            raise HTTPException(status_code=400, detail="Skill name cannot be empty")
        skill.name = data.name.strip()
        updated = True
    if data.description is not None:
        skill.description = data.description
        updated = True

    if updated:
        skill.updated_at = datetime.utcnow()
        _audit_log(
            db,
            entity_type="skill",
            entity_id=skill.id,
            field="own_skill_updated",
            old_value=None,
            new_value=skill.name,
            changed_by=current_user.id,
        )

    db.commit()

    plan = _get_or_create_plan(db, engineer_id)
    loaded = _eager_load_plan(db, plan.id)
    return _to_plan_response(loaded)


@router.get("/{engineer_id}", response_model=PlanResponse)
def get_plan(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    plan = _get_or_create_plan(db, engineer_id)
    loaded = _eager_load_plan(db, plan.id)
    return _to_plan_response(loaded)


@router.post("/{engineer_id}/skills", response_model=PlanResponse)
def add_skill_to_plan(
    engineer_id: int,
    data: PlanSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    skill = db.query(Skill).filter(Skill.id == data.skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_archived:
        raise HTTPException(status_code=400, detail="Skill is archived")
    if skill.is_custom:
        raise HTTPException(
            status_code=400,
            detail="Personal skills cannot be assigned from the catalog",
        )

    plan = _get_or_create_plan(db, engineer_id)

    existing = (
        db.query(PlanSkill)
        .filter(
            PlanSkill.plan_id == plan.id,
            PlanSkill.skill_id == data.skill_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Skill already in plan")

    if data.proficiency_level is not None and data.proficiency_level not in (
        1,
        2,
        3,
        4,
        5,
    ):
        raise HTTPException(
            status_code=400, detail="Proficiency level must be between 1 and 5"
        )

    plan_skill = PlanSkill(
        plan_id=plan.id,
        skill_id=data.skill_id,
        status=PlanSkillStatus.planned,
        proficiency_level=data.proficiency_level,
        notes=data.notes,
        skill_version_at_add=skill.catalog_version,
        added_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(plan_skill)
    db.flush()

    _audit_log(
        db,
        entity_type="plan_skill",
        entity_id=plan_skill.id,
        field="status",
        old_value=None,
        new_value=PlanSkillStatus.planned.value,
        changed_by=current_user.id,
    )

    db.commit()

    loaded = _eager_load_plan(db, plan.id)
    return _to_plan_response(loaded)


@router.put("/{engineer_id}/skills/{plan_skill_id}", response_model=PlanResponse)
def update_plan_skill(
    engineer_id: int,
    plan_skill_id: int,
    data: PlanSkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(
            PlanSkill.id == plan_skill_id,
            PlanSkill.plan_id == plan.id,
        )
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    updated = False

    if data.status is not None and data.status != plan_skill.status:
        _audit_log(
            db,
            entity_type="plan_skill",
            entity_id=plan_skill.id,
            field="status",
            old_value=plan_skill.status.value,
            new_value=data.status.value,
            changed_by=current_user.id,
        )
        plan_skill.status = data.status
        updated = True

    if (
        data.proficiency_level is not None
        and data.proficiency_level != plan_skill.proficiency_level
    ):
        if data.proficiency_level not in (1, 2, 3, 4, 5):
            raise HTTPException(
                status_code=400, detail="Proficiency level must be between 1 and 5"
            )
        _audit_log(
            db,
            entity_type="plan_skill",
            entity_id=plan_skill.id,
            field="proficiency_level",
            old_value=str(plan_skill.proficiency_level)
            if plan_skill.proficiency_level is not None
            else None,
            new_value=str(data.proficiency_level),
            changed_by=current_user.id,
        )
        plan_skill.proficiency_level = data.proficiency_level
        updated = True

    if data.focus_area is not None and data.focus_area != plan_skill.focus_area:
        valid_areas = ("education", "exposure", "experience", "")
        if data.focus_area not in valid_areas:
            raise HTTPException(
                status_code=400,
                detail="Focus area must be education, exposure, or experience",
            )
        _audit_log(
            db,
            entity_type="plan_skill",
            entity_id=plan_skill.id,
            field="focus_area",
            old_value=plan_skill.focus_area,
            new_value=data.focus_area or None,
            changed_by=current_user.id,
        )
        plan_skill.focus_area = data.focus_area or None
        updated = True

    if data.notes is not None and data.notes != plan_skill.notes:
        _audit_log(
            db,
            entity_type="plan_skill",
            entity_id=plan_skill.id,
            field="notes",
            old_value=plan_skill.notes,
            new_value=data.notes,
            changed_by=current_user.id,
        )
        plan_skill.notes = data.notes
        updated = True

    if updated:
        plan_skill.updated_at = datetime.utcnow()

    db.commit()

    loaded = _eager_load_plan(db, plan.id)
    return _to_plan_response(loaded)


@router.delete("/{engineer_id}/skills/{plan_skill_id}")
def remove_skill_from_plan(
    engineer_id: int,
    plan_skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(
            PlanSkill.id == plan_skill_id,
            PlanSkill.plan_id == plan.id,
        )
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    skill_name = plan_skill.skill.name

    db.query(PlanSkillTrainingLog).filter(
        PlanSkillTrainingLog.plan_skill_id == plan_skill_id
    ).delete()
    db.query(UserContentCompletion).filter(
        UserContentCompletion.plan_skill_id == plan_skill_id
    ).delete()
    db.query(UserContentOverride).filter(
        UserContentOverride.plan_skill_id == plan_skill_id
    ).delete()
    db.query(HiddenCatalogContent).filter(
        HiddenCatalogContent.plan_skill_id == plan_skill_id
    ).delete()
    db.query(UserCatalogDisplayOrder).filter(
        UserCatalogDisplayOrder.plan_skill_id == plan_skill_id
    ).delete()

    _audit_log(
        db,
        entity_type="plan_skill",
        entity_id=plan_skill_id,
        field="removed",
        old_value=skill_name,
        new_value=None,
        changed_by=current_user.id,
    )

    db.delete(plan_skill)
    db.commit()

    return {"detail": "Skill removed from plan"}


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/log", response_model=TrainingLogResponse
)
def add_training_log(
    engineer_id: int,
    plan_skill_id: int,
    data: TrainingLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(
            PlanSkill.id == plan_skill_id,
            PlanSkill.plan_id == plan.id,
        )
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    log_entry = PlanSkillTrainingLog(
        plan_skill_id=plan_skill_id,
        title=data.title,
        type=data.type,
        completed_at=data.completed_at,
        notes=data.notes,
    )
    db.add(log_entry)
    db.flush()

    _audit_log(
        db,
        entity_type="plan_skill",
        entity_id=plan_skill_id,
        field="training_log",
        old_value=None,
        new_value=data.title,
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(log_entry)

    return TrainingLogResponse.model_validate(log_entry)


@router.get(
    "/{engineer_id}/skills/{plan_skill_id}/content",
    response_model=PlanSkillContentResponse,
)
def get_plan_skill_content(
    engineer_id: int,
    plan_skill_id: int,
    include_hidden: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    catalog_items = (
        db.query(SkillLevelContent)
        .filter(SkillLevelContent.skill_id == plan_skill.skill_id)
        .order_by(SkillLevelContent.level, SkillLevelContent.position)
        .all()
    )

    completions = {
        c.content_id: c
        for c in db.query(UserContentCompletion).filter(
            UserContentCompletion.user_id == engineer_id,
            UserContentCompletion.plan_skill_id == plan_skill_id,
        )
    }

    overrides = {
        o.content_id: o
        for o in db.query(UserContentOverride).filter(
            UserContentOverride.user_id == engineer_id,
            UserContentOverride.plan_skill_id == plan_skill_id,
            UserContentOverride.is_active == True,
        )
    }

    hidden_ids = {
        h.content_id
        for h in db.query(HiddenCatalogContent).filter(
            HiddenCatalogContent.user_id == engineer_id,
            HiddenCatalogContent.plan_skill_id == plan_skill_id,
        )
    }

    display_orders = {
        o.content_id: o.position
        for o in db.query(UserCatalogDisplayOrder).filter(
            UserCatalogDisplayOrder.user_id == engineer_id,
            UserCatalogDisplayOrder.plan_skill_id == plan_skill_id,
        )
    }

    items = []
    completed_count = 0
    for item in catalog_items:
        is_hidden = item.id in hidden_ids
        if is_hidden and not include_hidden:
            continue
        comp = completions.get(item.id)
        ovr = overrides.get(item.id)
        is_completed = comp.completed if comp else False
        if is_completed and not is_hidden:
            completed_count += 1
        effective_position = display_orders.get(item.id, item.position)
        effective_type = ovr.override_type if ovr and ovr.override_type else item.type
        effective_url = (
            ovr.override_url if ovr and ovr.override_url is not None else item.url
        )
        items.append(
            MergedContentItem(
                id=item.id,
                skill_id=item.skill_id,
                level=item.level,
                type=effective_type,
                title=item.title,
                description=item.description,
                url=effective_url,
                position=effective_position,
                completed=is_completed,
                completed_at=comp.completed_at if comp else None,
                completion_notes=comp.notes if comp else None,
                has_override=ovr is not None,
                override_description=ovr.override_description if ovr else None,
                override_type=ovr.override_type if ovr else None,
                override_url=ovr.override_url if ovr else None,
                is_user_content=False,
                is_hidden=is_hidden,
            )
        )

    user_items_q = db.query(UserLevelContent).filter(
        UserLevelContent.user_id == engineer_id,
        UserLevelContent.plan_skill_id == plan_skill_id,
    )
    if (
        current_user.id != engineer_id
        and current_user.role != UserRole.admin
    ):
        user_items_q = user_items_q.filter(UserLevelContent.is_private == False)  # noqa: E712
    user_items = user_items_q.order_by(
        UserLevelContent.level, UserLevelContent.position
    ).all()

    for ui in user_items:
        if ui.completed:
            completed_count += 1
        items.append(
            MergedContentItem(
                id=ui.id,
                skill_id=ui.skill_id,
                level=ui.level,
                type=ui.type,
                title=ui.title,
                description=ui.description,
                description_format=ui.description_format,
                is_private=ui.is_private,
                url=ui.url,
                position=ui.position,
                completed=ui.completed,
                completed_at=ui.completed_at,
                completion_notes=None,
                has_override=False,
                override_description=None,
                is_user_content=True,
            )
        )

    items.sort(
        key=lambda x: (
            x.level,
            display_orders.get(x.id, x.position)
            if not x.is_user_content
            else x.position,
            x.id,
        )
    )

    return PlanSkillContentResponse(
        plan_skill_id=plan_skill_id,
        skill_id=plan_skill.skill_id,
        skill_name=plan_skill.skill.name,
        proficiency_level=plan_skill.proficiency_level,
        items=items,
        total_items=len(items),
        completed_items=completed_count,
    )


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/content/{content_id}/complete",
    response_model=ContentCompletionResponse,
)
def toggle_content_completion(
    engineer_id: int,
    plan_skill_id: int,
    content_id: int,
    data: ContentCompletionToggle = ContentCompletionToggle(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id,
            SkillLevelContent.skill_id == plan_skill.skill_id,
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    existing = (
        db.query(UserContentCompletion)
        .filter(
            UserContentCompletion.user_id == engineer_id,
            UserContentCompletion.plan_skill_id == plan_skill_id,
            UserContentCompletion.content_id == content_id,
        )
        .first()
    )

    now = datetime.utcnow()

    if existing is None:
        existing = UserContentCompletion(
            user_id=engineer_id,
            plan_skill_id=plan_skill_id,
            content_id=content_id,
            completed=True,
            completed_at=now,
            notes=data.notes,
        )
        db.add(existing)
    else:
        existing.completed = not existing.completed
        existing.completed_at = now if existing.completed else None
        existing.updated_at = now
        if data.notes is not None:
            existing.notes = data.notes

    log_action = "Marked complete" if existing.completed else "Marked incomplete"
    log_entry = PlanSkillTrainingLog(
        plan_skill_id=plan_skill_id,
        title=f"{log_action}: {content.title}",
        type=content.type,
        completed_at=now,
        notes=data.notes,
    )
    db.add(log_entry)

    _audit_log(
        db,
        entity_type="user_content_completion",
        entity_id=content_id,
        field="completed",
        old_value=str(not existing.completed),
        new_value=str(existing.completed),
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(existing)

    return ContentCompletionResponse.model_validate(existing)


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/content/{content_id}/override",
    response_model=ContentOverrideResponse,
)
def save_content_override(
    engineer_id: int,
    plan_skill_id: int,
    content_id: int,
    data: ContentOverrideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id,
            SkillLevelContent.skill_id == plan_skill.skill_id,
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    existing = (
        db.query(UserContentOverride)
        .filter(
            UserContentOverride.user_id == engineer_id,
            UserContentOverride.plan_skill_id == plan_skill_id,
            UserContentOverride.content_id == content_id,
        )
        .first()
    )

    now = datetime.utcnow()

    if existing is None:
        existing = UserContentOverride(
            user_id=engineer_id,
            plan_skill_id=plan_skill_id,
            content_id=content_id,
            override_description=data.override_description,
            override_type=data.override_type.value if data.override_type else None,
            override_url=data.override_url,
            is_active=True,
        )
        db.add(existing)
        notes_action = "Added personal notes"
    else:
        had_notes_before = bool(
            existing.override_description and str(existing.override_description).strip()
        )
        existing.override_description = data.override_description
        existing.override_type = (
            data.override_type.value if data.override_type else None
        )
        existing.override_url = data.override_url
        existing.is_active = True
        existing.updated_at = now
        notes_action = "Updated personal notes" if had_notes_before else "Added personal notes"

    _append_training_log(
        db,
        plan_skill_id,
        f"{notes_action}: {content.title[:80]}",
        content.type,
    )

    _audit_log(
        db,
        entity_type="user_content_override",
        entity_id=content_id,
        field="override_description",
        old_value=None,
        new_value="override saved",
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(existing)

    return ContentOverrideResponse.model_validate(existing)


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/user-content",
    response_model=UserContentResponse,
    status_code=201,
)
def create_user_content(
    engineer_id: int,
    plan_skill_id: int,
    data: UserContentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    if data.level not in (1, 2, 3):
        raise HTTPException(
            status_code=400,
            detail="Level must be 1 (Education), 2 (Exposure), or 3 (Experience)",
        )

    if not data.title or not data.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    max_pos = (
        db.query(UserLevelContent.position)
        .filter(
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
            UserLevelContent.level == data.level,
        )
        .order_by(UserLevelContent.position.desc())
        .first()
    )
    next_pos = (max_pos[0] + 1) if max_pos else 1000

    item = UserLevelContent(
        user_id=engineer_id,
        plan_skill_id=plan_skill_id,
        skill_id=plan_skill.skill_id,
        level=data.level,
        type=data.type,
        title=data.title.strip(),
        description=data.description,
        description_format=data.description_format or "markdown",
        is_private=bool(data.is_private),
        url=data.url,
        position=next_pos,
    )
    db.add(item)

    log_entry = PlanSkillTrainingLog(
        plan_skill_id=plan_skill_id,
        title=f"added user content: {data.title.strip()[:80]}",
        type=data.type,
        completed_at=datetime.utcnow(),
    )
    db.add(log_entry)

    _audit_log(
        db,
        entity_type="user_level_content",
        entity_id=0,
        field="created",
        old_value=None,
        new_value=data.title.strip()[:120],
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(item)

    return UserContentResponse.model_validate(item)


@router.put(
    "/{engineer_id}/skills/{plan_skill_id}/user-content/{item_id}",
    response_model=UserContentResponse,
)
def update_user_content(
    engineer_id: int,
    plan_skill_id: int,
    item_id: int,
    data: UserContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    item = (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.id == item_id,
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
        )
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="User content item not found")

    if data.title is not None:
        if not data.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        item.title = data.title.strip()
    if data.description is not None:
        item.description = data.description
    if data.description_format is not None:
        item.description_format = data.description_format
    if data.is_private is not None:
        item.is_private = bool(data.is_private)
    if data.url is not None:
        item.url = data.url
    if data.type is not None:
        item.type = data.type
    item.updated_at = datetime.utcnow()

    _audit_log(
        db,
        entity_type="user_level_content",
        entity_id=item_id,
        field="updated",
        old_value=None,
        new_value=item.title[:120],
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(item)

    return UserContentResponse.model_validate(item)


@router.delete(
    "/{engineer_id}/skills/{plan_skill_id}/user-content/{item_id}",
    status_code=204,
)
def delete_user_content(
    engineer_id: int,
    plan_skill_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    item = (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.id == item_id,
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
        )
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="User content item not found")

    _audit_log(
        db,
        entity_type="user_level_content",
        entity_id=item_id,
        field="deleted",
        old_value=item.title[:120],
        new_value=None,
        changed_by=current_user.id,
    )

    log_entry = PlanSkillTrainingLog(
        plan_skill_id=plan_skill_id,
        title=f"removed user content: {item.title[:80]}",
        type=item.type,
        completed_at=datetime.utcnow(),
    )
    db.add(log_entry)

    db.delete(item)
    db.commit()

    return None


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/user-content/{item_id}/complete",
    response_model=UserContentResponse,
)
def toggle_user_content_completion(
    engineer_id: int,
    plan_skill_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    item = (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.id == item_id,
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
        )
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="User content item not found")

    now = datetime.utcnow()
    item.completed = not item.completed
    item.completed_at = now if item.completed else None
    item.updated_at = now

    log_action = "Marked complete" if item.completed else "Marked incomplete"
    log_entry = PlanSkillTrainingLog(
        plan_skill_id=plan_skill_id,
        title=f"{log_action}: {item.title[:80]}",
        type=item.type,
        completed_at=now,
    )
    db.add(log_entry)

    _audit_log(
        db,
        entity_type="user_level_content",
        entity_id=item_id,
        field="completed",
        old_value=str(not item.completed),
        new_value=str(item.completed),
        changed_by=current_user.id,
    )

    db.commit()
    db.refresh(item)

    return UserContentResponse.model_validate(item)


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/content/{content_id}/hide",
    status_code=204,
)
def hide_catalog_content(
    engineer_id: int,
    plan_skill_id: int,
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .options(selectinload(PlanSkill.skill))
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id,
            SkillLevelContent.skill_id == plan_skill.skill_id,
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    existing = (
        db.query(HiddenCatalogContent)
        .filter(
            HiddenCatalogContent.user_id == engineer_id,
            HiddenCatalogContent.plan_skill_id == plan_skill_id,
            HiddenCatalogContent.content_id == content_id,
        )
        .first()
    )
    if existing:
        return None

    hidden = HiddenCatalogContent(
        user_id=engineer_id,
        plan_skill_id=plan_skill_id,
        content_id=content_id,
    )
    db.add(hidden)

    _append_training_log(
        db,
        plan_skill_id,
        f"Hidden: {content.title[:80]}",
        content.type,
    )

    _audit_log(
        db,
        entity_type="hidden_catalog_content",
        entity_id=content_id,
        field="hidden",
        old_value=None,
        new_value=content.title[:120],
        changed_by=current_user.id,
    )

    db.commit()
    return None


@router.delete(
    "/{engineer_id}/skills/{plan_skill_id}/content/{content_id}/hide",
    status_code=204,
)
def unhide_catalog_content(
    engineer_id: int,
    plan_skill_id: int,
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    hidden = (
        db.query(HiddenCatalogContent)
        .filter(
            HiddenCatalogContent.user_id == engineer_id,
            HiddenCatalogContent.plan_skill_id == plan_skill_id,
            HiddenCatalogContent.content_id == content_id,
        )
        .first()
    )
    if hidden is None:
        raise HTTPException(status_code=404, detail="Item is not hidden")

    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id,
            SkillLevelContent.skill_id == plan_skill.skill_id,
        )
        .first()
    )

    _append_training_log(
        db,
        plan_skill_id,
        f"Restored from catalog: {(content.title[:80] if content else f'item #{content_id}')}",
        content.type if content else SkillLevelContentType.action,
    )

    _audit_log(
        db,
        entity_type="hidden_catalog_content",
        entity_id=content_id,
        field="unhidden",
        old_value="hidden",
        new_value=None,
        changed_by=current_user.id,
    )

    db.delete(hidden)
    db.commit()
    return None


@router.put(
    "/{engineer_id}/skills/{plan_skill_id}/content/order",
    status_code=200,
)
def update_content_display_order(
    engineer_id: int,
    plan_skill_id: int,
    data: ContentOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    catalog_ids = {
        c.id
        for c in db.query(SkillLevelContent)
        .filter(SkillLevelContent.skill_id == plan_skill.skill_id)
        .all()
    }

    for entry in data.items:
        if entry.level not in (1, 2, 3):
            raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")
        if entry.kind == "user":
            row = (
                db.query(UserLevelContent)
                .filter(
                    UserLevelContent.id == entry.id,
                    UserLevelContent.user_id == engineer_id,
                    UserLevelContent.plan_skill_id == plan_skill_id,
                )
                .first()
            )
            if row is None:
                raise HTTPException(status_code=404, detail=f"User item {entry.id} not found")
            row.position = entry.position
        elif entry.kind == "catalog":
            if entry.id not in catalog_ids:
                raise HTTPException(
                    status_code=404, detail=f"Catalog item {entry.id} not found"
                )
            existing = (
                db.query(UserCatalogDisplayOrder)
                .filter(
                    UserCatalogDisplayOrder.user_id == engineer_id,
                    UserCatalogDisplayOrder.plan_skill_id == plan_skill_id,
                    UserCatalogDisplayOrder.content_id == entry.id,
                )
                .first()
            )
            if existing is None:
                db.add(
                    UserCatalogDisplayOrder(
                        user_id=engineer_id,
                        plan_skill_id=plan_skill_id,
                        content_id=entry.id,
                        position=entry.position,
                    )
                )
            else:
                existing.position = entry.position
                existing.updated_at = datetime.utcnow()
        else:
            raise HTTPException(status_code=400, detail="kind must be catalog or user")

    db.commit()
    return {"detail": "Order updated"}


@router.post(
    "/{engineer_id}/skills/{plan_skill_id}/resync",
    status_code=200,
)
def resync_catalog_content(
    engineer_id: int,
    plan_skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan = _get_or_create_plan(db, engineer_id)

    plan_skill = (
        db.query(PlanSkill)
        .filter(PlanSkill.id == plan_skill_id, PlanSkill.plan_id == plan.id)
        .first()
    )
    if plan_skill is None:
        raise HTTPException(status_code=404, detail="Plan skill not found")

    hidden_rows = (
        db.query(HiddenCatalogContent)
        .filter(
            HiddenCatalogContent.user_id == engineer_id,
            HiddenCatalogContent.plan_skill_id == plan_skill_id,
        )
        .all()
    )
    hidden_content_ids = [h.content_id for h in hidden_rows]
    count = len(hidden_rows)

    restored_contents = []
    if hidden_content_ids:
        restored_contents = (
            db.query(SkillLevelContent)
            .filter(SkillLevelContent.id.in_(hidden_content_ids))
            .all()
        )

    for hidden in hidden_rows:
        db.delete(hidden)

    if hidden_content_ids:
        db.query(UserContentOverride).filter(
            UserContentOverride.user_id == engineer_id,
            UserContentOverride.plan_skill_id == plan_skill_id,
            UserContentOverride.content_id.in_(hidden_content_ids),
        ).delete(synchronize_session=False)

    for content in restored_contents:
        _append_training_log(
            db,
            plan_skill_id,
            f"Restored from catalog: {content.title[:80]}",
            content.type,
        )

    if count > 0:
        _audit_log(
            db,
            entity_type="hidden_catalog_content",
            entity_id=plan_skill_id,
            field="resync",
            old_value=f"{count} hidden",
            new_value="0 hidden",
            changed_by=current_user.id,
        )

    db.commit()
    return {"detail": f"Restored {count} hidden item(s)"}
