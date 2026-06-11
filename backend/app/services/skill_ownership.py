"""Skill ownership RBAC and team-role helpers."""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from app.models.skill import Skill, SkillCategoryAssignment, SkillTeam
from app.models.user import User, UserRole


ROLE_OWNER = "owner"
ROLE_CONSUMER = "consumer"


def skill_team_ids_by_role(db: Session, skill_id: int, role: str) -> set[int]:
    rows = (
        db.query(SkillTeam.team_id)
        .filter(SkillTeam.skill_id == skill_id, SkillTeam.role == role)
        .all()
    )
    return {row[0] for row in rows}


def skill_owner_team_ids(db: Session, skill_id: int) -> set[int]:
    return skill_team_ids_by_role(db, skill_id, ROLE_OWNER)


def skill_consumer_team_ids(db: Session, skill_id: int) -> set[int]:
    return skill_team_ids_by_role(db, skill_id, ROLE_CONSUMER)


def manager_accessible_team_ids(current_user: User, db: Session) -> set[int]:
    """Teams a manager may operate on: own team + teams of direct reports."""
    allowed: set[int] = set()
    if current_user.team_id is not None:
        allowed.add(current_user.team_id)
    report_team_ids = (
        db.query(User.team_id)
        .filter(User.manager_id == current_user.id, User.team_id.isnot(None))
        .distinct()
        .all()
    )
    allowed.update(row[0] for row in report_team_ids)
    return allowed


def manager_skill_access(db: Session, current_user: User, skill_id: int) -> str:
    """
    Return access level: admin | owner | consumer | none.
    Owner wins when manager belongs to both owner and consumer teams.
    """
    if current_user.role == UserRole.admin:
        return "admin"
    if current_user.role != UserRole.manager:
        return "none"
    allowed = manager_accessible_team_ids(current_user, db)
    owners = skill_owner_team_ids(db, skill_id)
    consumers = skill_consumer_team_ids(db, skill_id)
    if owners & allowed:
        return "owner"
    if consumers & allowed:
        return "consumer"
    return "none"


def require_owner_or_admin(db: Session, current_user: User, skill_id: int) -> None:
    from fastapi import HTTPException

    access = manager_skill_access(db, current_user, skill_id)
    if access not in ("admin", "owner"):
        raise HTTPException(status_code=403, detail="Owner or admin access required")


def require_owner_consumer_or_admin(
    db: Session, current_user: User, skill_id: int
) -> str:
    from fastapi import HTTPException

    access = manager_skill_access(db, current_user, skill_id)
    if access == "none":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return access


def check_manager_owner_team_access(
    current_user: User, owner_team_ids: list[int], db: Session
) -> None:
    from fastapi import HTTPException

    if current_user.role == UserRole.admin:
        return
    if current_user.role != UserRole.manager:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if not owner_team_ids:
        return
    allowed = manager_accessible_team_ids(current_user, db)
    invalid = [tid for tid in owner_team_ids if tid not in allowed]
    if invalid:
        raise HTTPException(
            status_code=403,
            detail=f"Not authorized to assign owner team(s): {invalid}",
        )


def resolve_manager_owner_team_ids(
    current_user: User,
    skill_id: int,
    requested_owner_ids: list[int],
    db: Session,
) -> list[int]:
    """Merge owner assignments: managers control only their teams; others preserved."""
    from fastapi import HTTPException

    if current_user.role == UserRole.admin:
        return sorted(set(requested_owner_ids))
    allowed = manager_accessible_team_ids(current_user, db)
    existing_owners = skill_owner_team_ids(db, skill_id)
    existing_consumers = skill_consumer_team_ids(db, skill_id)
    requested_set = set(requested_owner_ids)
    forbidden_new = requested_set - allowed - existing_owners
    if forbidden_new:
        raise HTTPException(
            status_code=403,
            detail=f"Not authorized to assign owner team(s): {sorted(forbidden_new)}",
        )
    preserved = existing_owners - allowed
    final_owners = preserved | (requested_set & allowed)
    if not final_owners:
        raise HTTPException(
            status_code=400,
            detail="Skill must have at least one owner team",
        )
    # Consumer teams that become owners stay as owners only
    return sorted(final_owners)


def resolve_manager_consumer_team_ids(
    current_user: User,
    skill_id: int,
    requested_consumer_ids: list[int],
    db: Session,
) -> list[int]:

    if current_user.role == UserRole.admin:
        return sorted(set(requested_consumer_ids))
    allowed = manager_accessible_team_ids(current_user, db)
    existing_consumers = skill_consumer_team_ids(db, skill_id)
    existing_owners = skill_owner_team_ids(db, skill_id)
    requested_set = set(requested_consumer_ids)
    # Managers may only add/remove their own team as consumer
    manager_controlled = requested_set & allowed
    preserved = existing_consumers - allowed
    final = preserved | manager_controlled
    # Cannot consumer a team that is already owner
    overlap = final & existing_owners
    if overlap:
        final -= overlap
    return sorted(final)


def team_associated_skills(
    db: Session, team_id: int, *, include_archived: bool = False
) -> list[tuple[Skill, str]]:
    """
    Skills linked to a team as owner or consumer.
    Returns (Skill, role) pairs ordered by skill id; owner wins on duplicate rows.
    """
    q = (
        db.query(Skill, SkillTeam.role)
        .join(SkillTeam, SkillTeam.skill_id == Skill.id)
        .options(
            selectinload(Skill.skill_categories).selectinload(
                SkillCategoryAssignment.category
            )
        )
        .filter(SkillTeam.team_id == team_id)
    )
    if not include_archived:
        q = q.filter(Skill.is_archived.is_(False))
    rows = q.order_by(Skill.id).all()
    by_id: dict[int, tuple[Skill, str]] = {}
    for skill, role in rows:
        existing = by_id.get(skill.id)
        if existing is None:
            by_id[skill.id] = (skill, role)
        elif existing[1] != ROLE_OWNER and role == ROLE_OWNER:
            by_id[skill.id] = (skill, role)
    return sorted(by_id.values(), key=lambda pair: pair[0].id)


def sync_skill_team_roles(
    db: Session,
    skill_id: int,
    owner_team_ids: list[int],
    consumer_team_ids: list[int],
) -> None:
    from fastapi import HTTPException

    from app.services.skill_lifecycle import fork_catalog_plan_skills_for_detached_teams

    previous_teams = skill_owner_team_ids(db, skill_id) | skill_consumer_team_ids(
        db, skill_id
    )

    owner_set = set(owner_team_ids)
    consumer_set = set(consumer_team_ids) - owner_set
    if not owner_set:
        raise HTTPException(
            status_code=400,
            detail="Skill must have at least one owner team",
        )
    db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
    for tid in owner_set:
        db.add(SkillTeam(skill_id=skill_id, team_id=tid, role=ROLE_OWNER))
    for tid in consumer_set:
        db.add(SkillTeam(skill_id=skill_id, team_id=tid, role=ROLE_CONSUMER))

    detached_teams = previous_teams - (owner_set | consumer_set)
    if detached_teams:
        skill = db.query(Skill).filter(Skill.id == skill_id).first()
        if skill is not None and not skill.is_custom:
            fork_catalog_plan_skills_for_detached_teams(db, skill, detached_teams)


def active_catalog_skill_name_exists(
    db: Session, name: str, exclude_skill_id: int | None = None
) -> bool:
    q = db.query(Skill.id).filter(
        Skill.is_custom.is_(False),
        Skill.is_archived.is_(False),
        Skill.name == name,
    )
    if exclude_skill_id is not None:
        q = q.filter(Skill.id != exclude_skill_id)
    return q.first() is not None


def fuzzy_duplicate_warnings(db: Session, name: str, exclude_skill_id: int | None = None) -> list[str]:
    """Return warning strings for similar catalog skill names (non-blocking)."""
    import difflib

    normalized = " ".join(name.lower().split())
    if len(normalized) < 3:
        return []

    q = db.query(Skill.name).filter(
        Skill.is_custom.is_(False),
        Skill.is_archived.is_(False),
    )
    if exclude_skill_id is not None:
        q = q.filter(Skill.id != exclude_skill_id)
    warnings: list[str] = []
    for (existing_name,) in q.all():
        ratio = difflib.SequenceMatcher(
            None, normalized, " ".join(existing_name.lower().split())
        ).ratio()
        if ratio >= 0.82 and existing_name.strip().lower() != normalized:
            warnings.append(f'Similar skill exists: "{existing_name}"')
    return warnings[:5]
