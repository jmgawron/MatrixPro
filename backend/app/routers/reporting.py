"""AI-powered progress analysis endpoints.

Pulls change-log + skills-overview data for one or more engineers in a team,
asks the Cisco BridgeIT LLM to produce a Markdown report, and exposes both the
raw markdown and a PDF export. RBAC mirrors the team change-logs endpoint:
managers see their own team's engineers; admins must specify a team.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
)
from app.models.audit import AuditLog
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.models.org import Team
from app.services.llm_circuit import LLMError, chat_completion

router = APIRouter(prefix="/api/reporting", tags=["reporting"])


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


def _collect_engineer_data(
    engineer: User,
    db: Session,
    from_dt: Optional[datetime],
    to_dt: Optional[datetime],
) -> dict:
    """Bundle change logs + skills overview for a single engineer."""
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer.id)
        .first()
    )

    audit_entries: list[dict] = []
    training_entries: list[dict] = []
    groups: dict[str, list[dict]] = {
        "developing": [],
        "planned": [],
        "mastered": [],
    }

    if plan is None:
        return {
            "engineer_id": engineer.id,
            "engineer_name": engineer.name,
            "audit_entries": audit_entries,
            "training_entries": training_entries,
            "groups": groups,
            "counts": {k: 0 for k in groups},
        }

    plan_skills = (
        db.query(PlanSkill).filter(PlanSkill.plan_id == plan.id).all()
    )
    ps_ids = [ps.id for ps in plan_skills]
    skill_names = {
        ps.id: (
            db.query(Skill).filter(Skill.id == ps.skill_id).first().name
            if ps.skill_id
            else "Unknown"
        )
        for ps in plan_skills
    }

    for ps in plan_skills:
        status_key = ps.status.value if ps.status else "planned"
        entry = {
            "skill_name": skill_names.get(ps.id, "Unknown"),
            "proficiency_level": ps.proficiency_level,
        }
        if status_key in groups:
            groups[status_key].append(entry)
        else:
            groups["planned"].append(entry)

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
            audit_entries.append(
                {
                    "date": log.changed_at.isoformat() if log.changed_at else None,
                    "field": log.field,
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "skill_name": skill_names.get(log.entity_id, "Unknown"),
                }
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

        for tlog in training_q.order_by(
            PlanSkillTrainingLog.completed_at.desc()
        ).all():
            training_entries.append(
                {
                    "date": tlog.completed_at.isoformat()
                    if tlog.completed_at
                    else None,
                    "title": tlog.title,
                    "training_type": tlog.type.value if tlog.type else None,
                    "notes": tlog.notes,
                    "skill_name": skill_names.get(tlog.plan_skill_id, "Unknown"),
                }
            )

    return {
        "engineer_id": engineer.id,
        "engineer_name": engineer.name,
        "audit_entries": audit_entries,
        "training_entries": training_entries,
        "groups": groups,
        "counts": {k: len(v) for k, v in groups.items()},
    }


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
    period = []
    if from_date:
        period.append(f"from {from_date}")
    if to_date:
        period.append(f"to {to_date}")
    period_text = " ".join(period) if period else "the selected period"

    system = (
        "You are a TAC engineering manager assistant. Produce a clear, "
        "actionable Markdown progress report. Use H2 headings (##), bullet "
        "lists, and bold for emphasis. Never use H1. Be concise, factual, "
        "and constructive. Do not invent activities that are not in the "
        "supplied data."
    )

    sections_brief = (
        "Sections to include (in this order):\n"
        "1. **Executive Summary** — 2-4 sentences covering activity volume and trend.\n"
        "2. **Skill Backlog Snapshot** — counts per status (planned, developing, mastered) "
        "and notable skills in each bucket.\n"
        "3. **Highlights** — concrete wins (trainings completed, skills mastered, "
        "status promotions).\n"
        "4. **Progress Details** — group recent changes by engineer (if multi-engineer) "
        "and by skill. Mention audit changes and training logs.\n"
        "5. **Gaps & Risks** — stale items, skills stuck in 'planned', long gaps "
        "without activity.\n"
        "6. **Recommendations** — 3-5 specific next actions for the manager."
    )

    blocks: list[str] = []
    for d in engineers_data:
        blocks.append(f"### Engineer: {d['engineer_name']} (id={d['engineer_id']})")
        counts = d["counts"]
        blocks.append(
            f"- Skill counts: planned={counts['planned']}, "
            f"developing={counts['developing']}, mastered={counts['mastered']}"
        )
        for status_key in ("planned", "developing", "mastered"):
            items = d["groups"].get(status_key) or []
            if items:
                names = ", ".join(s["skill_name"] for s in items)
                blocks.append(f"- {status_key.capitalize()} skills: {names}")
        if d["training_entries"]:
            blocks.append("- Training logs:")
            for t in d["training_entries"][:40]:
                date = (t.get("date") or "")[:10]
                blocks.append(
                    f"  - {date} • {t.get('skill_name')} • "
                    f"{t.get('training_type') or 'training'} • {t.get('title')}"
                    + (f" — {t['notes']}" if t.get("notes") else "")
                )
        if d["audit_entries"]:
            blocks.append("- Audit changes:")
            for a in d["audit_entries"][:60]:
                date = (a.get("date") or "")[:10]
                old_v = a.get("old_value") or "-"
                new_v = a.get("new_value") or "-"
                blocks.append(
                    f"  - {date} • {a.get('skill_name')} • "
                    f"{a.get('field')}: {old_v} → {new_v}"
                )
        if not d["training_entries"] and not d["audit_entries"]:
            blocks.append("- No recorded activity in this period.")
        blocks.append("")

    user_content = (
        f"Generate a progress report for {target} covering {period_text}.\n\n"
        f"{sections_brief}\n\n"
        "## Raw Data\n\n" + "\n".join(blocks)
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]


# ─── Schemas ──────────────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    team_id: Optional[int] = None
    engineer_id: Optional[int] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class AnalyzeResponse(BaseModel):
    markdown: str
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
        _collect_engineer_data(e, db, from_dt, to_dt) for e in engineers
    ]

    messages = _build_prompt(team, engineers_data, payload.from_date, payload.to_date)

    try:
        markdown_out = chat_completion(messages)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    target_name = (
        engineers_data[0]["engineer_name"]
        if payload.engineer_id is not None and len(engineers_data) == 1
        else f"Team {team.name}"
    )

    return AnalyzeResponse(
        markdown=markdown_out,
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
