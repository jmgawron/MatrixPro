from datetime import datetime

from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.engineer
    team_id: int | None = None
    manager_id: int | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    team_id: int | None = None
    manager_id: int | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    team_id: int | None = None
    manager_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
