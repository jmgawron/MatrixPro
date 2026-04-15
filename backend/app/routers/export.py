import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.audit import AuditLog
from app.models.org import Team
from app.models.plan import (
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
)
from app.models.skill import Skill, SkillTeam
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/export", tags=["export"])


def _check_plan_access(current_user: User, engineer_id: int, db: Session) -> User:
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    if current_user.role == UserRole.admin:
        return engineer
    if current_user.role == UserRole.manager:
        if engineer.manager_id == current_user.id:
            return engineer
        raise HTTPException(status_code=403, detail="Not the manager of this engineer")
    if current_user.id == engineer_id:
        return engineer
    raise HTTPException(status_code=403, detail="Access denied")


def _status_label(status: PlanSkillStatus) -> str:
    labels = {
        PlanSkillStatus.planned: "Planned",
        PlanSkillStatus.developing: "Developing",
        PlanSkillStatus.mastered: "Mastered",
    }
    return labels.get(status, str(status))


def _get_plan_skills(engineer_id: int, db: Session):
    plan = (
        db.query(DevelopmentPlan)
        .options(selectinload(DevelopmentPlan.skills).selectinload(PlanSkill.skill))
        .filter(DevelopmentPlan.engineer_id == engineer_id)
        .first()
    )
    if plan is None:
        return []
    return plan.skills


@router.get("/plans/{engineer_id}/pdf")
def export_plan_pdf(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engineer = _check_plan_access(current_user, engineer_id, db)
    plan_skills = _get_plan_skills(engineer_id, db)

    rows_html = ""
    for ps in plan_skills:
        skill_name = ps.skill.name if ps.skill else f"Skill #{ps.skill_id}"
        status = _status_label(ps.status)
        level = str(ps.proficiency_level) if ps.proficiency_level is not None else "-"
        notes = ps.notes or "-"
        added_at = ps.added_at.strftime("%Y-%m-%d") if ps.added_at else "-"
        rows_html += (
            f"<tr>"
            f"<td>{skill_name}</td>"
            f"<td>{status}</td>"
            f"<td>{level}</td>"
            f"<td>{notes}</td>"
            f"<td>{added_at}</td>"
            f"</tr>"
        )

    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{
    background: #0d1117;
    color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 40px;
  }}
  h1 {{ color: #3b82f6; margin-bottom: 4px; }}
  .meta {{ color: #8b949e; font-size: 0.85em; margin-bottom: 32px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{
    background: #161b22;
    color: #3b82f6;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 2px solid #30363d;
    font-size: 0.85em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }}
  td {{
    padding: 10px 14px;
    border-bottom: 1px solid #21262d;
    font-size: 0.9em;
    vertical-align: top;
  }}
  tr:nth-child(even) td {{ background: #0d1117; }}
  tr:nth-child(odd) td {{ background: #111720; }}
</style>
</head>
<body>
  <h1>Development Plan — {engineer.name}</h1>
  <p class="meta">Generated: {generated}</p>
  <table>
    <thead>
      <tr>
        <th>Skill Name</th>
        <th>Status</th>
        <th>Proficiency Level</th>
        <th>Notes</th>
        <th>Added At</th>
      </tr>
    </thead>
    <tbody>
      {rows_html if rows_html else '<tr><td colspan="5" style="text-align:center;color:#8b949e;">No skills in plan</td></tr>'}
    </tbody>
  </table>
</body>
</html>"""

    try:
        from weasyprint import HTML as WeasyHTML

        pdf_bytes = WeasyHTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc}. Ensure WeasyPrint system dependencies (pango, cairo) are installed.",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=plan_{engineer_id}.pdf"},
    )


@router.get("/plans/{engineer_id}/csv")
def export_plan_csv(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan_skills = _get_plan_skills(engineer_id, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Skill Name", "Status", "Proficiency Level", "Notes", "Added At", "Updated At"]
    )

    for ps in plan_skills:
        skill_name = ps.skill.name if ps.skill else f"Skill #{ps.skill_id}"
        status = _status_label(ps.status)
        level = str(ps.proficiency_level) if ps.proficiency_level is not None else ""
        notes = ps.notes or ""
        added_at = ps.added_at.isoformat() if ps.added_at else ""
        updated_at = ps.updated_at.isoformat() if ps.updated_at else ""
        writer.writerow([skill_name, status, level, notes, added_at, updated_at])

    csv_string = output.getvalue()
    return Response(
        content=csv_string,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=plan_{engineer_id}.csv"},
    )


@router.get("/skills/csv")
def export_skills_csv(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skills = (
        db.query(Skill)
        .filter(Skill.is_archived == False)  # noqa: E712
        .order_by(Skill.id)
        .all()
    )

    skill_ids = [s.id for s in skills]
    team_rows = (
        db.query(SkillTeam.skill_id, Team.name)
        .join(Team, SkillTeam.team_id == Team.id)
        .filter(SkillTeam.skill_id.in_(skill_ids))
        .all()
    )
    skill_team_names: dict[int, list[str]] = {}
    for sid, tname in team_rows:
        skill_team_names.setdefault(sid, []).append(tname)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Name",
            "Description",
            "Teams",
            "Is Archived",
            "Catalog Version",
            "Created At",
        ]
    )

    for skill in skills:
        teams_str = "; ".join(skill_team_names.get(skill.id, []))
        writer.writerow(
            [
                skill.id,
                skill.name,
                skill.description or "",
                teams_str,
                skill.is_archived,
                skill.catalog_version,
                skill.created_at.isoformat() if skill.created_at else "",
            ]
        )

    csv_string = output.getvalue()
    return Response(
        content=csv_string,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=skills_catalog.csv"},
    )


@router.get("/teams/{team_id}/matrix/csv")
def export_team_matrix_csv(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    if current_user.role == UserRole.manager:
        manages_team = (
            db.query(User)
            .filter(User.manager_id == current_user.id, User.team_id == team_id)
            .first()
        )
        if manages_team is None:
            raise HTTPException(status_code=403, detail="Not the manager of this team")
    elif current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Access denied")

    engineers = (
        db.query(User)
        .filter(User.team_id == team_id, User.role == UserRole.engineer)
        .order_by(User.name)
        .all()
    )

    skill_ids = db.query(SkillTeam.skill_id).filter(SkillTeam.team_id == team_id).all()
    skill_id_list = [row[0] for row in skill_ids]
    skills = (
        db.query(Skill)
        .filter(Skill.id.in_(skill_id_list), Skill.is_archived == False)  # noqa: E712
        .order_by(Skill.name)
        .all()
    )

    engineer_ids = [e.id for e in engineers]
    plans = (
        db.query(DevelopmentPlan)
        .options(selectinload(DevelopmentPlan.skills))
        .filter(DevelopmentPlan.engineer_id.in_(engineer_ids))
        .all()
    )
    plan_map: dict[int, dict[int, PlanSkill]] = {}
    for plan in plans:
        skill_map: dict[int, PlanSkill] = {}
        for ps in plan.skills:
            skill_map[ps.skill_id] = ps
        plan_map[plan.engineer_id] = skill_map

    output = io.StringIO()
    writer = csv.writer(output)

    header = ["Engineer Name"] + [s.name for s in skills]
    writer.writerow(header)

    for engineer in engineers:
        row = [engineer.name]
        skill_map = plan_map.get(engineer.id, {})
        for skill in skills:
            ps = skill_map.get(skill.id)
            if ps is None:
                cell = "not_in_plan"
            elif ps.status == PlanSkillStatus.mastered:
                level = (
                    ps.proficiency_level if ps.proficiency_level is not None else "-"
                )
                cell = f"mastered (level {level})"
            elif ps.status == PlanSkillStatus.developing:
                cell = "developing"
            else:
                cell = "planned"
            row.append(cell)
        writer.writerow(row)

    csv_string = output.getvalue()
    return Response(
        content=csv_string,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=team_{team_id}_matrix.csv"
        },
    )


# ---------------------------------------------------------------------------
# Reporting Endpoints
# ---------------------------------------------------------------------------


def _proficiency_label(level: int | None) -> str:
    labels = {1: "Education", 2: "Exposure", 3: "Experience"}
    if level is None:
        return "-"
    return labels.get(level, str(level))


def _get_change_logs(
    engineer_id: int,
    db: Session,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> list[dict]:
    plan = (
        db.query(DevelopmentPlan)
        .filter(DevelopmentPlan.engineer_id == engineer_id)
        .first()
    )

    entries: list[dict] = []

    # 1) Audit logs for plan_skill entities belonging to this engineer
    if plan:
        plan_skill_ids = [
            row[0]
            for row in db.query(PlanSkill.id).filter(PlanSkill.plan_id == plan.id).all()
        ]

        if plan_skill_ids:
            audit_query = db.query(AuditLog).filter(
                AuditLog.entity_type == "plan_skill",
                AuditLog.entity_id.in_(plan_skill_ids),
            )
            if from_date:
                audit_query = audit_query.filter(AuditLog.changed_at >= from_date)
            if to_date:
                audit_query = audit_query.filter(AuditLog.changed_at <= to_date)

            audit_logs = audit_query.order_by(AuditLog.changed_at.desc()).all()

            for log in audit_logs:
                entries.append(
                    {
                        "type": "audit",
                        "date": log.changed_at.isoformat() if log.changed_at else None,
                        "field": log.field,
                        "old_value": log.old_value,
                        "new_value": log.new_value,
                        "changed_by": log.changed_by,
                    }
                )

            # 2) Training logs
            training_query = db.query(PlanSkillTrainingLog).filter(
                PlanSkillTrainingLog.plan_skill_id.in_(plan_skill_ids)
            )
            if from_date:
                training_query = training_query.filter(
                    PlanSkillTrainingLog.completed_at >= from_date
                )
            if to_date:
                training_query = training_query.filter(
                    PlanSkillTrainingLog.completed_at <= to_date
                )

            training_logs = training_query.order_by(
                PlanSkillTrainingLog.completed_at.desc()
            ).all()

            # Map plan_skill_id → skill name
            ps_skill_names: dict[int, str] = {}
            ps_rows = (
                db.query(PlanSkill.id, Skill.name)
                .join(Skill, PlanSkill.skill_id == Skill.id)
                .filter(PlanSkill.id.in_(plan_skill_ids))
                .all()
            )
            for ps_id, s_name in ps_rows:
                ps_skill_names[ps_id] = s_name

            for tlog in training_logs:
                entries.append(
                    {
                        "type": "training",
                        "date": (
                            tlog.completed_at.isoformat() if tlog.completed_at else None
                        ),
                        "title": tlog.title,
                        "training_type": tlog.type.value if tlog.type else None,
                        "notes": tlog.notes,
                        "skill_name": ps_skill_names.get(tlog.plan_skill_id, "Unknown"),
                    }
                )

    # Sort combined entries by date descending
    entries.sort(key=lambda e: e.get("date") or "", reverse=True)
    return entries


@router.get("/plans/{engineer_id}/change-logs")
def get_change_logs(
    engineer_id: int,
    from_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)

    parsed_from = None
    parsed_to = None
    if from_date:
        try:
            parsed_from = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            parsed_to = datetime.fromisoformat(to_date + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")

    entries = _get_change_logs(engineer_id, db, parsed_from, parsed_to)
    return {"engineer_id": engineer_id, "entries": entries}


@router.get("/plans/{engineer_id}/skills-overview")
def get_skills_overview(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    plan_skills = _get_plan_skills(engineer_id, db)

    groups: dict[str, list[dict]] = {
        "developing": [],
        "planned": [],
        "mastered": [],
    }
    for ps in plan_skills:
        skill_name = ps.skill.name if ps.skill else f"Skill #{ps.skill_id}"
        status_key = ps.status.value if ps.status else "planned"
        entry = {
            "skill_name": skill_name,
            "proficiency_level": ps.proficiency_level,
            "proficiency_label": _proficiency_label(ps.proficiency_level),
        }
        if status_key in groups:
            groups[status_key].append(entry)
        else:
            groups["planned"].append(entry)

    return {
        "engineer_id": engineer_id,
        "groups": groups,
        "counts": {k: len(v) for k, v in groups.items()},
    }


def _report_pdf_style() -> str:
    return """
    body {
        background: #0d1117;
        color: #e6edf3;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 40px;
    }
    h1 { color: #3b82f6; margin-bottom: 4px; }
    h2 { color: #58a6ff; margin-top: 28px; margin-bottom: 8px; font-size: 1.1em; }
    .meta { color: #8b949e; font-size: 0.85em; margin-bottom: 24px; }
    .badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 10px;
        font-size: 0.8em;
        font-weight: 600;
        margin-right: 6px;
    }
    .badge-audit { background: #1f2937; color: #93c5fd; }
    .badge-training { background: #1a2332; color: #6ee7b7; }
    .badge-developing { background: #1e3a5f; color: #93c5fd; }
    .badge-planned { background: #1f2937; color: #d1d5db; }
    .badge-mastered { background: #14532d; color: #6ee7b7; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
        background: #161b22;
        color: #3b82f6;
        text-align: left;
        padding: 8px 12px;
        border-bottom: 2px solid #30363d;
        font-size: 0.8em;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    td {
        padding: 8px 12px;
        border-bottom: 1px solid #21262d;
        font-size: 0.85em;
        vertical-align: top;
    }
    tr:nth-child(even) td { background: #0d1117; }
    tr:nth-child(odd) td { background: #111720; }
    .empty { color: #8b949e; text-align: center; padding: 20px; }
    ul { list-style: none; padding: 0; margin: 0; }
    ul li {
        padding: 6px 0;
        border-bottom: 1px solid #21262d;
        font-size: 0.9em;
    }
    """


@router.get("/plans/{engineer_id}/change-logs/pdf")
def export_change_logs_pdf(
    engineer_id: int,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engineer = _check_plan_access(current_user, engineer_id, db)

    parsed_from = None
    parsed_to = None
    if from_date:
        try:
            parsed_from = datetime.fromisoformat(from_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format")
    if to_date:
        try:
            parsed_to = datetime.fromisoformat(to_date + "T23:59:59")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format")

    entries = _get_change_logs(engineer_id, db, parsed_from, parsed_to)
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    date_range_text = ""
    if from_date or to_date:
        parts = []
        if from_date:
            parts.append(f"from {from_date}")
        if to_date:
            parts.append(f"to {to_date}")
        date_range_text = f" ({' '.join(parts)})"

    rows_html = ""
    for e in entries:
        date_str = e.get("date", "-") or "-"
        if len(date_str) > 10:
            date_str = date_str[:10]

        if e["type"] == "audit":
            type_badge = '<span class="badge badge-audit">Audit</span>'
            detail = f"<strong>{e.get('field', '')}</strong>: {e.get('old_value', '-')} → {e.get('new_value', '-')}"
        else:
            type_badge = '<span class="badge badge-training">Training</span>'
            detail = f"<strong>{e.get('skill_name', '')}</strong> — {e.get('title', '')} ({e.get('training_type', '')})"
            if e.get("notes"):
                detail += f"<br><em>{e['notes']}</em>"

        rows_html += (
            f"<tr><td>{date_str}</td><td>{type_badge}</td><td>{detail}</td></tr>"
        )

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{_report_pdf_style()}</style>
</head>
<body>
  <h1>Change Logs — {engineer.name}</h1>
  <p class="meta">Generated: {generated}{date_range_text}</p>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Details</th></tr></thead>
    <tbody>
      {rows_html if rows_html else '<tr><td colspan="3" class="empty">No change logs found</td></tr>'}
    </tbody>
  </table>
</body>
</html>"""

    try:
        from weasyprint import HTML as WeasyHTML

        pdf_bytes = WeasyHTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc}",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=change_logs_{engineer_id}.pdf"
        },
    )


@router.get("/plans/{engineer_id}/skills-overview/pdf")
def export_skills_overview_pdf(
    engineer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engineer = _check_plan_access(current_user, engineer_id, db)
    plan_skills = _get_plan_skills(engineer_id, db)
    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    groups: dict[str, list] = {"developing": [], "planned": [], "mastered": []}
    for ps in plan_skills:
        skill_name = ps.skill.name if ps.skill else f"Skill #{ps.skill_id}"
        status_key = ps.status.value if ps.status else "planned"
        if status_key in groups:
            groups[status_key].append(skill_name)
        else:
            groups["planned"].append(skill_name)

    sections_html = ""
    section_config = [
        ("developing", "Developing", "badge-developing"),
        ("planned", "Planned", "badge-planned"),
        ("mastered", "Mastered", "badge-mastered"),
    ]
    for key, label, badge_cls in section_config:
        skills_list = groups[key]
        count = len(skills_list)
        sections_html += (
            f'<h2><span class="badge {badge_cls}">{label}</span> ({count})</h2>'
        )
        if skills_list:
            items = "".join(f"<li>{name}</li>" for name in sorted(skills_list))
            sections_html += f"<ul>{items}</ul>"
        else:
            sections_html += '<p class="empty">No skills in this category</p>'

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>{_report_pdf_style()}</style>
</head>
<body>
  <h1>Skills Overview — {engineer.name}</h1>
  <p class="meta">Generated: {generated}</p>
  {sections_html}
</body>
</html>"""

    try:
        from weasyprint import HTML as WeasyHTML

        pdf_bytes = WeasyHTML(string=html).write_pdf()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc}",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=skills_overview_{engineer_id}.pdf"
        },
    )
