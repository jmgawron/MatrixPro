from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.plan import (
    PlanResponse,
    PlanSkillCreate,
    PlanSkillUpdate,
    TrainingLogCreate,
    TrainingLogResponse,
)

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("/", response_model=list[PlanResponse])
def list_plans(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/{engineer_id}", response_model=PlanResponse)
def get_plan(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.post("/{engineer_id}/skills", response_model=PlanResponse)
def add_skill_to_plan(
    engineer_id: int,
    data: PlanSkillCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.put("/{engineer_id}/skills/{plan_skill_id}", response_model=PlanResponse)
def update_plan_skill(
    engineer_id: int,
    plan_skill_id: int,
    data: PlanSkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.delete("/{engineer_id}/skills/{plan_skill_id}")
def remove_skill_from_plan(
    engineer_id: int,
    plan_skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


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
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")
