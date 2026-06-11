"""MatrixPro seed — Cisco TAC global catalog.

Domains : Enterprise Networking, Data Center Networking, Security, Non-Technical
Teams   : 20 technology teams × 4 shifts = 80 teams + 4 Non-Technical virtual = 84
Skills  : 50+ skills across Foundational / Core / Advanced / AI & Future (strict 1:1)
Users   : 1 admin + 20 managers (SHIFT1) + 20 engineers (SHIFT1)
Content : 18 SkillLevelContent rows per skill (3E: 6 Education + 6 Exposure + 6 Experience)
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

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
    SkillCategory,
    SkillCategoryAssignment,
    UserContentCompletion,
    UserLevelContent,
)
from app.models.catalog import (
    CertificationDomain,
    Certificate,
    SkillCertificate,
)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


AVATAR_CATALOG_IDS = [
    "avatar_astronaut", "avatar_ninja", "avatar_pirate", "avatar_wizard",
    "avatar_scientist", "avatar_detective", "avatar_chef", "avatar_pilot",
    "avatar_viking", "avatar_samurai", "avatar_cowboy", "avatar_knight",
    "avatar_robot", "avatar_alien", "avatar_vampire", "avatar_crown",
    "avatar_star", "avatar_shield", "avatar_bolt", "avatar_flame",
    "avatar_diamond", "avatar_rocket", "avatar_globe", "avatar_atom",
    "avatar_compass", "avatar_anchor", "avatar_leaf", "avatar_wolf",
    "avatar_phoenix", "avatar_dragon",
]


def pick_avatar(idx: int) -> str:
    return AVATAR_CATALOG_IDS[idx % len(AVATAR_CATALOG_IDS)]


DOMAIN_DEFS = [
    ("ENT",   "Enterprise Networking",      True,  "route"),
    ("DC",    "Data Center Networking",     True,  "datacenter"),
    ("SEC",   "Security",                   True,  "shield-lock"),
    ("NTECH", "Non-Technical",              False, "users"),
]

TEAM_TAXONOMY = {
    "ENT": [
        ("LANSW",  "LAN Switching",            "route"),
        ("ARCH",   "Software Architecture",    "code"),
        ("CATC",   "Catalyst Center",          "eye"),
        ("RP",     "Routing Protocols",        "route"),
        ("WRLS",   "Wireless",                 "wifi"),
        ("SDWAN",  "SD-WAN",                   "fabric"),
        ("SDA",    "Software-Defined Access",  "fabric"),
        ("OBSV",   "Observability & Telemetry","eye"),
    ],
    "DC": [
        ("NEXUS",  "Nexus Switching",          "datacenter"),
        ("ACI",    "ACI",                      "fabric"),
        ("MDS",    "Storage Networking",       "datacenter"),
        ("UCS",    "UCS Compute",              "datacenter"),
        ("DCN",    "DC Networking Protocols",  "route"),
        ("CLOUD",  "Cloud Networking",         "datacenter"),
    ],
    "SEC": [
        ("FTD",       "Firewall Security",          "shield-lock"),
        ("ISE",       "Identity Services Engine",   "lock"),
        ("SASE",      "Secure Access / SASE",       "shield-lock"),
        ("SECMAIL",   "Email & Web Security",       "shield-lock"),
        ("VPN",       "VPN & Remote Access",        "lock"),
        ("SECARCH",   "Security Architecture",      "code"),
    ],
}


CERT_CATALOG: dict[str, list[tuple[str, str, str]]] = {
    "Foundational": [
        ("CCST",     "Cisco Certified Support Technician", "Entry-level Cisco support credential."),
        ("CCNA",     "Cisco Certified Network Associate",  "Foundational networking certification."),
        ("ITIL4",    "ITIL 4 Foundation",                  "Service management & incident handling."),
    ],
    "Enterprise": [
        ("CCNP-ENCOR", "CCNP Enterprise Core",            "Enterprise networking core technologies."),
        ("CCNP-ENARSI","CCNP Advanced Routing",           "Advanced enterprise routing & services."),
        ("CCNP-ENWLSI","CCNP Enterprise Wireless Impl.",  "Wireless implementation."),
        ("CCNP-ENSDWI","CCNP SD-WAN Implementation",      "Cisco SD-WAN solutions."),
        ("CCIE-EI",    "CCIE Enterprise Infrastructure",  "Expert-level enterprise infrastructure."),
    ],
    "Data Center": [
        ("CCNP-DCCOR", "CCNP Data Center Core",           "Data center core technologies."),
        ("CCNP-DCACI", "CCNP Implementing ACI",           "ACI implementation."),
        ("CCNP-DCUCI", "CCNP Implementing UCS",           "UCS server implementation."),
        ("CCIE-DC",    "CCIE Data Center",                "Expert-level data center."),
    ],
    "Security": [
        ("CCNP-SCOR",  "CCNP Security Core",              "Security core technologies."),
        ("CCNP-SISE",  "CCNP Implementing ISE",           "ISE implementation."),
        ("CCNP-SVPN",  "CCNP Implementing Secure VPN",    "Secure VPN solutions."),
        ("CCIE-SEC",   "CCIE Security",                   "Expert-level security."),
        ("CYBEROPS",   "Cisco CyberOps Associate",        "Cybersecurity operations."),
    ],
    "Automation & DevOps": [
        ("DEVASSOC",   "Cisco Certified DevNet Associate","Network automation foundations."),
        ("DEVPRO",     "Cisco Certified DevNet Pro",      "Advanced network programmability."),
        ("DEVEXPERT",  "Cisco Certified DevNet Expert",   "Expert-level automation."),
    ],
    "Soft Skills & Service": [
        ("HDI-SCA",    "HDI Support Center Analyst",      "Customer service & escalation."),
        ("PMP",        "Project Management Professional", "Project & incident leadership."),
        ("TOGAF",      "TOGAF 9 Foundation",              "Enterprise architecture."),
    ],
}


ENT  = ["LANSW","ARCH","CATC","RP","WRLS","SDWAN","SDA","OBSV"]
DC   = ["NEXUS","ACI","MDS","UCS","DCN","CLOUD"]
SEC  = ["FTD","ISE","SASE","SECMAIL","VPN","SECARCH"]
ALL_TECH = ENT + DC + SEC

NTECH_CODE = "NTECH-GEN"


SKILLS: list[tuple[str, str, str, list[str], list[str], str, list[str]]] = [

    ("OSI Model & Encapsulation",
     "Master the 7-layer OSI and TCP/IP encapsulation as the basis for protocol analysis on any platform.",
     "foundational", ALL_TECH, ["CCST","CCNA"], "route", ["fundamentals","protocols"]),

    ("IPv4 Subnetting & VLSM",
     "Calculate subnets, summaries, and VLSM ranges quickly for any deployment scenario.",
     "foundational", ALL_TECH, ["CCST","CCNA"], "route", ["ip","fundamentals"]),

    ("IPv6 Addressing & Neighbor Discovery",
     "Understand IPv6 address scopes, SLAAC, DHCPv6, and NDP across enterprise and DC fabrics.",
     "foundational", ALL_TECH, ["CCNA"], "route", ["ipv6","fundamentals"]),

    ("Packet Capture & Wireshark Analysis",
     "Capture, decode, and triage packet flows using SPAN, ERSPAN, EPC and Wireshark filters.",
     "foundational", ALL_TECH, ["CCNA"], "eye", ["troubleshooting","analysis"]),

    ("Cisco IOS / NX-OS CLI Survival",
     "Navigate IOS-XE and NX-OS shells, scope show commands, and use pipes for fast diagnosis.",
     "foundational", ALL_TECH, ["CCST","CCNA"], "code", ["cli","fundamentals"]),

    ("TAC Case Lifecycle & SR Hygiene",
     "Drive a Service Request from open to RCA: severity, attachments, status updates, escalations.",
     "foundational", ALL_TECH, ["ITIL4"], "users", ["process","tac"]),

    ("Customer Communication Essentials",
     "Run a customer call with clarity: scope the problem, state next steps, manage expectations.",
     "foundational", ALL_TECH, ["HDI-SCA","ITIL4"], "users", ["soft-skills","customer"]),

    ("Logging, Syslog & Time Sync",
     "Configure syslog, NTP/PTP, and correlate logs across multiple devices and timezones.",
     "foundational", ALL_TECH, ["CCNA"], "eye", ["logging","fundamentals"]),


    ("Catalyst 9000 Switching Operations",
     "Day-to-day operation and troubleshooting of Catalyst 9000 platforms: VLANs, trunks, EtherChannel.",
     "core", ["LANSW","CATC","SDA"], ["CCNP-ENCOR"], "route", ["switching","catalyst"]),

    ("OSPF Multi-Area Design & Troubleshooting",
     "Design OSPF areas, debug adjacency, LSA flooding, and SPF behaviour in enterprise networks.",
     "core", ["RP","LANSW","SDA"], ["CCNP-ENCOR","CCNP-ENARSI"], "route", ["ospf","routing"]),

    ("EIGRP Operations",
     "Operate EIGRP topology table, query/reply mechanics, stuck-in-active analysis.",
     "core", ["RP","LANSW"], ["CCNP-ENARSI"], "route", ["eigrp","routing"]),

    ("Catalyst 9800 WLC Day-to-Day Ops",
     "Provision Catalyst 9800 WLCs, AP join, RRM tuning, client onboarding.",
     "core", ["WRLS"], ["CCNP-ENWLSI"], "wifi", ["wireless","wlc"]),

    ("Cisco SD-WAN vEdge / cEdge Operations",
     "Day-to-day operation of SD-WAN overlays: vManage, vBond, vSmart, control & data plane.",
     "core", ["SDWAN"], ["CCNP-ENSDWI"], "fabric", ["sdwan","overlay"]),

    ("Catalyst Center (DNAC) Assurance",
     "Use Catalyst Center for assurance, telemetry, and guided remediation in enterprise fabrics.",
     "core", ["CATC","SDA","OBSV"], ["CCNP-ENCOR"], "eye", ["assurance","dnac"]),

    ("Nexus 9000 NX-OS Operations",
     "Operate Nexus 9000 fabrics: VPC, FEX, port-channel, breakout, OS upgrade.",
     "core", ["NEXUS","ACI"], ["CCNP-DCCOR"], "datacenter", ["nexus","nxos"]),

    ("UCS B/C-Series Day-to-Day",
     "Manage UCS Manager / Intersight: service profiles, firmware policies, KVM troubleshooting.",
     "core", ["UCS"], ["CCNP-DCUCI"], "datacenter", ["ucs","compute"]),

    ("MDS Fibre Channel Operations",
     "Operate MDS SANs: VSANs, zoning, FLOGI/FDISC, fabric health.",
     "core", ["MDS"], ["CCNP-DCCOR"], "datacenter", ["storage","fc"]),

    ("ACI Tenant & EPG Provisioning",
     "Day-to-day ACI configuration: tenants, BDs, EPGs, contracts, L3Out basics.",
     "core", ["ACI"], ["CCNP-DCACI"], "fabric", ["aci","fabric"]),

    ("ASA Firewall Policy & NAT",
     "Configure and troubleshoot ASA: ACLs, NAT, packet-tracer, capture-on-the-box.",
     "core", ["FTD"], ["CCNP-SCOR"], "shield-lock", ["asa","firewall"]),

    ("AnyConnect Remote-Access VPN",
     "Deploy AnyConnect headends, SSL/IPsec tunnels, certificate handling, posture basics.",
     "core", ["VPN","FTD"], ["CCNP-SVPN"], "lock", ["anyconnect","vpn"]),

    ("ISE Authentication & Authorization Policies",
     "Build ISE policy sets: dot1x, MAB, posture, TrustSec basics, AD integration.",
     "core", ["ISE"], ["CCNP-SISE"], "lock", ["ise","aaa"]),

    ("Umbrella & Secure Internet Gateway",
     "Configure Umbrella DNS-layer security, tunnels, identity, and content filtering.",
     "core", ["SASE","SECMAIL"], ["CCNP-SCOR"], "shield-lock", ["umbrella","sase"]),


    ("BGP Route-Reflector & Confederation Design",
     "Design and troubleshoot large-scale iBGP with RRs, confederations, and policy filtering.",
     "advanced", ["RP","SDWAN","DCN"], ["CCIE-EI"], "route", ["bgp","scale-design"]),

    ("MPLS L3VPN & Inter-AS Option A/B/C",
     "Run MPLS L3VPNs end-to-end including PE/CE handoff and inter-AS scenarios.",
     "advanced", ["RP","SDWAN"], ["CCIE-EI"], "route", ["mpls","l3vpn"]),

    ("Segment Routing (SR-MPLS / SRv6) Fundamentals",
     "Introduce SR-MPLS and SRv6 into existing IGP/BGP designs; TI-LFA and policy basics.",
     "advanced", ["RP","SDWAN"], ["CCIE-EI"], "route", ["sr","mpls"]),

    ("SD-Access Fabric Deep Dive",
     "Operate LISP/VXLAN/CTS underpinnings of SD-Access; fabric edge, border, and CP nodes.",
     "advanced", ["SDA","LANSW","WRLS"], ["CCIE-EI"], "fabric", ["sda","fabric"]),

    ("Catalyst 9800 Advanced Wireless Troubleshooting",
     "Wireless RF analysis, roaming, 11k/v/r, FRA, and embedded packet capture on 9800.",
     "advanced", ["WRLS"], ["CCNP-ENWLSI","CCIE-EI"], "wifi", ["wireless","rf"]),

    ("ACI Multi-Pod & Multi-Site",
     "Design and troubleshoot ACI Multi-Pod and Multi-Site Orchestrator deployments.",
     "advanced", ["ACI"], ["CCIE-DC"], "fabric", ["aci","multisite"]),

    ("VXLAN EVPN Fabrics on Nexus",
     "Operate VXLAN EVPN data center fabrics; type-2/type-5 routes, distributed gateway.",
     "advanced", ["NEXUS","DCN"], ["CCIE-DC"], "datacenter", ["vxlan","evpn"]),

    ("UCS Fabric Interconnect & Firmware Lifecycle",
     "Lead UCS FI upgrades, firmware staging, end-host vs switch mode, FEX uplink design.",
     "advanced", ["UCS"], ["CCIE-DC"], "datacenter", ["ucs","lifecycle"]),

    ("MDS NPV/NPIV & Inter-VSAN Routing",
     "Advanced MDS: NPV/NPIV, IVR, slow-drain detection, FCIP extension.",
     "advanced", ["MDS"], ["CCIE-DC"], "datacenter", ["fc","ivr"]),

    ("FTD Threat Tuning & Snort Rules",
     "Tune Snort/Talos rules, intrusion policies, and FMC dashboards for high-noise environments.",
     "advanced", ["FTD"], ["CCIE-SEC"], "shield-lock", ["ftd","ips"]),

    ("DMVPN Phase 3 & FlexVPN",
     "Design DMVPN Phase 3 and FlexVPN with IKEv2, profiles, and dynamic routing.",
     "advanced", ["VPN","RP"], ["CCIE-SEC","CCNP-SVPN"], "lock", ["dmvpn","flexvpn"]),

    ("Zero Trust & Microsegmentation",
     "Apply Zero Trust principles using ISE, TrustSec, SDA, and policy enforcement at the edge.",
     "advanced", ["ISE","FTD","SDA"], ["CCIE-SEC"], "shield-lock", ["zero-trust","segmentation"]),

    ("ISE & TrustSec at Scale",
     "Run TrustSec SGT/SGACL at scale; policy matrix, propagation, troubleshooting drops.",
     "advanced", ["ISE","SDA"], ["CCIE-SEC"], "lock", ["trustsec","scale"]),

    ("SASE Architecture & Secure Service Edge",
     "Design SASE architectures: Umbrella, Secure Connect, ZTNA, CASB, SD-WAN integration.",
     "advanced", ["SASE","SDWAN","SECARCH"], ["CCIE-SEC"], "shield-lock", ["sase","sse"]),

    ("Cloud Networking on AWS / Azure with Cisco",
     "Extend Cisco overlays into AWS/Azure (Cloud OnRamp, CSR1000v/Cat 8000v, vMX peering).",
     "advanced", ["CLOUD","SDWAN"], ["CCIE-EI"], "datacenter", ["cloud","overlay"]),


    ("LLM-Assisted Log Triage",
     "Use LLM assistants to summarise syslog, debug, and show-tech bundles into actionable findings.",
     "ai_future", ALL_TECH, [], "sparkles", ["ai","triage"]),

    ("Python & pyATS Network Automation",
     "Write pyATS / Genie test suites and Python scripts to automate diagnostics and config audits.",
     "ai_future", ALL_TECH, ["DEVASSOC","DEVPRO"], "sparkles", ["automation","python"]),

    ("Ansible & Terraform for Cisco Infrastructure",
     "Use Ansible and Terraform providers to declaratively manage Catalyst, ACI, and cloud edges.",
     "ai_future", ["LANSW","ACI","CLOUD","SDWAN"], ["DEVPRO"], "sparkles", ["iac","automation"]),

    ("Model-Driven Telemetry & gNMI",
     "Stream model-driven telemetry over gRPC/gNMI into TSDBs for proactive monitoring.",
     "ai_future", ["NEXUS","CATC","SDA","OBSV"], ["DEVPRO"], "sparkles", ["telemetry","gnmi"]),

    ("ThousandEyes + Splunk AIOps",
     "Combine ThousandEyes and Splunk to deliver AIOps-style proactive incident detection.",
     "ai_future", ALL_TECH, [], "sparkles", ["aiops","observability"]),

    ("DNAC Predictive Wireless Insights",
     "Use Catalyst Center machine-learning insights to forecast wireless degradation.",
     "ai_future", ["CATC","WRLS"], [], "sparkles", ["ai","wireless"]),

    ("Webex AI Assistant for TAC Workflows",
     "Embed Webex AI into TAC workflows: summarisation, ChatOps bridges, knowledge retrieval.",
     "ai_future", ALL_TECH, [], "sparkles", ["ai","chatops"]),

    ("Generative AI Guardrails for Operations",
     "Apply prompt-injection defences, data-loss prevention, and audit trails when using GenAI in ops.",
     "ai_future", ALL_TECH, ["CYBEROPS"], "sparkles", ["ai","security"]),


    ("Active Listening & Empathy",
     "Listen for the customer's true concern, paraphrase, and confirm before acting.",
     "foundational", [NTECH_CODE], ["HDI-SCA"], "users", ["soft-skills","communication"]),

    ("Technical Writing for SRs",
     "Write clear, structured Service-Request updates and RCAs that internal and external readers understand.",
     "foundational", [NTECH_CODE], ["ITIL4"], "users", ["writing","communication"]),

    ("Time Management & Triage",
     "Prioritise multiple concurrent SRs against severity, SLA, and team load.",
     "foundational", [NTECH_CODE], ["ITIL4","HDI-SCA"], "users", ["productivity","triage"]),

    ("Conflict De-escalation",
     "Defuse heated customer or cross-team conflicts using structured de-escalation techniques.",
     "core", [NTECH_CODE], ["HDI-SCA"], "users", ["soft-skills","escalation"]),

    ("Cross-Team Collaboration & Handoffs",
     "Run clean handoffs between shifts and BUs; document state so the next engineer can resume.",
     "core", [NTECH_CODE], ["ITIL4"], "users", ["collaboration","handoff"]),

    ("Mentoring Junior Engineers",
     "Coach new hires on TAC processes, debugging methodology, and customer comms.",
     "advanced", [NTECH_CODE], ["PMP"], "users", ["mentoring","leadership"]),

    ("Incident Leadership on Major Outages",
     "Lead bridge calls during P1 incidents: scope impact, drive workstreams, communicate to execs.",
     "advanced", [NTECH_CODE], ["PMP","ITIL4"], "users", ["incident","leadership"]),
]


def _content_rows(skill_name: str):
    """Generate 18 SkillLevelContent rows for a skill: 6 Education + 6 Exposure + 6 Experience."""
    short = skill_name
    return [
        dict(level=1, type=SkillLevelContentType.course,
             title=f"Cisco U. course: {short} essentials",
             description=f"Complete the Cisco U. learning path covering the essentials of {short}.",
             url="https://u.cisco.com/", position=0),
        dict(level=1, type=SkillLevelContentType.course,
             title=f"DevNet learning lab: {short}",
             description=f"Run the DevNet learning lab for {short} to anchor concepts in practice.",
             url="https://developer.cisco.com/learning/", position=1),
        dict(level=1, type=SkillLevelContentType.reading,
             title=f"Configuration guide: {short}",
             description=f"Read the latest Cisco configuration guide for {short} end to end.",
             url="https://www.cisco.com/c/en/us/support/", position=2),
        dict(level=1, type=SkillLevelContentType.reading,
             title=f"Design guide / CVD: {short}",
             description=f"Study the Cisco Validated Design or design guide associated with {short}.",
             url="https://www.cisco.com/c/en/us/solutions/design-zone.html", position=3),
        dict(level=1, type=SkillLevelContentType.reading,
             title=f"TechZone articles on {short}",
             description=f"Curate 3 TechZone or Cisco Community articles deep-diving into {short}.",
             url="https://techzone.cisco.com/", position=4),
        dict(level=1, type=SkillLevelContentType.link,
             title=f"Reference RFCs / standards for {short}",
             description=f"Skim the relevant IETF RFCs or vendor standards that underpin {short}.",
             url="https://www.rfc-editor.org/", position=5),

        dict(level=2, type=SkillLevelContentType.action,
             title=f"Shadow senior engineer on {short} SRs",
             description=f"Sit in on at least 3 customer SRs involving {short}; observe debug strategy.",
             url=None, position=0),
        dict(level=2, type=SkillLevelContentType.link,
             title=f"dCloud lab walkthrough: {short}",
             description=f"Run a guided dCloud lab reproducing common {short} scenarios.",
             url="https://dcloud.cisco.com/", position=1),
        dict(level=2, type=SkillLevelContentType.link,
             title=f"CML / VIRL sandbox: {short}",
             description=f"Build a personal CML topology to experiment with {short} features.",
             url="https://learningnetwork.cisco.com/s/cml", position=2),
        dict(level=2, type=SkillLevelContentType.action,
             title=f"Review 5 historical SRs on {short}",
             description=f"Read 5 closed SRs touching {short} and write a one-page lessons-learned note.",
             url=None, position=3),
        dict(level=2, type=SkillLevelContentType.action,
             title=f"Attend internal knowledge session on {short}",
             description=f"Join or replay an internal TAC knowledge-session covering {short}.",
             url=None, position=4),
        dict(level=2, type=SkillLevelContentType.action,
             title=f"Reproduce a known bug related to {short}",
             description=f"Pick a CDETS / field notice on {short} and reproduce it in a lab.",
             url=None, position=5),

        dict(level=3, type=SkillLevelContentType.action,
             title=f"Own 5 customer SRs end-to-end on {short}",
             description=f"Drive ≥5 customer SRs covering {short} from open to RCA without escalation.",
             url=None, position=0),
        dict(level=3, type=SkillLevelContentType.action,
             title=f"Author RCA for a major {short} incident",
             description=f"Produce a written RCA for a P1/P2 incident where {short} was the root cause.",
             url=None, position=1),
        dict(level=3, type=SkillLevelContentType.action,
             title=f"Run internal training on {short}",
             description=f"Prepare and deliver a 60-minute TAC training session on {short}.",
             url=None, position=2),
        dict(level=3, type=SkillLevelContentType.action,
             title=f"Mentor a junior engineer through a {short} case",
             description=f"Pair with a junior engineer end-to-end on a customer SR involving {short}.",
             url=None, position=3),
        dict(level=3, type=SkillLevelContentType.action,
             title=f"File CDETS or doc fix for {short}",
             description=f"Identify and submit a defect (CDETS) or documentation correction tied to {short}.",
             url=None, position=4),
        dict(level=3, type=SkillLevelContentType.certification,
             title=f"Earn a certification covering {short}",
             description=f"Pass a Cisco or industry certification whose blueprint includes {short}.",
             url="https://learningnetwork.cisco.com/s/certifications", position=5),
    ]


# LANSW SHIFT2 OVERLAY — replaces LANSW-mapped skills, seeds alice (mgr) + bob
# + 5 engineers on TAC-ENT-LANSW-SHIFT2, and builds full development plans with
# 3E completions, proficiency, and timestamped training logs.

# 18 LANSW Shift-2 skills: 5 Foundational + 7 Core + 6 Advanced (strict 1:1).
# Tuple shape: (name, description, category_slug, cert_codes, icon, tags)
LANSW_SHIFT2_SKILLS: list[tuple[str, str, str, list[str], str, list[str]]] = [
    # Foundational
    ("Layer 2 Switching Fundamentals",
     "Frame forwarding, MAC tables, broadcast domains, ARP behavior, and switch operating principles.",
     "foundational", ["CCNA"], "lan",
     ["l2", "mac-table", "arp", "fundamentals"]),
    ("VLANs, Trunking & VTP",
     "802.1Q tagging, native VLAN, allowed-VLAN lists, DTP negotiation, and VTPv2/v3 domain hygiene.",
     "foundational", ["CCNA"], "lan",
     ["vlan", "trunk", "dot1q", "vtp"]),
    ("Spanning Tree: STP, RSTP & MST",
     "Root bridge election, port states, BPDU guard/root-guard, MST regions, and convergence tuning.",
     "foundational", ["CCNA"], "lan",
     ["spanning-tree", "rstp", "mst", "convergence"]),
    ("EtherChannel & Port-Channel Bundling",
     "LACP/PAgP negotiation, load-balance hashing, mismatch troubleshooting, and member-link diagnostics.",
     "foundational", ["CCNA"], "lan",
     ["etherchannel", "lacp", "port-channel"]),
    ("Catalyst CLI Survival & show-tech Hygiene",
     "IOS-XE CLI navigation, archive logging, EEM basics, and structured show-tech collection for TAC.",
     "foundational", ["CCNA"], "lan",
     ["ios-xe", "cli", "show-tech", "eem"]),

    # ── Core (7) ──
    ("Layer 3 on Switches: SVIs, Routed Ports & FHRPs",
     "Inter-VLAN routing, SVI design, routed uplinks, and HSRP/VRRP/GLBP first-hop redundancy tuning.",
     "core", ["CCNP-ENCOR"], "route",
     ["svi", "hsrp", "vrrp", "fhrp", "layer3"]),
    ("QoS on Catalyst Platforms",
     "MQC, trust boundaries, classification/marking, queuing/shaping, and platform-specific QoS pitfalls.",
     "core", ["CCNP-ENCOR"], "gauge",
     ["qos", "mqc", "queuing", "marking"]),
    ("IP Multicast on Switched Networks",
     "IGMP snooping, querier placement, PIM sparse-mode interop, MRIB/MFIB on Catalyst.",
     "core", ["CCNP-ENCOR"], "broadcast",
     ["multicast", "igmp-snooping", "pim"]),
    ("StackWise, StackWise-Virtual & Modular HA",
     "Stack election, SVL configuration, dual-active detection, supervisor RPR/SSO, and ISSU prerequisites.",
     "core", ["CCNP-ENCOR"], "layers",
     ["stackwise", "svl", "ha", "sso"]),
    ("Catalyst 9000 Platform Architecture",
     "C9200/9300/9500/9600 hardware, UADP vs Silicon One, line-rate forwarding, and feature licensing.",
     "core", ["CCNP-ENCOR"], "chip",
     ["catalyst-9000", "uadp", "silicon-one", "hardware"]),
    ("FED, Punt Path & Control-Plane Policing",
     "Forwarding Engine Driver tables, CPU punt reasons, CoPP profiles, and ‘show platform software fed’ flows.",
     "core", ["CCNP-ENCOR"], "shield-check",
     ["fed", "punt", "copp", "control-plane"]),
    ("Switching Control-Plane Debugging",
     "Methodical debugs for STP topology changes, EtherChannel flaps, FHRP state churn, and MAC instability.",
     "core", ["CCNP-ENCOR"], "wrench",
     ["debug", "troubleshooting", "control-plane"]),

    # ── Advanced (6) ──
    ("SD-Access Fabric Edge & Border on Catalyst",
     "LISP control-plane, VXLAN data-plane, fabric edge onboarding, border handoff, and SDA assurance.",
     "advanced", ["CCIE-EI"], "fabric",
     ["sda", "lisp", "vxlan", "fabric"]),
    ("EVPN/VXLAN on Catalyst 9k",
     "BGP EVPN address families, type-2/type-5 routes, anycast gateway, and dual-fabric integration.",
     "advanced", ["CCIE-EI"], "fabric",
     ["evpn", "vxlan", "bgp", "anycast-gateway"]),
    ("Catalyst-to-ACI / Nexus Interop",
     "L2/L3 handoff design, MTU and DSCP transparency, vPC peering boundaries, and tenant routing handoffs.",
     "advanced", ["CCIE-EI"], "datacenter",
     ["aci", "nexus", "interop", "handoff"]),
    ("Silicon One & Doppler ASIC Deep-Dive",
     "Pipeline structure, TCAM/SRAM partitioning, micro-engine debug, and ASIC-side packet tracing.",
     "advanced", ["CCIE-EI"], "chip",
     ["silicon-one", "doppler", "asic", "tcam"]),
    ("Industrial Ethernet (IE3K/IE9K) & PRP/HSR",
     "Ruggedized switching, PROFINET/CIP awareness, PRP/HSR ring redundancy, and time-sensitive networking.",
     "advanced", ["CCIE-EI"], "factory",
     ["ie3k", "ie9k", "prp", "hsr", "tsn"]),
    ("ISSU, GIR & In-Service Upgrades",
     "Graceful Insertion/Removal, ISSU compatibility matrix, rollback strategy, and chassis upgrade choreography.",
     "advanced", ["CCIE-EI"], "refresh",
     ["issu", "gir", "upgrade", "ha"]),
]

LANSW_SHIFT2_USERS = [
    # (first, last, email, role_value)
    ("Alice",   "Aalto",      "alice@matrixpro.com",   "manager"),
    ("Bob",     "Brennan",    "bob@matrixpro.com",     "engineer"),
    ("Caden",   "Costa",      "caden@matrixpro.com",   "engineer"),
    ("Daniela", "Dimitrov",   "daniela@matrixpro.com", "engineer"),
    ("Ethan",   "Eriksen",    "ethan@matrixpro.com",   "engineer"),
    ("Fiona",   "Fontaine",   "fiona@matrixpro.com",   "engineer"),
    ("Grace",   "Ghosh",      "grace@matrixpro.com",   "engineer"),
]


LANSW_ENGINEER_PERSONAS: dict[str, dict] = {
    "bob@matrixpro.com": {
        "name": "Bob",
        "specialization": "lab automation & repro engineer",
        "tone": "lab-first",
        "experience": "mid-senior",
        "interests": ["CML", "pyATS", "regression labs", "Genie parsers"],
    },
    "caden@matrixpro.com": {
        "name": "Caden",
        "specialization": "customer-facing escalation engineer & mentor",
        "tone": "customer-first",
        "experience": "senior",
        "interests": ["customer comms", "mentoring", "case studies", "TAC playbooks"],
    },
    "daniela@matrixpro.com": {
        "name": "Daniela",
        "specialization": "deep-dive packet-level troubleshooter",
        "tone": "forensic",
        "experience": "senior",
        "interests": ["EPC", "ELAM", "wireshark", "ASIC internals"],
    },
    "ethan@matrixpro.com": {
        "name": "Ethan",
        "specialization": "documentation & RCA writer",
        "tone": "writer",
        "experience": "mid",
        "interests": ["RCAs", "runbooks", "KB articles", "post-mortems"],
    },
    "fiona@matrixpro.com": {
        "name": "Fiona",
        "specialization": "AI/automation & innovation engineer",
        "tone": "innovator",
        "experience": "mid-senior",
        "interests": ["LLM triage", "telemetry", "gNMI", "ChatOps", "AIOps"],
    },
    "grace@matrixpro.com": {
        "name": "Grace",
        "specialization": "junior engineer ramping on fundamentals",
        "tone": "learner",
        "experience": "junior",
        "interests": ["CCNA prep", "fundamentals", "shadowing seniors", "study groups"],
    },
}


_PERSONAL_VERB_BY_LEVEL = {
    1: ["read", "review", "study", "annotate", "summarize"],
    2: ["shadow", "pair-troubleshoot", "observe", "co-pilot"],
    3: ["own", "drive", "deliver", "automate", "mentor on"],
}


def _personal_items_for(
    skill_name: str,
    persona: dict,
    level: int,
    rng,
) -> list[tuple]:
    """Return 1-2 personalized 3E items for (skill, persona, level).

    Each item: (content_type, title, description, url_or_None).
    Generated from persona×skill templates so items are unique per engineer
    and never overlap the global catalog content.
    """
    pname = persona["name"]
    spec = persona["specialization"]
    tone = persona["tone"]
    interests = persona["interests"]

    short_skill = skill_name.split(":")[0].split("(")[0].strip()

    pool: list[tuple] = []

    if level == 1:
        if tone == "lab-first":
            pool += [
                (SkillLevelContentType.reading,
                 f"{pname}'s lab notebook — {short_skill} repro recipes",
                 f"Personal markdown notebook capturing minimal CML topologies, "
                 f"reload-safe configs, and known-good baselines for {short_skill}. "
                 f"Maintained by {pname} and reviewed quarterly.",
                 None),
                (SkillLevelContentType.course,
                 f"Deep-read: vendor errata & field notices touching {short_skill}",
                 f"Quarterly sweep of Cisco field notices, PSIRTs, and bug-search "
                 f"hits relevant to {short_skill}. Bob curates a one-pager summary "
                 f"per quarter.",
                 "https://bst.cisco.com/"),
            ]
        elif tone == "customer-first":
            pool += [
                (SkillLevelContentType.reading,
                 f"Customer-language glossary for {short_skill}",
                 f"Caden's personal glossary translating {short_skill} engineering "
                 f"jargon into customer-friendly explanations. Used on every SR "
                 f"opening update.",
                 None),
                (SkillLevelContentType.course,
                 f"Selected SR case studies — {short_skill}",
                 f"Curated set of 5 anonymized SR transcripts demonstrating "
                 f"effective communication during {short_skill} incidents. "
                 f"Caden adds 1 case per month.",
                 None),
            ]
        elif tone == "forensic":
            pool += [
                (SkillLevelContentType.reading,
                 f"ASIC/forwarding internals deep-read for {short_skill}",
                 f"Daniela's reading list: design guides, white papers, and "
                 f"internal engineering decks covering the data-plane behaviour "
                 f"of {short_skill}. Updated whenever a new ASIC ships.",
                 None),
                (SkillLevelContentType.course,
                 f"Wireshark dissector study — {short_skill}",
                 f"Personal study of the protocol fields exercised by "
                 f"{short_skill}, including hand-crafted .pcap samples Daniela "
                 f"uses to verify dissector behaviour.",
                 "https://wiki.wireshark.org/"),
            ]
        elif tone == "writer":
            pool += [
                (SkillLevelContentType.reading,
                 f"Ethan's RCA template library — {short_skill}",
                 f"Reusable RCA outline tailored to {short_skill} incidents: "
                 f"timeline, contributing factors, customer impact, and "
                 f"corrective actions. Versioned in a personal git repo.",
                 None),
                (SkillLevelContentType.course,
                 f"Annotated KB article catalog for {short_skill}",
                 f"Personal index of the 10 most-referenced KB articles for "
                 f"{short_skill}, with Ethan's notes on accuracy, gaps, and "
                 f"rewrite candidates.",
                 None),
            ]
        elif tone == "innovator":
            pool += [
                (SkillLevelContentType.reading,
                 f"AI-assisted triage research for {short_skill}",
                 f"Fiona's curated arXiv + Cisco Research reading list on "
                 f"applying LLMs and ML to {short_skill} triage. Refreshed "
                 f"monthly with new papers.",
                 None),
                (SkillLevelContentType.course,
                 f"Telemetry schema study — {short_skill}",
                 f"Personal deep-read of YANG models, gNMI paths, and "
                 f"streaming-telemetry counters relevant to {short_skill}.",
                 "https://github.com/YangModels/yang"),
            ]
        else:  # learner / grace
            pool += [
                (SkillLevelContentType.reading,
                 f"Grace's flashcards — {short_skill} fundamentals",
                 f"Anki deck Grace builds while studying {short_skill}. Covers "
                 f"protocol fields, packet formats, and command syntax. "
                 f"Reviewed daily.",
                 None),
                (SkillLevelContentType.course,
                 f"Self-paced CCNA mapping for {short_skill}",
                 f"Grace's notes mapping each {short_skill} concept to the "
                 f"corresponding CCNA exam objective and Cisco U. module.",
                 "https://u.cisco.com/"),
            ]

    elif level == 2:
        if tone == "lab-first":
            pool += [
                (SkillLevelContentType.action,
                 f"Build a CML sandbox reproducing the top-3 {short_skill} "
                 f"customer issues",
                 f"Bob maintains a CML lab that reproduces the three most "
                 f"frequent {short_skill} SR patterns. Used as a regression "
                 f"bench when new IOS-XE trains drop.",
                 None),
                (SkillLevelContentType.action,
                 f"Pair-troubleshoot {short_skill} SR with senior — record session",
                 f"Bob shadows a Principal on a live {short_skill} escalation, "
                 f"records the screen-share, and produces a 1-page lessons-learned "
                 f"writeup.",
                 None),
            ]
        elif tone == "customer-first":
            pool += [
                (SkillLevelContentType.action,
                 f"Co-pilot 3 customer calls focused on {short_skill}",
                 f"Caden joins three customer bridges where {short_skill} is the "
                 f"primary topic, takes notes, and writes a post-call summary "
                 f"sent to the SR.",
                 None),
                (SkillLevelContentType.action,
                 f"Mentor a junior engineer through a {short_skill} SR",
                 f"Caden picks a sev-3 {short_skill} case for a junior to drive, "
                 f"observes the work, and provides written feedback after closure.",
                 None),
            ]
        elif tone == "forensic":
            pool += [
                (SkillLevelContentType.action,
                 f"Capture & dissect a live {short_skill} flow on a lab switch",
                 f"Daniela uses EPC + ELAM (or platform equivalent) to capture "
                 f"a representative {short_skill} flow, then annotates the "
                 f"resulting pcap with field-by-field explanations.",
                 None),
                (SkillLevelContentType.action,
                 f"Replay a closed {short_skill} SR in the lab and validate the RCA",
                 "Daniela picks a recently-closed escalation, rebuilds the topology, "
                 "and verifies the documented RCA against live forwarding-plane "
                 "evidence.",
                 None),
            ]
        elif tone == "writer":
            pool += [
                (SkillLevelContentType.action,
                 f"Shadow a {short_skill} escalation and draft a customer-facing summary",
                 f"Ethan observes a senior on a {short_skill} escalation and writes "
                 f"a customer-ready summary (problem, evidence, action plan) within "
                 f"24h of closure.",
                 None),
                (SkillLevelContentType.action,
                 f"Pair with TME to validate a draft {short_skill} runbook",
                 f"Ethan walks a TME through a draft runbook for {short_skill}, "
                 f"captures their corrections, and republishes within the week.",
                 None),
            ]
        elif tone == "innovator":
            pool += [
                (SkillLevelContentType.action,
                 f"Wire LLM-assisted log triage into a {short_skill} lab pipeline",
                 f"Fiona pipes captured {short_skill} debug bundles through an "
                 f"internal LLM-assisted summarizer and compares the output to a "
                 f"human-written summary.",
                 None),
                (SkillLevelContentType.action,
                 f"Prototype a gNMI dashboard for {short_skill} health",
                 f"Fiona builds a small Grafana board fed by gNMI streaming "
                 f"telemetry covering the key {short_skill} counters.",
                 None),
            ]
        else:  # learner / grace
            pool += [
                (SkillLevelContentType.action,
                 f"Shadow 2 SRs touching {short_skill} with a senior engineer",
                 f"Grace joins as silent observer on two {short_skill} SRs, "
                 f"takes structured notes, and reviews them with her mentor.",
                 None),
                (SkillLevelContentType.action,
                 f"Walk through {short_skill} packet captures in a study group",
                 f"Grace presents a curated {short_skill} pcap to the Shift-2 "
                 f"study group and answers questions on the protocol behaviour.",
                 None),
            ]

    else:  # level == 3 (Experience)
        if tone == "lab-first":
            pool += [
                (SkillLevelContentType.action,
                 f"Automate a {short_skill} regression suite in pyATS",
                 f"Bob writes a pyATS / Genie test suite that exercises the "
                 f"baseline {short_skill} behaviour on every IOS-XE rebuild and "
                 f"posts results to ChatOps.",
                 None),
                (SkillLevelContentType.action,
                 f"Publish a {short_skill} lab guide for the Shift-2 team",
                 f"Bob writes and publishes a step-by-step lab guide (CML topology "
                 f"+ configs + verification) for {short_skill} on the internal wiki.",
                 None),
            ]
        elif tone == "customer-first":
            pool += [
                (SkillLevelContentType.action,
                 f"Own ≥3 high-touch {short_skill} escalations end-to-end",
                 f"Caden takes lead on at least three customer escalations where "
                 f"{short_skill} is the root cause, including bridge facilitation, "
                 f"RCA, and closure communication.",
                 None),
                (SkillLevelContentType.action,
                 f"Deliver an internal brown-bag on {short_skill} comms patterns",
                 f"Caden presents to the Shift-2 team the recurring comms patterns "
                 f"he sees in {short_skill} escalations and the language that works.",
                 None),
            ]
        elif tone == "forensic":
            pool += [
                (SkillLevelContentType.action,
                 f"Drive a forwarding-plane RCA for a complex {short_skill} bug",
                 f"Daniela leads the data-plane investigation on a difficult "
                 f"{short_skill} defect, coordinating with BU / TME, and authors "
                 f"the technical RCA.",
                 None),
                (SkillLevelContentType.action,
                 f"Build a {short_skill} packet-walk training module",
                 f"Daniela produces a recorded walkthrough of a representative "
                 f"{short_skill} packet flow at the ASIC level for newer engineers.",
                 None),
            ]
        elif tone == "writer":
            pool += [
                (SkillLevelContentType.action,
                 f"Publish 2 KB articles covering common {short_skill} pitfalls",
                 f"Ethan authors two KB articles documenting the most common "
                 f"misconfigurations or pitfalls he has observed for {short_skill}, "
                 f"reviewed by a Principal before publish.",
                 None),
                (SkillLevelContentType.action,
                 f"Write the canonical {short_skill} TAC runbook for Shift-2",
                 f"Ethan writes the team-wide runbook for handling {short_skill} "
                 f"escalations on Shift-2, from triage to closure.",
                 None),
            ]
        elif tone == "innovator":
            pool += [
                (SkillLevelContentType.action,
                 f"Ship an AIOps prototype for {short_skill} anomaly detection",
                 f"Fiona ships an internal prototype that ingests {short_skill} "
                 f"telemetry and flags anomalies against a learned baseline. "
                 f"Demoed at a quarterly innovation review.",
                 None),
                (SkillLevelContentType.action,
                 f"Drive a ChatOps integration for {short_skill} alerts",
                 f"Fiona integrates {short_skill} alerts from a lab fabric into "
                 f"a Webex space with auto-summarisation and on-call routing.",
                 None),
            ]
        else:  # learner / grace
            pool += [
                (SkillLevelContentType.action,
                 f"Own a sev-3 {short_skill} SR end-to-end with mentor review",
                 f"Grace drives a sev-3 {short_skill} case from triage to closure "
                 f"with a mentor reviewing every customer-facing update.",
                 None),
                (SkillLevelContentType.action,
                 f"Document her first {short_skill} RCA with mentor sign-off",
                 f"Grace writes a structured RCA for her first owned {short_skill} "
                 f"case and gets it signed off by Alice before sending to the customer.",
                 None),
            ]

    persona_interest_blurb = rng.choice(interests)
    augmented = []
    for ctype, title, desc, url in pool:
        if persona_interest_blurb.lower() not in desc.lower():
            desc = f"{desc} Aligns with {pname}'s focus on {persona_interest_blurb}."
        augmented.append((ctype, title, desc, url))

    rng.shuffle(augmented)
    return augmented[: rng.randint(1, 2)]


def _seed_lansw_shift2(db) -> None:
    """Overlay LANSW Shift-2: replaces LANSW-team skills, seeds team + plans."""
    import random
    from collections import Counter

    rng = random.Random(20260524)  # deterministic but realistic-looking
    now = datetime.now(timezone.utc)

    # 1) Resolve LANSW teams (all 4 shifts)
    lansw_teams = (
        db.query(Team)
        .filter(Team.name.like("TAC-ENT-LANSW-SHIFT%"))
        .all()
    )
    lansw_team_ids = {t.shift: t.id for t in lansw_teams}
    if 2 not in lansw_team_ids:
        raise RuntimeError("TAC-ENT-LANSW-SHIFT2 not found — base seed missing?")
    shift2_id = lansw_team_ids[2]

    # 2) Detach overlapping skills from ALL LANSW teams (replace, not merge)
    overlap_q = (
        db.query(SkillTeam)
        .filter(SkillTeam.team_id.in_(list(lansw_team_ids.values())))
    )
    detached = overlap_q.delete(synchronize_session=False)
    db.flush()
    print(f"  LANSW overlay: detached {detached} existing SkillTeam links")

    # 3) Resolve categories + cert lookup
    cats = {c.slug: c for c in db.query(SkillCategory).all()}
    cert_objs = {
        c.name: c for c in db.query(Certificate).all()
    }
    # cert codes used in LANSW defs map by canonical name fragment
    cert_code_to_name = {
        "CCNA":         "Cisco Certified Network Associate",
        "CCNP-ENCOR":   "CCNP Enterprise Core",
        "CCIE-EI":      "CCIE Enterprise Infrastructure",
    }

    tag_cache: dict[str, Tag] = {t.name: t for t in db.query(Tag).all()}

    def get_tag(name: str) -> Tag:
        if name not in tag_cache:
            t = Tag(name=name)
            db.add(t)
            db.flush()
            tag_cache[name] = t
        return tag_cache[name]

    # 4) Create the 18 LANSW skills and bind to all 4 LANSW shifts
    created_skills: list[Skill] = []
    for name, desc, cat_slug, cert_codes, icon, tags in LANSW_SHIFT2_SKILLS:
        skill = Skill(name=name, description=desc, icon=icon)
        db.add(skill)
        db.flush()
        created_skills.append(skill)

        db.add(SkillCategoryAssignment(
            skill_id=skill.id, category_id=cats[cat_slug].id
        ))

        # bind to ALL LANSW shifts so cross-shift catalog stays consistent
        for tid in lansw_team_ids.values():
            db.add(SkillTeam(skill_id=skill.id, team_id=tid))

        for code in cert_codes:
            cname = cert_code_to_name.get(code)
            if cname and cname in cert_objs:
                db.add(SkillCertificate(
                    skill_id=skill.id, certificate_id=cert_objs[cname].id
                ))

        for tagname in tags:
            db.add(SkillTag(skill_id=skill.id, tag_id=get_tag(tagname).id))

        for row in _content_rows(name):
            db.add(SkillLevelContent(skill_id=skill.id, **row))
    db.flush()
    print(f"  LANSW overlay: created {len(created_skills)} new skills "
          f"(F={sum(1 for s in LANSW_SHIFT2_SKILLS if s[2]=='foundational')}, "
          f"C={sum(1 for s in LANSW_SHIFT2_SKILLS if s[2]=='core')}, "
          f"A={sum(1 for s in LANSW_SHIFT2_SKILLS if s[2]=='advanced')})")

    # 5) Seed users on SHIFT2 (alice = manager, others = engineers reporting to her)
    pwd = hash_password("password123")
    role_map = {"manager": UserRole.manager, "engineer": UserRole.engineer}
    user_objs: dict[str, User] = {}
    manager_user: User | None = None
    for idx, (first, last, email, role_str) in enumerate(LANSW_SHIFT2_USERS):
        u = User(
            name=first, surname=last, email=email,
            password_hash=pwd,
            role=role_map[role_str],
            team_id=shift2_id,
            avatar=pick_avatar(idx + 1),
        )
        db.add(u)
        db.flush()
        user_objs[email] = u
        if role_str == "manager":
            manager_user = u
    if manager_user is None:
        raise RuntimeError("LANSW overlay: no manager defined")
    for u in user_objs.values():
        if u.role == UserRole.engineer:
            u.manager_id = manager_user.id
    db.flush()
    print(f"  LANSW overlay: seeded {len(user_objs)} users on SHIFT2 "
          f"(1 mgr + {sum(1 for u in user_objs.values() if u.role == UserRole.engineer)} eng)")

    # 6) Build plans for each engineer: all 18 skills, weighted-random status
    # Weights: mastered 30 / developing 50 / planned 10 / random-rebalanced 10
    # → effective: ~35% mastered / ~55% developing / ~10% planned
    statuses_weighted = (
        [PlanSkillStatus.mastered] * 30 +
        [PlanSkillStatus.developing] * 50 +
        [PlanSkillStatus.planned] * 10 +
        rng.choices(
            [PlanSkillStatus.mastered, PlanSkillStatus.developing, PlanSkillStatus.planned],
            weights=[3, 5, 2], k=10,
        )
    )

    engineers = [u for u in user_objs.values() if u.role == UserRole.engineer]
    plan_summary: list[tuple[str, dict]] = []

    for eng in engineers:
        plan = DevelopmentPlan(engineer_id=eng.id)
        db.add(plan)
        db.flush()

        status_counter: Counter = Counter()
        for skill in created_skills:
            status = rng.choice(statuses_weighted)
            status_counter[status.value] += 1

            ps = PlanSkill(
                plan_id=plan.id,
                skill_id=skill.id,
                status=status,
                proficiency_level=None,
                skill_version_at_add=1,
            )
            db.add(ps)
            db.flush()

            # Fetch the 18 content rows for this skill, grouped by level
            content_rows = (
                db.query(SkillLevelContent)
                .filter(SkillLevelContent.skill_id == skill.id)
                .order_by(SkillLevelContent.level, SkillLevelContent.position)
                .all()
            )
            edu  = [c for c in content_rows if c.level == 1]  # Education
            exp  = [c for c in content_rows if c.level == 2]  # Exposure
            expr = [c for c in content_rows if c.level == 3]  # Experience

            if status == PlanSkillStatus.mastered:
                # Mark all 18 3E items completed; proficiency = 5 (fully mastered)
                ps.proficiency_level = 5
                # one completion timestamp per content, spread across last 12 months
                for c in content_rows:
                    days_ago = rng.randint(7, 365)
                    db.add(UserContentCompletion(
                        user_id=eng.id,
                        plan_skill_id=ps.id,
                        content_id=c.id,
                        completed=True,
                        completed_at=now - timedelta(days=days_ago),
                    ))
                # Training log: mastery milestone
                db.add(PlanSkillTrainingLog(
                    plan_skill_id=ps.id,
                    title=f"Mastered {skill.name}",
                    type=SkillLevelContentType.action,
                    completed_at=now - timedelta(days=rng.randint(1, 60)),
                    notes=(
                        f"Completed full 3E path for {skill.name}: 6 education modules, "
                        f"6 exposure exercises, 6 experience deliverables. Owned ≥5 customer "
                        f"SRs end-to-end and authored RCA documentation."
                    ),
                ))

            elif status == PlanSkillStatus.developing:
                # Developing: pick proficiency from {2, 3, 4, 5}
                #   2 = Education only         → complete Education subset
                #   3 = Education + early Exposure
                #   4 = Education + most Exposure
                #   5 = Education + Exposure complete, partway through Experience
                #   (Spec: Education=2, Experience=3 or 4, Exposure=5 — interpreted as
                #    "in this stage" depth markers)
                prof = rng.choice([2, 3, 4, 5])
                ps.proficiency_level = prof

                # Education: always partially-to-fully complete for any developing
                edu_done = rng.sample(edu, k=rng.randint(3, 6))
                exp_done: list[SkillLevelContent] = []
                expr_done: list[SkillLevelContent] = []

                if prof >= 3:
                    exp_done = rng.sample(exp, k=rng.randint(1, 3))
                if prof >= 4:
                    # bump exposure higher when proficiency higher
                    exp_done = rng.sample(exp, k=rng.randint(3, 6))
                if prof >= 5:
                    expr_done = rng.sample(expr, k=rng.randint(1, 3))

                completed_content = edu_done + exp_done + expr_done

                # current-quarter window (last ~90 days) for logs
                for c in completed_content:
                    days_ago = rng.randint(2, 85)
                    db.add(UserContentCompletion(
                        user_id=eng.id,
                        plan_skill_id=ps.id,
                        content_id=c.id,
                        completed=True,
                        completed_at=now - timedelta(days=days_ago),
                    ))

                # Add 1-3 training logs reflecting the engineer's recent activity
                log_count = rng.randint(1, 3)
                log_titles = [
                    f"Self-paced Cisco U. module on {skill.name}",
                    f"Lab exercise: {skill.name} on CML",
                    f"Shadowed senior on customer SR — {skill.name}",
                    f"Internal study group: {skill.name} deep-dive",
                    f"TechZone reading sprint — {skill.name}",
                ]
                log_types = [
                    SkillLevelContentType.course,
                    SkillLevelContentType.action,
                    SkillLevelContentType.reading,
                ]
                for _ in range(log_count):
                    db.add(PlanSkillTrainingLog(
                        plan_skill_id=ps.id,
                        title=rng.choice(log_titles),
                        type=rng.choice(log_types),
                        completed_at=now - timedelta(days=rng.randint(2, 85)),
                        notes=(
                            f"Logged during current quarter as part of developing "
                            f"competency in {skill.name}."
                        ),
                    ))

            else:  # planned
                # No 3E completions, no logs, no proficiency
                ps.proficiency_level = None

            persona = LANSW_ENGINEER_PERSONAS.get(eng.email)
            if persona is not None:
                for lvl in (1, 2, 3):
                    items = _personal_items_for(skill.name, persona, lvl, rng)
                    for pos, (ctype, title, desc, url) in enumerate(items):
                        if status == PlanSkillStatus.mastered:
                            done = True
                            done_at = now - timedelta(days=rng.randint(7, 300))
                        elif status == PlanSkillStatus.developing:
                            if lvl == 1:
                                done = rng.random() < 0.85
                            elif lvl == 2:
                                done = rng.random() < 0.45
                            else:
                                done = rng.random() < 0.15
                            done_at = (
                                now - timedelta(days=rng.randint(2, 85))
                                if done else None
                            )
                        else:
                            done = False
                            done_at = None

                        db.add(UserLevelContent(
                            user_id=eng.id,
                            plan_skill_id=ps.id,
                            skill_id=skill.id,
                            level=lvl,
                            type=ctype,
                            title=title,
                            description=desc,
                            url=url,
                            position=pos,
                            completed=done,
                            completed_at=done_at,
                        ))

        db.flush()
        plan_summary.append((eng.email, dict(status_counter)))

    db.flush()
    print(f"  LANSW overlay: built plans for {len(engineers)} engineers, "
          f"18 skills each ({len(engineers) * 18} plan_skills)")
    for email, counter in plan_summary:
        print(f"    {email:30s} mastered={counter.get('mastered', 0):2d} "
              f"developing={counter.get('developing', 0):2d} "
              f"planned={counter.get('planned', 0):2d}")


def run():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding domains...")
        domains: dict[str, Domain] = {}
        for code, name, is_tech, icon in DOMAIN_DEFS:
            d = Domain(name=name, is_technical=is_tech, icon=icon)
            db.add(d)
            domains[code] = d
        db.flush()

        print("Seeding teams (20 technology areas × 4 shifts = 80)...")
        teams_by_code: dict[str, list[Team]] = {}
        all_teams: list[Team] = []
        for domain_code, areas in TEAM_TAXONOMY.items():
            for team_code, _friendly, icon in areas:
                shifts: list[Team] = []
                for shift in range(1, 5):
                    t = Team(
                        name=f"TAC-{domain_code}-{team_code}-SHIFT{shift}",
                        domain_id=domains[domain_code].id,
                        shift=shift,
                        icon=icon,
                    )
                    shifts.append(t)
                    all_teams.append(t)
                teams_by_code[team_code] = shifts
        db.add_all(all_teams)
        db.flush()

        print("Seeding 4 Non-Technical virtual teams (one per shift)...")
        ntech_shifts: list[Team] = []
        for shift in range(1, 5):
            t = Team(
                name=f"TAC-NTECH-GEN-SHIFT{shift}",
                domain_id=domains["NTECH"].id,
                shift=shift,
                icon="users",
            )
            ntech_shifts.append(t)
            all_teams.append(t)
        db.add_all(ntech_shifts)
        db.flush()
        teams_by_code[NTECH_CODE] = ntech_shifts

        print("Seeding skill categories...")
        cat_defs = [
            ("foundational", "Foundational",         0),
            ("core",         "Core",                 1),
            ("advanced",     "Advanced",             2),
            ("ai_future",    "AI & Future Skills",   3),
        ]
        cats: dict[str, SkillCategory] = {}
        for slug, name, order in cat_defs:
            c = SkillCategory(slug=slug, name=name, sort_order=order)
            db.add(c)
            cats[slug] = c
        db.flush()

        print("Seeding certifications...")
        cert_objs: dict[str, Certificate] = {}
        for dom_name, certs in CERT_CATALOG.items():
            cd = CertificationDomain(
                name=dom_name,
                description=f"{dom_name} certifications.",
                icon="sparkles",
            )
            db.add(cd)
            db.flush()
            for _code, cname, cdesc in certs:
                c = Certificate(
                    name=cname,
                    description=cdesc,
                    certification_domain_id=cd.id,
                    icon="sparkles",
                )
                db.add(c)
                db.flush()
                cert_objs[_code] = c

        print(f"Seeding {len(SKILLS)} skills (strict 1:1 category) + 18 3E content rows each...")
        tag_cache: dict[str, Tag] = {}

        def get_tag(name: str) -> Tag:
            if name not in tag_cache:
                t = Tag(name=name)
                db.add(t)
                db.flush()
                tag_cache[name] = t
            return tag_cache[name]

        for name, desc, cat_slug, team_codes, cert_codes, icon, tags in SKILLS:
            skill = Skill(name=name, description=desc, icon=icon)
            db.add(skill)
            db.flush()

            db.add(SkillCategoryAssignment(skill_id=skill.id, category_id=cats[cat_slug].id))

            for tc in team_codes:
                for t in teams_by_code.get(tc, []):
                    db.add(SkillTeam(skill_id=skill.id, team_id=t.id))

            for code in cert_codes:
                c = cert_objs.get(code)
                if c is not None:
                    db.add(SkillCertificate(skill_id=skill.id, certificate_id=c.id))

            for tagname in tags:
                db.add(SkillTag(skill_id=skill.id, tag_id=get_tag(tagname).id))

            for row in _content_rows(name):
                db.add(SkillLevelContent(skill_id=skill.id, **row))
        db.flush()

        print("Seeding users (1 admin + 20 managers + 20 engineers)...")
        pwd = hash_password("password123")
        admin = User(
            name="Alex", surname="Admin",
            email="admin@matrixpro.com",
            password_hash=pwd, role=UserRole.admin, avatar=pick_avatar(0),
        )
        db.add(admin)
        db.flush()

        first_names_mgr = [
            "Aurora","Beatrice","Cyrus","Diana","Elliot","Faye","Gideon",
            "Hannah","Ivan","Jolene","Kiran","Lara","Milan","Nadia",
            "Oscar","Priya","Quinn","Rafael","Sofia","Theo",
        ]
        last_names_mgr = [
            "Aalto","Bianchi","Castellanos","Doherty","Engström","Ferraro","Gonzalez",
            "Haavisto","Iverson","Jakovenko","Khoury","Lindqvist","Moretti","Navarro",
            "Okafor","Petrov","Quan","Romero","Saito","Tan",
        ]
        first_names_eng = [
            "Aiden","Bella","Caden","Daniela","Ethan","Fiona","Grace",
            "Hugo","Isla","Jonas","Kira","Leo","Maya","Noor",
            "Owen","Paloma","Ravi","Selene","Tomas","Una",
        ]
        last_names_eng = [
            "Acharya","Brennan","Costa","Dimitrov","Eriksen","Fontaine","Ghosh",
            "Hassan","Ingvarsdottir","Jansen","Kowalski","Larsen","Mendoza","Nyberg",
            "Olsen","Palacios","Quiroz","Rashid","Sundberg","Tanaka",
        ]

        ordered_team_codes: list[tuple[str, str, str]] = []
        for domain_code, areas in TEAM_TAXONOMY.items():
            for team_code, friendly, _icon in areas:
                ordered_team_codes.append((team_code, friendly, domain_code))
        assert len(ordered_team_codes) == 20, f"Expected 20 teams, got {len(ordered_team_codes)}"

        engineers: list[tuple[User, str]] = []
        for idx, (team_code, _friendly, _domain_code) in enumerate(ordered_team_codes):
            shift1 = teams_by_code[team_code][0]
            mgr = User(
                name=first_names_mgr[idx],
                surname=last_names_mgr[idx],
                email=f"mgr-{team_code.lower()}@matrixpro.com",
                password_hash=pwd,
                role=UserRole.manager,
                team_id=shift1.id,
                avatar=pick_avatar(idx + 10),
            )
            db.add(mgr)
            db.flush()

            eng = User(
                name=first_names_eng[idx],
                surname=last_names_eng[idx],
                email=f"eng-{team_code.lower()}@matrixpro.com",
                password_hash=pwd,
                role=UserRole.engineer,
                team_id=shift1.id,
                manager_id=mgr.id,
                avatar=pick_avatar(idx + 20),
            )
            db.add(eng)
            db.flush()
            engineers.append((eng, team_code))
        db.flush()

        print("Seeding development plans (5-7 skills per engineer)...")
        from collections import defaultdict
        team_skill_index: dict[int, list[int]] = defaultdict(list)
        for st in db.query(SkillTeam).all():
            team_skill_index[st.team_id].append(st.skill_id)

        all_skills = {s.id: s for s in db.query(Skill).all()}
        statuses = [PlanSkillStatus.planned, PlanSkillStatus.developing, PlanSkillStatus.mastered]

        plan_size_cycle = [5, 6, 7]
        for idx, (eng, team_code) in enumerate(engineers):
            plan = DevelopmentPlan(engineer_id=eng.id)
            db.add(plan)
            db.flush()

            shift1 = teams_by_code[team_code][0]
            ntech_shift1 = teams_by_code[NTECH_CODE][0]
            candidate_skill_ids: list[int] = []
            for sid in team_skill_index.get(shift1.id, []):
                if sid not in candidate_skill_ids:
                    candidate_skill_ids.append(sid)
            for sid in team_skill_index.get(ntech_shift1.id, []):
                if sid not in candidate_skill_ids:
                    candidate_skill_ids.append(sid)
                if len(candidate_skill_ids) >= 10:
                    break

            target = plan_size_cycle[idx % 3]
            chosen = candidate_skill_ids[:target]

            for i, sid in enumerate(chosen):
                status = statuses[i % 3]
                ps = PlanSkill(
                    plan_id=plan.id,
                    skill_id=sid,
                    status=status,
                    proficiency_level=(i % 3) + 1,
                    skill_version_at_add=1,
                )
                db.add(ps)
                db.flush()
                if status == PlanSkillStatus.mastered:
                    db.add(PlanSkillTrainingLog(
                        plan_skill_id=ps.id,
                        title=f"Mastered {all_skills[sid].name}",
                        type=SkillLevelContentType.action,
                        completed_at=datetime.now(timezone.utc),
                        notes=f"Completed self-study and 3 customer SRs on {all_skills[sid].name}.",
                    ))

        db.commit()

        print("Applying LANSW Shift-2 overlay...")
        _seed_lansw_shift2(db)
        db.commit()

        print("Seed complete.")
        print(f"  Domains : {db.query(Domain).count()}")
        print(f"  Teams   : {db.query(Team).count()}")
        print(f"  Skills  : {db.query(Skill).count()}")
        print(f"  Content : {db.query(SkillLevelContent).count()}")
        print(f"  Certs   : {db.query(Certificate).count()}")
        print(f"  Users   : {db.query(User).count()}")
        print(f"  Plans   : {db.query(DevelopmentPlan).count()}")
        print(f"  PlanSk  : {db.query(PlanSkill).count()}")
        print("Admin login:    admin@matrixpro.com / password123")
        print("Manager email:  mgr-<team_code>@matrixpro.com / password123")
        print("Engineer email: eng-<team_code>@matrixpro.com / password123")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        sys.exit(1)
