from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import (
    auth,
    users,
    teams,
    skills,
    plans,
    export,
    domains,
    catalog,
    certification,
    feedback,
)

app = FastAPI(title="MatrixPro API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(skills.router)
app.include_router(plans.router)
app.include_router(export.router)
app.include_router(domains.router)
app.include_router(catalog.router)
app.include_router(certification.router)
app.include_router(feedback.router)


@app.on_event("startup")
def create_tables():
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MatrixPro API"}


@app.get("/api/stats")
def get_stats(shifts: str | None = None):
    from sqlalchemy.orm import Session
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    from app.models.org import Team
    from app.models.skill import Skill
    from app.models.skill import SkillTeam

    shift_filter: set[int] | None = None
    if shifts:
        try:
            shift_filter = {int(s) for s in shifts.split(",") if s.strip()}
        except ValueError:
            shift_filter = None

    db = SessionLocal()
    try:
        total_engineers = db.query(User).filter(User.role == UserRole.engineer).count()

        teams_q = db.query(Team)
        if shift_filter:
            teams_q = teams_q.filter(Team.shift.in_(shift_filter))
        total_teams = teams_q.count()

        if shift_filter:
            filtered_team_ids = [t.id for t in teams_q.all()]
            skills_with_matching_team = (
                (
                    db.query(SkillTeam.skill_id).filter(
                        SkillTeam.team_id.in_(filtered_team_ids)
                    )
                )
                if filtered_team_ids
                else db.query(SkillTeam.skill_id).filter(False)
            )
            skills_with_no_team = (
                db.query(Skill.id)
                .filter(Skill.is_archived == False)  # noqa: E712
                .filter(~Skill.id.in_(db.query(SkillTeam.skill_id)))
            )
            total_skills = (
                db.query(Skill)
                .filter(Skill.is_archived == False)  # noqa: E712
                .filter(
                    Skill.id.in_(skills_with_matching_team)
                    | Skill.id.in_(skills_with_no_team)
                )
                .count()
            )
        else:
            total_skills = db.query(Skill).filter(Skill.is_archived == False).count()  # noqa: E712

        return {
            "total_engineers": total_engineers,
            "total_teams": total_teams,
            "total_skills": total_skills,
        }
    finally:
        db.close()
