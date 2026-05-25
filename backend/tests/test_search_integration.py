"""
Integration tests for search endpoint.

Tests end-to-end search with grouped results, cursor pagination,
and FTS5 matching behavior.
"""

import pytest
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.org import Domain, Team
from app.models.skill import Skill, SkillLevelContentType
from app.models.plan import DevelopmentPlan, PlanSkill, PlanSkillStatus, UserLevelContent
from app.database import SessionLocal, Base, engine


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)



@pytest.fixture
def test_domain(db: Session):
    """Create test domain."""
    domain = Domain(
        name="Test Domain",
        is_technical=True
    )
    db.add(domain)
    db.commit()
    return domain


@pytest.fixture
def test_team(db: Session, test_domain):
    """Create test team."""
    team = Team(
        name="Test Team",
        domain_id=test_domain.id,
        shift=1
    )
    db.add(team)
    db.commit()
    return team


@pytest.fixture
def test_users(db: Session, test_team):
    """Create test users."""
    users = []
    for i in range(3):
        user = User(
            email=f"user{i}@test.com",
            hashed_password="hashed",
            role=UserRole.engineer,
            team_id=test_team.id
        )
        db.add(user)
        users.append(user)
    db.commit()
    return users


@pytest.fixture
def test_skill(db: Session, test_domain):
    """Create test skill."""
    skill = Skill(
        name="Test Skill",
        description="A test skill",
        domain_id=test_domain.id
    )
    db.add(skill)
    db.commit()
    return skill


@pytest.fixture
def test_plans(db: Session, test_users, test_skill):
    """Create development plans for test users."""
    plans = []
    for user in test_users:
        plan = DevelopmentPlan(engineer_id=user.id)
        db.add(plan)
        db.flush()
        
        plan_skill = PlanSkill(
            plan_id=plan.id,
            skill_id=test_skill.id,
            status=PlanSkillStatus.developing
        )
        db.add(plan_skill)
        plans.append(plan)
    
    db.commit()
    return plans


class TestSearchEndpointIntegration:
    """Integration tests for search endpoint."""
    
    def test_search_returns_grouped_results(
        self,
        db: Session,
        test_users,
        test_skill,
        test_plans
    ):
        """Test that search returns results grouped by proximity."""
        # Create user content for each user
        for i, user in enumerate(test_users):
            content = UserLevelContent(
                user_id=user.id,
                plan_skill_id=test_plans[i].skills[0].id,
                skill_id=test_skill.id,
                level=1,
                type=SkillLevelContentType.course,
                title=f"Course {i}",
                description=f"Description for course {i}"
            )
            db.add(content)
        
        db.commit()
        
        # TODO: Call search endpoint and verify grouping
        # This requires FastAPI test client setup
    
    def test_search_cursor_pagination(
        self,
        db: Session,
        test_users,
        test_skill,
        test_plans
    ):
        """Test cursor-based pagination."""
        # Create 50 user content items
        for i in range(50):
            content = UserLevelContent(
                user_id=test_users[0].id,
                plan_skill_id=test_plans[0].skills[0].id,
                skill_id=test_skill.id,
                level=1,
                type=SkillLevelContentType.course,
                title=f"Item {i:03d}",
                description=f"Description {i}"
            )
            db.add(content)
        
        db.commit()
        
        # TODO: Call search endpoint with limit=10
        # Verify has_more=True and next_cursor is set
        # Call again with next_cursor
        # Verify different results
    
    def test_search_fts5_fuzzy_matching(
        self,
        db: Session,
        test_users,
        test_skill,
        test_plans
    ):
        """Test FTS5 trigram fuzzy matching."""
        # Create content with specific titles
        titles = [
            "Kubernetes Deployment Strategies",
            "Kubernets Deployment Strategies",  # Typo: Kubernets
            "Kubernetes Deployment Stratgies",  # Typo: Stratgies
        ]
        
        for i, title in enumerate(titles):
            content = UserLevelContent(
                user_id=test_users[0].id,
                plan_skill_id=test_plans[0].skills[0].id,
                skill_id=test_skill.id,
                level=1,
                type=SkillLevelContentType.course,
                title=title,
                description="Test"
            )
            db.add(content)
        
        db.commit()
        
        # TODO: Search for "Kubernetes Deployment Strategies"
        # Verify all 3 results are returned (fuzzy matching)
        # Verify exact match ranks highest
    
    def test_search_soft_delete_excluded(
        self,
        db: Session,
        test_users,
        test_skill,
        test_plans
    ):
        """Test that soft-deleted content is excluded from search."""
        # Create content
        content = UserLevelContent(
            user_id=test_users[0].id,
            plan_skill_id=test_plans[0].skills[0].id,
            skill_id=test_skill.id,
            level=1,
            type=SkillLevelContentType.course,
            title="Test Content",
            description="Test"
        )
        db.add(content)
        db.commit()
        
        # Soft-delete it
        content.deleted_at = datetime.utcnow()
        db.commit()
        
        # TODO: Search for "Test Content"
        # Verify no results returned
    
    def test_search_level_filter(
        self,
        db: Session,
        test_users,
        test_skill,
        test_plans
    ):
        """Test that level filter works correctly."""
        # Create content at different levels
        for level in [1, 2, 3]:
            content = UserLevelContent(
                user_id=test_users[0].id,
                plan_skill_id=test_plans[0].skills[0].id,
                skill_id=test_skill.id,
                level=level,
                type=SkillLevelContentType.course,
                title=f"Level {level} Content",
                description="Test"
            )
            db.add(content)
        
        db.commit()
        
        # TODO: Search with level=1
        # Verify only level 1 content returned
        # TODO: Search with level=2
        # Verify only level 2 content returned


class TestSearchPerformance:
    """Performance tests for search functionality."""
    
    def test_search_with_large_dataset(self, db: Session):
        """Test search performance with 10k items."""
        # TODO: Create 10k user content items
        # TODO: Run search query
        # TODO: Verify query completes in < 100ms
        pass
    
    def test_cursor_pagination_stability(self, db: Session):
        """Test that cursor pagination is stable across insertions."""
        # TODO: Create initial dataset
        # TODO: Get first page with cursor
        # TODO: Insert new items
        # TODO: Get second page with cursor
        # TODO: Verify no duplicate results
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
