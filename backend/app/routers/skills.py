from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.skill import (
    SkillCreate,
    SkillResponse,
    SkillUpdate,
    SkillLevelContentCreate,
    SkillLevelContentResponse,
)

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/", response_model=list[SkillResponse])
def list_skills(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.post("/", response_model=SkillResponse)
def create_skill(
    data: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: int,
    data: SkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.post("/{skill_id}/content", response_model=SkillLevelContentResponse)
def add_skill_content(
    skill_id: int,
    data: SkillLevelContentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/{skill_id}/content", response_model=list[SkillLevelContentResponse])
def list_skill_content(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")
