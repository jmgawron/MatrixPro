import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.org import Team
from app.models.plan import DevelopmentPlan, PlanSkill, PlanSkillStatus
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
        PlanSkillStatus.in_pipeline: "In Pipeline",
        PlanSkillStatus.in_development: "In Development",
        PlanSkillStatus.proficiency: "Proficiency",
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
            elif ps.status == PlanSkillStatus.proficiency:
                level = (
                    ps.proficiency_level if ps.proficiency_level is not None else "-"
                )
                cell = f"proficiency (level {level})"
            elif ps.status == PlanSkillStatus.in_development:
                cell = "in_development"
            else:
                cell = "in_pipeline"
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
