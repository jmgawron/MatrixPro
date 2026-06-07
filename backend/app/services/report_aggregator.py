"""Plan skill metrics aggregation for My Plan reporting."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session, selectinload

from app.models.audit import AuditLog
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserLevelContent,
)
from app.models.skill import Skill, SkillCategoryAssignment
from app.models.user import User

FOCUS_LABELS = {
    "education": "Education",
    "exposure": "Exposure",
    "experience": "Experience",
    "1": "Education",
    "2": "Exposure",
    "3": "Experience",
}

CATEGORY_ORDER = {
    "foundational": 0,
    "core": 1,
    "advanced": 2,
    "ai-future": 3,
    "ai_future": 3,
}

STATUS_ORDER = {"developing": 0, "planned": 1, "mastered": 2}


def _focus_label(raw: str | None) -> str:
    if not raw:
        return "—"
    return FOCUS_LABELS.get(str(raw).lower(), str(raw).capitalize())


def _days_since(dt: datetime | None) -> int | None:
    if dt is None:
        return None
    return max(0, (datetime.utcnow() - dt).days)


def _category_slug(name: str) -> str:
    return name.lower().replace(" & ", "-").replace(" ", "-").replace("_", "-")


def _primary_category(categories: list[str]) -> str:
    if not categories:
        return "uncategorized"
    slugs = [_category_slug(c) for c in categories]
    slugs.sort(key=lambda s: CATEGORY_ORDER.get(s, 99))
    return slugs[0]


def _completion_pct(curriculum: dict, personal: dict) -> int:
    total = (
        curriculum["education"]["total"]
        + curriculum["exposure"]["total"]
        + curriculum["experience"]["total"]
        + personal[1]["total"]
        + personal[2]["total"]
        + personal[3]["total"]
    )
    done = (
        curriculum["education"]["completed"]
        + curriculum["exposure"]["completed"]
        + curriculum["experience"]["completed"]
        + personal[1]["completed"]
        + personal[2]["completed"]
        + personal[3]["completed"]
    )
    if total == 0:
        return 0
    return round(100 * done / total)


def collect_skill_metrics(engineer_id: int, db: Session) -> dict:
    """Return enriched skill rows + summary counts for an engineer's plan."""
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if engineer is None:
        return {"engineer_id": engineer_id, "engineer_name": "Unknown", "skills": [], "counts": {}}

    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer_id)
        .first()
    )
    if plan is None:
        return {
            "engineer_id": engineer_id,
            "engineer_name": engineer.name,
            "skills": [],
            "counts": {"developing": 0, "planned": 0, "mastered": 0},
        }

    plan_skills = db.query(PlanSkill).filter(PlanSkill.plan_id == plan.id).all()
    ps_ids = [ps.id for ps in plan_skills]
    skill_ids = [ps.skill_id for ps in plan_skills if ps.skill_id]

    skill_rows = (
        db.query(Skill)
        .options(
            selectinload(Skill.skill_categories).selectinload(
                SkillCategoryAssignment.category
            ),
            selectinload(Skill.level_content),
        )
        .filter(Skill.id.in_(skill_ids))
        .all()
        if skill_ids
        else []
    )
    skill_lookup = {s.id: s for s in skill_rows}

    completions_by_ps: dict[int, list[UserContentCompletion]] = {}
    if ps_ids:
        for c in db.query(UserContentCompletion).filter(
            UserContentCompletion.plan_skill_id.in_(ps_ids)
        ).all():
            completions_by_ps.setdefault(c.plan_skill_id, []).append(c)

    personal_by_ps: dict[int, list[UserLevelContent]] = {}
    if ps_ids:
        for ulc in db.query(UserLevelContent).filter(
            UserLevelContent.plan_skill_id.in_(ps_ids)
        ).all():
            personal_by_ps.setdefault(ulc.plan_skill_id, []).append(ulc)

    log_counts: dict[int, int] = {}
    if ps_ids:
        for row in (
            db.query(PlanSkillTrainingLog.plan_skill_id, PlanSkillTrainingLog.id)
            .filter(PlanSkillTrainingLog.plan_skill_id.in_(ps_ids))
            .all()
        ):
            log_counts[row[0]] = log_counts.get(row[0], 0) + 1

    last_activity: dict[int, datetime] = {}
    if ps_ids:
        for log in db.query(AuditLog).filter(
            AuditLog.entity_type == "plan_skill",
            AuditLog.entity_id.in_(ps_ids),
        ).all():
            if log.entity_id and log.changed_at:
                cur = last_activity.get(log.entity_id)
                if cur is None or log.changed_at > cur:
                    last_activity[log.entity_id] = log.changed_at

        for tlog in db.query(PlanSkillTrainingLog).filter(
            PlanSkillTrainingLog.plan_skill_id.in_(ps_ids)
        ).all():
            if tlog.plan_skill_id and tlog.completed_at:
                cur = last_activity.get(tlog.plan_skill_id)
                if cur is None or tlog.completed_at > cur:
                    last_activity[tlog.plan_skill_id] = tlog.completed_at

        for c in db.query(UserContentCompletion).filter(
            UserContentCompletion.plan_skill_id.in_(ps_ids),
            UserContentCompletion.completed.is_(True),
        ).all():
            if c.plan_skill_id and c.completed_at:
                cur = last_activity.get(c.plan_skill_id)
                if cur is None or c.completed_at > cur:
                    last_activity[c.plan_skill_id] = c.completed_at

    audit_counts: dict[int, int] = {}
    if ps_ids:
        for row in (
            db.query(AuditLog.entity_id)
            .filter(
                AuditLog.entity_type == "plan_skill",
                AuditLog.entity_id.in_(ps_ids),
            )
            .all()
        ):
            audit_counts[row[0]] = audit_counts.get(row[0], 0) + 1

    skills_out: list[dict] = []
    counts = {"developing": 0, "planned": 0, "mastered": 0}

    for ps in plan_skills:
        sk = skill_lookup.get(ps.skill_id) if ps.skill_id else None
        cats: list[str] = []
        education = {"total": 0, "completed": 0}
        exposure = {"total": 0, "completed": 0}
        experience = {"total": 0, "completed": 0}

        if sk is not None:
            cats = sorted(
                (sca.category.name for sca in sk.skill_categories if sca.category),
                key=lambda n: CATEGORY_ORDER.get(_category_slug(n), 99),
            )
            level_buckets = {1: education, 2: exposure, 3: experience}
            for lc in sk.level_content or []:
                bucket = level_buckets.get(lc.level)
                if bucket is not None:
                    bucket["total"] += 1

        content_level: dict[int, int] = {}
        if sk is not None:
            for lc in sk.level_content or []:
                content_level[lc.id] = lc.level

        comps = completions_by_ps.get(ps.id, [])
        for c in comps:
            if not c.completed:
                continue
            lvl = content_level.get(c.content_id)
            if lvl == 1:
                education["completed"] += 1
            elif lvl == 2:
                exposure["completed"] += 1
            elif lvl == 3:
                experience["completed"] += 1

        personal_by_level: dict[int, dict] = {
            1: {"total": 0, "completed": 0},
            2: {"total": 0, "completed": 0},
            3: {"total": 0, "completed": 0},
        }
        open_actions = 0
        for ulc in personal_by_ps.get(ps.id, []):
            bucket = personal_by_level.get(ulc.level)
            if bucket is None:
                continue
            bucket["total"] += 1
            if ulc.completed:
                bucket["completed"] += 1
            else:
                open_actions += 1

        for c in comps:
            if not c.completed:
                open_actions += 1

        curriculum = {
            "education": education,
            "exposure": exposure,
            "experience": experience,
        }
        completion_pct = _completion_pct(curriculum, personal_by_level)

        status_key = ps.status.value if ps.status else "planned"
        if status_key in counts:
            counts[status_key] += 1

        la = last_activity.get(ps.id)
        audit_count = audit_counts.get(ps.id, 0)

        skills_out.append(
            {
                "plan_skill_id": ps.id,
                "skill_id": ps.skill_id,
                "skill_name": sk.name if sk else "Unknown",
                "categories": cats,
                "primary_category": _primary_category(cats),
                "status": status_key,
                "focus_area": ps.focus_area,
                "focus_label": _focus_label(ps.focus_area),
                "completion_pct": completion_pct,
                "logged_actions": log_counts.get(ps.id, 0) + audit_count,
                "training_log_count": log_counts.get(ps.id, 0),
                "last_activity_at": la.isoformat() if la else None,
                "days_since_last_activity": _days_since(la),
                "open_actions": open_actions,
                "proficiency_level": ps.proficiency_level,
            }
        )

    return {
        "engineer_id": engineer_id,
        "engineer_name": engineer.name,
        "skills": skills_out,
        "counts": counts,
    }


def filter_skills(
    skills: list[dict],
    categories: Optional[list[str]] = None,
    statuses: Optional[list[str]] = None,
    skill_ids: Optional[list[int]] = None,
) -> list[dict]:
    out = skills
    if categories:
        cat_set = {c.lower() for c in categories}
        out = [
            s
            for s in out
            if any(_category_slug(c) in cat_set or c.lower() in cat_set for c in s["categories"])
            or ("uncategorized" in cat_set and not s["categories"])
        ]
    if statuses:
        status_set = {s.lower() for s in statuses}
        out = [s for s in out if s["status"] in status_set]
    if skill_ids:
        id_set = set(skill_ids)
        out = [s for s in out if s["skill_id"] in id_set]
    return out


def group_landscape(skills: list[dict]) -> dict:
    """Group skills by status → primary category."""
    groups: dict[str, dict[str, list]] = {
        "developing": {},
        "planned": {},
        "mastered": {},
    }
    for s in skills:
        status = s["status"] if s["status"] in groups else "planned"
        cat = s["primary_category"]
        groups[status].setdefault(cat, []).append(s)

    for status in groups:
        sorted_cats = sorted(
            groups[status].keys(),
            key=lambda c: CATEGORY_ORDER.get(c, 99),
        )
        groups[status] = {c: groups[status][c] for c in sorted_cats}

    return groups


def landscape_charts(skills: list[dict]) -> dict:
    counts = {"developing": 0, "planned": 0, "mastered": 0}
    for s in skills:
        if s["status"] in counts:
            counts[s["status"]] += 1

    status_donut = [
        {"label": "Developing", "value": counts["developing"], "color": "#3b82f6"},
        {"label": "Planned", "value": counts["planned"], "color": "#94a3b8"},
        {"label": "Mastered", "value": counts["mastered"], "color": "#e5c76b"},
    ]

    buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-99": 0, "100": 0}
    for s in skills:
        p = s["completion_pct"]
        if p >= 100:
            buckets["100"] += 1
        elif p >= 76:
            buckets["76-99"] += 1
        elif p >= 51:
            buckets["51-75"] += 1
        elif p >= 26:
            buckets["26-50"] += 1
        else:
            buckets["0-25"] += 1

    histogram = [{"bucket": k, "count": v} for k, v in buckets.items()]

    total = len(skills)
    avg_completion = round(sum(s["completion_pct"] for s in skills) / total) if total else 0

    return {
        "status_donut": status_donut,
        "completion_histogram": histogram,
        "avg_completion_pct": avg_completion,
    }


def stagnation_report(
    skills: list[dict], threshold_days: int = 60
) -> tuple[list[dict], list[str]]:
    stale = [
        s
        for s in skills
        if s["status"] == "developing"
        and (
            s["days_since_last_activity"] is None
            or s["days_since_last_activity"] >= threshold_days
        )
    ]
    stale.sort(
        key=lambda s: (-(s["completion_pct"] or 0), s["days_since_last_activity"] or 9999)
    )

    recommendations: list[str] = []
    if not stale:
        recommendations.append(
            "Great momentum — no developing skills have gone stale in this period."
        )
        return stale, recommendations

    by_completion = sorted(stale, key=lambda s: -s["completion_pct"])
    if by_completion:
        top = by_completion[0]
        recommendations.append(
            f"{top['skill_name']} is closest to completion ({top['completion_pct']}%) — "
            "a focused session could move it toward mastery."
        )

    by_open = sorted(stale, key=lambda s: -s["open_actions"])
    if by_open and by_open[0]["open_actions"] > 0:
        top = by_open[0]
        recommendations.append(
            f"{top['skill_name']} has {top['open_actions']} open action(s) — "
            "prioritize completing existing items before adding new ones."
        )

    if len(stale) >= 2:
        recommendations.append(
            f"{len(stale)} skills need attention — consider scheduling lab time this week "
            "to rebuild consistency."
        )

    return stale, recommendations
