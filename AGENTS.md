# MatrixPro — Cross-Session Knowledge Base

> **Purpose**: Reference document for OpenCode agents working on MatrixPro across sessions.
> **Last updated**: Post-Phase 6 — admin panel, certifications, feedback, settings, setup scripts added.

---

## 1. Project Overview

MatrixPro is a corporate web application for TAC Engineers to build, track, and manage individual skill development plans. It features RBAC (engineer/manager/admin), a skill catalog, development plans with kanban, team skills matrix, skill explorer with cross-team comparison, PDF/CSV export, admin panel (users/teams/domains/certifications/feedback management), and user settings.

**Full spec**: `Application Requirements.md` (739 lines, READ-ONLY reference)

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Python 3.11+ / FastAPI | `backend/app/main.py` entry (10 routers) |
| Database | SQLite + SQLAlchemy 2.0 | `data/matrixpro.db` (auto-created) |
| Auth | JWT (PyJWT) + bcrypt | HS256, configurable expiry |
| Frontend | Vanilla JS (ES modules) | NO build step, NO CSS framework |
| Design System | Sherlock / GenAI-Wireless | Dark-first, glassmorphism, CSS custom properties |
| PDF Export | WeasyPrint | Requires pango/cairo system libs |
| Infrastructure | Docker Compose | `api` (port 5000) + `web` (nginx, port 80) |

**No CI, no tests, no linting config** — pyproject.toml, .flake8, .editorconfig, .pre-commit-config.yaml all absent. Dependencies use loose `>=` pins (no lockfile).

---

## 3. Project Structure

```
MatrixPro/
├── Application Requirements.md    # Full spec (READ-ONLY)
├── AGENTS.md                      # This file
├── README.md                      # Setup instructions, feature overview
├── .env.example                   # JWT_SECRET, DATABASE_URL, JWT_EXPIRY_HOURS
├── .gitignore
├── setup.sh                       # One-command env setup (OS-aware: brew/apt/dnf/pacman)
├── start.sh                       # Launch backend+frontend, open browser (port 8000+3000)
├── docker-compose.yml             # api (port 5000) + web (nginx port 80)
├── nginx.conf                     # Proxy /api → backend:5000, serve frontend/
├── docs/design/                   # Design docs, icon analysis, skill-card demo HTML
├── tmp/                           # Screenshot artifacts (not code)
├── backend/
│   ├── Dockerfile                 # python:3.11-slim, uvicorn on port 5000
│   ├── requirements.txt           # Loose pins (>=), no lockfile
│   ├── venv/                      # Local venv (gitignored)
│   ├── tests/__init__.py          # Empty — no tests implemented
│   └── app/
│       ├── main.py                # FastAPI app, CORS, 10 router includes, /api/health, /api/stats
│       ├── config.py              # Settings: JWT_SECRET, DATABASE_URL, JWT_EXPIRY_HOURS
│       ├── database.py            # engine, SessionLocal, Base, get_db()
│       ├── dependencies.py        # get_current_user, require_role, require_manager_of, create_access_token
│       ├── seed.py                # Run: python -m app.seed (784 lines)
│       ├── models/
│       │   ├── __init__.py        # Imports all models for Base.metadata discovery
│       │   ├── org.py             # Organisation, Domain, Team (Team.shift, Team.icon)
│       │   ├── user.py            # User, UserRole(engineer|manager|admin), User.avatar
│       │   ├── skill.py           # Skill, SkillTeam, Tag, SkillTag, SkillLevelContent, SkillLevelContentType
│       │   ├── plan.py            # DevelopmentPlan, PlanSkill, PlanSkillStatus, PlanSkillTrainingLog
│       │   ├── catalog.py         # CertificationDomain, Certification (cert catalog)
│       │   ├── feedback.py        # Feedback model (user feedback collection)
│       │   └── audit.py           # AuditLog
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py            # LoginRequest, TokenResponse, UserProfile
│       │   ├── user.py            # UserCreate, UserUpdate, UserOut
│       │   ├── org.py             # OrgOut, DomainOut, TeamOut, TeamCreate, Matrix schemas
│       │   ├── skill.py           # SkillCreate/Update/Out, LevelContent, Explorer, Compare
│       │   └── plan.py            # PlanSkill CRUD, PlanResponse, TrainingLog schemas
│       └── routers/
│           ├── __init__.py
│           ├── auth.py            # /api/auth — login, me
│           ├── users.py           # /api/users — CRUD (admin)
│           ├── teams.py           # /api/teams — CRUD, matrix, stats, activity, change logs (708 lines)
│           ├── skills.py          # /api/skills — CRUD, content, explorer, compare (600 lines)
│           ├── plans.py           # /api/plans — plan skills, training log, content mgmt (1372 lines)
│           ├── export.py          # /api/export — PDF/CSV plans, skills, matrix, change logs (712 lines)
│           ├── domains.py         # /api/domains — domain CRUD (admin)
│           ├── catalog.py         # /api/catalog — catalog tree/search endpoints
│           ├── certification.py   # /api/certification — cert domains + certificates CRUD (admin)
│           └── feedback.py        # /api/feedback — user feedback CRUD
├── frontend/
│   ├── index.html                 # SPA shell: nav, #app, modal/toast portals
│   ├── css/
│   │   └── style.css              # ~7,260 lines — full design system (dark+light)
│   └── js/
│       ├── app.js                 # Entry: session restore, nav init, router init
│       ├── router.js              # Hash-based SPA router, param parsing, role checks
│       ├── state.js               # Pub/sub store: Store.get/set/on
│       ├── api.js                 # Fetch wrapper: JWT injection, 401 redirect
│       ├── utils/
│       │   └── dom.js             # DOM helper utilities
│       ├── components/
│       │   ├── nav.js             # Role-filtered navigation
│       │   ├── theme.js           # Dark/light toggle (localStorage)
│       │   ├── modal.js           # showModal + showConfirm (Promise-based)
│       │   ├── skeleton.js        # Skeleton loaders
│       │   ├── toast.js           # Toast notifications with stacking
│       │   ├── icons.js           # SVG icon catalog + icon picker (723 lines)
│       │   ├── avatars.js         # Avatar catalog + avatar picker (165 lines)
│       │   └── feedback.js        # Feedback widget component
│       └── pages/
│           ├── login.js           # Login form
│           ├── home.js            # Start Page with stats + nav cards (332 lines)
│           ├── my-plan.js         # My Plan kanban + content mgmt (1940 lines)
│           ├── my-team.js         # My Team matrix + charts + bulk assign (1762 lines)
│           ├── catalog.js         # Catalog Explorer tree + detail modals (1950 lines)
│           ├── skill-explorer.js  # Skill Explorer + cross-team compare (754 lines)
│           ├── admin.js           # Admin panel: users/teams/domains/certs/feedback tabs (1432 lines)
│           └── settings.js        # User settings: profile, password, avatar (173 lines)
└── data/
    └── matrixpro.db               # SQLite DB (gitignored, auto-created by seed)
```

---

## 4. Data Model

### Entity Relationship

```
Organisation 1──* Domain 1──* Team 1──* User
                         1──* Skill *──* Team (via SkillTeam)
                                    *──* Tag (via SkillTag)
                                    1──* SkillLevelContent
                                    1──* PlanSkill

User 1──1 DevelopmentPlan 1──* PlanSkill 1──* PlanSkillTrainingLog
User (manager) 1──* User (reports)
CertificationDomain 1──* Certification
Feedback → user_id → User
AuditLog → changed_by → User
```

### Key Enums

| Enum | Values |
|------|--------|
| `UserRole` | `engineer`, `manager`, `admin` |
| `PlanSkillStatus` | `in_pipeline`, `in_development`, `proficiency` |
| `SkillLevelContentType` | `course`, `certification`, `reading`, `link`, `action` |

### Important Model Details

- `User.manager_id` — self-referential FK to `users.id`
- `User.avatar` — avatar identifier string
- `DevelopmentPlan.engineer_id` — unique (one plan per engineer)
- `Skill.is_archived` — soft delete flag
- `Skill.catalog_version` — incremented on update
- `PlanSkill.skill_version_at_add` — snapshot of catalog_version at time of adding
- `Team.shift` — shift identifier (used for stats filtering)
- `Team.icon` — icon identifier for UI display
- `Domain.is_technical` — boolean flag for domain categorization
- `AuditLog` — entity_type + entity_id + field + old/new values
- `CertificationDomain` / `Certification` — separate cert catalog (models/catalog.py)
- `Feedback` — user-submitted feedback with type field (models/feedback.py)

---

## 5. API Routes

### Auth (`/api/auth`)
```
POST   /api/auth/login          # LoginRequest → TokenResponse
GET    /api/auth/me              # JWT → UserProfile
```

### Users (`/api/users` — admin only, except self-view)
```
GET    /api/users/               # List all users
POST   /api/users/               # Create user
GET    /api/users/{user_id}      # Get user
PUT    /api/users/{user_id}      # Update user
DELETE /api/users/{user_id}      # Delete user
```

### Teams (`/api/teams`)
```
GET    /api/teams/               # List teams
POST   /api/teams/               # Create team (admin)
GET    /api/teams/matrix         # Team skills matrix (manager/admin)
GET    /api/teams/{team_id}/stats      # Team statistics
GET    /api/teams/{team_id}/activity   # Team activity feed
GET    /api/teams/{team_id}/change-logs # Team change logs
GET    /api/teams/{team_id}      # Get team + members
PUT    /api/teams/{team_id}      # Update team (admin)
DELETE /api/teams/{team_id}      # Delete team (admin)
```

### Skills (`/api/skills`)
```
GET    /api/skills/              # List/search skills (supports ?cert_id= filter)
POST   /api/skills/              # Create skill (admin)
GET    /api/skills/explorer      # Search engineers by skill
GET    /api/skills/compare       # Cross-team skill comparison
GET    /api/skills/{skill_id}    # Get skill detail
PUT    /api/skills/{skill_id}    # Update skill (admin)
DELETE /api/skills/{skill_id}    # Archive skill (admin, soft-delete)
POST   /api/skills/{skill_id}/content   # Add level content (admin)
GET    /api/skills/{skill_id}/content   # Get level content
```

### Plans (`/api/plans`)
```
GET    /api/plans/                                   # List plans (manager: team, admin: all)
POST   /api/plans/own/skills                         # Engineer creates own skill
GET    /api/plans/{engineer_id}                      # Get plan for engineer
POST   /api/plans/{engineer_id}/skills               # Add skill to plan
POST   /api/plans/{engineer_id}/skills/bulk          # Bulk assign skills
PUT    /api/plans/{engineer_id}/skills/{ps_id}       # Update plan skill
DELETE /api/plans/{engineer_id}/skills/{ps_id}       # Remove skill from plan
POST   /api/plans/{engineer_id}/skills/{ps_id}/log   # Add training log
GET    /api/plans/{engineer_id}/skills/{ps_id}/content              # Get plan skill content
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/{c_id}/toggle    # Toggle content completion
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/{c_id}/override  # Save content override
POST   /api/plans/{engineer_id}/skills/{ps_id}/content/user         # Create user content
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/user/{uc_id} # Update user content
DELETE /api/plans/{engineer_id}/skills/{ps_id}/content/user/{uc_id} # Delete user content
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/user/{uc_id}/toggle  # Toggle user content
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/{c_id}/hide      # Hide catalog content
PUT    /api/plans/{engineer_id}/skills/{ps_id}/content/{c_id}/unhide    # Unhide catalog content
POST   /api/plans/{engineer_id}/skills/{ps_id}/resync               # Resync catalog content
```

### Export (`/api/export`)
```
GET    /api/export/plans/{engineer_id}/pdf    # Plan PDF
GET    /api/export/plans/{engineer_id}/csv    # Plan CSV
GET    /api/export/skills/csv                 # Skill catalog CSV
GET    /api/export/skills/overview/pdf        # Skills overview PDF
GET    /api/export/teams/{team_id}/matrix/csv # Team matrix CSV
GET    /api/export/change-logs                # Change logs list
GET    /api/export/change-logs/pdf            # Change logs PDF
```

### Domains (`/api/domains` — admin)
```
GET    /api/domains/             # List domains
```

### Catalog (`/api/catalog`)
```
GET    /api/catalog/             # Catalog tree/search
```

### Certifications (`/api/certification` — admin)
```
GET    /api/certification/domains      # List cert domains
POST   /api/certification/domains      # Create cert domain
PUT    /api/certification/domains/{id} # Update cert domain
DELETE /api/certification/domains/{id} # Delete cert domain
GET    /api/certification/             # List certificates
POST   /api/certification/             # Create certificate
PUT    /api/certification/{id}         # Update certificate
DELETE /api/certification/{id}         # Delete certificate
```

### Feedback (`/api/feedback`)
```
GET    /api/feedback/            # List feedback (admin)
POST   /api/feedback/            # Submit feedback (any auth user)
DELETE /api/feedback/{id}        # Delete feedback (admin)
```

### Stats / Health
```
GET    /api/health               # {"status":"ok","service":"MatrixPro API"}
GET    /api/stats                # Public stats (supports ?shifts= filter)
```

---

## 6. Frontend Architecture

### SPA Router (Hash-based)
```javascript
// Route definitions in app.js
'/':               { mount: mountHome,          minRole: null }
'/login':          { mount: mountLogin,         minRole: null, public: true }
'/my-plan':        { mount: mountMyPlan,        minRole: 'engineer' }
'/my-plan/:id':    { mount: mountMyPlan,        minRole: 'manager' }
'/my-team':        { mount: mountMyTeam,        minRole: 'manager' }
'/catalog':        { mount: mountCatalog,       minRole: 'engineer' }
'/skill-explorer': { mount: mountSkillExplorer, minRole: 'engineer' }
'/settings':       { mount: mountSettings,      minRole: 'engineer' }
'/admin':          { mount: mountAdmin,         minRole: 'admin' }
```

### Admin Panel Tabs (admin.js)
5 tabs: Users, Teams, Domains, Certifications, Feedback — each with CRUD tables, search, sort, and modals. Icon picker component for teams/domains/certs.

### Key Patterns
- **State**: `Store.get(key)`, `Store.set(key, value)`, `Store.on(key, callback)`
- **API**: `api.get(url)`, `api.post(url, body)`, `api.put(url, body)`, `api.delete(url)`
  - Auto-injects `Authorization: Bearer <token>` from `localStorage.matrixpro_token`
  - 401 → clears token, redirects to `#/login`
- **Modals**: `showModal({ title, body, actions })` → Promise
- **Toasts**: `showToast({ message, type })` — types: success, error, info, warning
- **Skeletons**: `renderSkeleton(type)` — card, table, kanban
- **Icons**: `icons.js` exports SVG icon catalog used across admin, catalog, nav
- **Avatars**: `avatars.js` exports `AVATAR_CATALOG` used in admin user modal + settings

### Page Mount Pattern
```javascript
// Each page exports: export function mountPageName(container, params) { ... }
// container = #app element
// params = route params (e.g. { id: '5' })
// Return cleanup function (optional) for route teardown
```

---

## 7. Auth & RBAC

### Dependencies (backend/app/dependencies.py)
- `get_current_user` — Extracts JWT from `Authorization: Bearer <token>`, returns User
- `require_role(*roles)` — Returns `Depends(dependency)` directly — do NOT wrap in `Depends()` again
- `require_manager_of(engineer_id)` — Admin passes, manager must own the engineer
- `create_access_token(user_id)` — Returns HS256 JWT with `sub` and `exp` claims

### Role Hierarchy
- **engineer**: Own plan, catalog read, settings, feedback submit
- **manager**: Team members' plans, team matrix, stats, activity
- **admin**: Everything — user/skill/team/domain/cert CRUD, feedback management

---

## 8. Design System

**System**: Sherlock / GenAI-Wireless — dark-first, glassmorphism-accented
**File**: `frontend/css/style.css` (~7,260 lines, complete dark+light themes)

### Key CSS Custom Properties
All color values, spacing, typography, and component styles are defined as CSS custom properties. See spec sections 7.1-7.16 for exact values.

### Dark/Light Theme
- Toggle stored in `localStorage.matrixpro_theme`
- `[data-theme="light"]` overrides on `:root`
- `prefers-reduced-motion` respected

---

## 9. Local Development

### Quick Start (recommended)
```bash
./setup.sh       # Installs system deps (OS-aware), creates venv, seeds DB, generates .env
./start.sh       # Starts backend (port 8000) + frontend (port 3000), opens browser
```

### Manual Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # Creates DB + seed data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Separate terminal:
cd frontend && python3 -m http.server 3000
```

### Docker (ports differ from local!)
```bash
cp .env.example .env
docker compose up --build
# Backend on port 5000, nginx on port 80
```

**⚠ Port mismatch**: Docker uses port 5000 (backend) + 80 (nginx). Local start.sh uses 8000 + 3000. Configurable via `MATRIXPRO_BACKEND_PORT` / `MATRIXPRO_FRONTEND_PORT` env vars.

### Test Credentials (from seed, password: `password123`)
| Email | Role | Team |
|-------|------|------|
| admin@matrixpro.com | admin | — |
| alice@matrixpro.com | manager | Wi-Fi 6 |
| bob@matrixpro.com | engineer | Wi-Fi 6 (reports to alice) |
| carol@matrixpro.com | manager | WLAN Controllers |
| dave@matrixpro.com | engineer | WLAN Controllers (reports to carol) |
| eve@matrixpro.com | engineer | Firewall (reports to carol) |

### SQLite Path Auto-Detection
`config.py` auto-detects: `/data/` in Docker → `./data/` locally. No env vars needed for local dev.

---

## 10. Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Project scaffold, DB schema, design CSS, SPA shell, seed data | **COMPLETE** |
| 1 | Auth (JWT login, /me), user CRUD with RBAC, teams CRUD | **COMPLETE** |
| 2 | Skill catalog CRUD, Catalog Explorer UI (tree, cards, search) | **COMPLETE** |
| 3 | My Plan kanban (drag-drop, cards, training log, audit) | **COMPLETE** |
| 4 | My Team matrix (2D grid, sticky headers, drill-down) | **COMPLETE** |
| 5 | Skill Explorer (search, cross-team comparison, overlap %, import) | **COMPLETE** |
| 6 | Start Page (stats, animations), PDF/CSV export, polish | **COMPLETE** |
| 7+ | Admin panel, certifications, domains, feedback, settings, setup scripts | **COMPLETE** |

---

## 11. Critical Constraints (from spec)

- All RBAC checks MUST be server-side (client-side UI restrictions alone are not sufficient)
- Skill deletion = soft-delete (archive) if referenced in any active plan
- Catalog updates do NOT auto-push to existing plans (version snapshot on add)
- All plan changes MUST be audit-logged (UTC timestamp + user identity)
- Destructive actions require explicit confirmation (custom modal, not browser confirm())
- Responsive for desktop (min 1280px viewport)
- Skeleton loaders for all async content (not spinners)
- `prefers-reduced-motion` respected

---

## 12. Complexity Hotspots

Files >500 lines requiring care when modifying:

| File | Lines | Risk |
|------|-------|------|
| `frontend/css/style.css` | 7,260 | Massive — search carefully, test both themes |
| `frontend/js/pages/catalog.js` | 1,950 | Tree view + content editor + many modals |
| `frontend/js/pages/my-plan.js` | 1,940 | Kanban + drag-drop + content mgmt + modals |
| `frontend/js/pages/my-team.js` | 1,762 | Matrix + charts + bulk assign + activity |
| `frontend/js/pages/admin.js` | 1,432 | 5 CRUD tabs + icon pickers + feedback |
| `backend/app/routers/plans.py` | 1,372 | 24 endpoints, content toggle/override/user-content |
| `backend/app/seed.py` | 784 | Procedural seeding — fragile ordering |
| `frontend/js/pages/skill-explorer.js` | 754 | Search + comparison + overlap viz |
| `frontend/js/components/icons.js` | 723 | SVG icon catalog data |
| `backend/app/routers/export.py` | 712 | PDF/CSV generation, WeasyPrint HTML templates |
| `backend/app/routers/teams.py` | 708 | Matrix, stats, activity, change logs |
| `backend/app/routers/skills.py` | 600 | Explorer + compare joins multiple tables |

---

## 13. Known Issues / Discoveries

### Infrastructure
- Docker CLI uses `docker compose` (v2 plugin), not `docker-compose`
- **Port mismatch**: Docker exposes backend on 5000, local dev uses 8000
- Dockerfile does NOT install WeasyPrint system deps (pango, cairo) — PDF export fails in Docker unless image is extended
- System has Python 3.14 but backend targets 3.11+ (Dockerfile uses python:3.11-slim)
- No CI, no tests, no linting/formatting config files

### Backend Patterns
- `require_role()` returns `Depends(dependency)` — do NOT wrap in `Depends()` again
- Plans + export routers use inline `_check_plan_access()` instead of `require_manager_of()` from dependencies.py
- `_get_or_create_plan()` auto-creates DevelopmentPlan on GET (side-effect on read)
- PlanSkill deletion cascades training logs manually (not via DB cascade)
- `Skill.is_archived == False` uses `# noqa: E712` throughout — prefer `.is_(False)`
- Hard delete of skills requires manual cascade deletion of SkillTag, SkillTeam, SkillLevelContent
- basedpyright LSP reports false positives on SQLAlchemy Column types (pre-existing)
- `/api/stats` supports `?shifts=` filter for team shift-based filtering

### Frontend Patterns
- JWT stored in localStorage (XSS-vulnerable if CSP not enforced)
- Cache-busting via `?v=N` query params on some imports in app.js
- `escHtml()` helper duplicated in admin.js and settings.js (not shared)
- Dead code after `return` is a recurring agent bug — always verify

### Route Ordering (FastAPI)
- `GET /api/teams/matrix` and `/{team_id}/stats` etc. MUST be defined BEFORE `/{team_id}`
- `GET /api/skills/explorer` and `/compare` MUST be defined BEFORE `/{skill_id}`
- Same pattern applies in certification router

### Seed Data
- Bob(4) has skills 1,2,4; Dave(5) has 3,5,9; Eve(6) has 6,7,8
- Team 1 vs Team 2 overlap: 3 skills (42.9%), Team 1 vs Team 3: 2 skills (22.2%)
- Carol manages Dave (WLAN Controllers) and Eve (Firewall) — cross-team manager
