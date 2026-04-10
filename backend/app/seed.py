import sys
from datetime import datetime, timezone

import bcrypt

from app.database import Base, SessionLocal, engine
from app.models import (
    Organisation,
    Domain,
    Team,
    User,
    UserRole,
    Skill,
    SkillTeam,
    Tag,
    SkillTag,
    SkillLevelContent,
    SkillLevelContentType,
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def run():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(Organisation).first():
            print("Database already seeded. Skipping.")
            return

        print("Seeding organisation and structure...")
        org = Organisation(name="Cisco TAC")
        db.add(org)
        db.flush()

        wireless = Domain(name="Wireless", organisation_id=org.id)
        security = Domain(name="Security", organisation_id=org.id)
        db.add_all([wireless, security])
        db.flush()

        wifi6_team = Team(name="Wi-Fi 6", domain_id=wireless.id)
        wlan_team = Team(name="WLAN Controllers", domain_id=wireless.id)
        firewall_team = Team(name="Firewall", domain_id=security.id)
        db.add_all([wifi6_team, wlan_team, firewall_team])
        db.flush()

        print("Seeding users...")
        pwd = hash_password("password123")

        admin_user = User(
            name="Admin",
            email="admin@matrixpro.com",
            password_hash=pwd,
            role=UserRole.admin,
        )
        alice = User(
            name="Alice",
            email="alice@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=wifi6_team.id,
        )
        carol = User(
            name="Carol",
            email="carol@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=wlan_team.id,
        )
        db.add_all([admin_user, alice, carol])
        db.flush()

        bob = User(
            name="Bob",
            email="bob@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wifi6_team.id,
            manager_id=alice.id,
        )
        dave = User(
            name="Dave",
            email="dave@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wlan_team.id,
            manager_id=carol.id,
        )
        eve = User(
            name="Eve",
            email="eve@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=firewall_team.id,
            manager_id=carol.id,
        )
        db.add_all([bob, dave, eve])
        db.flush()

        print("Seeding skills...")
        skill_data = [
            (
                "802.11ax Fundamentals",
                "Core Wi-Fi 6 standard concepts and PHY layer",
                wireless.id,
                [wifi6_team.id],
                ["wifi6", "wireless"],
            ),
            (
                "WPA3 Security",
                "Modern wireless security protocol implementation",
                wireless.id,
                [wifi6_team.id, wlan_team.id],
                ["security", "wireless"],
            ),
            (
                "Cisco WLC 9800 Administration",
                "Managing Cisco Catalyst 9800 WLAN Controllers",
                wireless.id,
                [wlan_team.id],
                ["wlc", "wireless"],
            ),
            (
                "OFDMA and MU-MIMO",
                "Multi-user orthogonal frequency division for Wi-Fi 6",
                wireless.id,
                [wifi6_team.id],
                ["wifi6", "rf"],
            ),
            (
                "Cisco DNA Center for Wireless",
                "Assurance and automation for wireless networks",
                wireless.id,
                [wifi6_team.id, wlan_team.id],
                ["dnac", "automation"],
            ),
            (
                "Firepower Threat Defense",
                "Cisco FTD configuration and policy management",
                security.id,
                [firewall_team.id],
                ["firewall", "ftd"],
            ),
            (
                "ASA Firewall Administration",
                "Cisco ASA configuration and troubleshooting",
                security.id,
                [firewall_team.id],
                ["firewall", "asa"],
            ),
            (
                "Zero Trust Network Access",
                "ZTNA architecture and implementation",
                security.id,
                [firewall_team.id],
                ["ztna", "security"],
            ),
            (
                "Cisco ISE Fundamentals",
                "Identity services engine configuration and policy",
                security.id,
                [firewall_team.id, wifi6_team.id],
                ["ise", "aaa"],
            ),
            (
                "Network Automation with Python",
                "Python scripting for network automation tasks",
                wireless.id,
                [wifi6_team.id, wlan_team.id, firewall_team.id],
                ["automation", "python"],
            ),
        ]

        content_templates = [
            (
                1,
                SkillLevelContentType.course,
                "Foundation Course",
                "Introductory course covering basic concepts",
                "https://learningnetwork.cisco.com",
            ),
            (
                1,
                SkillLevelContentType.reading,
                "Official Documentation",
                "Read the official product documentation",
                None,
            ),
            (
                2,
                SkillLevelContentType.course,
                "Advanced Configuration Lab",
                "Hands-on lab for intermediate learners",
                "https://dcloud.cisco.com",
            ),
            (
                2,
                SkillLevelContentType.certification,
                "Associate Certification",
                "Obtain the associate-level certification",
                "https://www.cisco.com/c/en/us/training-events/training-certifications.html",
            ),
            (
                3,
                SkillLevelContentType.certification,
                "Professional Certification",
                "Achieve professional-level certification",
                "https://www.cisco.com/c/en/us/training-events/training-certifications.html",
            ),
            (
                3,
                SkillLevelContentType.action,
                "Lead a Workshop",
                "Deliver a knowledge-sharing session to peers",
                None,
            ),
        ]

        all_tags: dict[str, Tag] = {}
        skills_created: list[Skill] = []

        for skill_name, skill_desc, domain_id, team_ids, tag_names in skill_data:
            skill = Skill(
                name=skill_name,
                description=skill_desc,
                domain_id=domain_id,
                is_future=False,
                is_archived=False,
                catalog_version=1,
            )
            db.add(skill)
            db.flush()

            for tid in team_ids:
                db.add(SkillTeam(skill_id=skill.id, team_id=tid))

            for tname in tag_names:
                if tname not in all_tags:
                    existing = db.query(Tag).filter(Tag.name == tname).first()
                    if not existing:
                        existing = Tag(name=tname)
                        db.add(existing)
                        db.flush()
                    all_tags[tname] = existing
                db.add(SkillTag(skill_id=skill.id, tag_id=all_tags[tname].id))

            for level, ctype, title, desc, url in content_templates:
                db.add(
                    SkillLevelContent(
                        skill_id=skill.id,
                        level=level,
                        type=ctype,
                        title=f"{skill_name}: {title}",
                        description=desc,
                        url=url,
                    )
                )

            skills_created.append(skill)

        db.flush()

        print("Seeding development plans...")
        for engineer, assigned_skills in [
            (bob, [skills_created[0], skills_created[1], skills_created[3]]),
            (dave, [skills_created[2], skills_created[4], skills_created[8]]),
            (eve, [skills_created[5], skills_created[6], skills_created[7]]),
        ]:
            plan = DevelopmentPlan(engineer_id=engineer.id)
            db.add(plan)
            db.flush()

            statuses = [
                PlanSkillStatus.in_development,
                PlanSkillStatus.in_pipeline,
                PlanSkillStatus.proficiency,
            ]
            for idx, skill in enumerate(assigned_skills):
                ps = PlanSkill(
                    plan_id=plan.id,
                    skill_id=skill.id,
                    status=statuses[idx % len(statuses)],
                    proficiency_level=idx + 1
                    if statuses[idx % len(statuses)] == PlanSkillStatus.proficiency
                    else None,
                    skill_version_at_add=1,
                    notes=f"Auto-seeded for {engineer.name}",
                )
                db.add(ps)
                db.flush()

                if ps.status == PlanSkillStatus.proficiency:
                    db.add(
                        PlanSkillTrainingLog(
                            plan_skill_id=ps.id,
                            title=f"Completed {skill.name} foundation course",
                            type=SkillLevelContentType.course,
                            completed_at=datetime.now(timezone.utc),
                            notes="Completed during initial onboarding",
                        )
                    )

        db.commit()
        print("Seed complete!")
        print("Users created:")
        print("  admin@matrixpro.com  (admin)    password: password123")
        print("  alice@matrixpro.com  (manager)  password: password123")
        print("  bob@matrixpro.com    (engineer) password: password123")
        print("  carol@matrixpro.com  (manager)  password: password123")
        print("  dave@matrixpro.com   (engineer) password: password123")
        print("  eve@matrixpro.com    (engineer) password: password123")

    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
