"""
Search endpoint for personal learning items with grouped pagination.

FTS5 trigram fuzzy matching + 3-tier proximity bucketing:
  1 = Same team (incl. requesting user's own items)
  2 = Same domain (different team)
  3 = Other (different domain)

See AGENTS.md §16 (Decision 5A/6A) for rationale on:
  - No `deleted_at` filter (hard delete + FTS DELETE trigger)
  - Domain resolved via team_id → teams.domain_id (User has no domain_id)
  - 3 tiers, not 4 (collapsed per user's grouping spec)
"""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.plan import PlanSkill
from app.models.skill import Skill
from app.search_utils import SearchCursor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plans", tags=["search"])

BUCKET_LABELS = {
    1: "From my team",
    2: "From my domain",
    3: "From other teams",
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


def _check_access(current_user: User, engineer_id: int, db: Session) -> None:
    if current_user.id == engineer_id:
        return
    if current_user.role == UserRole.admin:
        return
    engineer = db.query(User).filter(User.id == engineer_id).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")
    if current_user.role == UserRole.manager and engineer.manager_id == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Not authorized for this engineer")


@router.get("/{engineer_id}/skills/{skill_id}/content/search")
async def search_content(
    engineer_id: int,
    skill_id: int,
    q: str = Query(..., min_length=1, max_length=200),
    level: int = Query(..., ge=1, le=3),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user, engineer_id, db)

    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    engineer = db.query(User).filter(User.id == engineer_id).first()
    if not engineer or not engineer.development_plan:
        raise HTTPException(status_code=404, detail="Engineer plan not found")

    plan_skill = (
        db.query(PlanSkill)
        .filter(
            PlanSkill.plan_id == engineer.development_plan.id,
            PlanSkill.skill_id == skill_id,
        )
        .first()
    )
    if not plan_skill:
        raise HTTPException(status_code=404, detail="Skill not in engineer's plan")

    cursor_data = SearchCursor.decode(cursor) if cursor else None
    if cursor and not cursor_data:
        raise HTTPException(status_code=400, detail="Invalid cursor")

    req_team_id, req_domain_id = _resolve_team_and_domain(db, current_user.id)

    is_admin = current_user.role == UserRole.admin
    privacy_filter = (
        "AND (ulc.is_private = 0 OR ulc.user_id = :requesting_user_id)"
        if not is_admin
        else ""
    )

    fts_query = f"""
    SELECT
        ulc.id,
        ulc.title,
        ulc.description,
        ulc.description_format,
        ulc.url,
        ulc.created_at,
        ulc.user_id,
        ulc.is_private,
        CASE
            WHEN :req_team_id IS NOT NULL AND u_owner.team_id = :req_team_id THEN 1
            WHEN :req_domain_id IS NOT NULL AND t_owner.domain_id = :req_domain_id THEN 2
            ELSE 3
        END AS bucket,
        fts.rank AS bm25_score
    FROM user_content_fts fts
    JOIN user_level_content ulc ON fts.rowid = ulc.id
    JOIN users u_owner ON ulc.user_id = u_owner.id
    LEFT JOIN teams t_owner ON u_owner.team_id = t_owner.id
    WHERE
        ulc.skill_id = :skill_id
        AND ulc.level = :level
        {privacy_filter}
        AND fts.user_content_fts MATCH :search_query
    """

    if cursor_data:
        fts_query += """
        AND (
            (CASE
                WHEN :req_team_id IS NOT NULL AND u_owner.team_id = :req_team_id THEN 1
                WHEN :req_domain_id IS NOT NULL AND t_owner.domain_id = :req_domain_id THEN 2
                ELSE 3
            END) > :cursor_bucket
            OR (
                (CASE
                    WHEN :req_team_id IS NOT NULL AND u_owner.team_id = :req_team_id THEN 1
                    WHEN :req_domain_id IS NOT NULL AND t_owner.domain_id = :req_domain_id THEN 2
                    ELSE 3
                END) = :cursor_bucket
                AND (fts.rank > :cursor_score OR (fts.rank = :cursor_score AND ulc.id > :cursor_id))
            )
        )
        """

    fts_query += """
    ORDER BY bucket ASC, fts.rank ASC, ulc.id ASC
    LIMIT :limit_plus_one
    """

    params = {
        "requesting_user_id": current_user.id,
        "req_team_id": req_team_id,
        "req_domain_id": req_domain_id,
        "skill_id": skill_id,
        "level": level,
        "search_query": q,
        "limit_plus_one": limit + 1,
    }
    if cursor_data:
        params.update(
            {
                "cursor_bucket": cursor_data["bucket"],
                "cursor_score": cursor_data["score"],
                "cursor_id": cursor_data["id"],
            }
        )

    try:
        rows = db.execute(text(fts_query), params).fetchall()
    except Exception as e:
        logger.error(f"FTS5 search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

    has_more = len(rows) > limit
    rows = rows[:limit]

    results = []
    for r in rows:
        created = r[5]
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created)
            except ValueError:
                created = None
        results.append(
            {
                "id": r[0],
                "title": r[1],
                "description": r[2],
                "description_format": r[3] or "markdown",
                "url": r[4],
                "created_at": created.isoformat() if isinstance(created, datetime) else None,
                "user_id": r[6],
                "is_private": bool(r[7]),
                "bucket": r[8],
                "bucket_label": BUCKET_LABELS.get(r[8], "Other"),
                "score": float(r[9]) if r[9] is not None else 0.0,
                "is_user_content": True,
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

    count_query = f"""
    SELECT COUNT(*)
    FROM user_content_fts fts
    JOIN user_level_content ulc ON fts.rowid = ulc.id
    WHERE
        ulc.skill_id = :skill_id
        AND ulc.level = :level
        {privacy_filter}
        AND fts.user_content_fts MATCH :search_query
    """
    total_count = db.execute(
        text(count_query),
        {
            "skill_id": skill_id,
            "level": level,
            "search_query": q,
            "requesting_user_id": current_user.id,
        },
    ).scalar()

    return {
        "results": results,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total_count": total_count,
        "query": q,
        "level": level,
    }
