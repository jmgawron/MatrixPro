"""Explorer search endpoint tests — isolated temp SQLite DB."""

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
from app.models.org import Domain, Team
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    UserContentCompletion,
)
from app.models.skill import Skill, SkillLevelContent, SkillLevelContentType
from app.models.user import User, UserRole


@pytest.fixture
def tmp_db_url() -> Generator[str, None, None]:
    fd, path = tempfile.mkstemp(prefix="matrixpro_explorer_test_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    yield url
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def db(tmp_db_url: str) -> Generator[Session, None, None]:
    engine = create_engine(tmp_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seed_explorer_data(db: Session):
    domain = Domain(name="Enterprise", is_technical=True)
    db.add(domain)
    db.flush()

    team_s1 = Team(name="TAC-ENT-LANSW-SHIFT1", domain_id=domain.id, shift=1)
    team_s2 = Team(name="TAC-ENT-LANSW-SHIFT2", domain_id=domain.id, shift=2)
    db.add_all([team_s1, team_s2])
    db.flush()

    domain_sec = Domain(name="Security", is_technical=True)
    db.add(domain_sec)
    db.flush()
    team_sec = Team(name="TAC-SEC-FW-SHIFT1", domain_id=domain_sec.id, shift=1)
    db.add(team_sec)
    db.flush()

    manager = User(
        email="mgr@test.com",
        name="Manager One",
        role=UserRole.manager,
        password_hash="x",
        team_id=team_s1.id,
    )
    eng_a = User(
        email="eng-a@test.com",
        name="Alice Engineer",
        role=UserRole.engineer,
        password_hash="x",
        team_id=team_s1.id,
        manager_id=None,
    )
    eng_b = User(
        email="eng-b@test.com",
        name="Bob Engineer",
        role=UserRole.engineer,
        password_hash="x",
        team_id=team_s2.id,
        manager_id=None,
    )
    eng_c = User(
        email="eng-c@test.com",
        name="Charlie Engineer",
        role=UserRole.engineer,
        password_hash="x",
        team_id=team_sec.id,
        manager_id=None,
    )
    engineer = User(
        email="eng-only@test.com",
        name="Carol Engineer",
        role=UserRole.engineer,
        password_hash="x",
        team_id=team_s1.id,
        manager_id=None,
    )
    db.add_all([manager, eng_a, eng_b, eng_c, engineer])
    db.flush()

    skill = Skill(name="Layer 2 Switching", description="Test skill")
    db.add(skill)
    db.flush()

    content_l1 = SkillLevelContent(
        skill_id=skill.id,
        level=1,
        type=SkillLevelContentType.course,
        title="Intro VLAN Course",
        description="Learn VLANs",
        position=1,
    )
    content_l2 = SkillLevelContent(
        skill_id=skill.id,
        level=2,
        type=SkillLevelContentType.action,
        title="Lab VLAN Trunk",
        description="Hands-on trunk lab",
        position=2,
    )
    db.add_all([content_l1, content_l2])
    db.flush()

    plan_a = DevelopmentPlan(engineer_id=eng_a.id)
    plan_b = DevelopmentPlan(engineer_id=eng_b.id)
    plan_c = DevelopmentPlan(engineer_id=eng_c.id)
    db.add_all([plan_a, plan_b, plan_c])
    db.flush()

    ps_mastered = PlanSkill(
        plan_id=plan_a.id,
        skill_id=skill.id,
        status=PlanSkillStatus.mastered,
        proficiency_level=5,
        skill_version_at_add=1,
    )
    ps_developing = PlanSkill(
        plan_id=plan_b.id,
        skill_id=skill.id,
        status=PlanSkillStatus.developing,
        proficiency_level=1,
        focus_area="education",
        skill_version_at_add=1,
    )
    ps_sec = PlanSkill(
        plan_id=plan_c.id,
        skill_id=skill.id,
        status=PlanSkillStatus.mastered,
        proficiency_level=5,
        skill_version_at_add=1,
    )
    db.add_all([ps_mastered, ps_developing, ps_sec])
    db.flush()

    db.add(
        UserContentCompletion(
            user_id=eng_b.id,
            plan_skill_id=ps_developing.id,
            content_id=content_l1.id,
            completed=True,
        )
    )
    db.commit()

    return {
        "manager": manager,
        "engineer": engineer,
        "skill": skill,
        "content_l1": content_l1,
        "content_l2": content_l2,
        "eng_a": eng_a,
        "eng_b": eng_b,
        "eng_c": eng_c,
        "domain": domain,
        "domain_sec": domain_sec,
        "team_sec": team_sec,
    }


def _client_for(db: Session, user: User) -> TestClient:
    def override_db():
        yield db

    def override_user():
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return TestClient(app)


@pytest.fixture
def manager_client(db: Session, seed_explorer_data):
    client = _client_for(db, seed_explorer_data["manager"])
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def engineer_client(db: Session, seed_explorer_data):
    client = _client_for(db, seed_explorer_data["engineer"])
    yield client
    app.dependency_overrides.clear()


def test_explorer_requires_manager_or_admin(engineer_client):
    resp = engineer_client.get("/api/skills/explorer?skill_ids=1")
    assert resp.status_code == 403


def test_explorer_filter_by_skill_and_status(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    resp = manager_client.get(f"/api/skills/explorer?skill_ids={skill_id}&status=mastered")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    names = {row["engineer_name"] for row in data["results"]}
    assert names == {"Alice Engineer", "Charlie Engineer"}
    row = next(r for r in data["results"] if r["engineer_name"] == "Alice Engineer")
    assert row["status"] == "mastered"
    assert row["shift"] == 1
    assert row["development_focus"] is None
    assert row["progress"]["completion_pct"] == 100


def test_explorer_development_focus_and_shift(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    resp = manager_client.get(
        f"/api/skills/explorer?skill_ids={skill_id}&status=developing&focus=education&shift=2"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    row = data["results"][0]
    assert row["engineer_name"] == "Bob Engineer"
    assert row["development_focus"] == "Education"
    assert row["shift"] == 2


def test_explorer_content_options(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    resp = manager_client.get(f"/api/skills/explorer/content?skill_ids={skill_id}")
    assert resp.status_code == 200
    options = resp.json()["options"]
    assert len(options) == 2
    assert options[0]["title"] == "Intro VLAN Course"


def test_explorer_content_completion_filter(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    content_id = seed_explorer_data["content_l1"].id
    resp = manager_client.get(
        f"/api/skills/explorer?skill_ids={skill_id}"
        f"&content_ids={content_id}&content_completed=true"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["engineer_name"] == "Bob Engineer"
    assert data["results"][0]["content_matches"][0]["completed"] is True

    resp_missing = manager_client.get(
        f"/api/skills/explorer?skill_ids={skill_id}"
        f"&content_ids={content_id}&content_completed=false"
    )
    assert resp_missing.status_code == 200
    assert resp_missing.json()["total"] == 2
    missing_names = {row["engineer_name"] for row in resp_missing.json()["results"]}
    assert missing_names == {"Alice Engineer", "Charlie Engineer"}


def test_explorer_filter_by_team_ids(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    team_id = seed_explorer_data["team_sec"].id
    resp = manager_client.get(f"/api/skills/explorer?skill_ids={skill_id}&team_ids={team_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["engineer_name"] == "Charlie Engineer"


def test_explorer_filter_by_domain_ids(manager_client, seed_explorer_data):
    skill_id = seed_explorer_data["skill"].id
    domain_id = seed_explorer_data["domain"].id
    resp = manager_client.get(f"/api/skills/explorer?skill_ids={skill_id}&domain_ids={domain_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    names = {row["engineer_name"] for row in data["results"]}
    assert names == {"Alice Engineer", "Bob Engineer"}
