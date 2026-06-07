"""DELETE /api/skills/{id}/content/{id} cascades plan-side FK rows."""

from __future__ import annotations

import os
import tempfile
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db
from app.dependencies import get_current_user
from app.main import app
from app.migrations import run_migrations
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    UserContentCompletion,
)
from app.models.skill import Skill, SkillLevelContent, SkillLevelContentType
from app.models.user import User, UserRole


@pytest.fixture
def db() -> Generator[Session, None, None]:
    fd, path = tempfile.mkstemp(prefix="matrixpro_content_del_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    import app.migrations as _mig

    original_engine = getattr(_mig, "engine", None)
    _mig.engine = engine
    try:
        run_migrations()
    finally:
        if original_engine is not None:
            _mig.engine = original_engine

    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()

    def _override_get_db():
        try:
            yield session
        finally:
            pass

    mgr = User(email="mgr@test.com", name="Mgr", role=UserRole.manager, password_hash="x")
    eng = User(email="eng@test.com", name="Eng", role=UserRole.engineer, password_hash="x")
    session.add_all([mgr, eng])
    session.flush()

    skill = Skill(name="Test Skill", description="d", catalog_version=1)
    session.add(skill)
    session.flush()

    content = SkillLevelContent(
        skill_id=skill.id,
        level=1,
        type=SkillLevelContentType.course,
        title="Course A",
        description="desc",
        position=10,
    )
    session.add(content)
    session.flush()

    plan = DevelopmentPlan(engineer_id=eng.id)
    session.add(plan)
    session.flush()

    ps = PlanSkill(
        plan_id=plan.id,
        skill_id=skill.id,
        status=PlanSkillStatus.developing,
        skill_version_at_add=1,
    )
    session.add(ps)
    session.flush()

    session.add(
        UserContentCompletion(
            user_id=eng.id,
            plan_skill_id=ps.id,
            content_id=content.id,
            completed=True,
        )
    )
    session.commit()

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: mgr

    yield session

    app.dependency_overrides.clear()
    session.close()
    engine.dispose()
    try:
        os.unlink(path)
    except OSError:
        pass


def test_delete_skill_content_cascades_plan_completions(db: Session):
    client = TestClient(app)
    skill_id = db.query(Skill).first().id
    content_id = db.query(SkillLevelContent).first().id

    res = client.delete(f"/api/skills/{skill_id}/content/{content_id}")
    assert res.status_code == 200, res.text

    assert db.query(SkillLevelContent).filter(SkillLevelContent.id == content_id).count() == 0
    assert (
        db.query(UserContentCompletion)
        .filter(UserContentCompletion.content_id == content_id)
        .count()
        == 0
    )
