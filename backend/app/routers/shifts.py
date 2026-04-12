from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models.catalog import Shift, SkillShift
from app.models.org import Domain
from app.models.user import User, UserRole
from app.schemas.catalog import ShiftCreate, ShiftResponse, ShiftUpdate

router = APIRouter(prefix="/api/shifts", tags=["shifts"])


@router.get("/", response_model=list[ShiftResponse])
def list_shifts(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    return db.query(Shift).order_by(Shift.domain_id, Shift.name).all()


@router.post("/", response_model=ShiftResponse, status_code=201)
def create_shift(
    data: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")

    shift = Shift(name=data.name, domain_id=data.domain_id)
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.put("/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    data: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")

    if data.name is not None:
        shift.name = data.name
    if data.domain_id is not None:
        domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
        if domain is None:
            raise HTTPException(status_code=404, detail="Domain not found")
        shift.domain_id = data.domain_id

    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/{shift_id}")
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if shift is None:
        raise HTTPException(status_code=404, detail="Shift not found")

    skill_count = db.query(SkillShift).filter(SkillShift.shift_id == shift_id).count()
    if skill_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete shift with {skill_count} assigned skill(s)",
        )

    db.delete(shift)
    db.commit()
    return {"detail": "Shift deleted"}
