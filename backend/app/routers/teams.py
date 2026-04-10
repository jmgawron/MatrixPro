from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.org import TeamCreate, TeamResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("/", response_model=list[TeamResponse])
def list_teams(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.post("/", response_model=TeamResponse)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")


@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    raise HTTPException(status_code=501, detail="Not implemented yet — Phase 1")
