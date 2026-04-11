from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audit import AuditLog
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserContentOverride,
    UserLevelContent,
)
from app.models.skill import Skill, SkillLevelContent
from app.models.user import User, UserRole
from app.schemas.plan import (
    ContentCompletionResponse,
    ContentCompletionToggle,
    ContentOverrideCreate,
    ContentOverrideResponse,
    MergedContentItem,
    PlanResponse,
    PlanSkillContentResponse,
    PlanSkillCreate,
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
            selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.skill),
            selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.training_log),
        )
        .filter(DevelopmentPlan.id == plan_id)
        .first()
    )


def _to_plan_response(plan: DevelopmentPlan) -> PlanResponse:
    skill_responses = []
    for ps in plan.skills:
        skill_responses.append(
            PlanSkillResponse(
                id=ps.id,
                plan_id=ps.plan_id,
                skill_id=ps.skill_id,
                skill_name=ps.skill.name,
                status=ps.status,
                proficiency_level=ps.proficiency_level,
                notes=ps.notes,
                skill_version_at_add=ps.skill_version_at_add,
                added_at=ps.added_at,
                updated_at=ps.updated_at,
                training_logs=[
                    TrainingLogResponse.model_validate(log) for log in ps.training_log
                ],
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

    plan_skill = PlanSkill(
        plan_id=plan.id,
        skill_id=data.skill_id,
        status=PlanSkillStatus.in_pipeline,
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
        new_value=PlanSkillStatus.in_pipeline.value,
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

    items = []
    completed_count = 0
    for item in catalog_items:
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

    if data.level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")

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
