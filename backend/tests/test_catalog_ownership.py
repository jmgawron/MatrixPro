"""Catalog ownership: fork-on-delete, RBAC, duplicate, owner constraint."""

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
from app.models.org import Domain, Team
from app.models.plan import DevelopmentPlan, PlanSkill, PlanSkillStatus
from app.models.skill import Skill, SkillTeam
from app.models.user import User, UserRole


@pytest.fixture
def ownership_db() -> Generator[tuple[Session, User, User, Skill, Team], None, None]:
    fd, path = tempfile.mkstemp(prefix="matrixpro_own_", suffix=".db")
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

    domain = Domain(name="Enterprise", is_technical=True)
    session.add(domain)
    session.flush()
    owner_team = Team(name="TAC-ENT-OWN-SHIFT1", domain_id=domain.id, shift=1)
    consumer_team = Team(name="TAC-ENT-CON-SHIFT1", domain_id=domain.id, shift=1)
    session.add_all([owner_team, consumer_team])
    session.flush()

    mgr = User(
        email="mgr@test.com",
        name="Mgr",
        role=UserRole.manager,
        password_hash="x",
        team_id=owner_team.id,
    )
    consumer_mgr = User(
        email="cmgr@test.com",
        name="CMgr",
        role=UserRole.manager,
        password_hash="x",
        team_id=consumer_team.id,
    )
    eng = User(email="eng@test.com", name="Eng", role=UserRole.engineer, password_hash="x")
    session.add_all([mgr, consumer_mgr, eng])
    session.flush()

    skill = Skill(name="Routing OSPF", description="d", catalog_version=1)
    session.add(skill)
    session.flush()
    session.add(SkillTeam(skill_id=skill.id, team_id=owner_team.id, role="owner"))
    session.add(SkillTeam(skill_id=skill.id, team_id=consumer_team.id, role="consumer"))

    plan = DevelopmentPlan(engineer_id=eng.id)
    session.add(plan)
    session.flush()
    session.add(
        PlanSkill(
            plan_id=plan.id,
            skill_id=skill.id,
            status=PlanSkillStatus.planned,
            skill_version_at_add=1,
        )
    )
    session.commit()

    def _override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    yield session, mgr, consumer_mgr, skill, owner_team

    app.dependency_overrides.clear()
    session.close()
    engine.dispose()
    try:
        os.unlink(path)
    except OSError:
        pass


def test_delete_skill_forks_per_engineer(ownership_db):
    session, mgr, _, skill, _ = ownership_db
    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    preview = client.get(f"/api/skills/{skill.id}/delete-preview")
    assert preview.status_code == 200
    assert preview.json()["engineers_affected"] == 1

    skill_id = skill.id
    res = client.delete(f"/api/skills/{skill_id}")
    assert res.status_code == 200, res.text
    assert res.json()["engineers_forked"] == 1

    assert session.query(Skill).filter(Skill.id == skill_id).first() is None
    fork = session.query(Skill).filter(Skill.is_custom.is_(True)).first()
    assert fork is not None
    eng = session.query(User).filter(User.email == "eng@test.com").first()
    assert fork.owner_id == eng.id


def test_consumer_manager_cannot_edit_metadata(ownership_db):
    _, _, consumer_mgr, skill, _ = ownership_db
    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.put(f"/api/skills/{skill.id}", json={"name": "Hacked Name"})
    assert res.status_code == 403


def test_duplicate_skill_copies_without_consumers(ownership_db):
    _, mgr, _, skill, owner_team = ownership_db
    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.post(f"/api/skills/{skill.id}/duplicate")
    assert res.status_code == 200, res.text
    body = res.json()
    assert owner_team.name in body["name"]
    assert len(body["owner_teams"]) == 1
    assert body["owner_teams"][0]["id"] == owner_team.id
    assert body["consumer_teams"] == []


def test_create_skill_requires_owner_team(ownership_db):
    _, mgr, _, _, owner_team = ownership_db
    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    bad = client.post(
        "/api/skills/",
        json={"name": "New Skill", "owner_team_ids": [], "consumer_team_ids": []},
    )
    assert bad.status_code == 400

    ok = client.post(
        "/api/skills/",
        json={
            "name": "New Skill OK",
            "owner_team_ids": [owner_team.id],
            "consumer_team_ids": [],
        },
    )
    assert ok.status_code == 200, ok.text


def test_duplicate_emits_notification_for_engineer(ownership_db):
    session, mgr, consumer_mgr, skill, _ = ownership_db
    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.post(f"/api/skills/{skill.id}/duplicate")
    assert res.status_code == 200, res.text

    eng = session.query(User).filter(User.email == "eng@test.com").first()

    app.dependency_overrides[get_current_user] = lambda: mgr
    mgr_notes = client.get("/api/notifications/?limit=10")
    assert mgr_notes.status_code == 200
    assert not any(n["type"] == "skill_duplicated" for n in mgr_notes.json()["items"])

    app.dependency_overrides[get_current_user] = lambda: eng
    eng_notes = client.get("/api/notifications/?limit=10")
    assert eng_notes.status_code == 200
    assert any(n["type"] == "skill_duplicated" for n in eng_notes.json()["items"])

    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    cmgr_notes = client.get("/api/notifications/?limit=10")
    assert cmgr_notes.status_code == 200
    assert any(n["type"] == "skill_duplicated" for n in cmgr_notes.json()["items"])


def test_non_owner_manager_can_duplicate(ownership_db):
    _, mgr, consumer_mgr, skill, owner_team = ownership_db
    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.post(f"/api/skills/{skill.id}/duplicate")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["owner_teams"][0]["id"] == consumer_mgr.team_id
    assert body["owner_teams"][0]["id"] != owner_team.id


def test_owner_manager_can_assign_consumer_teams(ownership_db):
    session, mgr, _, skill, owner_team = ownership_db
    consumer_team = (
        session.query(Team).filter(Team.name == "TAC-ENT-CON-SHIFT1").first()
    )
    other_team = Team(
        name="TAC-ENT-OTHER-SHIFT1",
        domain_id=owner_team.domain_id,
        shift=2,
    )
    session.add(other_team)
    session.commit()

    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.put(
        f"/api/skills/{skill.id}",
        json={"consumer_team_ids": [consumer_team.id, other_team.id]},
    )
    assert res.status_code == 200, res.text
    consumer_ids = {t["id"] for t in res.json()["consumer_teams"]}
    assert consumer_team.id in consumer_ids
    assert other_team.id in consumer_ids


def test_owner_manager_can_add_co_owner_team(ownership_db):
    session, mgr, _, skill, owner_team = ownership_db
    co_owner = Team(
        name="TAC-ENT-CO-SHIFT1",
        domain_id=owner_team.domain_id,
        shift=3,
    )
    session.add(co_owner)
    session.commit()

    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.put(
        f"/api/skills/{skill.id}",
        json={"owner_team_ids": [owner_team.id, co_owner.id]},
    )
    assert res.status_code == 200, res.text
    owner_ids = {t["id"] for t in res.json()["owner_teams"]}
    assert owner_team.id in owner_ids
    assert co_owner.id in owner_ids


def test_manager_joins_as_consumer(ownership_db):
    session, mgr, consumer_mgr, skill, owner_team = ownership_db
    lone_skill = Skill(name="Isolated Skill", description="d", catalog_version=1)
    session.add(lone_skill)
    session.flush()
    session.add(
        SkillTeam(skill_id=lone_skill.id, team_id=owner_team.id, role="owner")
    )
    session.commit()

    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.post(f"/api/skills/{lone_skill.id}/join-consumer")
    assert res.status_code == 200, res.text
    consumer_ids = {t["id"] for t in res.json()["consumer_teams"]}
    assert consumer_mgr.team_id in consumer_ids


def test_manager_leaves_as_consumer(ownership_db):
    session, mgr, consumer_mgr, skill, owner_team = ownership_db
    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.delete(
        f"/api/skills/{skill.id}/consumer-teams/{consumer_mgr.team_id}"
    )
    assert res.status_code == 200, res.text
    consumer_ids = {t["id"] for t in res.json()["consumer_teams"]}
    assert consumer_mgr.team_id not in consumer_ids


def test_list_skills_includes_consumer_team_association(ownership_db):
    session, _, consumer_mgr, skill, _ = ownership_db
    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.get(f"/api/skills/?team_id={consumer_mgr.team_id}")
    assert res.status_code == 200, res.text
    skill_ids = {row["id"] for row in res.json()}
    assert skill.id in skill_ids


def test_owner_removes_consumer_team(ownership_db):
    session, mgr, consumer_mgr, skill, owner_team = ownership_db
    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.delete(
        f"/api/skills/{skill.id}/consumer-teams/{consumer_mgr.team_id}"
    )
    assert res.status_code == 200, res.text
    consumer_ids = {t["id"] for t in res.json()["consumer_teams"]}
    assert consumer_mgr.team_id not in consumer_ids


def test_team_matrix_includes_consumer_skill_with_role(ownership_db):
    _, mgr, consumer_mgr, skill, owner_team = ownership_db
    client = TestClient(app)

    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    consumer_res = client.get(f"/api/teams/matrix?team_id={consumer_mgr.team_id}")
    assert consumer_res.status_code == 200, consumer_res.text
    consumer_body = consumer_res.json()
    consumer_row = next(s for s in consumer_body["skills"] if s["id"] == skill.id)
    assert consumer_row["association_role"] == "consumer"

    app.dependency_overrides[get_current_user] = lambda: mgr
    owner_res = client.get(f"/api/teams/matrix?team_id={owner_team.id}")
    assert owner_res.status_code == 200, owner_res.text
    owner_row = next(s for s in owner_res.json()["skills"] if s["id"] == skill.id)
    assert owner_row["association_role"] == "owner"


def test_team_stats_includes_consumer_skill(ownership_db):
    _, _, consumer_mgr, skill, _ = ownership_db
    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.get(f"/api/teams/stats?team_id={consumer_mgr.team_id}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_skills"] >= 1
    stat = next(row for row in body["per_skill_stats"] if row["skill_id"] == skill.id)
    assert stat["association_role"] == "consumer"


def test_detach_consumer_team_forks_plan_skill_to_personal(ownership_db):
    session, mgr, consumer_mgr, skill, owner_team = ownership_db
    eng = session.query(User).filter(User.email == "eng@test.com").one()
    eng.team_id = consumer_mgr.team_id
    session.commit()

    app.dependency_overrides[get_current_user] = lambda: consumer_mgr
    client = TestClient(app)

    res = client.delete(
        f"/api/skills/{skill.id}/consumer-teams/{consumer_mgr.team_id}"
    )
    assert res.status_code == 200, res.text

    plan_skill = (
        session.query(PlanSkill)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(DevelopmentPlan.engineer_id == eng.id)
        .one()
    )
    forked_skill = session.query(Skill).filter(Skill.id == plan_skill.skill_id).one()
    assert forked_skill.is_custom is True
    assert forked_skill.owner_id == eng.id
    assert forked_skill.id != skill.id

    app.dependency_overrides[get_current_user] = lambda: eng
    plan_res = client.get(f"/api/plans/{eng.id}")
    assert plan_res.status_code == 200, plan_res.text
    row = next(ps for ps in plan_res.json()["skills"] if ps["id"] == plan_skill.id)
    assert row["is_custom"] is True


def test_detach_owner_team_forks_plan_skill_to_personal(ownership_db):
    session, mgr, consumer_mgr, skill, owner_team = ownership_db
    eng = session.query(User).filter(User.email == "eng@test.com").one()
    eng.team_id = owner_team.id
    session.commit()

    other_team = Team(name="TAC-ENT-OWN-SHIFT2", domain_id=owner_team.domain_id, shift=2)
    session.add(other_team)
    session.flush()
    session.add(SkillTeam(skill_id=skill.id, team_id=other_team.id, role="owner"))
    session.commit()

    app.dependency_overrides[get_current_user] = lambda: mgr
    client = TestClient(app)

    res = client.put(
        f"/api/skills/{skill.id}",
        json={"owner_team_ids": [other_team.id], "consumer_team_ids": [consumer_mgr.team_id]},
    )
    assert res.status_code == 200, res.text

    plan_skill = (
        session.query(PlanSkill)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(DevelopmentPlan.engineer_id == eng.id)
        .one()
    )
    forked_skill = session.query(Skill).filter(Skill.id == plan_skill.skill_id).one()
    assert forked_skill.is_custom is True
    assert forked_skill.owner_id == eng.id
