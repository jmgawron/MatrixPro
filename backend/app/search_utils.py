"""
Search utilities for grouped pagination with cursor-based navigation.

Provides cursor encoding/decoding and proximity bucketing logic for
the user_level_content search endpoint.
"""

import base64
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class SearchCursor:
    """
    Encodes/decodes cursor state for grouped pagination.
    
    Cursor format: base64-encoded JSON
    {
        "bucket": 1-4,           # Proximity bucket (1=engineer, 2=team, 3=domain, 4=global)
        "score": 42.5,           # BM25 score from FTS5
        "id": 12345              # Content ID for stable ordering
    }
    """
    
    @staticmethod
    def encode(bucket: int, score: float, content_id: int) -> str:
        """Encode cursor state to base64 string."""
        cursor_data = {
            "bucket": bucket,
            "score": score,
            "id": content_id
        }
        json_str = json.dumps(cursor_data, separators=(',', ':'))
        return base64.b64encode(json_str.encode()).decode()
    
    @staticmethod
    def decode(cursor: str) -> Optional[Dict[str, Any]]:
        """Decode cursor from base64 string. Returns None if invalid."""
        try:
            json_str = base64.b64decode(cursor.encode()).decode()
            data = json.loads(json_str)
            
            # Validate required fields
            if not all(k in data for k in ["bucket", "score", "id"]):
                logger.warning(f"Invalid cursor structure: {data}")
                return None
            
            return data
        except (ValueError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to decode cursor: {e}")
            return None


class ProximityBucketer:
    """
    Assigns proximity buckets based on org hierarchy.
    
    Buckets:
        1 = Same engineer (user_id match)
        2 = Same team (team_id match)
        3 = Same domain (domain_id match)
        4 = Global (no match)
    """
    
    @staticmethod
    def get_bucket(
        content_user_id: int,
        content_team_id: int,
        content_domain_id: int,
        requesting_user_id: int,
        requesting_team_id: int,
        requesting_domain_id: int
    ) -> int:
        """
        Determine proximity bucket for a content item.
        
        Args:
            content_user_id: User ID of content creator
            content_team_id: Team ID of content creator
            content_domain_id: Domain ID of content creator
            requesting_user_id: User ID making the request
            requesting_team_id: Team ID of requesting user
            requesting_domain_id: Domain ID of requesting user
        
        Returns:
            Bucket number (1-4)
        """
        if content_user_id == requesting_user_id:
            return 1
        elif content_team_id == requesting_team_id:
            return 2
        elif content_domain_id == requesting_domain_id:
            return 3
        else:
            return 4


class BM25Ranker:
    """
    Applies BM25 ranking with proximity boost.
    
    Formula:
        final_score = bm25_score + proximity_boost
    
    Proximity boost values:
        - Same engineer: +100
        - Same team: +50
        - Same domain: +25
        - Global: +0
    """
    
    PROXIMITY_BOOST = {
        1: 100,  # Same engineer
        2: 50,   # Same team
        3: 25,   # Same domain
        4: 0     # Global
    }
    
    @staticmethod
    def apply_boost(bm25_score: float, bucket: int) -> float:
        """
        Apply proximity boost to BM25 score.
        
        Args:
            bm25_score: Raw BM25 score from FTS5
            bucket: Proximity bucket (1-4)
        
        Returns:
            Boosted score
        """
        boost = BM25Ranker.PROXIMITY_BOOST.get(bucket, 0)
        return bm25_score + boost


# Example usage in FastAPI endpoint:
#
# @router.get("/api/plans/{engineer_id}/skills/{skill_id}/content/search")
# async def search_content(
#     engineer_id: int,
#     skill_id: int,
#     q: str,
#     level: int,
#     cursor: Optional[str] = None,
#     limit: int = 20,
#     db: Session = Depends(get_db),
#     current_user: User = Depends(get_current_user)
# ):
#     """
#     Search personal learning items with grouped pagination.
#     
#     Query parameters:
#         q: Free-text search query (fuzzy via FTS5 trigram)
#         level: 3E level (1=Education, 2=Exposure, 3=Experience)
#         cursor: Pagination cursor (base64-encoded JSON)
#         limit: Results per page (default 20, max 100)
#     
#     Response:
#         {
#             "results": [
#                 {
#                     "id": 123,
#                     "title": "...",
#                     "description": "...",
#                     "bucket": 1,
#                     "bucket_label": "Your items",
#                     "score": 42.5
#                 }
#             ],
#             "next_cursor": "eyJidWNrZXQiOjEsInNjb3JlIjo0Mi41LCJpZCI6MTIzfQ==",
#             "has_more": true,
#             "total_count": 156
#         }
#     """
#     
#     # Decode cursor if provided
#     cursor_data = None
#     if cursor:
#         cursor_data = SearchCursor.decode(cursor)
#     
#     # Build FTS5 query with proximity bucketing
#     # (See search_architecture.md for full SQL)
#     
#     # Apply cursor-based pagination
#     # ORDER BY bucket ASC, bm25_score DESC, id ASC
#     # LIMIT limit + 1 (to detect has_more)
#     
#     # Encode next cursor from last result
#     # Return results with bucket labels
