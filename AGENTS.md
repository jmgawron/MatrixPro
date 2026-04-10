# MatrixPro — Cross-Session Knowledge Base

> **Purpose**: Reference document for OpenCode agents working on MatrixPro across sessions.
> **Last updated**: Phase 1 completion.

---

## 1. Project Overview

MatrixPro is a corporate web application for TAC Engineers to build, track, and manage individual skill development plans. It features RBAC (engineer/manager/admin), a skill catalog, development plans with kanban, team skills matrix, skill explorer with cross-team comparison, and PDF/CSV export.

**Full spec**: `Application Requirements.md` (739 lines, READ-ONLY reference)

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Python 3.11+ / FastAPI | `backend/app/main.py` entry |
| Database | SQLite + SQLAlchemy 2.0 | `data/matrixpro.db` (auto-created) |
| Auth | JWT (PyJWT) + bcrypt | HS256, configurable expiry |
| Frontend | Vanilla JS (ES modules) | NO build step, NO CSS framework |
| Design System | Sherlock / GenAI-Wireless | Dark-first, glassmorphism, CSS custom properties |
| PDF Export | WeasyPrint | For plan PDF generation |
| Infrastructure | Docker Compose | `api` (FastAPI) + `web` (nginx) services |

---

## 3. Project Structure

```
MatrixPro/
├── Application Requirements.md    # Full spec (READ-ONLY)
├── AGENTS.md                      # This file
├── .env.example                   # JWT_SECRET, DATABASE_URL, JWT_EXPIRY_HOURS
├── .gitignore
├── docker-compose.yml             # api + web services
├── nginx.conf                     # Proxy /api → backend:8000, serve frontend/
├── backend/
│   ├── Dockerfile                 # python:3.11-slim
│   ├── requirements.txt
│   ├── venv/                      # Local venv (gitignored)
│   └── app/
│       ├── main.py                # FastAPI app, CORS, routers, startup create_all
│       ├── config.py              # Settings: JWT_SECRET, DATABASE_URL, JWT_EXPIRY_HOURS
│       ├── database.py            # engine, SessionLocal, Base, get_db()
│       ├── dependencies.py        # get_current_user, require_role, require_manager_of, create_access_token
│       ├── seed.py                # Run: python -m app.seed (function is run())
│       ├── models/
│       │   ├── __init__.py        # Imports all models for Base.metadata discovery
│       │   ├── org.py             # Organisation, Domain, Team
│       │   ├── user.py            # User, UserRole(engineer|manager|admin)
│       │   ├── skill.py           # Skill, SkillTeam, Tag, SkillTag, SkillLevelContent, SkillLevelContentType
│       │   ├── plan.py            # DevelopmentPlan, PlanSkill, PlanSkillStatus, PlanSkillTrainingLog
│       │   └── audit.py           # AuditLog
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── auth.py            # LoginRequest, TokenResponse, UserProfile
│       │   ├── user.py            # UserCreate, UserUpdate, UserOut
│       │   ├── org.py             # OrgOut, DomainOut, TeamOut, TeamCreate
│       │   ├── skill.py           # SkillCreate, SkillUpdate, SkillOut, SkillLevelContentCreate, etc.
│       │   └── plan.py            # PlanSkillCreate, PlanSkillUpdate, PlanSkillOut, TrainingLogCreate, etc.
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py            # POST /api/auth/login, GET /api/auth/me
│       │   ├── users.py           # CRUD /api/users/
│       │   ├── teams.py           # CRUD /api/teams/
│       │   ├── skills.py          # CRUD /api/skills/, content endpoints
│       │   ├── plans.py           # /api/plans/, skill management, training log
│       │   └── export.py          # PDF/CSV export endpoints
│       └── tests/                 # (empty, for future use)
├── frontend/
│   ├── index.html                 # SPA shell: nav, #app, modal/toast portals
│   ├── css/
│   │   └── style.css              # 2,070 lines — full design system
│   └── js/
│       ├── app.js                 # Entry: session restore, nav init, router init
│       ├── router.js              # Hash-based SPA router, param parsing, role checks
│       ├── state.js               # Pub/sub store: Store.get/set/on
│       ├── api.js                 # Fetch wrapper: JWT injection, 401 redirect
│       ├── components/
│       │   ├── nav.js             # Role-filtered navigation
│       │   ├── theme.js           # Dark/light toggle (localStorage)
│       │   ├── modal.js           # showModal + showConfirm (Promise-based)
│       │   ├── skeleton.js        # Skeleton loaders
│       │   └── toast.js           # Toast notifications with stacking
│       └── pages/
│           ├── login.js           # FUNCTIONAL login form
│           ├── home.js            # Placeholder (Phase 6)
│           ├── my-plan.js         # Placeholder (Phase 3)
│           ├── my-team.js         # Placeholder (Phase 4)
│           ├── catalog.js         # Placeholder (Phase 2)
│           └── skill-explorer.js  # Placeholder (Phase 5)
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
- `DevelopmentPlan.engineer_id` — unique (one plan per engineer)
- `Skill.is_archived` — soft delete flag
- `Skill.catalog_version` — incremented on update
- `PlanSkill.skill_version_at_add` — snapshot of catalog_version at time of adding
- `AuditLog` — entity_type + entity_id + field + old/new values

---

## 5. API Routes (33 total)

### Auth
```
POST   /api/auth/login          # LoginRequest → TokenResponse (Phase 1)
GET    /api/auth/me              # JWT → UserProfile (Phase 1)
```

### Users (admin only, except self-view)
```
GET    /api/users/               # List all users
POST   /api/users/               # Create user
GET    /api/users/{user_id}      # Get user
PUT    /api/users/{user_id}      # Update user
DELETE /api/users/{user_id}      # Delete user
```

### Teams
```
GET    /api/teams/               # List teams
POST   /api/teams/               # Create team (admin)
GET    /api/teams/{team_id}      # Get team + members
PUT    /api/teams/{team_id}      # Update team (admin)
DELETE /api/teams/{team_id}      # Delete team (admin)
```

### Skills
```
GET    /api/skills/              # List/search skills
POST   /api/skills/              # Create skill (admin)
GET    /api/skills/{skill_id}    # Get skill detail
PUT    /api/skills/{skill_id}    # Update skill (admin)
DELETE /api/skills/{skill_id}    # Archive skill (admin, soft-delete)
POST   /api/skills/{skill_id}/content   # Add level content (admin)
GET    /api/skills/{skill_id}/content   # Get level content
```

### Plans
```
GET    /api/plans/                                   # List plans (manager: team, admin: all)
GET    /api/plans/{engineer_id}                      # Get plan for engineer
POST   /api/plans/{engineer_id}/skills               # Add skill to plan
PUT    /api/plans/{engineer_id}/skills/{plan_skill_id}    # Update plan skill
DELETE /api/plans/{engineer_id}/skills/{plan_skill_id}    # Remove skill from plan
POST   /api/plans/{engineer_id}/skills/{plan_skill_id}/log  # Add training log
```

### Export
```
GET    /api/export/plans/{engineer_id}/pdf   # PDF export (Phase 6)
GET    /api/export/plans/{engineer_id}/csv   # CSV export (Phase 6)
GET    /api/export/skills/csv                # Skill catalog CSV (Phase 6)
```

### Health
```
GET    /api/health               # {"status":"ok","service":"MatrixPro API"}
```

**Note**: Auth, users, and teams routes are fully implemented (Phase 1). Skills, plans, and export routes are **stubs returning 501** (Phases 2-6).

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
```

### Key Patterns
- **State**: `Store.get(key)`, `Store.set(key, value)`, `Store.on(key, callback)`
- **API**: `api.get(url)`, `api.post(url, body)`, `api.put(url, body)`, `api.delete(url)`
  - Auto-injects `Authorization: Bearer <token>` from `localStorage.matrixpro_token`
  - 401 → clears token, redirects to `#/login`
- **Modals**: `showModal({ title, body, actions })` → Promise
- **Toasts**: `showToast({ message, type })` — types: success, error, info, warning
- **Skeletons**: `renderSkeleton(type)` — card, table, kanban

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
- `require_role(*roles)` — Depends on get_current_user, checks role membership
- `require_manager_of(engineer_id)` — Admin passes, manager must own the engineer
- `create_access_token(user_id)` — Returns HS256 JWT with `sub` and `exp` claims

### Role Hierarchy
- **engineer**: Own plan only, read catalog
- **manager**: Team members' plans, team matrix view
- **admin**: Everything, user/skill/team CRUD

---

## 8. Design System

**System**: Sherlock / GenAI-Wireless — dark-first, glassmorphism-accented
**File**: `frontend/css/style.css` (2,070 lines, complete)

### Key CSS Custom Properties
All color values, spacing, typography, and component styles are defined as CSS custom properties. See spec sections 7.1-7.16 for exact values.

### Dark/Light Theme
- Toggle stored in `localStorage.matrixpro_theme`
- `[data-theme="light"]` overrides on `:root`
- `prefers-reduced-motion` respected

---

## 9. Local Development

### Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # Creates DB + seed data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (separate terminal)
```bash
# Option A: Python simple server
cd frontend && python3 -m http.server 3000

# Option B: Via Docker Compose (nginx serves frontend, proxies /api)
docker compose up --build
```

### Test Credentials (from seed)
| Email | Role | Password | Notes |
|-------|------|----------|-------|
| admin@matrixpro.com | admin | password123 | Full access |
| alice@matrixpro.com | manager | password123 | Wi-Fi 6 team |
| bob@matrixpro.com | engineer | password123 | Wi-Fi 6, reports to alice |
| carol@matrixpro.com | manager | password123 | WLAN Controllers team |
| dave@matrixpro.com | engineer | password123 | WLAN Controllers, reports to carol |
| eve@matrixpro.com | engineer | password123 | Firewall, reports to carol |

### SQLite Path Auto-Detection
`config.py` auto-detects: `/data/` in Docker → `./data/` locally. No env vars needed for local dev.

---

## 10. Implementation Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Project scaffold, DB schema, design CSS, SPA shell, seed data | **COMPLETE** |
| 1 | Auth (JWT login, /me), user CRUD with RBAC, teams CRUD | **COMPLETE** |
| 2 | Skill catalog CRUD, Catalog Explorer UI (tree, cards, search) | Pending |
| 3 | My Plan kanban (drag-drop, cards, training log, audit) | Pending |
| 4 | My Team matrix (2D grid, sticky headers, drill-down) | Pending |
| 5 | Skill Explorer (search, cross-team comparison, overlap %, import) | Pending |
| 6 | Start Page (stats, animations), PDF/CSV export, polish | Pending |

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

## 12. Known Issues / Discoveries

- `visual-engineering` task category model is unavailable — use `unspecified-high` or `deep` instead
- Docker CLI uses `docker compose` (v2 plugin), not `docker-compose`
- System has Python 3.14 but backend targets 3.11+ (Dockerfile uses python:3.11-slim)
- WeasyPrint requires system-level dependencies (pango, cairo) — installed via pip but may need OS packages for PDF rendering
