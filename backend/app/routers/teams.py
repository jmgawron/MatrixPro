from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.audit import AuditLog
from app.models.org import Domain, Team
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
)
from app.models.skill import Skill, SkillTeam
from app.models.user import User, UserRole
from app.schemas.org import (
    ActivityItem,
    MatrixCellInfo,
    MatrixEngineerRow,
    MatrixSkillInfo,
    PerEngineerStat,
    PerSkillStat,
    SkillStatusCounts,
    TeamActivityResponse,
    TeamCreate,
    TeamMatrixResponse,
    TeamResponse,
    TeamStatsResponse,
)

router = APIRouter(prefix="/api/teams", tags=["teams"])


def _team_to_response(team: Team) -> TeamResponse:
    return TeamResponse(
        id=team.id,
        name=team.name,
        domain_id=team.domain_id,
        domain_name=team.domain.name if team.domain else None,
        shift=team.shift,
        icon=team.icon,
        created_at=team.created_at,
    )


def _resolve_team_and_engineers(
    current_user: User, db: Session, team_id: int | None = None
) -> tuple[Team, list[User]]:
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

    return team, engineers


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
    if data.shift not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="Shift must be 1, 2, 3, or 4")
    team = Team(
        name=data.name, domain_id=data.domain_id, shift=data.shift, icon=data.icon
    )
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
    team, engineers = _resolve_team_and_engineers(current_user, db, team_id)

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

    training_log_map: dict[int, datetime] = {}
    if engineer_ids:
        ps_ids = [
            ps.id
            for eng_skills in plan_skill_map.values()
            for ps in eng_skills.values()
        ]
        if ps_ids:
            max_logs = (
                db.query(
                    PlanSkillTrainingLog.plan_skill_id,
                    func.max(PlanSkillTrainingLog.completed_at).label("max_at"),
                )
                .filter(PlanSkillTrainingLog.plan_skill_id.in_(ps_ids))
                .group_by(PlanSkillTrainingLog.plan_skill_id)
                .all()
            )
            training_log_map = {row[0]: row[1] for row in max_logs if row[1]}

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
                    last_updated_at=ps.updated_at,
                    last_training_at=training_log_map.get(ps.id),
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


@router.get("/stats", response_model=TeamStatsResponse)
def get_team_stats(
    team_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team, engineers = _resolve_team_and_engineers(current_user, db, team_id)
    engineer_ids = [e.id for e in engineers]
    engineer_names = {e.id: e.name for e in engineers}

    team_skills = (
        db.query(Skill)
        .join(SkillTeam, SkillTeam.skill_id == Skill.id)
        .filter(SkillTeam.team_id == team.id, Skill.is_archived == False)  # noqa: E712
        .order_by(Skill.id)
        .all()
    )
    total_skills = len(team_skills)
    total_engineers = len(engineers)

    all_plan_skills: list[PlanSkill] = []
    plan_id_to_engineer: dict[int, int] = {}
    if engineer_ids:
        all_plan_skills = (
            db.query(PlanSkill)
            .join(DevelopmentPlan, DevelopmentPlan.id == PlanSkill.plan_id)
            .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
            .all()
        )
        plan_ids = {ps.plan_id for ps in all_plan_skills}
        if plan_ids:
            dp_rows = (
                db.query(DevelopmentPlan).filter(DevelopmentPlan.id.in_(plan_ids)).all()
            )
            plan_id_to_engineer = {dp.id: dp.engineer_id for dp in dp_rows}

    eng_skill_map: dict[int, dict[int, PlanSkill]] = {eid: {} for eid in engineer_ids}
    for ps in all_plan_skills:
        eng_id = plan_id_to_engineer.get(ps.plan_id)
        if eng_id is not None and eng_id in eng_skill_map:
            eng_skill_map[eng_id][ps.skill_id] = ps

    ps_ids = [ps.id for ps in all_plan_skills]
    training_log_map: dict[int, datetime] = {}
    if ps_ids:
        max_logs = (
            db.query(
                PlanSkillTrainingLog.plan_skill_id,
                func.max(PlanSkillTrainingLog.completed_at).label("max_at"),
            )
            .filter(PlanSkillTrainingLog.plan_skill_id.in_(ps_ids))
            .group_by(PlanSkillTrainingLog.plan_skill_id)
            .all()
        )
        training_log_map = {row[0]: row[1] for row in max_logs if row[1]}

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    completions_30d = 0
    if ps_ids:
        completions_30d = (
            db.query(PlanSkillTrainingLog)
            .filter(
                PlanSkillTrainingLog.plan_skill_id.in_(ps_ids),
                PlanSkillTrainingLog.completed_at >= thirty_days_ago,
            )
            .count()
        )

    team_skill_ids = {s.id for s in team_skills}
    cells_with_skill = 0
    total_cells = total_engineers * total_skills if total_skills > 0 else 0
    active_developments = 0
    critical_gaps = 0

    per_skill_stats: list[PerSkillStat] = []
    for skill in team_skills:
        status_counts = SkillStatusCounts()
        engineers_with = 0
        proficiency_levels: list[int] = []
        last_activity: datetime | None = None

        for eng_id in engineer_ids:
            ps = eng_skill_map[eng_id].get(skill.id)
            if ps is not None:
                engineers_with += 1
                cells_with_skill += 1
                if ps.status == PlanSkillStatus.in_pipeline:
                    status_counts.in_pipeline += 1
                elif ps.status == PlanSkillStatus.in_development:
                    status_counts.in_development += 1
                    active_developments += 1
                elif ps.status == PlanSkillStatus.proficiency:
                    status_counts.proficiency += 1
                if ps.proficiency_level is not None:
                    proficiency_levels.append(ps.proficiency_level)
                ps_last = training_log_map.get(ps.id) or ps.updated_at
                if ps_last and (last_activity is None or ps_last > last_activity):
                    last_activity = ps_last
            else:
                status_counts.not_in_plan += 1

        coverage = (
            (engineers_with / total_engineers * 100) if total_engineers > 0 else 0
        )
        if coverage == 0:
            critical_gaps += 1

        avg_prof = (
            sum(proficiency_levels) / len(proficiency_levels)
            if proficiency_levels
            else None
        )

        per_skill_stats.append(
            PerSkillStat(
                skill_id=skill.id,
                skill_name=skill.name,
                engineers_with_skill=engineers_with,
                total_engineers=total_engineers,
                coverage_pct=round(coverage, 1),
                avg_proficiency=round(avg_prof, 1) if avg_prof is not None else None,
                status_counts=status_counts,
                last_activity_at=last_activity,
            )
        )

    per_engineer_stats: list[PerEngineerStat] = []
    for eng_id in engineer_ids:
        skills_map = eng_skill_map[eng_id]
        team_ps = {sid: ps for sid, ps in skills_map.items() if sid in team_skill_ids}
        n_pipeline = sum(
            1 for ps in team_ps.values() if ps.status == PlanSkillStatus.in_pipeline
        )
        n_dev = sum(
            1 for ps in team_ps.values() if ps.status == PlanSkillStatus.in_development
        )
        n_prof = sum(
            1 for ps in team_ps.values() if ps.status == PlanSkillStatus.proficiency
        )

        last_act: datetime | None = None
        for ps in team_ps.values():
            ps_last = training_log_map.get(ps.id) or ps.updated_at
            if ps_last and (last_act is None or ps_last > last_act):
                last_act = ps_last

        per_engineer_stats.append(
            PerEngineerStat(
                engineer_id=eng_id,
                engineer_name=engineer_names[eng_id],
                total_skills_in_plan=len(team_ps),
                skills_in_development=n_dev,
                skills_proficient=n_prof,
                skills_in_pipeline=n_pipeline,
                last_activity_at=last_act,
            )
        )

    overall_coverage = cells_with_skill / total_cells * 100 if total_cells > 0 else 0

    return TeamStatsResponse(
        team_id=team.id,
        team_name=team.name,
        total_engineers=total_engineers,
        total_skills=total_skills,
        coverage_pct=round(overall_coverage, 1),
        critical_gaps=critical_gaps,
        active_developments=active_developments,
        completions_30d=completions_30d,
        per_skill_stats=per_skill_stats,
        per_engineer_stats=per_engineer_stats,
    )


@router.get("/activity", response_model=TeamActivityResponse)
def get_team_activity(
    team_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team, engineers = _resolve_team_and_engineers(current_user, db, team_id)
    engineer_ids = [e.id for e in engineers]
    engineer_names = {e.id: e.name for e in engineers}

    if not engineer_ids:
        return TeamActivityResponse(team_id=team.id, items=[], total=0)

    plan_rows = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
        .all()
    )
    plan_id_to_engineer = {dp.id: dp.engineer_id for dp in plan_rows}
    plan_ids = list(plan_id_to_engineer.keys())

    if not plan_ids:
        return TeamActivityResponse(team_id=team.id, items=[], total=0)

    plan_skills = db.query(PlanSkill).filter(PlanSkill.plan_id.in_(plan_ids)).all()
    ps_id_to_ps = {ps.id: ps for ps in plan_skills}
    ps_id_to_eng = {
        ps.id: plan_id_to_engineer[ps.plan_id]
        for ps in plan_skills
        if ps.plan_id in plan_id_to_engineer
    }

    skill_ids = {ps.skill_id for ps in plan_skills}
    skill_names: dict[int, str] = {}
    if skill_ids:
        skills = db.query(Skill.id, Skill.name).filter(Skill.id.in_(skill_ids)).all()
        skill_names = {s.id: s.name for s in skills}

    ps_ids = [ps.id for ps in plan_skills]
    logs: list[PlanSkillTrainingLog] = []
    if ps_ids:
        logs = (
            db.query(PlanSkillTrainingLog)
            .filter(PlanSkillTrainingLog.plan_skill_id.in_(ps_ids))
            .order_by(PlanSkillTrainingLog.completed_at.desc())
            .limit(limit)
            .all()
        )

    items: list[ActivityItem] = []
    for log in logs:
        ps = ps_id_to_ps.get(log.plan_skill_id)
        if ps is None:
            continue
        eng_id = ps_id_to_eng.get(log.plan_skill_id)
        if eng_id is None:
            continue

        items.append(
            ActivityItem(
                id=log.id,
                type="training_log",
                actor_name=engineer_names.get(eng_id, "Unknown"),
                target_engineer_name=engineer_names.get(eng_id),
                skill_name=skill_names.get(ps.skill_id),
                title=log.title,
                occurred_at=log.completed_at or datetime.utcnow(),
            )
        )

    audit_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.changed_by.in_(engineer_ids),
            AuditLog.entity_type.in_(["plan_skill", "user_content_completion"]),
        )
        .order_by(AuditLog.changed_at.desc())
        .limit(limit)
        .all()
    )

    for al in audit_logs:
        actor_name = engineer_names.get(al.changed_by, "Unknown")
        title = (
            f"{al.field}: {al.new_value}"
            if al.new_value
            else f"{al.field}: {al.old_value}"
        )
        items.append(
            ActivityItem(
                id=al.id + 1_000_000,
                type="audit",
                actor_name=actor_name,
                target_engineer_name=actor_name,
                skill_name=None,
                title=title,
                occurred_at=al.changed_at,
            )
        )

    items.sort(key=lambda x: x.occurred_at, reverse=True)
    items = items[:limit]

    return TeamActivityResponse(
        team_id=team.id,
        items=items,
        total=len(items),
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
    if data.shift is not None:
        if data.shift not in (1, 2, 3, 4):
            raise HTTPException(status_code=400, detail="Shift must be 1, 2, 3, or 4")
        team.shift = data.shift
    if data.icon is not None:
        team.icon = data.icon
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
