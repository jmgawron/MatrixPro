import sys
from datetime import date, datetime, timezone

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
from app.models.catalog import (
    Shift,
    CertificationDomain,
    Certificate,
    Campaign,
    SkillOrganisation,
    SkillDomain,
    SkillShift,
    SkillCertificate,
    SkillCampaign,
)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def run():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding organisations...")
        tac = Organisation(name="TAC")
        ps = Organisation(name="PS")
        cms = Organisation(name="CMS")
        css = Organisation(name="CSS")
        db.add_all([tac, ps, cms, css])
        db.flush()

        print("Seeding domains...")
        wireless = Domain(name="Wireless", organisation_id=tac.id, is_technical=True)
        security = Domain(name="Security", organisation_id=tac.id, is_technical=True)
        soft_skills = Domain(
            name="Soft Skills", organisation_id=tac.id, is_technical=False
        )
        ps_general = Domain(name="PS General", organisation_id=ps.id, is_technical=True)
        cms_general = Domain(
            name="CMS General", organisation_id=cms.id, is_technical=True
        )
        css_general = Domain(
            name="CSS General", organisation_id=css.id, is_technical=True
        )
        db.add_all(
            [wireless, security, soft_skills, ps_general, cms_general, css_general]
        )
        db.flush()

        print("Seeding teams...")
        wifi6_team = Team(name="Wi-Fi 6", domain_id=wireless.id)
        wlan_team = Team(name="WLAN Controllers", domain_id=wireless.id)
        firewall_team = Team(name="Firewall", domain_id=security.id)
        db.add_all([wifi6_team, wlan_team, firewall_team])
        db.flush()

        print("Seeding shifts (TAC only)...")
        shifts = {}
        for domain in [wireless, security]:
            for i in range(1, 5):
                s = Shift(name=f"Shift{i}", domain_id=domain.id)
                db.add(s)
                shifts[(domain.id, i)] = s
        db.flush()

        print("Seeding certification domains and certificates...")
        cert_data = {
            "CCNA": [
                ("CCNA R&S", "Cisco Certified Network Associate Routing & Switching")
            ],
            "CCNP Enterprise": [
                (
                    "ENCOR",
                    "Implementing and Operating Cisco Enterprise Network Core Technologies",
                ),
                (
                    "ENARSI",
                    "Implementing Cisco Enterprise Advanced Routing and Services",
                ),
            ],
            "CCNP Security": [
                ("SCOR", "Implementing and Operating Cisco Security Core Technologies"),
                ("SVPN", "Implementing Secure Solutions with Virtual Private Networks"),
            ],
            "DevNet Associate": [("DevNet Assoc", "Cisco Certified DevNet Associate")],
            "DevNet Professional": [
                (
                    "DEVCOR",
                    "Developing Applications Using Cisco Core Platforms and APIs",
                )
            ],
            "CyberOps": [("CyberOps Assoc", "Cisco Certified CyberOps Associate")],
        }

        cert_domains = {}
        all_certs = {}
        for cd_name, certs in cert_data.items():
            cd = CertificationDomain(name=cd_name)
            db.add(cd)
            db.flush()
            cert_domains[cd_name] = cd
            for cert_name, cert_desc in certs:
                c = Certificate(
                    name=cert_name,
                    description=cert_desc,
                    certification_domain_id=cd.id,
                )
                db.add(c)
                db.flush()
                all_certs[cert_name] = c

        print("Seeding campaigns...")
        campaign_wireless_sec = Campaign(
            name="Q3 Wireless Security Patching",
            description="Mandatory training on latest wireless security patches and vulnerability mitigations",
            organisation_id=tac.id,
            domain_id=wireless.id,
            start_date=date(2026, 7, 1),
            end_date=date(2026, 9, 30),
            is_mandatory=True,
        )
        campaign_soft_skills = Campaign(
            name="FY26 Soft Skills Initiative",
            description="Optional professional development program for communication and leadership skills",
            organisation_id=tac.id,
            domain_id=soft_skills.id,
            start_date=date(2025, 7, 1),
            end_date=date(2026, 6, 30),
            is_mandatory=False,
        )
        db.add_all([campaign_wireless_sec, campaign_soft_skills])
        db.flush()

        print("Seeding users...")
        pwd = hash_password("password123")

        admin_user = User(
            name="Admin",
            surname="System",
            email="admin@matrixpro.com",
            password_hash=pwd,
            role=UserRole.admin,
            avatar="avatar_shield",
        )
        alice = User(
            name="Alice",
            surname="Johnson",
            email="alice@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=wifi6_team.id,
            avatar="avatar_crown",
        )
        carol = User(
            name="Carol",
            surname="Williams",
            email="carol@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=wlan_team.id,
            avatar="avatar_star",
        )
        db.add_all([admin_user, alice, carol])
        db.flush()

        bob = User(
            name="Bob",
            surname="Smith",
            email="bob@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wifi6_team.id,
            manager_id=alice.id,
            avatar="avatar_rocket",
        )
        dave = User(
            name="Dave",
            surname="Brown",
            email="dave@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wlan_team.id,
            manager_id=carol.id,
            avatar="avatar_bolt",
        )
        eve = User(
            name="Eve",
            surname="Davis",
            email="eve@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=firewall_team.id,
            manager_id=carol.id,
            avatar="avatar_flame",
        )
        db.add_all([bob, dave, eve])
        db.flush()

        print("Seeding skills with M2M assignments...")

        skill_defs = [
            {
                "name": "802.11ax Fundamentals",
                "description": "Core Wi-Fi 6 standard concepts and PHY layer",
                "teams": [wifi6_team],
                "tags": ["wifi6", "wireless"],
                "orgs": [tac],
                "domains": [wireless],
                "shifts": [(wireless.id, 1), (wireless.id, 2)],
                "certs": ["CCNA R&S"],
                "campaigns": [],
            },
            {
                "name": "WPA3 Security",
                "description": "Modern wireless security protocol implementation",
                "teams": [wifi6_team, wlan_team],
                "tags": ["security", "wireless"],
                "orgs": [tac],
                "domains": [wireless, security],
                "shifts": [(wireless.id, 1), (wireless.id, 2), (security.id, 1)],
                "certs": ["CCNA R&S", "SCOR"],
                "campaigns": [campaign_wireless_sec],
            },
            {
                "name": "Cisco WLC 9800 Administration",
                "description": "Managing Cisco Catalyst 9800 WLAN Controllers",
                "teams": [wlan_team],
                "tags": ["wlc", "wireless"],
                "orgs": [tac],
                "domains": [wireless],
                "shifts": [(wireless.id, 3), (wireless.id, 4)],
                "certs": ["ENCOR"],
                "campaigns": [],
            },
            {
                "name": "OFDMA and MU-MIMO",
                "description": "Multi-user orthogonal frequency division for Wi-Fi 6",
                "teams": [wifi6_team],
                "tags": ["wifi6", "rf"],
                "orgs": [tac],
                "domains": [wireless],
                "shifts": [(wireless.id, 1)],
                "certs": [],
                "campaigns": [],
            },
            {
                "name": "Cisco DNA Center for Wireless",
                "description": "Assurance and automation for wireless networks",
                "teams": [wifi6_team, wlan_team],
                "tags": ["dnac", "automation"],
                "orgs": [tac],
                "domains": [wireless],
                "shifts": [
                    (wireless.id, 1),
                    (wireless.id, 2),
                    (wireless.id, 3),
                    (wireless.id, 4),
                ],
                "certs": ["ENCOR", "ENARSI"],
                "campaigns": [],
            },
            {
                "name": "Firepower Threat Defense",
                "description": "Cisco FTD configuration and policy management",
                "teams": [firewall_team],
                "tags": ["firewall", "ftd"],
                "orgs": [tac],
                "domains": [security],
                "shifts": [(security.id, 1), (security.id, 2)],
                "certs": ["SCOR", "SVPN"],
                "campaigns": [],
            },
            {
                "name": "ASA Firewall Administration",
                "description": "Cisco ASA configuration and troubleshooting",
                "teams": [firewall_team],
                "tags": ["firewall", "asa"],
                "orgs": [tac],
                "domains": [security],
                "shifts": [(security.id, 3), (security.id, 4)],
                "certs": ["SCOR"],
                "campaigns": [],
            },
            {
                "name": "Zero Trust Network Access",
                "description": "ZTNA architecture and implementation",
                "teams": [firewall_team],
                "tags": ["ztna", "security"],
                "orgs": [tac],
                "domains": [security],
                "shifts": [(security.id, 1), (security.id, 2)],
                "certs": ["CyberOps Assoc"],
                "campaigns": [],
            },
            {
                "name": "Cisco ISE Fundamentals",
                "description": "Identity services engine configuration and policy",
                "teams": [firewall_team, wifi6_team],
                "tags": ["ise", "aaa"],
                "orgs": [tac],
                "domains": [security, wireless],
                "shifts": [(security.id, 1), (wireless.id, 1)],
                "certs": ["SCOR", "CCNA R&S"],
                "campaigns": [],
            },
            {
                "name": "Network Automation with Python",
                "description": "Python scripting for network automation tasks",
                "teams": [wifi6_team, wlan_team, firewall_team],
                "tags": ["automation", "python"],
                "orgs": [tac, ps],
                "domains": [wireless, security],
                "shifts": [],
                "certs": ["DevNet Assoc", "DEVCOR"],
                "campaigns": [],
            },
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

        for sd in skill_defs:
            skill = Skill(
                name=sd["name"],
                description=sd["description"],
                is_future=False,
                is_archived=False,
                catalog_version=1,
            )
            db.add(skill)
            db.flush()

            for team in sd["teams"]:
                db.add(SkillTeam(skill_id=skill.id, team_id=team.id))

            for tname in sd["tags"]:
                if tname not in all_tags:
                    existing = db.query(Tag).filter(Tag.name == tname).first()
                    if not existing:
                        existing = Tag(name=tname)
                        db.add(existing)
                        db.flush()
                    all_tags[tname] = existing
                db.add(SkillTag(skill_id=skill.id, tag_id=all_tags[tname].id))

            for org in sd["orgs"]:
                db.add(SkillOrganisation(skill_id=skill.id, organisation_id=org.id))

            for dom in sd["domains"]:
                db.add(SkillDomain(skill_id=skill.id, domain_id=dom.id))

            for domain_id, shift_num in sd["shifts"]:
                shift = shifts[(domain_id, shift_num)]
                db.add(SkillShift(skill_id=skill.id, shift_id=shift.id))

            for cert_name in sd["certs"]:
                cert = all_certs[cert_name]
                db.add(SkillCertificate(skill_id=skill.id, certificate_id=cert.id))

            for camp in sd["campaigns"]:
                db.add(SkillCampaign(skill_id=skill.id, campaign_id=camp.id))

            for idx, (level, ctype, title, desc, url) in enumerate(content_templates):
                db.add(
                    SkillLevelContent(
                        skill_id=skill.id,
                        level=level,
                        type=ctype,
                        title=f"{sd['name']}: {title}",
                        description=desc,
                        url=url,
                        position=idx,
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
        print()
        print("Organisations: TAC, PS, CMS, CSS")
        print(
            "Domains: Wireless, Security, Soft Skills (TAC); PS General; CMS General; CSS General"
        )
        print("Shifts: Shift1-4 per Wireless and Security domains")
        print(
            "Cert Domains: CCNA, CCNP Enterprise, CCNP Security, DevNet Associate, DevNet Professional, CyberOps"
        )
        print(
            "Campaigns: Q3 Wireless Security Patching (mandatory), FY26 Soft Skills Initiative (optional)"
        )

    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
