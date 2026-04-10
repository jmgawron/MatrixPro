from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import auth, users, teams, skills, plans, export

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


@app.on_event("startup")
def create_tables():
    import app.models  # noqa: F401 — ensure all models are registered with Base.metadata

    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "MatrixPro API"}
