from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import auth, users, teams, skills, plans, export, domains

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


@app.on_event("startup")
def create_tables():
    import app.models  # noqa: F401 — ensure all models are registered with Base.metadata

    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MatrixPro API"}


@app.get("/api/stats")
def get_stats():
    from sqlalchemy.orm import Session
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    from app.models.org import Team
    from app.models.skill import Skill

    db = SessionLocal()
    try:
        total_engineers = db.query(User).filter(User.role == UserRole.engineer).count()
        total_teams = db.query(Team).count()
        total_skills = db.query(Skill).filter(Skill.is_archived == False).count()  # noqa: E712
        return {
            "total_engineers": total_engineers,
            "total_teams": total_teams,
            "total_skills": total_skills,
        }
    finally:
        db.close()
