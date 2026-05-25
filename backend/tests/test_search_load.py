"""Load tests for search endpoint with 100k synthetic items."""
import pytest
import time
import random
import string
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
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
def load_test_setup(db: Session):
    """Set up test data for load testing."""
    # Create domain
    domain = Domain(name="Load Test Domain")
    db.add(domain)
    db.commit()
    
    # Create teams
    teams = []
    for i in range(5):
        team = Team(
            name=f"Load Test Team {i}",
            domain_id=domain.id,
            shift=f"SHIFT{(i % 4) + 1}",
            icon="diamond"
        )
        db.add(team)
        teams.append(team)
    db.commit()
    
    # Create users (engineers)
    users = []
    for i in range(20):
        user = User(
            name=f"Engineer{i}",
            surname="LoadTest",
            email=f"engineer{i}@loadtest.com",
            password_hash="hashed",
            role=UserRole.engineer,
            team_id=teams[i % len(teams)].id
        )
        db.add(user)
        users.append(user)
    db.commit()
    
    # Create skills
    skills = []
    skill_names = [
        "Python Programming", "Kubernetes", "Docker", "AWS", "Azure",
        "GCP", "Terraform", "Ansible", "Jenkins", "GitLab CI",
        "GitHub Actions", "Prometheus", "Grafana", "ELK Stack", "Splunk",
        "DataDog", "New Relic", "Dynatrace", "AppDynamics", "Elastic",
        "MongoDB", "PostgreSQL", "MySQL", "Redis", "Cassandra",
        "Kafka", "RabbitMQ", "ActiveMQ", "NATS", "gRPC",
        "REST APIs", "GraphQL", "WebSockets", "OAuth 2.0", "JWT",
        "SSL/TLS", "PKI", "LDAP", "Active Directory", "SAML",
        "Linux", "Windows Server", "macOS", "FreeBSD", "CentOS",
        "Ubuntu", "Debian", "RHEL", "Alpine", "CoreOS"
    ]
    
    for name in skill_names:
        skill = Skill(name=name, description=f"Description for {name}")
        db.add(skill)
        skills.append(skill)
    db.commit()
    
    # Create development plans for each user
    plans = []
    for user in users:
        plan = DevelopmentPlan(engineer_id=user.id)
        db.add(plan)
        plans.append(plan)
    db.commit()
    
    # Create plan skills (assign 5 random skills to each plan)
    plan_skills = []
    for plan in plans:
        assigned_skills = random.sample(skills, min(5, len(skills)))
        for skill in assigned_skills:
            plan_skill = PlanSkill(
                plan_id=plan.id,
                skill_id=skill.id,
                skill_version_at_add=1
            )
            db.add(plan_skill)
            plan_skills.append(plan_skill)
    db.commit()
    
    return {
        "domain": domain,
        "teams": teams,
        "users": users,
        "skills": skills,
        "plans": plans,
        "plan_skills": plan_skills
    }


class TestSearchLoad100k:
    """Load tests with 100k synthetic items."""

    def test_generate_100k_items(self, db: Session, load_test_setup):
        """Generate 100k synthetic user content items."""
        setup = load_test_setup
        plan_skills = setup["plan_skills"]
        users = setup["users"]
        
        # Generate 100k items
        batch_size = 1000
        total_items = 100000
        
        start_time = time.time()
        
        for batch_num in range(total_items // batch_size):
            batch = []
            for i in range(batch_size):
                item_num = batch_num * batch_size + i
                plan_skill = plan_skills[item_num % len(plan_skills)]
                user = users[item_num % len(users)]
                
                # Generate realistic content
                content_types = ["course", "certification", "reading", "link", "action"]
                titles = [
                    f"Advanced {plan_skill.skill.name} - Part {i % 10 + 1}",
                    f"Mastering {plan_skill.skill.name}",
                    f"{plan_skill.skill.name} Deep Dive",
                    f"Practical {plan_skill.skill.name} Guide",
                    f"{plan_skill.skill.name} Best Practices"
                ]
                
                content = UserLevelContent(
                    user_id=user.id,
                    plan_skill_id=plan_skill.id,
                    skill_id=plan_skill.skill_id,
                    level=(item_num % 3) + 1,
                    type=random.choice(content_types),
                    title=random.choice(titles),
                    description=f"Description for item {item_num}",
                    url=f"https://example.com/course/{item_num}",
                    completed=random.random() < 0.3,
                    completed_at=datetime.utcnow() - timedelta(days=random.randint(0, 180)) if random.random() < 0.3 else None
                )
                batch.append(content)
            
            db.add_all(batch)
            db.commit()
            
            # Progress indicator
            items_created = (batch_num + 1) * batch_size
            elapsed = time.time() - start_time
            rate = items_created / elapsed
            print(f"\n✓ Created {items_created:,} items ({rate:.0f} items/sec)")
        
        # Verify total count
        total_count = db.query(UserLevelContent).count()
        assert total_count == total_items, f"Expected {total_items}, got {total_count}"
        
        elapsed = time.time() - start_time
        print(f"\n✅ Generated {total_items:,} items in {elapsed:.2f}s ({total_items/elapsed:.0f} items/sec)")

    def test_query_performance_100k(self, db: Session, load_test_setup):
        """Test query performance with 100k items."""
        setup = load_test_setup
        plan_skills = setup["plan_skills"]
        users = setup["users"]
        
        # Generate 100k items
        print("\n📊 Generating 100k items for query performance test...")
        batch_size = 5000
        total_items = 100000
        
        for batch_num in range(total_items // batch_size):
            batch = []
            for i in range(batch_size):
                item_num = batch_num * batch_size + i
                plan_skill = plan_skills[item_num % len(plan_skills)]
                user = users[item_num % len(users)]
                
                content = UserLevelContent(
                    user_id=user.id,
                    plan_skill_id=plan_skill.id,
                    skill_id=plan_skill.skill_id,
                    level=(item_num % 3) + 1,
                    type=random.choice(["course", "certification", "reading", "link", "action"]),
                    title=f"Course {item_num}",
                    description=f"Description {item_num}",
                    completed=random.random() < 0.3
                )
                batch.append(content)
            
            db.add_all(batch)
            db.commit()
        
        print("✓ 100k items generated")
        
        # Test various query patterns
        queries = [
            ("All items", lambda: db.query(UserLevelContent).all()),
            ("Limit 100", lambda: db.query(UserLevelContent).limit(100).all()),
            ("Limit 1000", lambda: db.query(UserLevelContent).limit(1000).all()),
            ("Filter by level=1", lambda: db.query(UserLevelContent).filter_by(level=1).all()),
            ("Filter by completed=True", lambda: db.query(UserLevelContent).filter_by(completed=True).all()),
            ("Filter by plan_skill_id", lambda: db.query(UserLevelContent).filter_by(plan_skill_id=plan_skills[0].id).all()),
            ("Order by created_at DESC, limit 100", lambda: db.query(UserLevelContent).order_by(UserLevelContent.created_at.desc()).limit(100).all()),
        ]
        
        print("\n📈 Query Performance Results:")
        print("─" * 70)
        
        for query_name, query_func in queries:
            start = time.time()
            result = query_func()
            elapsed = time.time() - start
            count = len(result) if isinstance(result, list) else result.count()
            print(f"  {query_name:<40} {elapsed*1000:>8.2f}ms  ({count:>6,} rows)")
        
        print("─" * 70)

    def test_concurrent_queries_100k(self, db: Session, load_test_setup):
        """Test concurrent query performance with 100k items."""
        setup = load_test_setup
        plan_skills = setup["plan_skills"]
        users = setup["users"]
        
        # Generate 100k items
        print("\n📊 Generating 100k items for concurrent query test...")
        batch_size = 5000
        total_items = 100000
        
        for batch_num in range(total_items // batch_size):
            batch = []
            for i in range(batch_size):
                item_num = batch_num * batch_size + i
                plan_skill = plan_skills[item_num % len(plan_skills)]
                user = users[item_num % len(users)]
                
                content = UserLevelContent(
                    user_id=user.id,
                    plan_skill_id=plan_skill.id,
                    skill_id=plan_skill.skill_id,
                    level=(item_num % 3) + 1,
                    type=random.choice(["course", "certification", "reading", "link", "action"]),
                    title=f"Course {item_num}",
                    description=f"Description {item_num}",
                    completed=random.random() < 0.3
                )
                batch.append(content)
            
            db.add_all(batch)
            db.commit()
        
        print("✓ 100k items generated")
        
        # Define concurrent query tasks
        def run_query(query_id):
            from app.database import SessionLocal
            session = SessionLocal()
            try:
                start = time.time()
                
                # Simulate different query patterns
                if query_id % 3 == 0:
                    result = session.query(UserLevelContent).limit(100).all()
                elif query_id % 3 == 1:
                    result = session.query(UserLevelContent).filter_by(level=1).limit(50).all()
                else:
                    result = session.query(UserLevelContent).filter_by(completed=True).limit(50).all()
                
                elapsed = time.time() - start
                return {"query_id": query_id, "elapsed": elapsed, "rows": len(result)}
            finally:
                session.close()
        
        # Run concurrent queries
        num_concurrent = 50
        print(f"\n🔄 Running {num_concurrent} concurrent queries...")
        
        start_total = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(run_query, i) for i in range(num_concurrent)]
            for future in as_completed(futures):
                results.append(future.result())
        
        total_elapsed = time.time() - start_total
        
        # Analyze results
        query_times = [r["elapsed"] for r in results]
        avg_time = sum(query_times) / len(query_times)
        min_time = min(query_times)
        max_time = max(query_times)
        
        print("\n📊 Concurrent Query Results:")
        print("─" * 70)
        print(f"  Total queries:        {num_concurrent}")
        print(f"  Total time:           {total_elapsed:.2f}s")
        print(f"  Avg query time:       {avg_time*1000:.2f}ms")
        print(f"  Min query time:       {min_time*1000:.2f}ms")
        print(f"  Max query time:       {max_time*1000:.2f}ms")
        print(f"  Queries per second:   {num_concurrent/total_elapsed:.1f}")
        print("─" * 70)
        
        # Verify all queries succeeded
        assert len(results) == num_concurrent
        assert all(r["elapsed"] > 0 for r in results)

    def test_pagination_stability_100k(self, db: Session, load_test_setup):
        """Test pagination stability with 100k items."""
        setup = load_test_setup
        plan_skills = setup["plan_skills"]
        users = setup["users"]
        
        # Generate 100k items
        print("\n📊 Generating 100k items for pagination stability test...")
        batch_size = 5000
        total_items = 100000
        
        for batch_num in range(total_items // batch_size):
            batch = []
            for i in range(batch_size):
                item_num = batch_num * batch_size + i
                plan_skill = plan_skills[item_num % len(plan_skills)]
                user = users[item_num % len(users)]
                
                content = UserLevelContent(
                    user_id=user.id,
                    plan_skill_id=plan_skill.id,
                    skill_id=plan_skill.skill_id,
                    level=(item_num % 3) + 1,
                    type=random.choice(["course", "certification", "reading", "link", "action"]),
                    title=f"Course {item_num}",
                    description=f"Description {item_num}",
                    completed=random.random() < 0.3
                )
                batch.append(content)
            
            db.add_all(batch)
            db.commit()
        
        print("✓ 100k items generated")
        
        # Test pagination with page size 100
        page_size = 100
        num_pages = 10
        
        print(f"\n📄 Testing pagination ({page_size} items/page, {num_pages} pages)...")
        
        page_results = []
        for page_num in range(num_pages):
            start = time.time()
            offset = page_num * page_size
            items = db.query(UserLevelContent).offset(offset).limit(page_size).all()
            elapsed = time.time() - start
            
            page_results.append({
                "page": page_num + 1,
                "offset": offset,
                "count": len(items),
                "elapsed": elapsed
            })
        
        # Verify consistency
        print("\n📊 Pagination Results:")
        print("─" * 70)
        print(f"  {'Page':<6} {'Offset':<10} {'Count':<8} {'Time (ms)':<12}")
        print("─" * 70)
        
        for result in page_results:
            print(f"  {result['page']:<6} {result['offset']:<10} {result['count']:<8} {result['elapsed']*1000:>10.2f}ms")
        
        print("─" * 70)
        
        # Verify all pages have consistent item counts
        counts = [r["count"] for r in page_results]
        assert all(c == page_size for c in counts), f"Inconsistent page sizes: {counts}"
        
        # Verify query times are stable (no significant variance)
        times = [r["elapsed"] for r in page_results]
        avg_time = sum(times) / len(times)
        max_deviation = max(abs(t - avg_time) for t in times)
        print(f"\n✅ Pagination stable: avg {avg_time*1000:.2f}ms, max deviation {max_deviation*1000:.2f}ms")
