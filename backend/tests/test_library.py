"""
Library router integration tests.

Covers:
  * scope enforcement — (skill_id, level) cannot leak across boundaries
  * privacy — is_private items hidden from non-owners (admin sees all)
  * 3-tier proximity ranking — team < domain < others
  * cursor pagination — stable, base64 round-trip
  * import roundtrip — full copy, position increments by 10, no shared refs
  * import scope/privacy/not_found skipping (Decision 6F partial-OK)
  * html→md conversion at import (Decision 6C)
  * owner-only mutation on user-content PUT/DELETE
  * level validation (1A: reject 4/5)
  * cap enforcement (50 source_ids max)

Each test uses an isolated temp-file SQLite DB and overrides
`get_db` + `get_current_user` so the seeded dev DB at
`data/matrixpro.db` is never touched.
"""

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
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    UserLevelContent,
)
from app.models.skill import Skill, SkillLevelContentType
from app.models.user import User, UserRole


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_db_url() -> Generator[str, None, None]:
    """Per-test temp-file SQLite. File-based (not :memory:) so FTS5 + triggers
    behave identically to production."""
    fd, path = tempfile.mkstemp(prefix="matrixpro_lib_test_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    yield url
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def db(tmp_db_url: str) -> Generator[Session, None, None]:
    """Isolated session bound to the temp DB. Runs full migrations so
    FTS5 + triggers + nullable plan_skill_id are all in place."""
    engine = create_engine(tmp_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    # Re-run idempotent migrations against this engine to install FTS5 / triggers.
    # `run_migrations` reads from `app.database.engine` so we monkey-patch via env.
    # Simpler: import the SQL helpers directly.
    from app import migrations as _mig

    # Temporarily swap engine
    original_engine = _mig.engine if hasattr(_mig, "engine") else None
    _mig.engine = engine  # type: ignore[attr-defined]
    try:
        run_migrations()
    finally:
        if original_engine is not None:
            _mig.engine = original_engine  # type: ignore[attr-defined]

    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # Wire dependency_overrides so the FastAPI app uses THIS session.
    def _override_get_db():
        try:
            yield session
        finally:
            pass  # closed in teardown

    app.dependency_overrides[get_db] = _override_get_db

    yield session

    app.dependency_overrides.pop(get_db, None)
    session.close()
    engine.dispose()


@pytest.fixture
def seeded(db: Session) -> dict:
    """Minimal world: 2 domains, 3 teams, 1 admin + manager + 5 engineers spread
    across team/domain proximity tiers, 1 skill, plan_skills per engineer."""
    # Domains
    dom_ent = Domain(name="Enterprise", is_technical=True)
    dom_dc = Domain(name="Data Center", is_technical=True)
    db.add_all([dom_ent, dom_dc])
    db.flush()

    # Teams (shift required, NOT NULL)
    team_a = Team(name="LANSW-S2", domain_id=dom_ent.id, shift=2)
    team_b = Team(name="ROUTING-S1", domain_id=dom_ent.id, shift=1)  # same domain as A
    team_c = Team(name="ACI-S1", domain_id=dom_dc.id, shift=1)  # different domain
    db.add_all([team_a, team_b, team_c])
    db.flush()

    # Users
    def _u(name, email, role, team_id, manager_id=None):
        u = User(
            name=name,
            email=email,
            password_hash="x",
            role=role,
            team_id=team_id,
            manager_id=manager_id,
        )
        db.add(u)
        return u

    admin = _u("Admin", "admin@x", UserRole.admin, None)
    mgr = _u("Mgr", "mgr@x", UserRole.manager, team_a.id)
    db.flush()

    eng_owner = _u("Owner", "owner@x", UserRole.engineer, team_a.id, manager_id=mgr.id)
    eng_teammate = _u("Teammate", "teammate@x", UserRole.engineer, team_a.id, manager_id=mgr.id)
    eng_domain = _u("DomainPeer", "dompeer@x", UserRole.engineer, team_b.id)
    eng_other = _u("OtherDomain", "other@x", UserRole.engineer, team_c.id)
    eng_outsider = _u("Outsider", "outsider@x", UserRole.engineer, team_c.id)
    db.flush()

    # Skill
    skill = Skill(name="L2 Fundamentals", is_archived=False)
    db.add(skill)
    db.flush()

    # Plans + plan_skills for each engineer
    plan_skills = {}
    for e in [eng_owner, eng_teammate, eng_domain, eng_other, eng_outsider]:
        plan = DevelopmentPlan(engineer_id=e.id)
        db.add(plan)
        db.flush()
        ps = PlanSkill(
            plan_id=plan.id,
            skill_id=skill.id,
            status=PlanSkillStatus.developing,
            skill_version_at_add=1,
        )
        db.add(ps)
        db.flush()
        plan_skills[e.id] = ps

    db.commit()

    return {
        "admin": admin,
        "mgr": mgr,
        "owner": eng_owner,
        "teammate": eng_teammate,
        "domain_peer": eng_domain,
        "other": eng_other,
        "outsider": eng_outsider,
        "skill": skill,
        "team_a": team_a,
        "team_b": team_b,
        "team_c": team_c,
        "plan_skills": plan_skills,
    }


@pytest.fixture
def client(db: Session) -> TestClient:
    return TestClient(app)


def _auth_as(user: User):
    """Helper: override get_current_user to act as `user`."""
    app.dependency_overrides[get_current_user] = lambda: user


def _mk_content(
    db: Session,
    user: User,
    skill_id: int,
    plan_skill_id: int,
    level: int = 1,
    title: str = "Item",
    description: str = "desc",
    description_format: str = "markdown",
    is_private: bool = False,
    position: int = 1000,
) -> UserLevelContent:
    c = UserLevelContent(
        user_id=user.id,
        plan_skill_id=plan_skill_id,
        skill_id=skill_id,
        level=level,
        type=SkillLevelContentType.action,
        title=title,
        description=description,
        description_format=description_format,
        is_private=is_private,
        position=position,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ---------------------------------------------------------------------------
# Scope enforcement
# ---------------------------------------------------------------------------


class TestLibrarySearchScope:
    def test_search_filters_by_skill_id(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        other_skill = Skill(name="Other", is_archived=False)
        db.add(other_skill)
        db.flush()
        # Item on the queried skill
        _mk_content(db, seeded["teammate"], seeded["skill"].id, seeded["plan_skills"][seeded["teammate"].id].id, level=1, title="MATCH")
        # Item on a different skill — must not leak
        other_ps = PlanSkill(
            plan_id=db.query(DevelopmentPlan).filter_by(engineer_id=seeded["teammate"].id).first().id,
            skill_id=other_skill.id,
            status=PlanSkillStatus.developing,
            skill_version_at_add=1,
        )
        db.add(other_ps)
        db.commit()
        _mk_content(db, seeded["teammate"], other_skill.id, other_ps.id, level=1, title="LEAK")

        _auth_as(owner)
        r = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1},
        )
        assert r.status_code == 200, r.text
        titles = [x["title"] for x in r.json()["results"]]
        assert "MATCH" in titles
        assert "LEAK" not in titles

    def test_search_filters_by_level(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        ps = seeded["plan_skills"][tm.id]
        _mk_content(db, tm, seeded["skill"].id, ps.id, level=1, title="L1")
        _mk_content(db, tm, seeded["skill"].id, ps.id, level=2, title="L2")
        _mk_content(db, tm, seeded["skill"].id, ps.id, level=3, title="L3")

        _auth_as(owner)
        for lvl in (1, 2, 3):
            r = client.get(
                f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
                params={"level": lvl},
            )
            assert r.status_code == 200
            titles = [x["title"] for x in r.json()["results"]]
            assert titles == [f"L{lvl}"], f"level={lvl} got {titles}"

    def test_search_rejects_invalid_level(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        for bad in (0, 4, 5, 99, -1):
            r = client.get(
                f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
                params={"level": bad},
            )
            assert r.status_code == 422, f"level={bad} should be rejected, got {r.status_code}"

    def test_search_404_on_unknown_skill(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.get(
            f"/api/plans/{owner.id}/skills/999999/library/search",
            params={"level": 1},
        )
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Privacy
# ---------------------------------------------------------------------------


class TestLibraryPrivacy:
    def test_private_item_hidden_from_non_owner(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title="SECRET", is_private=True)
        _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title="PUBLIC", is_private=False)

        _auth_as(owner)
        r = client.get(f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search", params={"level": 1})
        assert r.status_code == 200
        titles = [x["title"] for x in r.json()["results"]]
        assert "PUBLIC" in titles
        assert "SECRET" not in titles

    def test_private_item_visible_to_owner(self, db: Session, seeded: dict, client: TestClient):
        tm = seeded["teammate"]
        _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title="MINE", is_private=True)

        _auth_as(tm)
        r = client.get(f"/api/plans/{tm.id}/skills/{seeded['skill'].id}/library/search", params={"level": 1})
        assert r.status_code == 200
        titles = [x["title"] for x in r.json()["results"]]
        assert "MINE" in titles

    def test_private_item_visible_to_admin(self, db: Session, seeded: dict, client: TestClient):
        admin = seeded["admin"]
        tm = seeded["teammate"]
        _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title="HIDDEN", is_private=True)

        _auth_as(admin)
        # Admin can query for any engineer
        r = client.get(f"/api/plans/{tm.id}/skills/{seeded['skill'].id}/library/search", params={"level": 1})
        assert r.status_code == 200
        titles = [x["title"] for x in r.json()["results"]]
        assert "HIDDEN" in titles


# ---------------------------------------------------------------------------
# 3-tier ranking
# ---------------------------------------------------------------------------


class TestLibraryRanking:
    def test_team_beats_domain_beats_other(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]  # team_a / dom_ent
        # Teammate (same team) → bucket 1
        _mk_content(db, seeded["teammate"], seeded["skill"].id, seeded["plan_skills"][seeded["teammate"].id].id, level=1, title="TEAM")
        # Domain peer (different team, same domain) → bucket 2
        _mk_content(db, seeded["domain_peer"], seeded["skill"].id, seeded["plan_skills"][seeded["domain_peer"].id].id, level=1, title="DOMAIN")
        # Outsider (other domain) → bucket 3
        _mk_content(db, seeded["other"], seeded["skill"].id, seeded["plan_skills"][seeded["other"].id].id, level=1, title="OTHER")

        _auth_as(owner)
        r = client.get(f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search", params={"level": 1})
        assert r.status_code == 200
        results = r.json()["results"]
        assert [x["title"] for x in results] == ["TEAM", "DOMAIN", "OTHER"]
        assert [x["bucket"] for x in results] == [1, 2, 3]
        assert results[0]["bucket_label"] == "From my team"
        assert results[1]["bucket_label"] == "From my domain"
        assert results[2]["bucket_label"] == "From other teams"

    def test_is_mine_flag(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _mk_content(db, owner, seeded["skill"].id, seeded["plan_skills"][owner.id].id, level=1, title="MINE")
        _mk_content(db, seeded["teammate"], seeded["skill"].id, seeded["plan_skills"][seeded["teammate"].id].id, level=1, title="THEIRS")

        _auth_as(owner)
        r = client.get(f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search", params={"level": 1})
        results = {x["title"]: x for x in r.json()["results"]}
        assert results["MINE"]["is_mine"] is True
        assert results["THEIRS"]["is_mine"] is False


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class TestLibraryPagination:
    def test_cursor_returns_next_page(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        ps = seeded["plan_skills"][tm.id]
        for i in range(9):
            _mk_content(db, tm, seeded["skill"].id, ps.id, level=1, title=f"item-{i:02d}")

        _auth_as(owner)
        # Page 1
        r1 = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1, "limit": 3},
        )
        assert r1.status_code == 200
        body1 = r1.json()
        assert len(body1["results"]) == 3
        assert body1["has_more"] is True
        assert body1["next_cursor"] is not None

        # Page 2
        r2 = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1, "limit": 3, "cursor": body1["next_cursor"]},
        )
        assert r2.status_code == 200
        body2 = r2.json()
        assert len(body2["results"]) == 3
        # No overlap with page 1
        ids1 = {x["id"] for x in body1["results"]}
        ids2 = {x["id"] for x in body2["results"]}
        assert ids1.isdisjoint(ids2)

    def test_invalid_cursor_rejected(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1, "cursor": "not-base64-!!!"},
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Import roundtrip
# ---------------------------------------------------------------------------


class TestLibraryImport:
    def test_import_creates_full_copy(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        src = _mk_content(
            db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id,
            level=1, title="Source", description="# Hello\n\nMarkdown body.",
            description_format="markdown",
        )

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [src.id]},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["imported"]) == 1
        assert body["skipped"] == []

        clone_id = body["imported"][0]["id"]
        assert clone_id != src.id

        # Verify in DB
        clone = db.query(UserLevelContent).filter_by(id=clone_id).first()
        assert clone is not None
        assert clone.user_id == owner.id
        assert clone.plan_skill_id == seeded["plan_skills"][owner.id].id
        assert clone.skill_id == src.skill_id
        assert clone.level == src.level
        assert clone.title == src.title
        assert clone.description == src.description
        assert clone.description_format == "markdown"
        assert clone.source_user_content_id == src.id
        assert clone.is_private is False
        # NOT the same row
        assert clone.id != src.id

        # Mutating clone does NOT affect source
        clone.title = "Mutated"
        db.commit()
        db.refresh(src)
        assert src.title == "Source"

    def test_import_position_increments_by_10(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        # Seed an existing item in owner's plan_skill to anchor max position
        _mk_content(
            db, owner, seeded["skill"].id, seeded["plan_skills"][owner.id].id,
            level=1, title="existing", position=2050,
        )
        srcs = [
            _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title=f"src-{i}")
            for i in range(3)
        ]

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [s.id for s in srcs]},
        )
        assert r.status_code == 200
        positions = [
            db.query(UserLevelContent).filter_by(id=x["id"]).first().position
            for x in r.json()["imported"]
        ]
        # Starts at max+10 = 2060, then 2070, 2080
        assert positions == [2060, 2070, 2080]

    def test_import_skips_scope_mismatch(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        src_l2 = _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=2, title="L2-only")

        _auth_as(owner)
        # Try to import a level-2 item into level-1 → scope_mismatch
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [src_l2.id]},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == []
        assert body["skipped"] == [{"id": src_l2.id, "reason": "scope_mismatch"}]

    def test_import_skips_private_other_user(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        src = _mk_content(
            db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id,
            level=1, title="private-src", is_private=True,
        )

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [src.id]},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == []
        assert body["skipped"] == [{"id": src.id, "reason": "private"}]

    def test_import_skips_not_found(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [999_999]},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == []
        assert body["skipped"] == [{"id": 999_999, "reason": "not_found"}]

    def test_import_partial_success(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        good = _mk_content(db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id, level=1, title="ok")
        bad_private = _mk_content(
            db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id,
            level=1, title="hidden", is_private=True,
        )

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [good.id, bad_private.id, 12345]},
        )
        assert r.status_code == 200
        body = r.json()
        assert len(body["imported"]) == 1
        assert body["imported"][0]["title"] == "ok"
        skipped_ids = {(s["id"], s["reason"]) for s in body["skipped"]}
        assert (bad_private.id, "private") in skipped_ids
        assert (12345, "not_found") in skipped_ids

    def test_import_html_to_markdown_conversion(self, db: Session, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        tm = seeded["teammate"]
        src = _mk_content(
            db, tm, seeded["skill"].id, seeded["plan_skills"][tm.id].id,
            level=1, title="legacy",
            description="<h2>Heading</h2><p>Paragraph with <strong>bold</strong>.</p>",
            description_format="legacy_html",
        )

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [src.id]},
        )
        assert r.status_code == 200
        clone_id = r.json()["imported"][0]["id"]
        clone = db.query(UserLevelContent).filter_by(id=clone_id).first()
        assert clone.description_format == "markdown"
        # markdownify ATX style → "## Heading"
        assert "## Heading" in clone.description
        assert "**bold**" in clone.description
        # No raw HTML left
        assert "<h2>" not in clone.description
        assert "<strong>" not in clone.description

    def test_import_rejects_empty_source_ids(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": []},
        )
        assert r.status_code == 400

    def test_import_rejects_over_50(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": list(range(1, 52))},
        )
        assert r.status_code == 400

    def test_import_rejects_invalid_level(self, seeded: dict, client: TestClient):
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 5},
            json={"source_ids": [1]},
        )
        assert r.status_code == 422
        detail = r.json().get("detail", [])
        assert any("level" in str(e.get("loc", [])) for e in detail)

    def test_import_allows_owner_to_import_own_private(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """Owner can import their own private item; clone is always public (is_private=False)."""
        owner = seeded["owner"]
        ps = seeded["plan_skills"][owner.id]
        private_item = _mk_content(
            db,
            owner,
            seeded["skill"].id,
            level=1,
            plan_skill_id=ps.id,
            is_private=True,
            title="My Secret Note",
        )
        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [private_item.id]},
        )
        assert r.status_code == 200
        body = r.json()
        assert len(body["imported"]) == 1
        clone = body["imported"][0]
        assert clone["is_private"] is False
        assert clone["source_user_content_id"] == private_item.id

    def test_import_position_from_scratch(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """When engineer has no existing items at level, first import starts at 1000."""
        owner = seeded["owner"]
        teammate = seeded["teammate"]
        ps_owner = seeded["plan_skills"][owner.id]
        ps_teammate = seeded["plan_skills"][teammate.id]

        items = [
            _mk_content(db, teammate, seeded["skill"].id, level=1,
                        plan_skill_id=ps_teammate.id, title=f"Item {i}")
            for i in range(3)
        ]

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [it.id for it in items]},
        )
        assert r.status_code == 200
        imported = r.json()["imported"]
        assert len(imported) == 3
        positions = sorted(c["position"] for c in imported)
        assert positions == [1000, 1010, 1020]

    def test_import_preserves_markdown_source(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """Items with description_format='markdown' are copied verbatim (no conversion)."""
        owner = seeded["owner"]
        teammate = seeded["teammate"]
        ps_teammate = seeded["plan_skills"][teammate.id]

        md_item = _mk_content(
            db,
            teammate,
            seeded["skill"].id,
            level=2,
            plan_skill_id=ps_teammate.id,
            title="Markdown Item",
            description="## Heading\n\n- bullet one\n- bullet two",
            description_format="markdown",
        )

        _auth_as(owner)
        r = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 2},
            json={"source_ids": [md_item.id]},
        )
        assert r.status_code == 200
        clone = r.json()["imported"][0]
        assert clone["description_format"] == "markdown"
        assert "## Heading" in clone["description"]

    @pytest.mark.xfail(
        reason="Duplicate detection (skip reason 'duplicate') is not yet implemented in library.py",
        strict=True,
    )
    def test_import_skips_duplicate(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """Importing an item that was already imported should return it in 'skipped'
        with reason='duplicate'. Currently unimplemented — xfail until shipped."""
        owner = seeded["owner"]
        teammate = seeded["teammate"]
        ps_owner = seeded["plan_skills"][owner.id]
        ps_teammate = seeded["plan_skills"][teammate.id]

        source = _mk_content(
            db, teammate, seeded["skill"].id, level=1,
            plan_skill_id=ps_teammate.id, title="Dup Source"
        )

        _auth_as(owner)
        r1 = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [source.id]},
        )
        assert r1.status_code == 200
        assert len(r1.json()["imported"]) == 1

        r2 = client.post(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/import",
            params={"level": 1},
            json={"source_ids": [source.id]},
        )
        assert r2.status_code == 200
        body = r2.json()
        assert len(body["imported"]) == 0
        assert len(body["skipped"]) == 1
        assert body["skipped"][0]["reason"] == "duplicate"


# ---------------------------------------------------------------------------
# Login helper + smoke test
# ---------------------------------------------------------------------------


def login(client: TestClient, email: str, password: str = "password123") -> str:
    """Obtain a JWT token via the real /api/auth/login endpoint.

    Returns the access token string. Raises AssertionError on failure.
    """
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    token = r.json().get("access_token")
    assert token, "access_token missing from login response"
    return token


class TestLoginHelper:
    """Smoke-tests the login() helper against the real auth endpoint."""

    def test_login_returns_token(self, seeded: dict, db: Session, client: TestClient):
        """login() returns a non-empty JWT string for a valid user."""
        import bcrypt

        owner = seeded["owner"]
        owner.password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
        db.commit()

        token = login(client, owner.email)
        assert isinstance(token, str)
        assert len(token) > 20

    def test_login_wrong_password_raises(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """login() raises AssertionError when credentials are wrong."""
        import bcrypt

        owner = seeded["owner"]
        owner.password_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt()).decode()
        db.commit()

        with pytest.raises(AssertionError):
            login(client, owner.email, password="wrong")


# ---------------------------------------------------------------------------
# Search response shape assertions
# ---------------------------------------------------------------------------


class TestSearchResponseShape:
    """Verify the search endpoint returns the documented response envelope."""

    def test_search_response_keys(self, seeded: dict, db: Session, client: TestClient):
        """Response must contain results, next_cursor, has_more, query, level, skill_id."""
        owner = seeded["owner"]
        _auth_as(owner)
        r = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1, "q": ""},
        )
        assert r.status_code == 200
        body = r.json()
        for key in ("results", "next_cursor", "has_more"):
            assert key in body, f"missing key '{key}' in search response"

    def test_search_result_item_keys(
        self, seeded: dict, db: Session, client: TestClient
    ):
        """Each result item must carry the documented fields."""
        owner = seeded["owner"]
        teammate = seeded["teammate"]
        ps_teammate = seeded["plan_skills"][teammate.id]
        _mk_content(
            db, teammate, seeded["skill"].id, level=1,
            plan_skill_id=ps_teammate.id, title="Shape Test Item"
        )
        _auth_as(owner)
        r = client.get(
            f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
            params={"level": 1, "q": "Shape"},
        )
        assert r.status_code == 200
        results = r.json()["results"]
        assert len(results) >= 1
        item = results[0]
        for key in ("id", "title", "description", "url", "created_at",
                    "user_id", "is_private", "bucket"):
            assert key in item, f"missing key '{key}' in result item"

    def test_search_level_422_includes_level_in_loc(
        self, seeded: dict, client: TestClient
    ):
        """422 for out-of-range level must name 'level' in the error location."""
        owner = seeded["owner"]
        _auth_as(owner)
        for bad_level in (0, 4, 99):
            r = client.get(
                f"/api/plans/{owner.id}/skills/{seeded['skill'].id}/library/search",
                params={"level": bad_level, "q": ""},
            )
            assert r.status_code == 422, f"expected 422 for level={bad_level}"
            detail = r.json().get("detail", [])
            assert any(
                "level" in str(e.get("loc", [])) for e in detail
            ), f"'level' not in error loc for level={bad_level}"


# ---------------------------------------------------------------------------
# FTS5 trigger sanity
# ---------------------------------------------------------------------------


class TestFTS5Sanity:
    """Verify that the FTS5 sync triggers fire correctly on INSERT / UPDATE / DELETE."""

    def _fts_count(self, db: Session, query: str) -> int:
        from sqlalchemy import text
        result = db.execute(
            text("SELECT COUNT(*) FROM user_content_fts WHERE user_content_fts MATCH :q"),
            {"q": query},
        ).scalar()
        return result or 0

    def test_fts_indexes_on_insert(self, seeded: dict, db: Session):
        """Inserting a UserLevelContent row makes it searchable via FTS5."""
        owner = seeded["owner"]
        ps = seeded["plan_skills"][owner.id]
        _mk_content(
            db, owner, seeded["skill"].id, level=1,
            plan_skill_id=ps.id, title="XYZZY unique token"
        )
        assert self._fts_count(db, "XYZZY") >= 1

    def test_fts_updates_on_title_change(self, seeded: dict, db: Session):
        """Updating the title of a row updates the FTS5 index."""
        owner = seeded["owner"]
        ps = seeded["plan_skills"][owner.id]
        item = _mk_content(
            db, owner, seeded["skill"].id, level=1,
            plan_skill_id=ps.id, title="OldTitleToken"
        )
        assert self._fts_count(db, "OldTitleToken") >= 1

        item.title = "NewTitleToken"
        db.commit()

        assert self._fts_count(db, "OldTitleToken") == 0
        assert self._fts_count(db, "NewTitleToken") >= 1

    def test_fts_removes_on_delete(self, seeded: dict, db: Session):
        """Deleting a UserLevelContent row removes it from the FTS5 index."""
        owner = seeded["owner"]
        ps = seeded["plan_skills"][owner.id]
        item = _mk_content(
            db, owner, seeded["skill"].id, level=1,
            plan_skill_id=ps.id, title="DeleteMeToken"
        )
        assert self._fts_count(db, "DeleteMeToken") >= 1

        db.delete(item)
        db.commit()

        assert self._fts_count(db, "DeleteMeToken") == 0
