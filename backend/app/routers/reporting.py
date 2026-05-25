"""AI-powered progress analysis endpoints.

Path-3 redesign (May 2026):
  - Evidence-rich `_collect_engineer_data` (skill metadata, 3E curriculum coverage,
    personal items, audit staleness, peer benchmarks, engineer context).
  - Prioritised truncation under a ~30k input-character budget (training logs and
    audit entries are sliced after high-signal items are pinned).
  - JSON-first prompt: LLM emits {markdown, sections, scorecard, ...} where the
    `markdown` field is the canonical pre-rendered report; backend falls back to
    raw text if JSON parsing fails so the UI never breaks.
  - Tuned LLM params via `chat_completion(..., temperature, max_tokens, top_p)`.

RBAC mirrors the team change-logs endpoint: managers see their own team's
engineers; admins must specify a team.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audit import AuditLog
from app.models.org import Domain, Team
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserLevelContent,
)
from app.models.skill import (
    Skill,
    SkillCategoryAssignment,
    SkillLevelContent,
)
from app.models.user import User, UserRole
from app.services.llm_circuit import LLMError, chat_completion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reporting", tags=["reporting"])


# ─── Constants ────────────────────────────────────────────────────────────────

# Soft cap on the raw-data block embedded in the user message.  Most modern LLM
# context windows handle far more, but staying conservative keeps latency down
# and avoids "lost in the middle" attention dropoff.  ~30k characters ≈ 7-8k
# tokens, leaving plenty of headroom for the 4k-token output budget.
MAX_RAW_DATA_CHARS = 30_000
MAX_TRAINING_ENTRIES = 80      # hard cap before prioritised truncation
MAX_AUDIT_ENTRIES = 120        # hard cap before prioritised truncation
STALE_DAYS_THRESHOLD = 60      # 'planned' or 'developing' with no activity
PEER_COHORT_SAMPLE = 25        # cap for peer benchmark queries


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _resolve_scope(
    current_user: User,
    db: Session,
    team_id: Optional[int],
    engineer_id: Optional[int],
) -> tuple[Team, list[User]]:
    if current_user.role == UserRole.engineer:
        raise HTTPException(status_code=403, detail="Forbidden")

    if current_user.role == UserRole.admin:
        if team_id is None:
            raise HTTPException(
                status_code=400, detail="team_id required for admin"
            )
        team = db.query(Team).filter(Team.id == team_id).first()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        engineers = db.query(User).filter(User.team_id == team_id).all()
    else:
        if current_user.team_id is None:
            raise HTTPException(
                status_code=400, detail="Manager has no team assigned"
            )
        team = db.query(Team).filter(Team.id == current_user.team_id).first()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found")
        engineers = db.query(User).filter(User.manager_id == current_user.id).all()

    if engineer_id is not None:
        engineers = [e for e in engineers if e.id == engineer_id]
        if not engineers:
            raise HTTPException(
                status_code=404, detail="Engineer not found on this team"
            )

    return team, engineers


def _parse_date(value: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        if end_of_day:
            return datetime.fromisoformat(value + "T23:59:59")
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _days_since(dt: Optional[datetime], reference: Optional[datetime] = None) -> Optional[int]:
    if dt is None:
        return None
    ref = reference or datetime.utcnow()
    return max(0, (ref - dt).days)


def _engineer_role_context(
    engineer: User, team: Optional[Team], db: Session
) -> dict:
    """Identity + organisational context (team, domain, manager, shift)."""
    domain_name: Optional[str] = None
    domain_is_technical: Optional[bool] = None
    if team is not None and team.domain_id is not None:
        dom = db.query(Domain).filter(Domain.id == team.domain_id).first()
        if dom is not None:
            domain_name = dom.name
            domain_is_technical = bool(dom.is_technical)

    manager_name: Optional[str] = None
    if engineer.manager_id:
        mgr = db.query(User).filter(User.id == engineer.manager_id).first()
        if mgr is not None:
            manager_name = mgr.name

    tenure_days = _days_since(engineer.created_at)

    return {
        "team_name": team.name if team else None,
        "team_shift": getattr(team, "shift", None) if team else None,
        "domain_name": domain_name,
        "domain_is_technical": domain_is_technical,
        "manager_name": manager_name,
        "role": engineer.role.value if engineer.role else None,
        "tenure_days_in_system": tenure_days,
    }


def _peer_benchmarks(
    engineer: User, team: Optional[Team], db: Session
) -> dict:
    """Cohort-level reference for relative standing — anonymised aggregates."""
    if team is None:
        return {
            "team_size": 0,
            "team_avg_mastered": None,
            "team_avg_developing": None,
            "team_avg_planned": None,
            "team_avg_proficiency": None,
            "engineer_rank_by_mastered": None,
        }

    peers = (
        db.query(User)
        .filter(User.team_id == team.id, User.role == UserRole.engineer)
        .limit(PEER_COHORT_SAMPLE)
        .all()
    )
    if not peers:
        return {
            "team_size": 0,
            "team_avg_mastered": None,
            "team_avg_developing": None,
            "team_avg_planned": None,
            "team_avg_proficiency": None,
            "engineer_rank_by_mastered": None,
        }

    peer_ids = [p.id for p in peers]
    plans = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id.in_(peer_ids))
        .all()
    )
    plan_by_engineer = {p.engineer_id: p.id for p in plans}

    if not plan_by_engineer:
        return {
            "team_size": len(peers),
            "team_avg_mastered": None,
            "team_avg_developing": None,
            "team_avg_planned": None,
            "team_avg_proficiency": None,
            "engineer_rank_by_mastered": None,
        }

    plan_skills = (
        db.query(PlanSkill)
        .filter(PlanSkill.plan_id.in_(plan_by_engineer.values()))
        .all()
    )

    # Reverse lookup plan_id → engineer_id.
    plan_to_engineer = {pid: eid for eid, pid in plan_by_engineer.items()}

    per_eng_counts: dict[int, dict] = {}
    for eid in peer_ids:
        per_eng_counts[eid] = {
            "mastered": 0,
            "developing": 0,
            "planned": 0,
            "proficiency_levels": [],
        }
    for ps in plan_skills:
        eid = plan_to_engineer.get(ps.plan_id)
        if eid is None:
            continue
        bucket = per_eng_counts.setdefault(
            eid,
            {"mastered": 0, "developing": 0, "planned": 0, "proficiency_levels": []},
        )
        if ps.status == PlanSkillStatus.mastered:
            bucket["mastered"] += 1
        elif ps.status == PlanSkillStatus.developing:
            bucket["developing"] += 1
        else:
            bucket["planned"] += 1
        if ps.proficiency_level is not None:
            bucket["proficiency_levels"].append(ps.proficiency_level)

    mastered_counts = [v["mastered"] for v in per_eng_counts.values()]
    developing_counts = [v["developing"] for v in per_eng_counts.values()]
    planned_counts = [v["planned"] for v in per_eng_counts.values()]
    all_proficiencies = [
        lvl for v in per_eng_counts.values() for lvl in v["proficiency_levels"]
    ]

    avg = lambda xs: round(sum(xs) / len(xs), 1) if xs else None

    eng_mastered = per_eng_counts.get(engineer.id, {}).get("mastered", 0)
    sorted_mastered = sorted(mastered_counts, reverse=True)
    try:
        rank = sorted_mastered.index(eng_mastered) + 1
    except ValueError:
        rank = None

    return {
        "team_size": len(peer_ids),
        "team_avg_mastered": avg(mastered_counts),
        "team_avg_developing": avg(developing_counts),
        "team_avg_planned": avg(planned_counts),
        "team_avg_proficiency": avg(all_proficiencies),
        "engineer_rank_by_mastered": rank,
    }


def _collect_engineer_data(
    engineer: User,
    team: Optional[Team],
    db: Session,
    from_dt: Optional[datetime],
    to_dt: Optional[datetime],
) -> dict:
    """Bundle evidence: skills + 3E curriculum coverage + activity + context."""
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer.id)
        .first()
    )

    engineer_context = _engineer_role_context(engineer, team, db)
    peer_benchmarks = _peer_benchmarks(engineer, team, db)

    if plan is None:
        return {
            "engineer_id": engineer.id,
            "engineer_name": engineer.name,
            "engineer_context": engineer_context,
            "peer_benchmarks": peer_benchmarks,
            "plan_present": False,
            "skills": [],
            "counts": {"developing": 0, "planned": 0, "mastered": 0},
            "audit_entries": [],
            "training_entries": [],
            "totals": {
                "audit_total": 0,
                "training_total": 0,
                "curriculum_items_total": 0,
                "curriculum_items_completed": 0,
                "personal_items_total": 0,
                "personal_items_completed": 0,
            },
        }

    plan_skills = (
        db.query(PlanSkill)
        .filter(PlanSkill.plan_id == plan.id)
        .all()
    )
    ps_ids = [ps.id for ps in plan_skills]
    skill_ids = [ps.skill_id for ps in plan_skills if ps.skill_id]

    # Eager-load skill rows with categories.  Tags + certs are pulled lazily
    # below to keep this query bounded.
    skill_rows = (
        db.query(Skill)
        .options(
            selectinload(Skill.skill_categories).selectinload(
                SkillCategoryAssignment.category
            ),
            selectinload(Skill.skill_tags).selectinload(Skill.skill_tags.property.mapper.class_.tag) if False else selectinload(Skill.skill_tags),
            selectinload(Skill.skill_certificates),
            selectinload(Skill.level_content),
        )
        .filter(Skill.id.in_(skill_ids))
        .all()
        if skill_ids
        else []
    )
    skill_lookup: dict[int, Skill] = {s.id: s for s in skill_rows}

    # Completions + personal items, indexed per plan_skill.
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

    # Audit + training within window (no slicing yet — done at prompt time).
    audit_q = db.query(AuditLog)
    audit_entries_raw: list[AuditLog] = []
    training_entries_raw: list[PlanSkillTrainingLog] = []
    if ps_ids:
        audit_q = audit_q.filter(
            AuditLog.entity_type == "plan_skill",
            AuditLog.entity_id.in_(ps_ids),
        )
        if from_dt:
            audit_q = audit_q.filter(AuditLog.changed_at >= from_dt)
        if to_dt:
            audit_q = audit_q.filter(AuditLog.changed_at <= to_dt)
        audit_entries_raw = audit_q.order_by(AuditLog.changed_at.desc()).all()

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
        training_entries_raw = training_q.order_by(
            PlanSkillTrainingLog.completed_at.desc()
        ).all()

    # Build "last activity" lookup per plan_skill_id from audit + training.
    last_activity: dict[int, datetime] = {}
    for log in audit_entries_raw:
        if log.entity_id and log.changed_at:
            cur = last_activity.get(log.entity_id)
            if cur is None or log.changed_at > cur:
                last_activity[log.entity_id] = log.changed_at
    for tlog in training_entries_raw:
        if tlog.plan_skill_id and tlog.completed_at:
            cur = last_activity.get(tlog.plan_skill_id)
            if cur is None or tlog.completed_at > cur:
                last_activity[tlog.plan_skill_id] = tlog.completed_at

    # Per-skill enriched records.
    skills_out: list[dict] = []
    counts = {"developing": 0, "planned": 0, "mastered": 0}
    curriculum_total = 0
    curriculum_done = 0
    personal_total = 0
    personal_done = 0

    for ps in plan_skills:
        sk = skill_lookup.get(ps.skill_id) if ps.skill_id else None
        cats = []
        tags = []
        certs = []
        education = {"total": 0, "completed": 0}
        exposure = {"total": 0, "completed": 0}
        experience = {"total": 0, "completed": 0}

        if sk is not None:
            cats = sorted(
                (sca.category for sca in sk.skill_categories if sca.category is not None),
                key=lambda c: (c.sort_order, c.id),
            )
            cats = [c.name for c in cats]
            try:
                tags = [st.tag.name for st in sk.skill_tags if st.tag is not None]
            except Exception:
                tags = []
            try:
                certs = [sc.certificate.name for sc in sk.skill_certificates if sc.certificate is not None]
            except Exception:
                certs = []

            level_buckets = {1: education, 2: exposure, 3: experience}
            for lc in sk.level_content or []:
                bucket = level_buckets.get(lc.level)
                if bucket is not None:
                    bucket["total"] += 1

        comps = completions_by_ps.get(ps.id, [])
        # SkillLevelContent → completion level cross-ref via SkillLevelContent.
        # We need to map completion.content_id back to a level.
        content_level: dict[int, int] = {}
        if sk is not None:
            for lc in sk.level_content or []:
                content_level[lc.id] = lc.level
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

        curriculum_total += education["total"] + exposure["total"] + experience["total"]
        curriculum_done += education["completed"] + exposure["completed"] + experience["completed"]

        # Personal items per level.
        personal_items = personal_by_ps.get(ps.id, [])
        personal_by_level: dict[int, dict] = {
            1: {"total": 0, "completed": 0, "titles": []},
            2: {"total": 0, "completed": 0, "titles": []},
            3: {"total": 0, "completed": 0, "titles": []},
        }
        for ulc in personal_items:
            bucket = personal_by_level.get(ulc.level)
            if bucket is None:
                continue
            bucket["total"] += 1
            if ulc.completed:
                bucket["completed"] += 1
                # Capture short titles for evidence — first 3 per level.
                if len(bucket["titles"]) < 3 and ulc.title:
                    bucket["titles"].append(ulc.title)
            personal_total += 1
            if ulc.completed:
                personal_done += 1

        status_key = ps.status.value if ps.status else "planned"
        if status_key in counts:
            counts[status_key] += 1

        la = last_activity.get(ps.id)
        days_since_activity = _days_since(la) if la else None
        is_stale = (
            status_key in ("developing", "planned")
            and (days_since_activity is None or days_since_activity > STALE_DAYS_THRESHOLD)
        )

        # Days in current status — approximated by ps.updated_at (status flip
        # updates this column; AuditLog has the precise truth but this is a
        # cheap good-enough signal).
        days_in_status = _days_since(ps.updated_at)

        # Average completion lag: time between added_at and the latest
        # completed_at within content for this skill.
        latest_complete: Optional[datetime] = None
        for c in comps:
            if c.completed and c.completed_at:
                if latest_complete is None or c.completed_at > latest_complete:
                    latest_complete = c.completed_at
        avg_completion_lag_days: Optional[int] = None
        if latest_complete and ps.added_at:
            avg_completion_lag_days = max(0, (latest_complete - ps.added_at).days)

        skills_out.append(
            {
                "plan_skill_id": ps.id,
                "skill_id": ps.skill_id,
                "skill_name": sk.name if sk else "Unknown",
                "skill_description": (sk.description or "").strip() if sk else "",
                "categories": cats,
                "tags": tags,
                "certs": certs,
                "status": status_key,
                "proficiency_level": ps.proficiency_level,
                "focus_area": ps.focus_area,
                "added_at": ps.added_at.isoformat() if ps.added_at else None,
                "updated_at": ps.updated_at.isoformat() if ps.updated_at else None,
                "days_in_status": days_in_status,
                "days_since_last_activity": days_since_activity,
                "is_stale": is_stale,
                "avg_completion_lag_days": avg_completion_lag_days,
                "curriculum": {
                    "education": education,
                    "exposure": exposure,
                    "experience": experience,
                },
                "personal_items": personal_by_level,
            }
        )

    # Audit + training as flat lists with names + categories.
    audit_entries: list[dict] = []
    for log in audit_entries_raw:
        sid = next((ps.skill_id for ps in plan_skills if ps.id == log.entity_id), None)
        sk = skill_lookup.get(sid) if sid else None
        cats = []
        if sk is not None:
            cats = [
                sca.category.name
                for sca in sk.skill_categories
                if sca.category is not None
            ]
        audit_entries.append(
            {
                "date": log.changed_at.isoformat() if log.changed_at else None,
                "field": log.field,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "skill_name": sk.name if sk else "Unknown",
                "categories": cats,
            }
        )

    training_entries: list[dict] = []
    for tlog in training_entries_raw:
        sid = next((ps.skill_id for ps in plan_skills if ps.id == tlog.plan_skill_id), None)
        sk = skill_lookup.get(sid) if sid else None
        cats = []
        if sk is not None:
            cats = [
                sca.category.name
                for sca in sk.skill_categories
                if sca.category is not None
            ]
        training_entries.append(
            {
                "date": tlog.completed_at.isoformat() if tlog.completed_at else None,
                "title": tlog.title,
                "training_type": tlog.type.value if tlog.type else None,
                "notes": tlog.notes,
                "skill_name": sk.name if sk else "Unknown",
                "categories": cats,
            }
        )

    return {
        "engineer_id": engineer.id,
        "engineer_name": engineer.name,
        "engineer_context": engineer_context,
        "peer_benchmarks": peer_benchmarks,
        "plan_present": True,
        "skills": skills_out,
        "counts": counts,
        "audit_entries": audit_entries,
        "training_entries": training_entries,
        "totals": {
            "audit_total": len(audit_entries),
            "training_total": len(training_entries),
            "curriculum_items_total": curriculum_total,
            "curriculum_items_completed": curriculum_done,
            "personal_items_total": personal_total,
            "personal_items_completed": personal_done,
        },
    }


def _format_skill_block(s: dict) -> list[str]:
    """One skill → bullet-rich evidence block."""
    cats = ", ".join(s["categories"]) if s["categories"] else "Uncategorized"
    tags = ", ".join(s["tags"]) if s["tags"] else "—"
    certs = ", ".join(s["certs"]) if s["certs"] else "—"
    cur = s["curriculum"]
    pi = s["personal_items"]

    def _pct(done: int, total: int) -> str:
        if total <= 0:
            return "n/a"
        return f"{done}/{total} ({round(100 * done / total)}%)"

    stale_tag = " ⚠ STALE" if s["is_stale"] else ""
    lines = [
        f"  • {s['skill_name']} [{cats}] — status={s['status']}, "
        f"proficiency={s['proficiency_level'] or '-'}, "
        f"days_in_status={s['days_in_status']}, "
        f"days_since_activity={s['days_since_last_activity']}{stale_tag}",
        f"    tags: {tags}; certs: {certs}",
        f"    3E coverage: Education {_pct(cur['education']['completed'], cur['education']['total'])}, "
        f"Exposure {_pct(cur['exposure']['completed'], cur['exposure']['total'])}, "
        f"Experience {_pct(cur['experience']['completed'], cur['experience']['total'])}",
    ]
    personal_summary_bits: list[str] = []
    for lvl, label in ((1, "Edu"), (2, "Exp"), (3, "Exper")):
        b = pi.get(lvl, {})
        if b.get("total"):
            personal_summary_bits.append(
                f"{label} {b['completed']}/{b['total']}"
                + (f" e.g. \"{b['titles'][0]}\"" if b.get("titles") else "")
            )
    if personal_summary_bits:
        lines.append("    personal items: " + "; ".join(personal_summary_bits))
    if s.get("avg_completion_lag_days") is not None:
        lines.append(
            f"    completion lag: ~{s['avg_completion_lag_days']}d from add → latest completion"
        )
    return lines


def _prioritise_and_render(d: dict, char_budget: int) -> str:
    """Render one engineer's evidence under a character budget.

    Priority order:
      1. Engineer context + peer benchmarks (always shown)
      2. Counts + totals (always shown)
      3. Mastered skills, then stale skills, then developing, then planned
      4. Training logs (most recent first)
      5. Audit changes (most recent first)
    Lower-priority slices are dropped as we approach the budget.
    """
    parts: list[str] = []
    ctx = d["engineer_context"]
    pb = d["peer_benchmarks"]
    totals = d["totals"]
    counts = d["counts"]

    parts.append(f"### Engineer: {d['engineer_name']} (id={d['engineer_id']})")
    parts.append(
        "  Context: role={role}, team={team}/{shift}, domain={dom} ({tech}), "
        "manager={mgr}, tenure≈{tenure}d".format(
            role=ctx.get("role"),
            team=ctx.get("team_name"),
            shift=ctx.get("team_shift") or "—",
            dom=ctx.get("domain_name") or "—",
            tech=("technical" if ctx.get("domain_is_technical") else "non-technical")
            if ctx.get("domain_is_technical") is not None
            else "—",
            mgr=ctx.get("manager_name") or "—",
            tenure=ctx.get("tenure_days_in_system"),
        )
    )
    parts.append(
        "  Peer benchmarks: team_size={n}, avg_mastered={am}, avg_developing={ad}, "
        "avg_planned={ap}, avg_proficiency={apr}, rank_by_mastered={rk}".format(
            n=pb.get("team_size"),
            am=pb.get("team_avg_mastered"),
            ad=pb.get("team_avg_developing"),
            ap=pb.get("team_avg_planned"),
            apr=pb.get("team_avg_proficiency"),
            rk=pb.get("engineer_rank_by_mastered"),
        )
    )
    parts.append(
        f"  Counts: planned={counts['planned']}, developing={counts['developing']}, "
        f"mastered={counts['mastered']}"
    )
    parts.append(
        "  Totals: audits={a}, trainings={t}, curriculum {cd}/{ct}, personal_items {pd}/{pt}".format(
            a=totals["audit_total"],
            t=totals["training_total"],
            cd=totals["curriculum_items_completed"],
            ct=totals["curriculum_items_total"],
            pd=totals["personal_items_completed"],
            pt=totals["personal_items_total"],
        )
    )

    if not d.get("plan_present"):
        parts.append("  (No development plan on record.)")
        return "\n".join(parts)

    # Sort skills: mastered first, then stale, then developing, then planned.
    skills = list(d["skills"])

    def _skill_priority(s: dict) -> tuple:
        status_rank = {"mastered": 0, "developing": 2, "planned": 3}.get(s["status"], 4)
        stale_rank = 0 if s.get("is_stale") else 1
        return (status_rank, stale_rank, -(s.get("proficiency_level") or 0))

    skills.sort(key=_skill_priority)

    parts.append("  Skills (ordered by priority):")
    skill_render_chars = 0
    skills_rendered = 0
    deferred_summary_count = 0
    for s in skills:
        block = _format_skill_block(s)
        block_text = "\n".join(block)
        if len("\n".join(parts)) + skill_render_chars + len(block_text) > char_budget * 0.55:
            deferred_summary_count += 1
            continue
        parts.append(block_text)
        skill_render_chars += len(block_text)
        skills_rendered += 1
    if deferred_summary_count:
        parts.append(
            f"  … plus {deferred_summary_count} additional skill(s) omitted to stay within budget."
        )

    # Training entries.
    if d["training_entries"]:
        parts.append("  Training logs (most recent first):")
        rendered = 0
        for t in d["training_entries"][:MAX_TRAINING_ENTRIES]:
            line = (
                f"    - {(t.get('date') or '')[:10]} • {t.get('skill_name')} "
                f"[{', '.join(t.get('categories') or []) or 'Uncategorized'}] • "
                f"{t.get('training_type') or 'training'} • {t.get('title')}"
                + (f" — {t['notes']}" if t.get("notes") else "")
            )
            if len("\n".join(parts)) + len(line) > char_budget * 0.80:
                parts.append(
                    f"    … plus {len(d['training_entries']) - rendered} more training entr(ies) omitted."
                )
                break
            parts.append(line)
            rendered += 1

    # Audit entries.
    if d["audit_entries"]:
        parts.append("  Audit changes (most recent first):")
        rendered = 0
        for a in d["audit_entries"][:MAX_AUDIT_ENTRIES]:
            line = (
                f"    - {(a.get('date') or '')[:10]} • {a.get('skill_name')} "
                f"[{', '.join(a.get('categories') or []) or 'Uncategorized'}] • "
                f"{a.get('field')}: {a.get('old_value') or '-'} → {a.get('new_value') or '-'}"
            )
            if len("\n".join(parts)) + len(line) > char_budget * 0.99:
                parts.append(
                    f"    … plus {len(d['audit_entries']) - rendered} more audit entr(ies) omitted."
                )
                break
            parts.append(line)
            rendered += 1

    if not d["training_entries"] and not d["audit_entries"]:
        parts.append("  (No recorded activity in this period.)")

    return "\n".join(parts)


def _build_prompt(
    team: Team,
    engineers_data: list[dict],
    from_date: Optional[str],
    to_date: Optional[str],
) -> list[dict]:
    is_single = len(engineers_data) == 1
    target = (
        engineers_data[0]["engineer_name"]
        if is_single
        else f"team {team.name} ({len(engineers_data)} engineers)"
    )
    period_bits: list[str] = []
    if from_date:
        period_bits.append(f"from {from_date}")
    if to_date:
        period_bits.append(f"to {to_date}")
    period_text = " ".join(period_bits) if period_bits else "the selected period"

    system = (
        "You are an expert TAC engineering manager and skill-development coach.\n"
        "\n"
        "Your job is to produce a holistic, evidence-based progress assessment of\n"
        "an engineer's skill development. Be balanced, factual, and constructive.\n"
        "\n"
        "Rules:\n"
        "1. EVIDENCE-FIRST: every claim must be grounded in the supplied data\n"
        "   (skill names, counts, 3E coverage percentages, dates, audit fields).\n"
        "   When you cite a number, it MUST come from the Raw Data block.\n"
        "2. NO INVENTION: do not invent activities, certifications, dates, or\n"
        "   skill names that do not appear in the input. If data is missing,\n"
        "   say so explicitly in the Data Confidence Note.\n"
        "3. BALANCED: every report must surface BOTH wins (mastered skills,\n"
        "   completed curriculum, training streaks) AND concerns (stale skills,\n"
        "   shallow 3E coverage, low-proficiency masteries, missing categories).\n"
        "4. CATEGORY-FRAMED: skills belong to one or more of Foundational, Core,\n"
        "   Advanced, AI & Future Skills. Frame strengths and gaps by category.\n"
        "5. 3E-AWARE: the 3E framework is Education (L1 read/watch), Exposure\n"
        "   (L2 lab/co-pilot), Experience (L3 own/ship). Mastery without\n"
        "   Experience coverage is a yellow flag, not a green one.\n"
        "6. PEER-RELATIVE: when peer benchmarks are present, use them to\n"
        "   calibrate (e.g. 'above team avg of N mastered'). Do not over-index\n"
        "   on rank — peer cohorts here are small.\n"
        "7. ACTIONABLE: recommendations must be specific, measurable, and tied\n"
        "   to the evidence (e.g. 'Complete the 3 outstanding Exposure items on\n"
        "   <skill>' beats 'practice more').\n"
        "8. CALIBRATION: a mastered skill with 0 days_in_status or no training\n"
        "   logs should be flagged as 'mastery claim unverified by evidence'.\n"
        "9. STRUCTURED OUTPUT: respond ONLY with a single JSON object — no\n"
        "   prose before or after, no Markdown code fences. The object MUST\n"
        "   match the schema below.\n"
        "\n"
        "Response schema (JSON only):\n"
        "{\n"
        '  "markdown": "<full Markdown report, ready to render>",\n'
        '  "executive_summary": "<2-4 sentence summary>",\n'
        '  "scorecard": {\n'
        '    "activity_volume": "low|moderate|high",\n'
        '    "evidence_quality": "thin|adequate|strong",\n'
        '    "category_balance": "narrow|mixed|broad",\n'
        '    "trend": "regressing|flat|improving"\n'
        "  },\n"
        '  "key_achievements": ["..."],\n'
        '  "gaps_and_concerns": ["..."],\n'
        '  "recommendations": [\n'
        '    {"action": "...", "rationale": "...", "category": "Foundational|Core|Advanced|AI & Future Skills|Cross-cutting"}\n'
        "  ],\n"
        '  "data_confidence_note": "<one paragraph on coverage limits>"\n'
        "}\n"
        "\n"
        "The `markdown` field MUST contain these H2 sections in this order:\n"
        "## Executive Summary\n"
        "## Performance Scorecard  (render the scorecard as a GitHub-flavoured Markdown table; the table MUST contain real newline characters between the header row, the separator row, and each body row so that standard Markdown parsers detect it)\n"
        "## Key Achievements\n"
        "## Gaps & Concerns\n"
        "## 3E Framework Analysis\n"
        "## Peer-Relative Standing\n"
        "## Recommendations\n"
        "## Data Confidence Note\n"
        "Use H2 only (no H1). Use bullet lists and bold for emphasis."
    )

    # Build raw-data section under budget.
    per_engineer_budget = max(2000, MAX_RAW_DATA_CHARS // max(1, len(engineers_data)))
    rendered_blocks: list[str] = []
    for d in engineers_data:
        rendered_blocks.append(_prioritise_and_render(d, per_engineer_budget))
    raw_data_block = "\n\n".join(rendered_blocks)

    user_content = (
        f"Generate a progress report for {target} covering {period_text}.\n\n"
        f"Return exactly one JSON object matching the schema in the system prompt.\n"
        f"Do not wrap the JSON in code fences.\n\n"
        f"## Raw Data\n\n{raw_data_block}"
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]


# ─── JSON extraction ──────────────────────────────────────────────────────────


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Optional[dict]:
    """Pull the first JSON object out of the LLM response, tolerant of fences."""
    if not text:
        return None
    cleaned = text.strip()
    # Strip ```json fences if the model added them despite instructions.
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    m = _JSON_BLOCK_RE.search(cleaned)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


# ─── Schemas ──────────────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    team_id: Optional[int] = None
    engineer_id: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class AnalyzeResponse(BaseModel):
    markdown: str
    structured: Optional[dict] = None
    target_name: str
    team_id: int
    team_name: str
    engineer_id: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    generated_at: str
    generated_by: str


class PdfRequest(BaseModel):
    markdown: str
    target_name: str
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    generated_at: Optional[str] = None
    generated_by: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_progress(
    payload: AnalyzeRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team, engineers = _resolve_scope(
        current_user, db, payload.team_id, payload.engineer_id
    )
    if not engineers:
        raise HTTPException(status_code=404, detail="No engineers in scope")

    from_dt = _parse_date(payload.from_date)
    to_dt = _parse_date(payload.to_date, end_of_day=True)

    engineers_data = [
        _collect_engineer_data(e, team, db, from_dt, to_dt) for e in engineers
    ]

    messages = _build_prompt(team, engineers_data, payload.from_date, payload.to_date)

    try:
        raw_out = chat_completion(
            messages,
            temperature=0.3,
            max_tokens=4000,
            top_p=0.9,
        )
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    structured = _extract_json(raw_out)
    if structured and isinstance(structured.get("markdown"), str) and structured["markdown"].strip():
        markdown_out = structured["markdown"]
    else:
        # Fallback: treat the entire response as markdown so the UI still renders.
        logger.warning(
            "LLM response did not contain parseable JSON with `markdown` field; "
            "falling back to raw output."
        )
        markdown_out = raw_out
        structured = None

    target_name = (
        engineers_data[0]["engineer_name"]
        if payload.engineer_id is not None and len(engineers_data) == 1
        else f"Team {team.name}"
    )

    return AnalyzeResponse(
        markdown=markdown_out,
        structured=structured,
        target_name=target_name,
        team_id=team.id,
        team_name=team.name,
        engineer_id=payload.engineer_id,
        from_date=payload.from_date,
        to_date=payload.to_date,
        generated_at=datetime.utcnow().isoformat() + "Z",
        generated_by=current_user.name,
    )


@router.post("/analyze/pdf")
def analyze_progress_pdf(
    payload: PdfRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.engineer:
        raise HTTPException(status_code=403, detail="Forbidden")

    import markdown as md
    from weasyprint import HTML as WeasyHTML

    body_html = md.markdown(
        payload.markdown or "",
        extensions=["extra", "sane_lists", "tables"],
    )

    period_parts: list[str] = []
    if payload.from_date:
        period_parts.append(f"from {payload.from_date}")
    if payload.to_date:
        period_parts.append(f"to {payload.to_date}")
    period_text = " ".join(period_parts) if period_parts else ""

    generated_meta = payload.generated_at or (datetime.utcnow().isoformat() + "Z")
    generated_by = payload.generated_by or current_user.name

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 18mm 16mm; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    font-size: 11pt;
    line-height: 1.45;
  }}
  h1 {{ color: #1e40af; margin: 0 0 4px 0; font-size: 20pt; }}
  h2 {{ color: #1e3a8a; margin-top: 18px; margin-bottom: 6px; font-size: 14pt;
        border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }}
  h3 {{ color: #1f2937; margin-top: 12px; margin-bottom: 4px; font-size: 12pt; }}
  .meta {{ color: #6b7280; font-size: 9.5pt; margin-bottom: 20px; }}
  ul, ol {{ margin: 6px 0 10px 22px; }}
  li {{ margin-bottom: 3px; }}
  strong {{ color: #111827; }}
  em {{ color: #374151; }}
  code {{ background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }}
  table {{ border-collapse: collapse; margin: 8px 0; width: 100%; }}
  th, td {{ border: 1px solid #e5e7eb; padding: 6px 8px; font-size: 10pt; text-align: left; }}
  th {{ background: #f9fafb; color: #1e40af; }}
  blockquote {{ border-left: 3px solid #93c5fd; margin: 8px 0; padding: 4px 12px;
                background: #eff6ff; color: #1e3a8a; }}
  hr {{ border: none; border-top: 1px solid #d1d5db; margin: 16px 0; }}
</style>
</head>
<body>
  <h1>Progress Analysis — {payload.target_name}</h1>
  <p class="meta">
    Generated: {generated_meta} • By: {generated_by}{(' • ' + period_text) if period_text else ''}
  </p>
  {body_html}
</body>
</html>"""

    pdf_bytes = WeasyHTML(string=html).write_pdf()
    filename = (
        f"progress-analysis-{payload.target_name.replace(' ', '_')}-"
        f"{datetime.utcnow().strftime('%Y%m%d-%H%M')}.pdf"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
