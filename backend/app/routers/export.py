from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/plans/{engineer_id}/pdf")
def export_plan_pdf(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/plans/{engineer_id}/csv")
def export_plan_csv(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/skills/csv")
def export_skills_csv(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")
