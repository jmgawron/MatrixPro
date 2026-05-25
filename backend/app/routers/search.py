"""
Search endpoint for personal learning items with grouped pagination.

Provides full-text search over user_level_content with:
- FTS5 trigram tokenizer for fuzzy matching
- Proximity-based grouping (engineer → team → domain → global)
- Cursor-based pagination for infinite scroll
- BM25 ranking with proximity boost
"""

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_manager_of
from app.models.user import User
from app.models.plan import UserLevelContent, PlanSkill
from app.models.skill import Skill
from app.models.org import Team
from app.search_utils import SearchCursor, ProximityBucketer, BM25Ranker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plans", tags=["search"])

# Bucket labels for UI
BUCKET_LABELS = {
    1: "Your items",
    2: "Team items",
    3: "Domain items",
    4: "Global items"
}


class SearchResult:
    """Represents a single search result with proximity metadata."""
    
    def __init__(
        self,
        id: int,
        title: str,
        description: Optional[str],
        url: Optional[str],
        bucket: int,
        score: float,
        created_at: datetime,
        user_id: int,
        is_user_content: bool = True
    ):
        self.id = id
        self.title = title
        self.description = description
        self.url = url
        self.bucket = bucket
        self.bucket_label = BUCKET_LABELS.get(bucket, "Unknown")
        self.score = score
        self.created_at = created_at
        self.user_id = user_id
        self.is_user_content = is_user_content
    
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "url": self.url,
            "bucket": self.bucket,
            "bucket_label": self.bucket_label,
            "score": round(self.score, 2),
            "created_at": self.created_at.isoformat(),
            "user_id": self.user_id,
            "is_user_content": self.is_user_content
        }


@router.get("/{engineer_id}/skills/{skill_id}/content/search")
async def search_content(
    engineer_id: int,
    skill_id: int,
    q: str = Query(..., min_length=1, max_length=200),
    level: int = Query(..., ge=1, le=3),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search personal learning items with grouped pagination.
    
    Supports:
    - Fuzzy text search via FTS5 trigram tokenizer
    - Proximity-based grouping (same engineer → team → domain → global)
    - Cursor-based pagination for infinite scroll
    - BM25 ranking with proximity boost
    
    Query parameters:
        q: Free-text search query (required, 1-200 chars)
        level: 3E level (1=Education, 2=Exposure, 3=Experience)
        cursor: Pagination cursor (base64-encoded JSON)
        limit: Results per page (default 20, max 100)
    
    Response:
        {
            "results": [
                {
                    "id": 123,
                    "title": "...",
                    "description": "...",
                    "bucket": 1,
                    "bucket_label": "Your items",
                    "score": 42.5,
                    "created_at": "2026-05-25T10:30:00",
                    "user_id": 5,
                    "is_user_content": true
                }
            ],
            "next_cursor": "eyJidWNrZXQiOjEsInNjb3JlIjo0Mi41LCJpZCI6MTIzfQ==",
            "has_more": true,
            "total_count": 156
        }
    """
    
    # Verify access: current user must be the engineer or a manager/admin
    if current_user.id != engineer_id:
        require_manager_of(engineer_id, current_user, db)
    
    # Get requesting user's org context for proximity bucketing
    requesting_user = db.query(User).filter(User.id == current_user.id).first()
    if not requesting_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get target engineer's org context
    target_engineer = db.query(User).filter(User.id == engineer_id).first()
    if not target_engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")
    
    # Verify skill exists and engineer has it in their plan
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    plan_skill = db.query(PlanSkill).filter(
        PlanSkill.plan_id == target_engineer.development_plan.id,
        PlanSkill.skill_id == skill_id
    ).first()
    if not plan_skill:
        raise HTTPException(status_code=404, detail="Skill not in engineer's plan")
    
    # Decode cursor if provided
    cursor_data = None
    if cursor:
        cursor_data = SearchCursor.decode(cursor)
        if not cursor_data:
            raise HTTPException(status_code=400, detail="Invalid cursor")
    
    # Build FTS5 search query with proximity bucketing
    # This query:
    # 1. Joins user_content_fts (FTS5 virtual table) with user_level_content
    # 2. Filters by skill_id, level, and soft-delete status
    # 3. Calculates proximity bucket based on org hierarchy
    # 4. Applies BM25 ranking with proximity boost
    # 5. Implements cursor-based pagination
    
    fts_query = f"""
    SELECT
        ulc.id,
        ulc.title,
        ulc.description,
        ulc.url,
        ulc.created_at,
        ulc.user_id,
        CASE
            WHEN ulc.user_id = :requesting_user_id THEN 1
            WHEN u_target.team_id = u_requesting.team_id THEN 2
            WHEN u_target.domain_id = u_requesting.domain_id THEN 3
            ELSE 4
        END AS bucket,
        fts.rank AS bm25_score
    FROM user_content_fts fts
    JOIN user_level_content ulc ON fts.rowid = ulc.id
    JOIN users u_target ON ulc.user_id = u_target.id
    JOIN users u_requesting ON u_requesting.id = :requesting_user_id
    WHERE
        ulc.skill_id = :skill_id
        AND ulc.level = :level
        AND ulc.deleted_at IS NULL
        AND fts.user_content_fts MATCH :search_query
    """
    
    # Add cursor-based pagination filter if provided
    if cursor_data:
        fts_query += f"""
        AND (
            bucket > :cursor_bucket
            OR (bucket = :cursor_bucket AND bm25_score < :cursor_score)
            OR (bucket = :cursor_bucket AND bm25_score = :cursor_score AND ulc.id > :cursor_id)
        )
        """
    
    fts_query += """
    ORDER BY bucket ASC, bm25_score DESC, ulc.id ASC
    LIMIT :limit_plus_one
    """
    
    # Prepare query parameters
    params = {
        "requesting_user_id": current_user.id,
        "skill_id": skill_id,
        "level": level,
        "search_query": q,  # FTS5 will handle fuzzy matching via trigram tokenizer
        "limit_plus_one": limit + 1
    }
    
    if cursor_data:
        params.update({
            "cursor_bucket": cursor_data["bucket"],
            "cursor_score": cursor_data["score"],
            "cursor_id": cursor_data["id"]
        })
    
    # Execute FTS5 query
    try:
        results = db.execute(text(fts_query), params).fetchall()
    except Exception as e:
        logger.error(f"FTS5 search failed: {e}")
        raise HTTPException(status_code=500, detail="Search failed")
    
    # Parse results
    search_results = []
    has_more = False
    
    for row in results:
        if len(search_results) >= limit:
            has_more = True
            break
        
        result = SearchResult(
            id=row[0],
            title=row[1],
            description=row[2],
            url=row[3],
            created_at=row[4],
            user_id=row[5],
            bucket=row[6],
            score=row[7],
            is_user_content=True
        )
        search_results.append(result)
    
    # Generate next cursor from last result
    next_cursor = None
    if has_more and search_results:
        last_result = search_results[-1]
        next_cursor = SearchCursor.encode(
            bucket=last_result.bucket,
            score=last_result.score,
            content_id=last_result.id
        )
    
    # Get total count (for UI pagination info)
    count_query = """
    SELECT COUNT(*)
    FROM user_content_fts fts
    JOIN user_level_content ulc ON fts.rowid = ulc.id
    WHERE
        ulc.skill_id = :skill_id
        AND ulc.level = :level
        AND ulc.deleted_at IS NULL
        AND fts.user_content_fts MATCH :search_query
    """
    
    total_count = db.execute(
        text(count_query),
        {
            "skill_id": skill_id,
            "level": level,
            "search_query": q
        }
    ).scalar()
    
    return {
        "results": [r.to_dict() for r in search_results],
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total_count": total_count,
        "query": q,
        "level": level
    }


@router.post("/{engineer_id}/skills/{skill_id}/content/search/sync")
async def sync_fts_index(
    engineer_id: int,
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger FTS5 index sync for a skill.
    
    This endpoint is useful for:
    - Debugging search issues
    - Forcing index rebuild after bulk operations
    - Testing FTS5 consistency
    
    Requires admin or manager role.
    """
    
    # Verify access
    if current_user.role.value not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Rebuild FTS5 index for this skill
        rebuild_query = """
        DELETE FROM user_content_fts
        WHERE rowid IN (
            SELECT id FROM user_level_content
            WHERE skill_id = :skill_id AND deleted_at IS NULL
        );
        
        INSERT INTO user_content_fts(rowid, title, description)
        SELECT id, title, description
        FROM user_level_content
        WHERE skill_id = :skill_id AND deleted_at IS NULL;
        """
        
        db.execute(text(rebuild_query), {"skill_id": skill_id})
        db.commit()
        
        logger.info(f"FTS5 index synced for skill {skill_id}")
        
        return {
            "status": "success",
            "message": f"FTS5 index synced for skill {skill_id}"
        }
    except Exception as e:
        logger.error(f"FTS5 sync failed: {e}")
        raise HTTPException(status_code=500, detail="Sync failed")
