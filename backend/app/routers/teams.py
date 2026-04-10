from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.org import Domain, Team
from app.models.user import User, UserRole
from app.schemas.org import TeamCreate, TeamResponse

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _team_to_response(team: Team) -> TeamResponse:
    return TeamResponse(
        id=team.id,
        name=team.name,
        domain_id=team.domain_id,
        domain_name=team.domain.name if team.domain else None,
        created_at=team.created_at,
    )


@router.get("/", response_model=list[TeamResponse])
def list_teams(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    teams = db.query(Team).options(joinedload(Team.domain)).all()
    return [_team_to_response(t) for t in teams]


@router.post("/", response_model=TeamResponse)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
    if domain is None:
        raise HTTPException(status_code=404, detail="Domain not found")
    team = Team(name=data.name, domain_id=data.domain_id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(
    team_id: int,
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    if data.domain_id is not None:
        domain = db.query(Domain).filter(Domain.id == data.domain_id).first()
        if domain is None:
            raise HTTPException(status_code=404, detail="Domain not found")
        team.domain_id = data.domain_id
    if data.name is not None:
        team.name = data.name
    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}")
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    member_count = db.query(User).filter(User.team_id == team_id).count()
    if member_count > 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete team with active members"
        )
    db.delete(team)
    db.commit()
    return {"detail": "Team deleted"}
