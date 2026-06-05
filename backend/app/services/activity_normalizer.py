"""Normalize audit logs and training entries into unified activity events."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.plan import DevelopmentPlan, PlanSkill, PlanSkillTrainingLog
from app.models.skill import Skill, SkillCategoryAssignment
from app.services.report_aggregator import _category_slug
from sqlalchemy.orm import selectinload

ACTIVITY_LABELS = {
    "skill_added": "Skill added to plan",
    "skill_removed": "Skill removed from plan",
    "status_changed": "Status changed",
    "focus_changed": "Focus area changed",
    "proficiency_changed": "Proficiency changed",
    "action_added": "Action added",
    "action_completed": "Action completed",
    "action_reopened": "Action reopened",
    "action_removed": "Action removed",
    "notes_updated": "Notes updated",
    "content_created": "Personal item created",
    "content_updated": "Personal item updated",
    "content_hidden": "Content hidden",
    "content_unhidden": "Content unhidden",
    "content_override": "Content override saved",
    "resync": "Catalog resync",
    "bulk_assign": "Bulk assign",
    "own_skill_created": "Own skill created",
    "own_skill_updated": "Own skill updated",
    "other": "Activity",
}


def _normalize_audit_field(field: str, old: str | None, new: str | None) -> str:
    if field == "status":
        return "status_changed"
    if field == "focus_area":
        return "focus_changed"
    if field == "proficiency_level":
        return "proficiency_changed"
    if field == "removed":
        return "skill_removed"
    if field == "notes":
        return "notes_updated"
    if field == "training_log":
        return "action_added"
    if field == "created":
        return "content_created"
    if field == "updated":
        return "content_updated"
    if field == "deleted":
        return "action_removed"
    if field == "hidden":
        return "content_hidden"
    if field == "unhidden":
        return "content_unhidden"
    if field == "override_description":
        return "content_override"
    if field == "resync":
        return "resync"
    if field == "bulk_assign":
        return "skill_added"
    if field in ("own_skill_created", "own_skill_updated"):
        return field
    if field == "completed":
        if new and new.lower() in ("true", "1", "yes"):
            return "action_completed"
        if new and new.lower() in ("false", "0", "no"):
            return "action_reopened"
        return "action_completed"
    return "other"


def _normalize_training_title(title: str) -> tuple[str, str | None, str | None]:
    lower = (title or "").lower()
    if lower.startswith("marked complete:"):
        detail = title.split(":", 1)[1].strip() if ":" in title else title
        return "action_completed", None, detail
    if lower.startswith("marked incomplete:"):
        detail = title.split(":", 1)[1].strip() if ":" in title else title
        return "action_reopened", detail, None
    if lower.startswith("completed:"):
        detail = title.split(":", 1)[1].strip() if ":" in title else title
        return "action_completed", None, detail
    return "action_added", None, title


def collect_activity(
    engineer_id: int,
    db: Session,
    from_dt: datetime | None = None,
    to_dt: datetime | None = None,
    activity_types: list[str] | None = None,
    skill_ids: list[int] | None = None,
    sort: str = "desc",
) -> dict:
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer_id)
        .first()
    )
    if plan is None:
        return {"skills": [], "total_events": 0}

    plan_skills = db.query(PlanSkill).filter(PlanSkill.plan_id == plan.id).all()
    ps_ids = [ps.id for ps in plan_skills]
    ps_to_skill: dict[int, int] = {ps.id: ps.skill_id for ps in plan_skills}
    ps_to_status: dict[int, str] = {
        ps.id: ps.status.value if ps.status else "planned" for ps in plan_skills
    }

    skill_ids_all = list({ps.skill_id for ps in plan_skills if ps.skill_id})
    skill_rows = (
        db.query(Skill)
        .options(
            selectinload(Skill.skill_categories).selectinload(
                SkillCategoryAssignment.category
            )
        )
        .filter(Skill.id.in_(skill_ids_all))
        .all()
        if skill_ids_all
        else []
    )
    skill_lookup = {s.id: s for s in skill_rows}

    events_by_skill: dict[int, list[dict]] = {}

    def _add_event(skill_id: int, event: dict) -> None:
        if skill_ids and skill_id not in skill_ids:
            return
        if activity_types and event["activity_type"] not in activity_types:
            return
        events_by_skill.setdefault(skill_id, []).append(event)

    if ps_ids:
        audit_q = db.query(AuditLog).filter(
            AuditLog.entity_type == "plan_skill",
            AuditLog.entity_id.in_(ps_ids),
        )
        if from_dt:
            audit_q = audit_q.filter(AuditLog.changed_at >= from_dt)
        if to_dt:
            audit_q = audit_q.filter(AuditLog.changed_at <= to_dt)

        for log in audit_q.order_by(AuditLog.changed_at.desc()).all():
            sid = ps_to_skill.get(log.entity_id)
            if sid is None:
                continue
            sk = skill_lookup.get(sid)
            cats = (
                [sca.category.name for sca in sk.skill_categories if sca.category]
                if sk
                else []
            )
            act_type = _normalize_audit_field(
                log.field, log.old_value, log.new_value
            )
            _add_event(
                sid,
                {
                    "timestamp": log.changed_at.isoformat() if log.changed_at else None,
                    "activity_type": act_type,
                    "activity_label": ACTIVITY_LABELS.get(act_type, act_type),
                    "previous": log.old_value,
                    "new": log.new_value,
                    "comment": None,
                    "source": "audit",
                    "plan_skill_id": log.entity_id,
                    "skill_name": sk.name if sk else "Unknown",
                    "categories": cats,
                    "status": ps_to_status.get(log.entity_id, "planned"),
                },
            )

        training_q = db.query(PlanSkillTrainingLog).filter(
            PlanSkillTrainingLog.plan_skill_id.in_(ps_ids)
        )
        if from_dt:
            training_q = training_q.filter(
                PlanSkillTrainingLog.completed_at >= from_dt
            )
        if to_dt:
            training_q = training_q.filter(
                PlanSkillTrainingLog.completed_at <= to_dt
            )

        for tlog in training_q.order_by(PlanSkillTrainingLog.completed_at.desc()).all():
            sid = ps_to_skill.get(tlog.plan_skill_id)
            if sid is None:
                continue
            sk = skill_lookup.get(sid)
            cats = (
                [sca.category.name for sca in sk.skill_categories if sca.category]
                if sk
                else []
            )
            act_type, prev, new = _normalize_training_title(tlog.title or "")
            _add_event(
                sid,
                {
                    "timestamp": (
                        tlog.completed_at.isoformat() if tlog.completed_at else None
                    ),
                    "activity_type": act_type,
                    "activity_label": ACTIVITY_LABELS.get(act_type, act_type),
                    "previous": prev,
                    "new": new or tlog.title,
                    "comment": tlog.notes,
                    "source": "training",
                    "plan_skill_id": tlog.plan_skill_id,
                    "skill_name": sk.name if sk else "Unknown",
                    "categories": cats,
                    "status": ps_to_status.get(tlog.plan_skill_id, "planned"),
                },
            )

        for ps in plan_skills:
            if from_dt and ps.added_at and ps.added_at < from_dt:
                continue
            if to_dt and ps.added_at and ps.added_at > to_dt:
                continue
            if skill_ids and ps.skill_id not in skill_ids:
                continue
            sk = skill_lookup.get(ps.skill_id) if ps.skill_id else None
            cats = (
                [sca.category.name for sca in sk.skill_categories if sca.category]
                if sk
                else []
            )
            has_add = any(
                e["activity_type"] in ("skill_added", "bulk_assign")
                for e in events_by_skill.get(ps.skill_id, [])
            )
            if not has_add and ps.added_at:
                evt = {
                    "timestamp": ps.added_at.isoformat(),
                    "activity_type": "skill_added",
                    "activity_label": ACTIVITY_LABELS["skill_added"],
                    "previous": None,
                    "new": sk.name if sk else "Skill",
                    "comment": None,
                    "source": "plan",
                    "plan_skill_id": ps.id,
                    "skill_name": sk.name if sk else "Unknown",
                    "categories": cats,
                    "status": ps.status.value if ps.status else "planned",
                }
                if not activity_types or "skill_added" in activity_types:
                    events_by_skill.setdefault(ps.skill_id, []).append(evt)

    skills_out: list[dict] = []
    total = 0
    reverse = sort != "asc"

    for skill_id, events in events_by_skill.items():
        if not events:
            continue
        events.sort(key=lambda e: e.get("timestamp") or "", reverse=reverse)
        sk = skill_lookup.get(skill_id)
        skills_out.append(
            {
                "skill_id": skill_id,
                "skill_name": sk.name if sk else events[0]["skill_name"],
                "categories": events[0]["categories"],
                "status": events[0]["status"],
                "events": events,
                "event_count": len(events),
            }
        )
        total += len(events)

    skills_out.sort(key=lambda s: s["events"][0]["timestamp"] if s["events"] else "", reverse=reverse)

    return {"skills": skills_out, "total_events": total}
