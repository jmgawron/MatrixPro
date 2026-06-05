"""My Plan reporting endpoints — landscape, activity, stagnation, AI summary, PDF."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.org import Team
from app.models.user import User, UserRole
from app.routers.plans import _check_plan_access
from app.services.activity_normalizer import collect_activity
from app.services.report_aggregator import (
    collect_skill_metrics,
    filter_skills,
    group_landscape,
    landscape_charts,
    stagnation_report,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_date(value: str | None, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if end_of_day and "T" not in value:
            return dt.replace(hour=23, minute=59, second=59)
        return dt
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from exc


def _parse_csv_ints(value: str | None) -> list[int] | None:
    if not value:
        return None
    try:
        return [int(x.strip()) for x in value.split(",") if x.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid skill_ids") from exc


def _parse_csv_str(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [x.strip() for x in value.split(",") if x.strip()]


class AiSummaryRequest(BaseModel):
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class PdfExportRequest(BaseModel):
    report_type: Literal["landscape", "activity", "stagnation", "ai_summary"]
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    threshold_days: Optional[int] = 60
    categories: Optional[list[str]] = None
    statuses: Optional[list[str]] = None
    skill_ids: Optional[list[int]] = None
    markdown: Optional[str] = None
    title: Optional[str] = None


@router.get("/plans/{engineer_id}/landscape")
def get_landscape_report(
    engineer_id: int,
    categories: Optional[str] = Query(None),
    statuses: Optional[str] = Query(None),
    skill_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    data = collect_skill_metrics(engineer_id, db)
    skills = filter_skills(
        data["skills"],
        categories=_parse_csv_str(categories),
        statuses=_parse_csv_str(statuses),
        skill_ids=_parse_csv_ints(skill_ids),
    )
    charts = landscape_charts(skills)
    return {
        "engineer_id": engineer_id,
        "engineer_name": data["engineer_name"],
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "summary": {
            "total_skills": len(skills),
            "by_status": {
                k: sum(1 for s in skills if s["status"] == k)
                for k in ("developing", "planned", "mastered")
            },
            "avg_completion_pct": charts["avg_completion_pct"],
        },
        "groups": group_landscape(skills),
        "charts": charts,
    }


@router.get("/plans/{engineer_id}/activity")
def get_activity_report(
    engineer_id: int,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    activity_type: Optional[str] = Query(None),
    skill_ids: Optional[str] = Query(None),
    sort: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    from_dt = _parse_date(from_date)
    to_dt = _parse_date(to_date, end_of_day=True)
    act_types = _parse_csv_str(activity_type)
    result = collect_activity(
        engineer_id,
        db,
        from_dt=from_dt,
        to_dt=to_dt,
        activity_types=act_types,
        skill_ids=_parse_csv_ints(skill_ids),
        sort=sort,
    )
    return {
        "engineer_id": engineer_id,
        "from_date": from_date,
        "to_date": to_date,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        **result,
    }


@router.get("/plans/{engineer_id}/stagnation")
def get_stagnation_report(
    engineer_id: int,
    days: int = Query(60, ge=7, le=365),
    categories: Optional[str] = Query(None),
    skill_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    data = collect_skill_metrics(engineer_id, db)
    skills = filter_skills(
        data["skills"],
        categories=_parse_csv_str(categories),
        skill_ids=_parse_csv_ints(skill_ids),
    )
    stale, recommendations = stagnation_report(skills, threshold_days=days)
    return {
        "engineer_id": engineer_id,
        "engineer_name": data["engineer_name"],
        "threshold_days": days,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "stale_count": len(stale),
        "skills": stale,
        "recommendations": recommendations,
    }


@router.post("/plans/{engineer_id}/ai-summary")
def post_ai_summary(
    engineer_id: int,
    payload: AiSummaryRequest = Body(default_factory=AiSummaryRequest),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.routers.reporting import run_engineer_self_analysis

    engineer = _check_plan_access(current_user, engineer_id, db)
    return run_engineer_self_analysis(
        engineer, db, payload.from_date, payload.to_date, current_user
    )


def _pdf_style() -> str:
    return """
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           margin: 36px; color: #1e293b; font-size: 10pt; }
    h1 { color: #1e40af; font-size: 18pt; margin-bottom: 4px; border-bottom: 2px solid #1e40af; padding-bottom: 6px; }
    h2 { color: #1e40af; font-size: 12pt; margin-top: 18px; }
    .meta { color: #64748b; font-size: 9pt; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 8pt;
         text-transform: uppercase; border: 1px solid #e2e8f0; }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 9pt; vertical-align: top; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0;
              font-size: 8pt; color: #94a3b8; text-align: center; }
    ul { padding-left: 1.2em; }
    li { margin-bottom: 4px; }
    """


@router.post("/plans/{engineer_id}/export/pdf")
def export_report_pdf(
    engineer_id: int,
    payload: PdfExportRequest = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_plan_access(current_user, engineer_id, db)
    try:
        from weasyprint import HTML as WeasyHTML
    except ImportError as exc:
        raise HTTPException(
            status_code=503, detail="PDF generation unavailable (WeasyPrint)"
        ) from exc

    import markdown as md

    generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    engineer = db.query(User).filter(User.id == engineer_id).first()
    eng_name = engineer.name if engineer else f"Engineer {engineer_id}"
    body_parts: list[str] = []

    if payload.report_type == "landscape":
        data = get_landscape_report(engineer_id, None, None, None, db, current_user)
        body_parts.append("<h1>Skills Landscape Report</h1>")
        body_parts.append(
            f'<div class="meta">Engineer: {eng_name}<br>Generated: {generated} by {current_user.name}</div>'
        )
        s = data["summary"]
        body_parts.append(
            f"<p>Total skills: {s['total_skills']} · "
            f"Developing: {s['by_status']['developing']} · "
            f"Planned: {s['by_status']['planned']} · "
            f"Mastered: {s['by_status']['mastered']} · "
            f"Avg completion: {s['avg_completion_pct']}%</p>"
        )
        status_labels = {
            "developing": "Developing",
            "planned": "Planned",
            "mastered": "Mastered",
        }
        for status, cat_groups in data["groups"].items():
            if not cat_groups:
                continue
            body_parts.append(f"<h2>{status_labels.get(status, status)}</h2>")
            for cat, skills in cat_groups.items():
                if not skills:
                    continue
                body_parts.append(f"<h3>{cat.replace('-', ' ').title()}</h3>")
                body_parts.append(
                    "<table><tr><th>Skill</th><th>Completion</th><th>Focus</th>"
                    "<th>Actions</th><th>Last activity</th></tr>"
                )
                for sk in skills:
                    la = (sk.get("last_activity_at") or "—")[:10]
                    body_parts.append(
                        f"<tr><td>{sk['skill_name']}</td><td>{sk['completion_pct']}%</td>"
                        f"<td>{sk['focus_label']}</td><td>{sk['logged_actions']}</td>"
                        f"<td>{la}</td></tr>"
                    )
                body_parts.append("</table>")

    elif payload.report_type == "activity":
        act = collect_activity(
            engineer_id,
            db,
            from_dt=_parse_date(payload.from_date),
            to_dt=_parse_date(payload.to_date, end_of_day=True),
            skill_ids=payload.skill_ids,
        )
        body_parts.append("<h1>Activity History Report</h1>")
        period = f"{payload.from_date or '—'} to {payload.to_date or '—'}"
        body_parts.append(
            f'<div class="meta">Engineer: {eng_name}<br>Period: {period}<br>Generated: {generated}</div>'
        )
        for skill in act["skills"]:
            body_parts.append(
                f"<h2>{skill['skill_name']} ({skill['event_count']} events)</h2>"
            )
            body_parts.append(
                "<table><tr><th>Date</th><th>Type</th><th>Details</th><th>Notes</th></tr>"
            )
            for ev in skill["events"]:
                detail = ev.get("new") or ev.get("previous") or "—"
                if ev.get("previous") and ev.get("new"):
                    detail = f"{ev['previous']} → {ev['new']}"
                body_parts.append(
                    f"<tr><td>{(ev.get('timestamp') or '')[:16]}</td>"
                    f"<td>{ev.get('activity_label', '')}</td>"
                    f"<td>{detail}</td>"
                    f"<td>{ev.get('comment') or '—'}</td></tr>"
                )
            body_parts.append("</table>")

    elif payload.report_type == "stagnation":
        days = payload.threshold_days or 60
        data = collect_skill_metrics(engineer_id, db)
        skills = filter_skills(
            data["skills"],
            categories=payload.categories,
            skill_ids=payload.skill_ids,
        )
        stale, recs = stagnation_report(skills, threshold_days=days)
        body_parts.append("<h1>Stagnation / Focus Report</h1>")
        body_parts.append(
            f'<div class="meta">Engineer: {eng_name}<br>Threshold: {days} days<br>Generated: {generated}</div>'
        )
        body_parts.append(f"<p><strong>{len(stale)}</strong> developing skill(s) need attention.</p>")
        if stale:
            body_parts.append(
                "<table><tr><th>Skill</th><th>Completion</th><th>Focus</th>"
                "<th>Last activity</th><th>Open</th><th>Days stale</th></tr>"
            )
            for sk in stale:
                la = (sk.get("last_activity_at") or "—")[:10]
                days_stale = sk.get("days_since_last_activity")
                body_parts.append(
                    f"<tr><td>{sk['skill_name']}</td><td>{sk['completion_pct']}%</td>"
                    f"<td>{sk['focus_label']}</td><td>{la}</td>"
                    f"<td>{sk['open_actions']}</td><td>{days_stale if days_stale is not None else '—'}</td></tr>"
                )
            body_parts.append("</table>")
        if recs:
            body_parts.append("<h2>Recommended next steps</h2><ul>")
            for r in recs:
                body_parts.append(f"<li>{r}</li>")
            body_parts.append("</ul>")

    elif payload.report_type == "ai_summary":
        if not payload.markdown:
            raise HTTPException(status_code=400, detail="markdown required for ai_summary PDF")
        title = payload.title or "AI Development Summary"
        body_parts.append(f"<h1>{title}</h1>")
        period = f"{payload.from_date or '—'} to {payload.to_date or '—'}"
        body_parts.append(
            f'<div class="meta">Engineer: {eng_name}<br>Period: {period}<br>Generated: {generated}</div>'
        )
        body_parts.append(md.markdown(payload.markdown, extensions=["extra", "sane_lists", "tables"]))

    else:
        raise HTTPException(status_code=400, detail="Unknown report_type")

    body_parts.append(
        f'<div class="footer">MatrixPro · Generated {generated} · {current_user.name}</div>'
    )
    html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{_pdf_style()}</style></head><body>{''.join(body_parts)}</body></html>"

    pdf_bytes = WeasyHTML(string=html).write_pdf()
    filename = f"{payload.report_type}_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
