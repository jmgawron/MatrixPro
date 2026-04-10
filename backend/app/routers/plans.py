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
)
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.schemas.plan import (
    PlanResponse,
    PlanSkillCreate,
    PlanSkillResponse,
    PlanSkillUpdate,
    TrainingLogCreate,
    TrainingLogResponse,
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
