from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole


def get_current_user(
    authorization: str = Header(...), db: Session = Depends(get_db)
) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*roles: UserRole) -> Callable:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return Depends(dependency)


def require_manager_of(engineer_id_param: str = "engineer_id"):
    def dependency(
        engineer_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role == UserRole.admin:
            return current_user
        engineer = db.query(User).filter(User.id == engineer_id).first()
        if engineer is None:
            raise HTTPException(status_code=404, detail="Engineer not found")
        if (
            engineer.manager_id != current_user.id
            and current_user.role != UserRole.manager
        ):
            raise HTTPException(
                status_code=403, detail="Not the manager of this engineer"
            )
        if engineer.manager_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Not the manager of this engineer"
            )
        return current_user

    return Depends(dependency)


def create_access_token(user_id: int) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expiry}, settings.JWT_SECRET, algorithm="HS256"
    )
