from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audit import AuditLog
from app.models.plan import (
    DevelopmentPlan,
    HiddenCatalogContent,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserContentOverride,
    UserLevelContent,
)
from app.models.org import Team
from app.models.skill import Skill, SkillLevelContent, SkillTeam
from app.models.user import User, UserRole
from app.schemas.org import BulkAssignRequest, BulkAssignResponse, BulkAssignResultItem
from app.schemas.plan import (
    ContentCompletionResponse,
    ContentCompletionToggle,
    ContentOverrideCreate,
    ContentOverrideResponse,
    MergedContentItem,
    OwnSkillCreate,
    OwnSkillUpdate,
    PlanResponse,
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


def _eager_load_plan(db: Session, plan_id: int) -> Optional[DevelopmentPlan]:
    return (
        db.query(DevelopmentPlan)
        .options(
            selectinload(DevelopmentPlan.engineer),
            selectinload(DevelopmentPlan.skills)
            .selectinload(PlanSkill.skill)
            .selectinload(Skill.skill_teams)
            .selectinload(SkillTeam.team)
            .selectinload(Team.domain),
            selectinload(DevelopmentPlan.skills)
            .selectinload(PlanSkill.skill)
            .selectinload(Skill.level_content),
            selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.training_log),
        )
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

        skill_responses.append(
            PlanSkillResponse(
                id=ps.id,
                plan_id=ps.plan_id,
                skill_id=ps.skill_id,
                skill_name=ps.skill.name,
                skill_icon=ps.skill.icon,
                is_custom=ps.skill.is_custom,
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
            )
        )
    return PlanResponse(
        id=plan.id,
        engineer_id=plan.engineer_id,
        engineer_name=plan.engineer.name,
        created_at=plan.created_at,
        skills=skill_responses,
    )


def _get_or_create_plan(db: Session, engineer_id: int) -> DevelopmentPlan:
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
        db.commit()
        db.refresh(plan)
    return plan


@router.get("/", response_model=list[PlanResponse])
def list_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.admin, UserRole.manager):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if current_user.role == UserRole.admin:
        plans = (
            db.query(DevelopmentPlan)
            .options(
                selectinload(DevelopmentPlan.engineer),
                selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.skill),
                selectinload(DevelopmentPlan.skills).selectinload(
                    PlanSkill.training_log
                ),
            )
            .all()
        )
    else:
        report_ids = [r.id for r in current_user.reports]
        plans = (
            db.query(DevelopmentPlan)
            .options(
                selectinload(DevelopmentPlan.engineer),
                selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.skill),
                selectinload(DevelopmentPlan.skills).selectinload(
                    PlanSkill.training_log
                ),
            )
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

    results: list[BulkAssignResultItem] = []
    assigned_count = 0
    skipped_count = 0
    error_count = 0

    for eng_id in data.engineer_ids:
        engineer = db.query(User).filter(User.id == eng_id).first()
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

        plan = _get_or_create_plan(db, eng_id)

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

    skill = Skill(
        name=data.name.strip(),
        description=data.description,
        icon=None,
        is_archived=False,
        is_custom=True,
        owner_id=engineer_id,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

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

    items = []
    completed_count = 0
    for item in catalog_items:
        if item.id in hidden_ids:
            continue
        comp = completions.get(item.id)
        ovr = overrides.get(item.id)
        is_completed = comp.completed if comp else False
        if is_completed:
            completed_count += 1
        items.append(
            MergedContentItem(
                id=item.id,
                skill_id=item.skill_id,
                level=item.level,
                type=item.type,
                title=item.title,
                description=ovr.override_description if ovr else item.description,
                url=item.url,
                position=item.position,
                completed=is_completed,
                completed_at=comp.completed_at if comp else None,
                completion_notes=comp.notes if comp else None,
                has_override=ovr is not None,
                override_description=ovr.override_description if ovr else None,
                is_user_content=False,
            )
        )

    user_items = (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
        )
        .order_by(UserLevelContent.level, UserLevelContent.position)
        .all()
    )

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

    items.sort(key=lambda x: (x.level, x.position, x.id))

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

    log_action = "completed" if existing.completed else "uncompleted"
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
            is_active=True,
        )
        db.add(existing)
    else:
        existing.override_description = data.override_description
        existing.is_active = True
        existing.updated_at = now

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

    if data.level not in (1, 2, 3, 4, 5):
        raise HTTPException(status_code=400, detail="Level must be between 1 and 5")

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
    _check_plan_access(current_user, engineer_id, db)
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
    _check_plan_access(current_user, engineer_id, db)
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

    log_action = "completed" if item.completed else "uncompleted"
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

    count = (
        db.query(HiddenCatalogContent)
        .filter(
            HiddenCatalogContent.user_id == engineer_id,
            HiddenCatalogContent.plan_skill_id == plan_skill_id,
        )
        .delete()
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
