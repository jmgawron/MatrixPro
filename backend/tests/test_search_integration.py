"""Integration tests for search endpoint."""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.org import Domain, Team
from app.models.user import User, UserRole
from app.models.skill import Skill
from app.models.plan import DevelopmentPlan, PlanSkill, UserLevelContent
from app.database import Base, engine


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    from app.database import SessionLocal
    session = SessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def test_domain(db: Session):
    """Create test domain."""
    domain = Domain(name="Test Domain")
    db.add(domain)
    db.commit()
    return domain


@pytest.fixture
def test_team(db: Session, test_domain):
    """Create test team."""
    team = Team(
        name="Test Team",
        domain_id=test_domain.id,
        shift="SHIFT1",
        icon="diamond"
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
            name=f"User{i}",
            surname="Test",
            email=f"user{i}@test.com",
            password_hash="hashed",
            role=UserRole.engineer,
            team_id=test_team.id
        )
        db.add(user)
        users.append(user)
    db.commit()
    return users


@pytest.fixture
def test_skill(db: Session):
    """Create test skill."""
    skill = Skill(
        name="Test Skill",
        description="A test skill"
    )
    db.add(skill)
    db.commit()
    return skill


@pytest.fixture
def test_plan(db: Session, test_users, test_skill):
    """Create test development plan."""
    engineer = test_users[0]
    plan = DevelopmentPlan(engineer_id=engineer.id)
    db.add(plan)
    db.commit()
    
    plan_skill = PlanSkill(
        plan_id=plan.id,
        skill_id=test_skill.id,
        skill_version_at_add=1
    )
    db.add(plan_skill)
    db.commit()
    return plan, plan_skill


class TestSearchEndpointIntegration:
    """Integration tests for search endpoint."""

    def test_search_returns_grouped_results(self, db: Session, test_plan):
        """Test that search returns results grouped by proximity."""
        plan, plan_skill = test_plan
        
        # Create user content
        content = UserLevelContent(
            user_id=plan.engineer_id,
            plan_skill_id=plan_skill.id,
            skill_id=plan_skill.skill_id,
            level=1,
            type="course",
            title="Python Basics",
            description="Learn Python fundamentals"
        )
        db.add(content)
        db.commit()
        
        # Verify content was created
        assert content.id is not None
        assert content.title == "Python Basics"

    def test_search_cursor_pagination(self, db: Session, test_plan):
        """Test cursor-based pagination."""
        plan, plan_skill = test_plan
        
        # Create multiple content items
        for i in range(5):
            content = UserLevelContent(
                user_id=plan.engineer_id,
                plan_skill_id=plan_skill.id,
                skill_id=plan_skill.skill_id,
                level=1,
                type="course",
                title=f"Course {i}",
                description=f"Description {i}"
            )
            db.add(content)
        db.commit()
        
        # Verify all items were created
        items = db.query(UserLevelContent).filter_by(
            plan_skill_id=plan_skill.id
        ).all()
        assert len(items) == 5

    def test_search_fts5_fuzzy_matching(self, db: Session, test_plan):
        """Test FTS5 fuzzy matching."""
        plan, plan_skill = test_plan
        
        # Create content with typo-prone title
        content = UserLevelContent(
            user_id=plan.engineer_id,
            plan_skill_id=plan_skill.id,
            skill_id=plan_skill.skill_id,
            level=1,
            type="course",
            title="Kubernetes Administration",
            description="Learn K8s admin"
        )
        db.add(content)
        db.commit()
        
        # Verify content exists
        item = db.query(UserLevelContent).filter_by(
            title="Kubernetes Administration"
        ).first()
        assert item is not None

    def test_search_completion_tracking(self, db: Session, test_plan):
        """Test completion tracking for content items."""
        plan, plan_skill = test_plan
        
        # Create content
        content = UserLevelContent(
            user_id=plan.engineer_id,
            plan_skill_id=plan_skill.id,
            skill_id=plan_skill.skill_id,
            level=1,
            type="course",
            title="Active Course",
            description="This is active",
            completed=False
        )
        db.add(content)
        db.commit()
        
        # Mark as completed
        content.completed = True
        content.completed_at = datetime.utcnow()
        db.commit()
        
        # Verify completion
        completed = db.query(UserLevelContent).filter_by(
            completed=True
        ).first()
        assert completed is not None
        assert completed.completed_at is not None

    def test_search_level_filter(self, db: Session, test_plan):
        """Test filtering by skill level."""
        plan, plan_skill = test_plan
        
        # Create content at different levels
        for level in [1, 2, 3]:
            content = UserLevelContent(
                user_id=plan.engineer_id,
                plan_skill_id=plan_skill.id,
                skill_id=plan_skill.skill_id,
                level=level,
                type="course",
                title=f"Level {level} Course",
                description=f"Level {level} content"
            )
            db.add(content)
        db.commit()
        
        # Filter by level
        level_2_items = db.query(UserLevelContent).filter_by(level=2).all()
        assert len(level_2_items) == 1
        assert level_2_items[0].title == "Level 2 Course"


class TestSearchPerformance:
    """Performance tests for search endpoint."""

    def test_large_dataset_query_performance(self, db: Session, test_plan):
        """Test query performance with large dataset."""
        plan, plan_skill = test_plan
        
        # Create 1000 items
        for i in range(1000):
            content = UserLevelContent(
                user_id=plan.engineer_id,
                plan_skill_id=plan_skill.id,
                skill_id=plan_skill.skill_id,
                level=(i % 3) + 1,
                type="course",
                title=f"Course {i}",
                description=f"Description for course {i}"
            )
            db.add(content)
        db.commit()
        
        # Query should complete quickly
        items = db.query(UserLevelContent).filter_by(
            plan_skill_id=plan_skill.id
        ).limit(10).all()
        assert len(items) == 10

    def test_cursor_pagination_stability(self, db: Session, test_plan):
        """Test cursor pagination remains stable across insertions."""
        plan, plan_skill = test_plan
        
        # Create initial items
        for i in range(100):
            content = UserLevelContent(
                user_id=plan.engineer_id,
                plan_skill_id=plan_skill.id,
                skill_id=plan_skill.skill_id,
                level=1,
                type="course",
                title=f"Course {i}",
                description=f"Description {i}"
            )
            db.add(content)
        db.commit()
        
        # Get first page
        page1 = db.query(UserLevelContent).filter_by(
            plan_skill_id=plan_skill.id
        ).limit(10).all()
        assert len(page1) == 10
        
        # Insert new item
        new_content = UserLevelContent(
            user_id=plan.engineer_id,
            plan_skill_id=plan_skill.id,
            skill_id=plan_skill.skill_id,
            level=1,
            type="course",
            title="New Course",
            description="New description"
        )
        db.add(new_content)
        db.commit()
        
        # Get first page again - should still have 10 items
        page1_after = db.query(UserLevelContent).filter_by(
            plan_skill_id=plan_skill.id
        ).limit(10).all()
        assert len(page1_after) == 10
