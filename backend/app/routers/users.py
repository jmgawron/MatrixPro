import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    if current_user.role == UserRole.admin:
        return db.query(User).all()
    return db.query(User).filter(User.team_id == current_user.team_id).all()


@router.post("/", response_model=UserResponse)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        name=data.name,
        email=data.email,
        password_hash=password_hash,
        role=data.role,
        team_id=data.team_id,
        manager_id=data.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == UserRole.admin:
        return user

    if current_user.role == UserRole.manager:
        if user.team_id == current_user.team_id or user.id == current_user.id:
            return user
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role == UserRole.manager:
        if user.team_id != current_user.team_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    if data.email is not None:
        conflict = (
            db.query(User).filter(User.email == data.email, User.id != user_id).first()
        )
        if conflict:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = data.email

    if data.name is not None:
        user.name = data.name

    if data.team_id is not None:
        user.team_id = data.team_id

    if data.manager_id is not None:
        user.manager_id = data.manager_id

    if data.role is not None:
        if current_user.role != UserRole.admin:
            raise HTTPException(
                status_code=403, detail="Only admins can change user roles"
            )
        user.role = data.role

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}
