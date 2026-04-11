from pydantic import BaseModel

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    name: str
    surname: str
    email: str
    role: UserRole
    avatar: str | None = None
    team_id: int | None = None
    manager_id: int | None = None

    model_config = {"from_attributes": True}


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    surname: str | None = None
    avatar: str | None = None
