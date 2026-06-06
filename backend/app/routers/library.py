"""
Library router — context-scoped personal learning content library.

Endpoints:
  GET  /api/plans/{engineer_id}/skills/{skill_id}/library/search
       Browse all engineers' items for this exact (skill_id, level), respecting
       privacy + 3-tier proximity ranking. Used by the "Discover" tab.

  POST /api/plans/{engineer_id}/skills/{skill_id}/library/import
       Clone N library items into the engineer's plan_skill as full independent
       copies. See Decision 1A (no shared refs / no sync).

Scoping is enforced server-side: results MUST match (skill_id, level). No
broader queries allowed.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from markdownify import markdownify as _html_to_md
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.plan import PlanSkill, UserLevelContent
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.schemas.plan import (
    LibraryImportRequest,
    LibraryImportResponse,
    UserContentResponse,
)
from app.search_utils import SearchCursor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plans", tags=["library"])

BUCKET_LABELS = {
    1: "My team",
    2: "My domain (all shifts)",
    3: "Other teams & domains",
}


def _resolve_team_and_domain(db: Session, user_id: int) -> tuple[Optional[int], Optional[int]]:
    row = db.execute(
        text(
            "SELECT u.team_id, t.domain_id "
            "FROM users u LEFT JOIN teams t ON u.team_id = t.id "
            "WHERE u.id = :uid"
        ),
        {"uid": user_id},
    ).fetchone()
    if not row:
        return None, None
    return row[0], row[1]


def _check_access(current_user: User, engineer_id: int, db: Session) -> User:
    if current_user.id == engineer_id:
        return current_user
    if current_user.role == UserRole.admin:
        engineer = db.query(User).filter(User.id == engineer_id).first()
        if not engineer:
            raise HTTPException(status_code=404, detail="Engineer not found")
        return engineer
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")
    if current_user.role == UserRole.manager and engineer.manager_id == current_user.id:
        return engineer
    raise HTTPException(status_code=403, detail="Not authorized for this engineer")


def _require_plan_skill(db: Session, engineer: User, skill_id: int) -> PlanSkill:
    if not engineer.development_plan:
        raise HTTPException(status_code=404, detail="Engineer plan not found")
    ps = (
        db.query(PlanSkill)
        .filter(
            PlanSkill.plan_id == engineer.development_plan.id,
            PlanSkill.skill_id == skill_id,
        )
        .first()
    )
    if not ps:
        raise HTTPException(status_code=404, detail="Skill not in engineer's plan")
    return ps


@router.get("/{engineer_id}/skills/{skill_id}/library/search")
async def library_search(
    engineer_id: int,
    skill_id: int,
    level: int = Query(..., ge=1, le=3),
    q: Optional[str] = Query(None, max_length=200),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user, engineer_id, db)

    if not db.query(Skill).filter(Skill.id == skill_id).first():
        raise HTTPException(status_code=404, detail="Skill not found")

    cursor_data = SearchCursor.decode(cursor) if cursor else None
    if cursor and not cursor_data:
        raise HTTPException(status_code=400, detail="Invalid cursor")

    req_team_id, req_domain_id = _resolve_team_and_domain(db, engineer_id)
    is_admin = current_user.role == UserRole.admin

    # Discover excludes the plan owner's items (Create tab only) and non-public items
    # for non-admins. Admins may still see other engineers' private items.
    exclude_own_clause = "AND ulc.user_id != :engineer_id"
    privacy_clause = "" if is_admin else "AND ulc.is_private = 0"

    has_query = bool(q and q.strip())

    bucket_case = """
        CASE
            WHEN :req_team_id IS NOT NULL AND u_owner.team_id = :req_team_id THEN 1
            WHEN :req_domain_id IS NOT NULL AND t_owner.domain_id = :req_domain_id THEN 2
            ELSE 3
        END
    """

    if has_query:
        sql = f"""
        SELECT
            ulc.id, ulc.title, ulc.description, ulc.description_format, ulc.url,
            ulc.created_at, ulc.user_id, ulc.is_private,
            u_owner.name AS owner_name,
            {bucket_case} AS bucket,
            fts.rank AS score
        FROM user_content_fts fts
        JOIN user_level_content ulc ON fts.rowid = ulc.id
        JOIN users u_owner ON ulc.user_id = u_owner.id
        LEFT JOIN teams t_owner ON u_owner.team_id = t_owner.id
        WHERE ulc.skill_id = :skill_id
          AND ulc.level = :level
          {exclude_own_clause}
          {privacy_clause}
          AND fts.user_content_fts MATCH :search_query
        """
        order = "ORDER BY bucket ASC, fts.rank ASC, ulc.id ASC"
    else:
        sql = f"""
        SELECT
            ulc.id, ulc.title, ulc.description, ulc.description_format, ulc.url,
            ulc.created_at, ulc.user_id, ulc.is_private,
            u_owner.name AS owner_name,
            {bucket_case} AS bucket,
            0.0 AS score
        FROM user_level_content ulc
        JOIN users u_owner ON ulc.user_id = u_owner.id
        LEFT JOIN teams t_owner ON u_owner.team_id = t_owner.id
        WHERE ulc.skill_id = :skill_id
          AND ulc.level = :level
          {exclude_own_clause}
          {privacy_clause}
        """
        order = "ORDER BY bucket ASC, ulc.created_at DESC, ulc.id ASC"

    if cursor_data:
        if has_query:
            sql += f"""
            AND (
                ({bucket_case}) > :cursor_bucket
                OR (
                    ({bucket_case}) = :cursor_bucket
                    AND (fts.rank > :cursor_score OR (fts.rank = :cursor_score AND ulc.id > :cursor_id))
                )
            )
            """
        else:
            sql += f"""
            AND (
                ({bucket_case}) > :cursor_bucket
                OR (({bucket_case}) = :cursor_bucket AND ulc.id < :cursor_id)
            )
            """

    sql += f" {order} LIMIT :limit_plus_one"

    params: dict = {
        "engineer_id": engineer_id,
        "req_team_id": req_team_id,
        "req_domain_id": req_domain_id,
        "skill_id": skill_id,
        "level": level,
        "limit_plus_one": limit + 1,
    }
    if has_query:
        params["search_query"] = q
    if cursor_data:
        params.update(
            {
                "cursor_bucket": cursor_data["bucket"],
                "cursor_score": cursor_data["score"],
                "cursor_id": cursor_data["id"],
            }
        )

    try:
        rows = db.execute(text(sql), params).fetchall()
    except Exception as e:
        logger.error(f"Library search failed: {e}")
        raise HTTPException(status_code=500, detail="Library search failed")

    has_more = len(rows) > limit
    rows = rows[:limit]

    results = []
    for r in rows:
        created = r[5]
        if hasattr(created, "isoformat"):
            created_iso = created.isoformat()
        elif created is None:
            created_iso = None
        else:
            created_iso = str(created)
        results.append(
            {
                "id": r[0],
                "title": r[1],
                "description": r[2],
                "description_format": r[3] or "markdown",
                "url": r[4],
                "created_at": created_iso,
                "user_id": r[6],
                "is_private": bool(r[7]),
                "owner_name": r[8],
                "bucket": r[9],
                "bucket_label": BUCKET_LABELS.get(r[9], "Other"),
                "score": float(r[10]) if r[10] is not None else 0.0,
                "is_mine": r[6] == engineer_id,
            }
        )

    next_cursor = None
    if has_more and results:
        last = results[-1]
        next_cursor = SearchCursor.encode(
            bucket=last["bucket"],
            score=last["score"],
            content_id=last["id"],
        )

    return {
        "results": results,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "query": q or "",
        "level": level,
        "skill_id": skill_id,
    }


@router.post(
    "/{engineer_id}/skills/{skill_id}/library/import",
    response_model=LibraryImportResponse,
)
async def library_import(
    engineer_id: int,
    skill_id: int,
    payload: LibraryImportRequest,
    level: int = Query(..., ge=1, le=3),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engineer = _check_access(current_user, engineer_id, db)
    ps = _require_plan_skill(db, engineer, skill_id)

    if not payload.source_ids:
        raise HTTPException(status_code=400, detail="No source_ids provided")
    if len(payload.source_ids) > 50:
        raise HTTPException(status_code=400, detail="Cannot import more than 50 items at once")

    sources = (
        db.query(UserLevelContent)
        .filter(UserLevelContent.id.in_(payload.source_ids))
        .all()
    )
    found_ids = {s.id for s in sources}
    is_admin = current_user.role == UserRole.admin

    imported: list[UserLevelContent] = []
    skipped: list[dict] = []

    existing_max_pos = (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == ps.id,
            UserLevelContent.level == level,
        )
        .order_by(UserLevelContent.position.desc())
        .first()
    )
    next_pos = (existing_max_pos.position + 10) if existing_max_pos else 1000

    for sid in payload.source_ids:
        if sid not in found_ids:
            skipped.append({"id": sid, "reason": "not_found"})
            continue
        src = next(s for s in sources if s.id == sid)

        if src.skill_id != skill_id or src.level != level:
            skipped.append({"id": sid, "reason": "scope_mismatch"})
            continue

        if src.is_private and src.user_id != current_user.id and not is_admin:
            skipped.append({"id": sid, "reason": "private"})
            continue

        # Decision 6C: convert legacy_html sources to markdown on import so
        # the engineer's plan never propagates legacy content forward.
        src_format = src.description_format or "markdown"
        src_desc = src.description or ""
        if src_format == "legacy_html" and src_desc:
            try:
                cloned_desc = _html_to_md(src_desc, heading_style="ATX").strip()
            except Exception:
                logging.exception("library import: html->md conversion failed for src=%s", src.id)
                cloned_desc = src_desc  # fall back to raw HTML, keep format=legacy_html below
                cloned_format = "legacy_html"
            else:
                cloned_format = "markdown"
        else:
            cloned_desc = src_desc
            cloned_format = "markdown" if src_format != "legacy_html" else "legacy_html"

        clone = UserLevelContent(
            user_id=engineer_id,
            plan_skill_id=ps.id,
            skill_id=skill_id,
            level=level,
            type=src.type,
            title=src.title,
            description=cloned_desc,
            description_format=cloned_format,
            url=src.url,
            position=next_pos,
            completed=False,
            completed_at=None,
            is_private=False,
            source_user_content_id=src.id,
        )
        db.add(clone)
        imported.append(clone)
        next_pos += 10

    db.commit()
    for c in imported:
        db.refresh(c)

    return LibraryImportResponse(
        imported=[UserContentResponse.model_validate(c) for c in imported],
        skipped=skipped,
    )
