from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def list_users(current_user: User = require_role(UserRole.admin, UserRole.manager)):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.post("/", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")
