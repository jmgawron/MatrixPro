"""Catalog notification emitters and retrieval."""

from __future__ import annotations

import json
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.plan import DevelopmentPlan, PlanSkill
from app.models.skill import Skill, SkillTeam
from app.models.user import User, UserRole


def purge_old_notifications(db: Session, days: int = 60) -> int:
    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = (
        db.query(Notification)
        .filter(Notification.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    return deleted


def _emit(db: Session, user_id: int, ntype: str, title: str, body: str | None, payload: dict | None):
    db.add(
        Notification(
            user_id=user_id,
            type=ntype,
            title=title,
            body=body,
            payload_json=json.dumps(payload) if payload else None,
            created_at=datetime.utcnow(),
        )
    )


def recipients_for_skill_change(db: Session, skill_id: int) -> set[int]:
    """Engineers with skill in plan + managers of owner/consumer teams."""
    user_ids: set[int] = set()

    engineer_ids = (
        db.query(DevelopmentPlan.engineer_id)
        .join(PlanSkill, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(PlanSkill.skill_id == skill_id)
        .distinct()
        .all()
    )
    user_ids.update(row[0] for row in engineer_ids)

    team_ids = (
        db.query(SkillTeam.team_id)
        .filter(SkillTeam.skill_id == skill_id)
        .all()
    )
    for (team_id,) in team_ids:
        managers = (
            db.query(User.id)
            .filter(User.role == UserRole.manager, User.team_id == team_id)
            .all()
        )
        user_ids.update(row[0] for row in managers)

    return user_ids


def notify_skill_event(
    db: Session,
    skill: Skill,
    event_type: str,
    title: str,
    body: str | None = None,
    payload: dict | None = None,
    exclude_user_id: int | None = None,
) -> None:
    """One notification per recipient per event (batched at skill level)."""
    base_payload = {"skill_id": skill.id, "skill_name": skill.name, **(payload or {})}
    for uid in recipients_for_skill_change(db, skill.id):
        if exclude_user_id is not None and uid == exclude_user_id:
            continue
        _emit(db, uid, event_type, title, body, base_payload)


def notify_users(
    db: Session,
    user_ids: set[int],
    event_type: str,
    title: str,
    body: str | None = None,
    payload: dict | None = None,
) -> None:
    for uid in user_ids:
        _emit(db, uid, event_type, title, body, payload)


def list_notifications(db: Session, user_id: int, limit: int = 20) -> list[Notification]:
    purge_old_notifications(db)
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
