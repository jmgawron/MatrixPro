import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import create_access_token, get_current_user
from app.logging_config import get_logger, log_auth_event, log_client_ip, log_user_email, log_user_id
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
auth_logger = get_logger("auth")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "-"


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    log_client_ip.set(ip)

    user = db.query(User).filter(User.email == data.email).first()
    if user is None or not bcrypt.checkpw(
        data.password.encode(), user.password_hash.encode()
    ):
        log_auth_event(
            auth_logger,
            "login_failed",
            email=data.email,
            success=False,
            detail=f"ip={ip}",
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    log_user_id.set(str(user.id))
    log_user_email.set(user.email)
    log_auth_event(
        auth_logger,
        "login_success",
        email=user.email,
        user_id=user.id,
        detail=f"ip={ip}",
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/password")
def change_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not bcrypt.checkpw(
        data.current_password.encode(), current_user.password_hash.encode()
    ):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="New password must be at least 6 characters"
        )
    current_user.password_hash = bcrypt.hashpw(
        data.new_password.encode(), bcrypt.gensalt()
    ).decode()
    db.commit()
    log_auth_event(
        auth_logger,
        "password_changed",
        email=current_user.email,
        user_id=current_user.id,
    )
    return {"detail": "Password changed successfully"}


@router.put("/me/profile", response_model=UserResponse)
def update_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.name is not None:
        current_user.name = data.name
    if data.surname is not None:
        current_user.surname = data.surname
    if data.avatar is not None:
        current_user.avatar = data.avatar
    db.commit()
    db.refresh(current_user)
    return current_user
