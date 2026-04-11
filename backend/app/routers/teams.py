from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.org import Domain, Team
from app.models.plan import DevelopmentPlan, PlanSkill
from app.models.skill import Skill, SkillTeam
from app.models.user import User, UserRole
from app.schemas.org import (
    MatrixCellInfo,
    MatrixEngineerRow,
    MatrixSkillInfo,
    TeamCreate,
    TeamMatrixResponse,
    TeamResponse,
)

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
    team = (
        db.query(Team)
        .options(joinedload(Team.domain))
        .filter(Team.id == team.id)
        .first()
    )
    return _team_to_response(team)


@router.get("/matrix", response_model=TeamMatrixResponse)
def get_team_matrix(
    team_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.engineer:
        raise HTTPException(status_code=403, detail="Forbidden")

    if current_user.role == UserRole.admin:
        if team_id is None:
            raise HTTPException(
                status_code=400,
                detail="team_id query parameter required for admin",
            )
        team = db.query(Team).filter(Team.id == team_id).first()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        engineers = db.query(User).filter(User.team_id == team_id).all()
    else:
        if current_user.team_id is None:
            raise HTTPException(status_code=400, detail="Manager has no team assigned")
        team = db.query(Team).filter(Team.id == current_user.team_id).first()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        engineers = db.query(User).filter(User.manager_id == current_user.id).all()

    skill_rows = (
        db.query(Skill)
        .join(SkillTeam, SkillTeam.skill_id == Skill.id)
        .filter(SkillTeam.team_id == team.id, Skill.is_archived == False)  # noqa: E712
        .order_by(Skill.id)
        .all()
    )

    engineer_ids = [e.id for e in engineers]
    plan_skill_ids_in_plans: set[int] = set()
    if engineer_ids:
        plan_skill_records = (
            db.query(PlanSkill)
            .join(DevelopmentPlan, DevelopmentPlan.id == PlanSkill.plan_id)
            .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
            .all()
        )
        plan_skill_ids_in_plans = {ps.skill_id for ps in plan_skill_records}

    team_skill_ids = {s.id for s in skill_rows}
    extra_skill_ids = plan_skill_ids_in_plans - team_skill_ids
    extra_skills: list[Skill] = []
    if extra_skill_ids:
        extra_skills = (
            db.query(Skill)
            .join(SkillTeam, SkillTeam.skill_id == Skill.id)
            .filter(
                SkillTeam.team_id == team.id,
                Skill.id.in_(extra_skill_ids),
            )
            .order_by(Skill.id)
            .all()
        )

    all_skills = skill_rows + extra_skills

    plan_skill_map: dict[int, dict[int, PlanSkill]] = {e.id: {} for e in engineers}
    if engineer_ids:
        all_plan_skills = (
            db.query(PlanSkill)
            .join(DevelopmentPlan, DevelopmentPlan.id == PlanSkill.plan_id)
            .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
            .all()
        )
        plan_ids = {ps.plan_id for ps in all_plan_skills}
        plan_id_to_engineer: dict[int, int] = {}
        if plan_ids:
            dp_rows = (
                db.query(DevelopmentPlan).filter(DevelopmentPlan.id.in_(plan_ids)).all()
            )
            plan_id_to_engineer = {dp.id: dp.engineer_id for dp in dp_rows}
        for ps in all_plan_skills:
            eng_id = plan_id_to_engineer.get(ps.plan_id)
            if eng_id is not None and eng_id in plan_skill_map:
                plan_skill_map[eng_id][ps.skill_id] = ps

    skill_infos = [MatrixSkillInfo(id=s.id, name=s.name) for s in all_skills]
    engineer_rows = []
    for eng in engineers:
        cells: dict[str, MatrixCellInfo] = {}
        for skill in all_skills:
            ps = plan_skill_map[eng.id].get(skill.id)
            if ps is not None:
                cells[str(skill.id)] = MatrixCellInfo(
                    status=ps.status.value,
                    proficiency_level=ps.proficiency_level,
                )
            else:
                cells[str(skill.id)] = MatrixCellInfo(
                    status="not_in_plan",
                    proficiency_level=None,
                )
        engineer_rows.append(MatrixEngineerRow(id=eng.id, name=eng.name, cells=cells))

    return TeamMatrixResponse(
        team_id=team.id,
        team_name=team.name,
        skills=skill_infos,
        engineers=engineer_rows,
    )


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = (
        db.query(Team)
        .options(joinedload(Team.domain))
        .filter(Team.id == team_id)
        .first()
    )
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return _team_to_response(team)


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
    team = (
        db.query(Team)
        .options(joinedload(Team.domain))
        .filter(Team.id == team_id)
        .first()
    )
    return _team_to_response(team)


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
