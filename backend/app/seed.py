import sys
from datetime import date, datetime, timezone

import bcrypt

from app.database import Base, SessionLocal, engine
from app.models import (
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
    CertificationDomain,
    Certificate,
    SkillCertificate,
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
        # ── Domains ──────────────────────────────────────────────────────────
        print("Seeding domains...")
        wireless = Domain(name="Wireless", is_technical=True, icon="wifi")
        security = Domain(name="Security", is_technical=True, icon="shield-lock")
        switching = Domain(name="Switching & Routing", is_technical=True, icon="route")
        collab = Domain(name="Collaboration", is_technical=True, icon="server-phone")
        dc = Domain(name="Data Center", is_technical=True, icon="datacenter")
        soft_skills = Domain(name="Soft Skills", is_technical=False, icon="users")
        db.add_all([wireless, security, switching, collab, dc, soft_skills])
        db.flush()

        # ── Teams (12 teams across 4 shifts) ─────────────────────────────────
        print("Seeding teams (with shift assignments)...")
        # Wireless
        wifi6 = Team(name="Wi-Fi 6/6E", domain_id=wireless.id, shift=1)
        wlan_ctrl = Team(name="WLAN Controllers", domain_id=wireless.id, shift=2)
        wifi_assurance = Team(name="Wireless Assurance", domain_id=wireless.id, shift=3)

        # Security
        firewall = Team(name="Firewall & FTD", domain_id=security.id, shift=1)
        ise_team = Team(name="ISE & Identity", domain_id=security.id, shift=2)
        vpn_team = Team(name="VPN & Remote Access", domain_id=security.id, shift=4)

        # Switching & Routing
        campus_sw = Team(name="Campus Switching", domain_id=switching.id, shift=1)
        routing_team = Team(name="Enterprise Routing", domain_id=switching.id, shift=3)
        sdwan_team = Team(name="SD-WAN", domain_id=switching.id, shift=4)

        # Collaboration
        webex_team = Team(name="Webex Calling", domain_id=collab.id, shift=2)
        uc_team = Team(name="Unified Communications", domain_id=collab.id, shift=3)

        # Data Center
        aci_team = Team(name="ACI Fabric", domain_id=dc.id, shift=4)

        all_teams = [
            wifi6,
            wlan_ctrl,
            wifi_assurance,
            firewall,
            ise_team,
            vpn_team,
            campus_sw,
            routing_team,
            sdwan_team,
            webex_team,
            uc_team,
            aci_team,
        ]
        db.add_all(all_teams)
        db.flush()

        # ── Certification Domains & Certificates ──────────────────────────────
        print("Seeding certification domains and certificates...")
        cert_data = {
            "CCNA": [
                ("CCNA", "Cisco Certified Network Associate"),
            ],
            "CCNP Enterprise": [
                ("ENCOR", "Implementing Cisco Enterprise Network Core Technologies"),
                (
                    "ENARSI",
                    "Implementing Cisco Enterprise Advanced Routing and Services",
                ),
            ],
            "CCNP Security": [
                ("SCOR", "Implementing and Operating Cisco Security Core Technologies"),
                ("SVPN", "Implementing Secure Solutions with Virtual Private Networks"),
                ("SISE", "Implementing and Configuring Cisco Identity Services Engine"),
            ],
            "CCNP Collaboration": [
                ("CLCOR", "Implementing Cisco Collaboration Core Technologies"),
                ("CLICA", "Implementing Cisco Collaboration Applications"),
            ],
            "CCNP Data Center": [
                ("DCCOR", "Implementing Cisco Data Center Core Technologies"),
                ("DCACI", "Implementing Cisco Application Centric Infrastructure"),
            ],
            "DevNet Associate": [
                ("DevNet Assoc", "Cisco Certified DevNet Associate"),
            ],
            "DevNet Professional": [
                (
                    "DEVCOR",
                    "Developing Applications Using Cisco Core Platforms and APIs",
                ),
            ],
            "CyberOps": [
                ("CyberOps Assoc", "Cisco Certified CyberOps Associate"),
            ],
            "Wireless Specialty": [
                (
                    "Wi-Fi 6 Specialist",
                    "Cisco Wi-Fi 6 Design and Deployment Specialist",
                ),
            ],
            "SD-WAN Specialist": [
                ("SD-WAN Design", "Cisco SD-WAN Design and Deploy Specialist"),
            ],
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

        # ── Users ─────────────────────────────────────────────────────────────
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
        # Managers (one per domain area — shift-aligned)
        alice = User(
            name="Alice",
            surname="Johnson",
            email="alice@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=wifi6.id,
            avatar="avatar_crown",
        )
        carol = User(
            name="Carol",
            surname="Williams",
            email="carol@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=firewall.id,
            avatar="avatar_star",
        )
        frank = User(
            name="Frank",
            surname="Chen",
            email="frank@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=campus_sw.id,
            avatar="avatar_bolt",
        )
        grace = User(
            name="Grace",
            surname="Lopez",
            email="grace@matrixpro.com",
            password_hash=pwd,
            role=UserRole.manager,
            team_id=webex_team.id,
            avatar="avatar_flame",
        )
        db.add_all([admin_user, alice, carol, frank, grace])
        db.flush()

        # Engineers
        bob = User(
            name="Bob",
            surname="Smith",
            email="bob@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wifi6.id,
            manager_id=alice.id,
            avatar="avatar_rocket",
        )
        dave = User(
            name="Dave",
            surname="Brown",
            email="dave@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=wlan_ctrl.id,
            manager_id=alice.id,
            avatar="avatar_bolt",
        )
        eve = User(
            name="Eve",
            surname="Davis",
            email="eve@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=firewall.id,
            manager_id=carol.id,
            avatar="avatar_flame",
        )
        henry = User(
            name="Henry",
            surname="Park",
            email="henry@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=ise_team.id,
            manager_id=carol.id,
            avatar="avatar_rocket",
        )
        ivan = User(
            name="Ivan",
            surname="Novak",
            email="ivan@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=campus_sw.id,
            manager_id=frank.id,
            avatar="avatar_star",
        )
        julia = User(
            name="Julia",
            surname="Kim",
            email="julia@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=routing_team.id,
            manager_id=frank.id,
            avatar="avatar_crown",
        )
        kevin = User(
            name="Kevin",
            surname="Patel",
            email="kevin@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=sdwan_team.id,
            manager_id=frank.id,
            avatar="avatar_shield",
        )
        lisa = User(
            name="Lisa",
            surname="Torres",
            email="lisa@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=webex_team.id,
            manager_id=grace.id,
            avatar="avatar_flame",
        )
        mike = User(
            name="Mike",
            surname="Reeves",
            email="mike@matrixpro.com",
            password_hash=pwd,
            role=UserRole.engineer,
            team_id=aci_team.id,
            manager_id=grace.id,
            avatar="avatar_bolt",
        )
        db.add_all([bob, dave, eve, henry, ivan, julia, kevin, lisa, mike])
        db.flush()

        # ── Skills (30 skills across all domains) ─────────────────────────────
        print("Seeding skills with team and certificate assignments...")

        skill_defs = [
            # ── Wireless ──
            {
                "name": "802.11ax/be Fundamentals",
                "description": "Wi-Fi 6/6E/7 PHY and MAC layer concepts, OFDMA, MU-MIMO, BSS coloring",
                "teams": [wifi6],
                "tags": ["wifi6", "wireless", "rf"],
                "certs": ["CCNA", "Wi-Fi 6 Specialist"],
                "icon": "wifi",
            },
            {
                "name": "WPA3 & Wireless Security",
                "description": "SAE, OWE, 802.1X with WPA3, WIDS/WIPS, rogue detection",
                "teams": [wifi6, wlan_ctrl],
                "tags": ["security", "wireless", "wpa3"],
                "certs": ["CCNA", "SCOR"],
                "icon": "shield-lock",
            },
            {
                "name": "Cisco WLC 9800 Administration",
                "description": "Catalyst 9800 WLC configuration, HA SSO, FlexConnect, AP management",
                "teams": [wlan_ctrl],
                "tags": ["wlc", "wireless", "9800"],
                "certs": ["ENCOR", "Wi-Fi 6 Specialist"],
                "icon": "access-point",
            },
            {
                "name": "Cisco DNA Center for Wireless",
                "description": "Wireless assurance, AI-driven analytics, SDA wireless integration",
                "teams": [wifi6, wlan_ctrl, wifi_assurance],
                "tags": ["dnac", "automation", "assurance"],
                "certs": ["ENCOR", "ENARSI"],
                "icon": "dashboard",
            },
            {
                "name": "RF Design & Site Survey",
                "description": "Predictive site surveys, Ekahau, channel planning, power optimization",
                "teams": [wifi_assurance],
                "tags": ["rf", "design", "survey"],
                "certs": ["Wi-Fi 6 Specialist"],
                "icon": "antenna",
            },
            # ── Security ──
            {
                "name": "Firepower Threat Defense",
                "description": "Cisco FTD configuration, Snort IPS rules, AMP, malware defense",
                "teams": [firewall],
                "tags": ["firewall", "ftd", "ips"],
                "certs": ["SCOR", "SVPN"],
                "icon": "firewall",
            },
            {
                "name": "ASA Firewall Administration",
                "description": "Cisco ASA configuration, NAT, ACLs, failover, VPN termination",
                "teams": [firewall, vpn_team],
                "tags": ["firewall", "asa", "nat"],
                "certs": ["SCOR"],
                "icon": "shield",
            },
            {
                "name": "Cisco ISE Configuration",
                "description": "802.1X, MAB, profiling, posture, pxGrid, TrustSec integration",
                "teams": [ise_team],
                "tags": ["ise", "aaa", "identity"],
                "certs": ["SISE", "SCOR"],
                "icon": "fingerprint",
            },
            {
                "name": "Zero Trust Architecture",
                "description": "ZTNA design, Duo integration, micro-segmentation, identity-first security",
                "teams": [ise_team, firewall],
                "tags": ["ztna", "security", "zero-trust"],
                "certs": ["CyberOps Assoc", "SCOR"],
                "icon": "lock",
            },
            {
                "name": "AnyConnect & Remote Access VPN",
                "description": "AnyConnect deployment, split tunneling, DTLS, posture checks, RA-VPN",
                "teams": [vpn_team],
                "tags": ["vpn", "anyconnect", "remote-access"],
                "certs": ["SVPN"],
                "icon": "vpn",
            },
            {
                "name": "Site-to-Site VPN Technologies",
                "description": "IPsec, GRE, DMVPN, FlexVPN, IKEv2 configuration and troubleshooting",
                "teams": [vpn_team, routing_team],
                "tags": ["vpn", "ipsec", "dmvpn"],
                "certs": ["SVPN", "ENARSI"],
                "icon": "tunnel",
            },
            # ── Switching & Routing ──
            {
                "name": "Catalyst Switching Platforms",
                "description": "Cat 9000 series, UADP ASIC, StackWise Virtual, ISSU, IOS-XE",
                "teams": [campus_sw],
                "tags": ["switching", "catalyst", "9000"],
                "certs": ["CCNA", "ENCOR"],
                "icon": "switch",
            },
            {
                "name": "SDA & Campus Fabric",
                "description": "Software-Defined Access, LISP, VXLAN, CTS, macro/micro segmentation",
                "teams": [campus_sw, routing_team],
                "tags": ["sda", "fabric", "vxlan"],
                "certs": ["ENCOR"],
                "icon": "fabric",
            },
            {
                "name": "OSPF & EIGRP Deep Dive",
                "description": "Advanced OSPF (areas, LSA types, stub), EIGRP named mode, route filtering",
                "teams": [routing_team],
                "tags": ["routing", "ospf", "eigrp"],
                "certs": ["CCNA", "ENARSI"],
                "icon": "route",
            },
            {
                "name": "BGP for Enterprise",
                "description": "eBGP/iBGP, route reflectors, communities, path selection, prefix filtering",
                "teams": [routing_team, sdwan_team],
                "tags": ["routing", "bgp", "wan"],
                "certs": ["ENARSI"],
                "icon": "globe",
            },
            {
                "name": "Cisco SD-WAN (Viptela)",
                "description": "vManage/vSmart/vBond/vEdge, OMP, policies, application-aware routing",
                "teams": [sdwan_team],
                "tags": ["sdwan", "viptela", "wan"],
                "certs": ["SD-WAN Design"],
                "icon": "cloud-network",
            },
            {
                "name": "SD-WAN Security Integration",
                "description": "Cloud security with Umbrella SIG, IPS/IDS on vEdge, ZBFW in SD-WAN",
                "teams": [sdwan_team, firewall],
                "tags": ["sdwan", "security", "umbrella"],
                "certs": ["SD-WAN Design", "SCOR"],
                "icon": "cloud-lock",
            },
            # ── Collaboration ──
            {
                "name": "Webex Calling Administration",
                "description": "Webex Control Hub, PSTN options, call routing, auto-attendants, hunt groups",
                "teams": [webex_team],
                "tags": ["webex", "calling", "cloud"],
                "certs": ["CLCOR"],
                "icon": "phone",
            },
            {
                "name": "CUCM Administration",
                "description": "Cisco Unified Communications Manager, dial plans, partitions, CSS, MRA",
                "teams": [uc_team],
                "tags": ["cucm", "voip", "dial-plan"],
                "certs": ["CLCOR", "CLICA"],
                "icon": "server-phone",
            },
            {
                "name": "SIP Protocol & Oribits",
                "description": "SIP signaling, SDP, oribits, codec negotiation, SRTP, oribits troubleshooting",
                "teams": [webex_team, uc_team],
                "tags": ["sip", "voip", "protocol"],
                "certs": ["CLCOR"],
                "icon": "protocol",
            },
            {
                "name": "Webex Meetings & Devices",
                "description": "Room systems, Board/Desk/Room series, OBTP, hybrid services",
                "teams": [webex_team],
                "tags": ["webex", "devices", "meetings"],
                "certs": [],
                "icon": "video",
            },
            # ── Data Center ──
            {
                "name": "ACI Fabric Fundamentals",
                "description": "ACI architecture, spine/leaf, APIC, tenants, EPGs, contracts",
                "teams": [aci_team],
                "tags": ["aci", "datacenter", "fabric"],
                "certs": ["DCCOR", "DCACI"],
                "icon": "datacenter",
            },
            {
                "name": "Nexus NX-OS Administration",
                "description": "Nexus 9000 standalone mode, vPC, FEX, NX-OS troubleshooting",
                "teams": [aci_team],
                "tags": ["nexus", "datacenter", "nxos"],
                "certs": ["DCCOR"],
                "icon": "rack-server",
            },
            # ── Cross-domain ──
            {
                "name": "Network Automation with Python",
                "description": "Netmiko, NAPALM, pyATS, REST APIs, YANG models, Ansible for network",
                "teams": [wifi6, campus_sw, routing_team, aci_team],
                "tags": ["automation", "python", "devnet"],
                "certs": ["DevNet Assoc", "DEVCOR"],
                "icon": "code",
            },
            {
                "name": "Terraform for Network Infra",
                "description": "Terraform providers for ACI, Meraki, ISE; IaC workflows, state management",
                "teams": [aci_team, sdwan_team],
                "tags": ["automation", "terraform", "iac"],
                "certs": ["DEVCOR"],
                "icon": "infrastructure",
            },
            {
                "name": "Cisco ThousandEyes",
                "description": "Internet and cloud intelligence, endpoint agents, network path visualization",
                "teams": [wifi_assurance, sdwan_team, webex_team],
                "tags": ["monitoring", "thousandeyes", "assurance"],
                "certs": [],
                "icon": "eye",
            },
            # ── Soft skills (no team / non-technical) ──
            {
                "name": "Technical Case Documentation",
                "description": "Writing clear case notes, reproduction steps, escalation summaries for TAC",
                "teams": [],
                "tags": ["communication", "documentation"],
                "certs": [],
                "icon": "document",
            },
            {
                "name": "Customer Communication",
                "description": "Active listening, empathy, de-escalation techniques, expectation setting",
                "teams": [],
                "tags": ["communication", "soft-skill"],
                "certs": [],
                "icon": "users",
            },
            {
                "name": "Root Cause Analysis",
                "description": "5-Why analysis, fishbone diagrams, fault isolation methodology",
                "teams": [],
                "tags": ["troubleshooting", "methodology"],
                "certs": [],
                "icon": "search",
            },
            {
                "name": "Lab Recreation & Testing",
                "description": "Building lab topologies, CML usage, dCloud reservations, reproducing defects",
                "teams": [],
                "tags": ["lab", "testing", "cml"],
                "certs": [],
                "icon": "flask",
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
                icon=sd.get("icon"),
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

            for cert_name in sd["certs"]:
                cert = all_certs[cert_name]
                db.add(SkillCertificate(skill_id=skill.id, certificate_id=cert.id))

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

        # ── Development Plans ──────────────────────────────────────────────────
        print("Seeding development plans...")
        plan_assignments = [
            (
                bob,
                [skills_created[0], skills_created[1], skills_created[3]],
            ),  # Wi-Fi 6 skills
            (
                dave,
                [skills_created[2], skills_created[3], skills_created[1]],
            ),  # WLAN skills
            (
                eve,
                [skills_created[5], skills_created[6], skills_created[8]],
            ),  # Firewall skills
            (
                henry,
                [skills_created[7], skills_created[8], skills_created[9]],
            ),  # ISE + security
            (
                ivan,
                [skills_created[11], skills_created[12], skills_created[23]],
            ),  # Switching + automation
            (
                julia,
                [skills_created[13], skills_created[14], skills_created[10]],
            ),  # Routing + VPN
            (
                kevin,
                [skills_created[15], skills_created[16], skills_created[24]],
            ),  # SD-WAN + Terraform
            (
                lisa,
                [skills_created[17], skills_created[19], skills_created[25]],
            ),  # Webex + ThousandEyes
            (
                mike,
                [skills_created[21], skills_created[22], skills_created[24]],
            ),  # ACI + Nexus + Terraform
        ]

        statuses = [
            PlanSkillStatus.developing,
            PlanSkillStatus.planned,
            PlanSkillStatus.mastered,
        ]

        for engineer, assigned_skills in plan_assignments:
            plan = DevelopmentPlan(engineer_id=engineer.id)
            db.add(plan)
            db.flush()

            for idx, skill in enumerate(assigned_skills):
                ps = PlanSkill(
                    plan_id=plan.id,
                    skill_id=skill.id,
                    status=statuses[idx % len(statuses)],
                    proficiency_level=idx + 1
                    if statuses[idx % len(statuses)] == PlanSkillStatus.mastered
                    else None,
                    skill_version_at_add=1,
                    notes=f"Auto-seeded for {engineer.name}",
                )
                db.add(ps)
                db.flush()

                if ps.status == PlanSkillStatus.mastered:
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
        print()
        print("Users created:")
        print("  admin@matrixpro.com   (admin)    password: password123")
        print(
            "  alice@matrixpro.com   (manager)  password: password123  [Wi-Fi 6/6E, Shift 1]"
        )
        print(
            "  carol@matrixpro.com   (manager)  password: password123  [Firewall & FTD, Shift 1]"
        )
        print(
            "  frank@matrixpro.com   (manager)  password: password123  [Campus Switching, Shift 1]"
        )
        print(
            "  grace@matrixpro.com   (manager)  password: password123  [Webex Calling, Shift 2]"
        )
        print("  bob@matrixpro.com     (engineer) password: password123  [Wi-Fi 6/6E]")
        print(
            "  dave@matrixpro.com    (engineer) password: password123  [WLAN Controllers]"
        )
        print(
            "  eve@matrixpro.com     (engineer) password: password123  [Firewall & FTD]"
        )
        print(
            "  henry@matrixpro.com   (engineer) password: password123  [ISE & Identity]"
        )
        print(
            "  ivan@matrixpro.com    (engineer) password: password123  [Campus Switching]"
        )
        print(
            "  julia@matrixpro.com   (engineer) password: password123  [Enterprise Routing]"
        )
        print("  kevin@matrixpro.com   (engineer) password: password123  [SD-WAN]")
        print(
            "  lisa@matrixpro.com    (engineer) password: password123  [Webex Calling]"
        )
        print("  mike@matrixpro.com    (engineer) password: password123  [ACI Fabric]")
        print()
        print(
            "Domains: Wireless, Security, Switching & Routing, Collaboration, Data Center, Soft Skills"
        )
        print("Teams (12): across all 4 shifts")
        print(f"Skills: {len(skills_created)} total")
        print(f"Cert Domains: {len(cert_domains)}")

    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
