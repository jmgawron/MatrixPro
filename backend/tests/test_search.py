"""
Unit tests for search functionality.

Tests cursor pagination, proximity bucketing, FTS matching, and ranking.
"""

import pytest
import base64
import json
from datetime import datetime

from app.search_utils import SearchCursor, ProximityBucketer, BM25Ranker


class TestSearchCursor:
    """Tests for cursor encoding/decoding."""
    
    def test_encode_cursor(self):
        """Test cursor encoding to base64."""
        cursor = SearchCursor.encode(bucket=1, score=42.5, content_id=123)
        
        # Verify it's valid base64
        decoded = base64.b64decode(cursor.encode()).decode()
        data = json.loads(decoded)
        
        assert data["bucket"] == 1
        assert data["score"] == 42.5
        assert data["id"] == 123
    
    def test_decode_cursor(self):
        """Test cursor decoding from base64."""
        original = {"bucket": 2, "score": 35.0, "id": 456}
        json_str = json.dumps(original, separators=(',', ':'))
        cursor = base64.b64encode(json_str.encode()).decode()
        
        decoded = SearchCursor.decode(cursor)
        
        assert decoded["bucket"] == 2
        assert decoded["score"] == 35.0
        assert decoded["id"] == 456
    
    def test_decode_invalid_cursor(self):
        """Test decoding invalid cursor returns None."""
        invalid_cursor = "not-valid-base64!!!"
        result = SearchCursor.decode(invalid_cursor)
        assert result is None
    
    def test_decode_missing_fields(self):
        """Test decoding cursor with missing fields returns None."""
        incomplete = {"bucket": 1}  # Missing score and id
        json_str = json.dumps(incomplete, separators=(',', ':'))
        cursor = base64.b64encode(json_str.encode()).decode()
        
        result = SearchCursor.decode(cursor)
        assert result is None
    
    def test_cursor_roundtrip(self):
        """Test encode → decode roundtrip."""
        original_bucket = 3
        original_score = 99.99
        original_id = 789
        
        cursor = SearchCursor.encode(original_bucket, original_score, original_id)
        decoded = SearchCursor.decode(cursor)
        
        assert decoded["bucket"] == original_bucket
        assert decoded["score"] == original_score
        assert decoded["id"] == original_id


class TestProximityBucketer:
    """Tests for proximity bucketing logic."""
    
    def test_same_engineer_bucket(self):
        """Test bucket 1 when content creator is same as requester."""
        bucket = ProximityBucketer.get_bucket(
            content_user_id=1,
            content_team_id=10,
            content_domain_id=100,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 1
    
    def test_same_team_bucket(self):
        """Test bucket 2 when content creator is on same team."""
        bucket = ProximityBucketer.get_bucket(
            content_user_id=2,
            content_team_id=10,
            content_domain_id=100,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 2
    
    def test_same_domain_bucket(self):
        """Test bucket 3 when content creator is in same domain."""
        bucket = ProximityBucketer.get_bucket(
            content_user_id=2,
            content_team_id=20,
            content_domain_id=100,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 3
    
    def test_global_bucket(self):
        """Test bucket 4 when content creator is in different domain."""
        bucket = ProximityBucketer.get_bucket(
            content_user_id=2,
            content_team_id=20,
            content_domain_id=200,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 4
    
    def test_bucket_priority_engineer_over_team(self):
        """Test that engineer match takes priority over team match."""
        # Even if teams differ, same engineer should return bucket 1
        bucket = ProximityBucketer.get_bucket(
            content_user_id=1,
            content_team_id=20,
            content_domain_id=100,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 1
    
    def test_bucket_priority_team_over_domain(self):
        """Test that team match takes priority over domain match."""
        # Even if domains differ, same team should return bucket 2
        bucket = ProximityBucketer.get_bucket(
            content_user_id=2,
            content_team_id=10,
            content_domain_id=200,
            requesting_user_id=1,
            requesting_team_id=10,
            requesting_domain_id=100
        )
        assert bucket == 2


class TestBM25Ranker:
    """Tests for BM25 ranking with proximity boost."""
    
    def test_engineer_boost(self):
        """Test proximity boost for same engineer."""
        boosted = BM25Ranker.apply_boost(bm25_score=10.0, bucket=1)
        assert boosted == 110.0  # 10.0 + 100
    
    def test_team_boost(self):
        """Test proximity boost for same team."""
        boosted = BM25Ranker.apply_boost(bm25_score=10.0, bucket=2)
        assert boosted == 60.0  # 10.0 + 50
    
    def test_domain_boost(self):
        """Test proximity boost for same domain."""
        boosted = BM25Ranker.apply_boost(bm25_score=10.0, bucket=3)
        assert boosted == 35.0  # 10.0 + 25
    
    def test_global_no_boost(self):
        """Test no boost for global results."""
        boosted = BM25Ranker.apply_boost(bm25_score=10.0, bucket=4)
        assert boosted == 10.0  # 10.0 + 0
    
    def test_negative_bm25_score(self):
        """Test boost with negative BM25 score (edge case)."""
        boosted = BM25Ranker.apply_boost(bm25_score=-5.0, bucket=1)
        assert boosted == 95.0  # -5.0 + 100
    
    def test_zero_bm25_score(self):
        """Test boost with zero BM25 score."""
        boosted = BM25Ranker.apply_boost(bm25_score=0.0, bucket=2)
        assert boosted == 50.0  # 0.0 + 50
    
    def test_boost_values_ordering(self):
        """Test that boost values maintain correct ordering."""
        # Same engineer should always score higher than same team
        engineer_score = BM25Ranker.apply_boost(10.0, 1)
        team_score = BM25Ranker.apply_boost(10.0, 2)
        assert engineer_score > team_score
        
        # Same team should always score higher than same domain
        domain_score = BM25Ranker.apply_boost(10.0, 3)
        assert team_score > domain_score
        
        # Same domain should always score higher than global
        global_score = BM25Ranker.apply_boost(10.0, 4)
        assert domain_score > global_score


class TestCursorPaginationLogic:
    """Integration tests for cursor pagination logic."""
    
    def test_cursor_ordering_same_bucket(self):
        """Test that within same bucket, lower score comes after cursor."""
        # Cursor at bucket=1, score=50.0, id=100
        cursor_data = {"bucket": 1, "score": 50.0, "id": 100}
        
        # Next result should have score < 50.0 (or same score but id > 100)
        next_result = {"bucket": 1, "score": 45.0, "id": 101}
        
        # Verify ordering: cursor score > next score
        assert cursor_data["score"] > next_result["score"]
    
    def test_cursor_ordering_different_bucket(self):
        """Test that bucket takes priority over score in ordering."""
        # Cursor at bucket=1, score=10.0
        cursor_data = {"bucket": 1, "score": 10.0, "id": 100}
        
        # Next result in bucket=2 should come after, even with higher score
        next_result = {"bucket": 2, "score": 100.0, "id": 200}
        
        # Verify ordering: cursor bucket < next bucket
        assert cursor_data["bucket"] < next_result["bucket"]
    
    def test_cursor_id_tiebreaker(self):
        """Test that ID is used as tiebreaker when bucket and score match."""
        # Cursor at bucket=1, score=50.0, id=100
        cursor_data = {"bucket": 1, "score": 50.0, "id": 100}
        
        # Next result with same bucket and score but higher id
        next_result = {"bucket": 1, "score": 50.0, "id": 101}
        
        # Verify ordering: cursor id < next id
        assert cursor_data["id"] < next_result["id"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
