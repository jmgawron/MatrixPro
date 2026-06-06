# MatrixPro — Cross-Session Knowledge Base

> **Purpose**: Reference document for OpenCode agents working on MatrixPro across sessions.
> **Last updated**: Catalog Tombstone-Delete + Non-Technical Skill Toggle — admin cascade-delete keeps plan_skills as orphaned personal artifacts with amber badge; Create Skill modal Non-Technical toggle routes to NTECH-GEN multi-shift teams.

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
- `SkillCategory` / `SkillCategoryAssoc` — extensible skill classification (Foundational, Core, Advanced, AI & Future Skills); many-to-many with Skill (see §14)

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

---

## 14. Skill Classification Framework

Adds an extensible 4-tier classification on top of the existing Domain/Team taxonomy. Skills may belong to **multiple categories** (M2M).

### Categories (seeded; backed by DB rows, NOT a Python enum)

| id | slug | name | sort_order |
|----|------|------|------------|
| 1 | foundational | Foundational | 0 |
| 2 | core | Core | 1 |
| 3 | advanced | Advanced | 2 |
| 4 | ai-future | AI & Future Skills | 3 |

Categories live in `skill_categories`; associations in `skill_category_assoc(skill_id, category_id)`. Adding a new category is a single INSERT — no code changes needed. Existing skills backfill to **Core** by default.

### Data Model
- `backend/app/models/skill.py` → `SkillCategory`, `SkillCategoryAssoc`
- `Skill.categories` relationship (M2M via association table)
- `backend/app/schemas/skill.py` → `SkillCategoryOut`, `SkillOut.categories: List[SkillCategoryOut]`, `SkillUpdate.category_ids: List[int] | None`
- `backend/app/schemas/plan.py` → `PlanSkillOut.categories` (sibling of `skill_id`/`skill_name`, NOT nested under `skill`)

### API
- `GET /api/skills/categories` → list all categories
- `GET /api/skills/?category_id=N` → filter catalog by category
- `PUT /api/skills/{id}` accepts `category_ids: [int]` to replace associations
- `GET /api/skills/{id}` returns `categories` array
- `GET /api/plans/{engineer_id}` plan_skill rows include top-level `categories` array

### Frontend
- **Catalog (Organization tab only)**: skills grouped by category as collapsible sections. Default state: **Core expanded, others collapsed**. Each section header = title + chevron + count. Cert/Non-Technical tabs untouched.
- **Edit Skill modal**: category picker (native checkboxes) inserted BETWEEN `metaRow` and `assocRow` with `<hr>` separators. Multi-select. Saves via `PUT /api/skills/{id}` with `category_ids`.
- **My Plan**: per-active-section chip toolbar (above the current section grid). Chips render all categories, ALL active by default. Toggling a chip OFF removes that category group; toggling back ON restores. Skills with multiple categories appear in EACH matching group (intentional). Uncategorized skills land in a pseudo-group. State persists across section switches via module-level `_activeCategoryFilters: Set<number>`.

### Critical Frontend Bugs Encountered
1. **Plan payload shape**: Agent assumed `planSkill.skill.categories` but API returns `planSkill.categories` at top level. Fixed in `my-plan.js` line 408 with fallback: `planSkill.categories || planSkill.skill?.categories || []`.
2. **Cache busting**: Both `frontend/js/app.js?v=N` (in `index.html`) AND `pages/my-plan.js?v=N` (in `app.js`) must be bumped together — bumping only the inner import leaves the parent app.js cached.

### CSS
- `frontend/css/style.css` §7.17 — catalog category sections (uses `.collapsible` primitive + dedicated `.catalog-category-chevron` to avoid `::before` collision with `.chevron`). **Post-polish**: editorial typography — transparent bg, 1px border-bottom rule, title 14px/600 uppercase/0.56px letter-spacing, count rendered as 11px pill. No boxed/heavy container.
- §7.18 — skill category picker in Edit modal. **Post-polish**: custom checkbox cards via `:has(input:checked)`. Native checkbox hidden (opacity:0 + position:absolute + appearance:none); explicit `<span class="skill-category-item__check">` indicator (16×16, 1.5px border, 4px radius). Card uses `--accent-soft` bg + accent border when checked. Picker container class `.skill-category-picker`; item class `.skill-category-item`.
- §7.19 — My Plan category groups. **Post-polish**: chip toolbar `#mp-category-toolbar` (class `.mp-filter-chips`, padding `0 18px` to align with `.mp-section-grid`). Groups container `.mp-category-groups-container`. Each group: `.mp-category-group` → `.mp-category-group__header` (border-bottom rule) → `.mp-category-group__name` (12px/600/uppercase/0.72px) + `.mp-category-group__count` (11px tabular-nums) → `.mp-category-group__cards.mp-section-grid`.

### Category Icon Set (final, shared across My Plan + Catalog)

| Category | Icon name | Visual |
|----------|-----------|--------|
| Foundational | `seedling` | Sprout from soil |
| Core | `diamond` | Multi-facet diamond |
| Advanced | `atom` | 3-orbit atom |
| AI & Future Skills | `sparkles` | 4-point star with sparkles |
| (uncategorized fallback) | `layers` | Stacked layers |

Canonical SVG dictionary lives in `frontend/js/pages/my-plan.js` (`SVG_ICONS`, L25+). `catalog.js` ships its own `CATEGORY_SVG_ICONS` mirror (top of file, ~L10) to avoid cross-page imports; both must stay in sync when icons change. Slug→icon map (`CATEGORY_ICON_MAP`) maps both `ai_future` (backend slug) and `ai-future` (alias) to `sparkles`.

### Catalog Module Visual Parity (post-Skill-Classification polish)

- **Organization tab section titles** (`buildCategorySection` in `catalog.js`): icon SVG injected between `.catalog-category-chevron` and `.catalog-category-title` via `categoryIconSpan(slug, '16px')`. CSS hook: `.catalog-category-icon-svg` (style.css after `.catalog-category-title`) — 16×16, `var(--text-secondary)` at 0.85 opacity, brightens to `--text-primary` on header hover.
- **Edit Skill modal category picker** (`buildSkillCategoryPicker` in `catalog.js`): replaced legacy `.skill-category-grid` of checkbox `<label>` cards with `.skill-category-chips` (NO `mp-filter-chips--inline` modifier — see Specificity Trap below) containing `<button class="mp-filter-chip skill-category-chip">` per category. Each chip carries `data-category-id` + `data-category` (slug), preselect via `.active` class from existing `categories`, click toggles `.active` + `aria-pressed`. Hidden `<input.skill-category-item__cb>` retained inside each chip and synced on toggle so existing `readSkillForm` selector (`.skill-category-item__cb:checked`) keeps working without changes. Picker container wraps chips in a bordered card (`var(--bg-card-soft)`, `--border-soft`, `--radius-md`) at style.css §7.18.
- **Modal picker active state (pill + ✓)**: `.skill-category-picker .skill-category-chip.active` ruleset at style.css L8316-8395 — `background: var(--accent-soft, rgba(59,130,246,.1))`, `border: 1px solid var(--accent, #3b82f6)`, inset accent ring via `box-shadow`, `color: var(--accent)`, `font-weight: 600`, and `::after { content: "✓" }` rendered as 14px bold accent glyph after the label. Hex fallbacks after `var(--accent, …)` for robustness. Picked unambiguously over the subtler "border-left only" sidebar variant because horizontal chip layouts have no left edge to anchor a border-left highlight on.
- **Specificity Trap (DO NOT REINTRODUCE)**: `mp-filter-chips--inline` is the LEFT-SIDEBAR variant used in My Plan's section nav. Its `.mp-filter-chips--inline .mp-filter-chip.active` rule (style.css ~L8450) uses `border-left: 3px solid var(--accent)` with the same `(0,2,0)` specificity as `.mp-filter-chip.active` and appears LATER in source order, so it silently overrides any picker-specific rules. The Edit Skill modal picker is a **horizontal** chip group, not a sidebar — its wrapper must use `class="skill-category-chips"` only (no `mp-filter-chips--inline`), and the new ruleset uses `.skill-category-picker .skill-category-chip.active` `(0,3,0)` to win cleanly.

### Validation (Playwright, post-implementation + post-polish)
- Catalog Organization tab: Foundational(7) collapsed, Core(18) expanded, Advanced(15) collapsed, AI & Future(5) collapsed. Cert tab unaffected. ✅
- Edit Skill modal: open skill 1, picker shows 4 items with Foundational+Core prechecked. Toggle Advanced ON → save → `GET /api/skills/1` returns `['Foundational','Core','Advanced']`. ✅
- My Plan (Bob, engineer 6): 4 category chips render active by default; skill 1 (cats Foundational+Core+Advanced) appears in all 3 matching groups; toggling Advanced OFF removes Advanced group; chip state persists when switching to Planned section. ✅
- **Post-polish visual verification (computed styles via Playwright)**: Catalog headers transparent + uppercase small-caps ✅; modal items hide native input + render custom check indicator with `--accent-soft` on checked ✅; My Plan toolbar `left=528.5px` matches groups container `left=528.5px` (perfect alignment) ✅; chip toggle Advanced OFF correctly drops the Advanced group from rendered list (3 → 2) ✅.
- **Pill + ✓ rollout verification (v=13)**: Removed `mp-filter-chips--inline` from `buildSkillCategoryPicker` wrapper to break specificity tie with sidebar variant. Bumped `frontend/index.html` to `css/style.css?v=13` (CSS file cache was the silent blocker — `style.css?v=12` stayed cached even after `catalog.js?v=12` reloaded, so the new picker rules were never parsed). Post-bump computed styles confirmed: active chip `bg=rgba(59,130,246,0.1)`, `color=rgb(59,130,246)`, `border=1px solid rgb(59,130,246)`, `box-shadow=rgb(59,130,246) 0px 0px 0px 1px inset`, `font-weight=600`, `::after content="✓"`. Inactive chip: white bg, slate text, soft border, no check. Save roundtrip on skill 22 (ACI Fabric Fundamentals): toggle AI & Future OFF → `PUT /api/skills/22 { category_ids: [1,2,3] }` → `GET` returns `[Foundational, Core, Advanced]` → reopen modal → preselect matches ✅. Baseline `[Foundational, Core, Advanced, AI & Future Skills]` restored. Screenshots: `modal-v13-pill-check.png` (light), `modal-v13-dark.png` (dark — note: app defaults to light body bg regardless of `data-theme` attr, but chip rules use theme-invariant accent tokens so visual identical).
- **Cache versions live**: `app.js?v=34`, `style.css?v=16`, `catalog.js?v=13`, `my-plan.js?v=22`.

### Edit Skill Modal Redesign (v=16)

**Problem**: Modal required scrolling at 1920×852 (322px overflow). Inconsistent label styles, oversized icon picker dominating viewport, vertically-stacked assoc fields wasting horizontal space.

**Approach**: Layout restructure + collapsed-by-default icon picker + visual consistency polish. No functionality changes — pure presentation.

**Layout (final)**:
- Row 1 (`.skill-edit-top-section`): 2-col grid `minmax(0,1fr) minmax(300px,340px)` with `align-items:start`. Left = Name + Description (textarea fills available space, `min-height:88px`). Right = Icon picker (collapsed) + Tags.
- Row 2 (`.skill-category-picker`): full-width horizontal chip strip (v=13 pill+✓ styling preserved).
- Row 3 (`.skill-edit-row.skill-edit-row--assoc`): 2-col grid Teams | Certs, each `.skill-assoc-section` `min-height:150px` (was 320px), `padding:12px 14px`.
- All `<hr class="skill-edit-divider">` removed from DOM; visual separation via section labels + assoc card borders.
- Section labels unified: 12px / 600 / uppercase / 0.06em letter-spacing.

**Icon picker collapsed mode (`buildIconPicker` in `catalog.js` L2052)**:
- Default state = `.skill-icon-picker--collapsed`. Shows compact preview row: 36×36 swatch (`.icon-picker-preview__swatch`) + icon name + "Change…" button (`.icon-picker-preview__toggle`). Height ~107px (was ~360px expanded).
- Click "Change…" → removes `--collapsed` class, lazy-calls `renderIcons('')` on first expand (avoids upfront DOM cost), toggle text becomes "Close", expandable search + grid revealed.
- CSS hook: `.skill-icon-picker--collapsed .icon-picker-expandable { display: none }`.
- **Hidden input safeguard**: `<input type="hidden" class="skill-icon-value">` carries selected icon name. `readSkillForm` (L2129) reads this FIRST, falls back to `.skill-icon-option.selected` only if missing. Prevents icon being wiped to `null` when user saves without ever opening the picker (the rendered `.icon-picker-categories` is empty until first expand, so `.selected` doesn't exist).

**Modal envelope** (`style.css` L1423):
- `.modal-skill-edit .modal-body { max-height: calc(92vh - 130px) }` (was 85vh). At 1920×852 → 653px usable, content = 645px, **overflow = 0**.

**Validation (Playwright, 1920×852)**:
- Modal h=776, bottom=814 vs viewport 852 (38px gap) ✅.
- modal-body overflow = 0 ✅.
- Component heights: top=264, icon-picker=107 (collapsed), category-picker=123, assoc=150 ✅.
- Icon picker expand: class removed, "Change…" → "Close", grid renders 14 category labels lazily ✅.
- Icon picker collapse cycle: class restored ✅.
- Save roundtrip on skill 22: toggle AI & Future chip OFF → `PUT /api/skills/22 { category_ids: [1,2,3] }` → `GET` returns `[foundational, core, advanced]` ✅. Icon field preserved as `"fabric"` (hidden-input safeguard worked — picker never opened during the test) ✅.
- Baseline restored: skill 22 = all 4 categories ✅.
- Screenshots: `edit-skill-v16-top.png` (collapsed), `edit-skill-v16-iconexpanded.png` (expanded).

**Cache bumps applied**: `style.css?v=15 → v=16`, `catalog.js?v=12 → v=13`.

### Edit Skill Modal v=17 Regression Fixes

Two functional regressions surfaced by user testing post-v=16:

**Bug 1 — Teams/Certs combobox dropdown collapsed to 8–10px height despite portal mount.**
- Root cause: `.combobox-multi__dropdown` (style.css L7833) sets `top: calc(100% + 4px)` for the default in-flow case. The portal variant `.combobox-multi__dropdown--portal` only overrode `z-index`, leaving `top` to resolve against `<body>` (≈856px). Combined with the inline `bottom: 217.961px` set by the portal positioning JS, this gave the fixed element conflicting top+bottom anchors that squashed it to `height ≈ 8–10px`.
- Fix (style.css L7847): extended portal rule to also set `top: auto; left: auto; right: auto`, letting inline positioning win cleanly.
- Verified via Playwright: dropdown renders at `y=336.9, h=280` with 22 options; typing "Wi-Fi" filters to `["Wi-Fi 6/6E"]`. Certs combo behaves identically (y=544, h=72).

**Bug 2 — Icon picker "Close" button left grid visible instead of collapsing.**
- Root cause: source order in §7.18-adjacent rules. `.skill-icon-picker--collapsed .icon-picker-expandable { display: none }` (L5838, specificity 0,2,0) was defined BEFORE the broader `.skill-icon-picker .icon-picker-expandable { display: flex }` (L5841, same 0,2,0 specificity) — the later rule won the cascade and overrode the collapse.
- Fix (style.css L5837): reordered so the `display:flex` base rule comes first, followed by the collapse override (`.skill-icon-picker.skill-icon-picker--collapsed .icon-picker-expandable { display: none }` — chained class bumps specificity slightly for clarity).
- Verified: Expand → `exp_display:flex, exp_h:197`; click icon → click Close → `classes:"skill-icon-picker skill-icon-picker--collapsed"`, `exp_display:none, exp_h:0, ip_h:50`.

**Cache bumps applied**: `style.css?v=16 → v=17`. `catalog.js` untouched (no JS change needed).

**Baseline preserved**: skill 22 restored to `icon=fabric, categories=[Foundational, Core, Advanced, AI & Future Skills]` after test cycles.

### Global TAC Reseed — 174 skills × 100 technology teams × 51 users (current)

**Trigger**: User request to reseed the database to model realistic global Cisco TAC operations: 25 technology team areas × 4 shifts (follow-the-sun) across Enterprise / DC / Collaboration / Security domains, plus a non-technical domain, with skills aligned to the 3E philosophy (Education / Exposure / Experience) and a full certification catalog.

**Approach**: Full `Base.metadata.drop_all` + `create_all` re-run via `python -m app.seed`. Complete catalog generation from declarative tuples.

**Domains (5 total)**:

| code | name | is_technical |
|------|------|--------------|
| ENT | Enterprise Networking | True |
| DC | Data Center | True |
| COLL | Collaboration | True |
| SEC | Security | True |
| NTECH | Non-Technical | False |

**Team taxonomy — 104 Team rows**:
- 25 technology areas × 4 shifts = 100 technical teams.
- 4 NTECH-GEN virtual teams (one per shift) attaching non-technical skills.
- Naming: `TAC-<DOMAIN>-<AREA>-SHIFT<N>` (e.g. `TAC-ENT-LANSW-SHIFT1`, `TAC-DC-ACI-SHIFT3`, `TAC-SEC-FW-SHIFT2`, `TAC-NTECH-GEN-SHIFT1`).
- Area codes:
  - **ENT (7)**: LANSW, ROUT, WLAN, SDA, SDWAN, DNAC, ARCH
  - **DC (6)**: ACI, NEXUS, UCS, MDS, HCI, CLOUD
  - **COLL (6)**: CUCM, CUBE, WEBEX, CMS, CCX, CONTCTR
  - **SEC (6)**: FW, FTD, ISE, AMP, UMBRELLA, SECARCH

**Skill catalog — 174 skills (after seed completion; spec asked ~150)**:

| Category | Count | Notes |
|----------|-------|-------|
| Foundational | 24 | Cross-cutting basics (TCP/IP, RF intro, CLI, OS, packet capture, ticketing, customer comms) |
| Core | 64 | Day-to-day operations per technology area |
| Advanced | 85 | Deep troubleshooting, multi-feature integration, escalation-grade analysis |
| AI & Future Skills | 14 | LLM-assisted triage, AI ops, telemetry/observability, automation, ChatOps |

- Avg categories/skill = 1.07 (most strict 1:1; foundational + AI skills sometimes overlap into Core).
- Every skill has 5 `SkillLevelContent` rows = **870 content rows** total (Education ×2, Exposure ×2, Experience ×1 per skill — generated via `_content_rows()`).
- Every skill carries 2–4 tags (e.g. `troubleshooting`, `escalation`, `protocol-analysis`, `customer-comms`, `automation`, `ai-assisted`).

**Certification catalog — 27 certificates across 7 domains**:

| Domain | Examples |
|--------|----------|
| Foundational | CCST, CCNA, ITIL 4 |
| Enterprise | CCNP ENCOR, ENWLSI, ENARSI, CCIE EI, CCIE Wireless |
| Data Center | CCNP DC, CCIE DC, VMware VCP-NV |
| Collaboration | CCNP Collab, CCIE Collab |
| Security | CCNP Security, CCIE Security, CISSP, GCIH, GIAC GNFA |
| Automation & DevOps | DevNet Associate, DevNet Pro, DevNet Expert, HashiCorp Terraform Assoc., Python PCAP |
| Soft Skills / Service | ITIL 4 Specialist, Customer Service Pro, Crucial Conversations |

Skills are linked to certs via `SkillCertificate` M2M when the skill maps to a known cert track.

**Roster — 51 users (all password `password123`)**:
- 1 admin: `admin@matrixpro.com`.
- 25 managers (one per technology area, placed on SHIFT1): `mgr-<area>@matrixpro.com` (e.g. `mgr-lansw@matrixpro.com`, `mgr-aci@matrixpro.com`, `mgr-fw@matrixpro.com`).
- 25 engineers (one per area, SHIFT1, reporting to the area manager): `eng-<area>@matrixpro.com` (e.g. `eng-lansw@matrixpro.com`).
- SHIFT2/3/4 teams remain empty (demonstrates the shift taxonomy without bloating the user list).

**Development plans — 25 plans, 175 plan_skills (7 each)**:
- Each engineer gets the first 7 skills from their team's skill set, with statuses rotated across `planned` / `developing` / `mastered`.
- Every `mastered` plan-skill gets a `PlanSkillTrainingLog` entry (`title`, `type=action`, `completed_at`, `notes`).
- `proficiency_level` rotates 1→2→3.

**Verification (post-seed API smoke test)**:
- `GET /api/health` → `{"status":"ok","service":"MatrixPro API"}` ✅.
- Admin login returns JWT ✅.
- `GET /api/skills/` → 174 skills, every skill has ≥1 category, distribution matches table above ✅.
- `GET /api/teams/` → 104 teams, naming convention `TAC-ENT-LANSW-SHIFT1` etc. confirmed ✅.
- `GET /api/plans/` → 25 plans ✅.

**Schema corrections required during implementation (model drift vs. earlier handoff notes)**:
1. `PlanSkillStatus` actual members are `planned` / `developing` / `mastered` — NOT the `in_pipeline` / `in_development` / `proficiency` strings used in §11 / earlier sessions. README still describes the kanban as "Pipeline / In Development / Proficiency" — those are UI labels for the same underlying enum values.
2. `PlanSkillTrainingLog` schema is `(plan_skill_id, title, type, completed_at, notes)` — NOT `(plan_skill_id, note, logged_at)`. The `type` column is a `SkillLevelContentType` enum, so seed uses `SkillLevelContentType.action` for "mastered" milestones.
3. `Certificate` has no `code` column — `code` strings (e.g. "CCIE-EI") exist only as in-memory dict keys for skill→cert lookup during seed.

**Stale references to retire (older AGENTS.md content now obsolete)**:
- §9 "Test Credentials" table (admin@/alice@/bob@/carol@/dave@/eve@) — replaced by `mgr-<area>@` / `eng-<area>@` pattern.
- §13 "Seed Data" — Bob/Dave/Eve skill assignments no longer apply.
- §14 "Catalog Reset — 24 TAC-Realistic Skills" (next section) — superseded by this entry. Kept below for historical context only.
- README §"Demo Credentials" table — out of date with the new roster (README is not authoritative for seed contents; future doc pass should sync).

**Files touched**:
- `backend/app/seed.py` — full rewrite (~1090 lines): `DOMAINS`, `TEAM_TAXONOMY`, `CATEGORIES`, `CERT_CATALOG`, 28 skill-group constants, `ALL_SKILL_GROUPS` aggregator, `_content_rows()` 3E generator, manager/engineer roster loop, plan/training-log generator.
- No frontend changes required (the new data flows through existing endpoints unchanged).

### Catalog Reset — 24 TAC-Realistic Skills (strict 1:1 category mapping)

**Trigger**: User request to reset the skill catalog with brand-new skills, balanced across all 4 categories, with strict **one category per skill** (overriding the schema's M2M capability for this dataset).

**Approach**: Full seed re-run (`python -m app.seed`) — wipes everything (users, plans, skills, logs) and reseeds from scratch.

**New catalog (24 skills, 6 per category, single category each)**:

| idx | name | category | team(s) | cert |
|-----|------|----------|---------|------|
| 0 | OSI Model & TCP/IP Fundamentals | Foundational | campus_sw, routing | CCNA |
| 1 | IPv4 Subnetting & VLSM | Foundational | campus_sw, routing | CCNA |
| 2 | Ethernet, VLANs & Trunking Basics | Foundational | campus_sw | CCNA |
| 3 | Introduction to Wireless RF | Foundational | wifi6, wlan_ctrl | CCNA |
| 4 | Cisco IOS CLI Survival Skills | Foundational | campus_sw, routing | CCNA |
| 5 | Customer Communication Essentials | Foundational | (soft skills) | — |
| 6 | Catalyst 9000 Switching Operations | Core | campus_sw | CCNP ENCOR |
| 7 | OSPF Multi-Area Design & Troubleshooting | Core | routing | CCNP ENCOR |
| 8 | Catalyst 9800 WLC Day-to-Day Ops | Core | wifi6, wlan_ctrl | CCNP ENWLSI |
| 9 | ASA Firewall Policy & NAT | Core | firewall | CCNP Security |
| 10 | AnyConnect Remote-Access VPN | Core | firewall, vpn_team | CCNP Security |
| 11 | CUCM Dial Plan & Call Routing | Core | uc_team | CCNP Collab |
| 12 | BGP Route-Reflector & Confederation Design | Advanced | routing | CCIE EI |
| 13 | SD-Access Fabric Deep Dive | Advanced | campus_sw, sdwan_team | CCIE EI |
| 14 | FTD Threat Tuning & Snort Rules | Advanced | firewall | CCIE Security |
| 15 | ACI Multi-Pod & Multi-Site | Advanced | aci_team | CCIE DC |
| 16 | DMVPN Phase 3 & FlexVPN Deep Dive | Advanced | vpn_team, routing | CCIE Security |
| 17 | Zero Trust Architecture & Microsegmentation | Advanced | ise_team, firewall | — |
| 18 | LLM-Assisted Log Triage | AI & Future Skills | (cross-team) | — |
| 19 | Webex AI Assistant Configuration | AI & Future Skills | webex_team | — |
| 20 | Python & pyATS Network Automation | AI & Future Skills | campus_sw, routing | DevNet Pro |
| 21 | Terraform for Cisco Infrastructure | AI & Future Skills | aci_team, sdwan_team | DevNet Pro |
| 22 | DNAC Predictive Wireless Insights | AI & Future Skills | wifi_assurance, wifi6 | — |
| 23 | ThousandEyes + Splunk AIOps | AI & Future Skills | (cross-team) | — |

**plan_assignments rewrite**: All 9 engineer assignments re-mapped to valid indices (0-23) aligned with each engineer's team domain. Old code referenced indices 23/24/25 (out of bounds for new 24-skill catalog). Engineer→indices:
- bob (Wi-Fi 6): [3, 8, 0] · dave (WLAN): [8, 3, 4] · eve (Firewall): [9, 14, 10] · henry (ISE): [17, 9, 14]
- ivan (Campus SW): [2, 6, 20] · julia (Routing): [7, 12, 10] · kevin (SD-WAN): [16, 21, 17]
- lisa (Webex): [11, 19, 23] · mike (ACI): [15, 6, 21]

**API verification** (admin token, `GET /api/skills/`):
- Total skills = 24 ✅
- Per-category counts = `{Foundational: 6, Core: 6, Advanced: 6, AI & Future Skills: 6}` ✅
- Skills with >1 category = 0 ✅ (strict 1:1 enforced)
- Skills with 0 categories = 0 ✅
- Bob's plan (engineer_id=6): 3 skills, all reference valid new catalog ids (4/9/1), categories populated at top-level of plan_skill payload ✅

**Stale references to retire**:
- Old per-engineer skill IDs in §13 ("Bob(4) has skills 1,2,4 …") — no longer valid. Bob is now `engineer_id=6` and has plan skills referencing catalog ids 4, 9, 1.
- Skill 22 baseline mentioned in earlier sections — skill 22 is now `DNAC Predictive Wireless Insights` (AI & Future), no longer `ACI Fabric Fundamentals`. Old AI testing references to skill 22 are obsolete.
- Old Carol-manages-Dave-and-Eve cross-team detail in §13 still holds (seed retains that structure).

**Schema clarification**: Model name in code is `SkillCategoryAssignment` (not `SkillCategoryAssoc` as stated in §4). AGENTS.md §4 has minor documentation drift — code is authoritative.

**Files touched**: `backend/app/seed.py` only (`skill_category_map`, `skill_defs`, `plan_assignments`).

### LANSW Shift-2 Overlay — Realistic LAN Switching dataset (current)

Adds a destructive overlay on top of the global TAC reseed so the `TAC-ENT-LANSW-SHIFT2` team has a deep dataset for demos. Runs as the last step of `python -m app.seed` via `_seed_lansw_shift2(db)` in `backend/app/seed.py`.

**18 LANSW skills (strict 1:1 category, replaces overlapping LANSW catalog)**:

| # | Category | Skill |
|---|----------|-------|
| 1 | Foundational | Layer 2 Switching Fundamentals |
| 2 | Foundational | VLANs, Trunking & VTP |
| 3 | Foundational | Spanning Tree: STP, RSTP & MST |
| 4 | Foundational | EtherChannel & Link Aggregation (LACP/PAgP) |
| 5 | Foundational | First Hop Redundancy (HSRP/VRRP/GLBP) |
| 6 | Core | Layer 3 Switching & Inter-VLAN Routing |
| 7 | Core | Catalyst 9000 IOS-XE Operations |
| 8 | Core | Stacking & StackWise Virtual |
| 9 | Core | QoS on Campus Switches |
| 10 | Core | Multicast on Campus (IGMP/PIM-SM) |
| 11 | Core | DHCP, DHCP Snooping & Dynamic ARP Inspection |
| 12 | Core | 802.1X, MAB & MACsec Switchport Security |
| 13 | Advanced | VXLAN EVPN Campus Fabric |
| 14 | Advanced | SD-Access Underlay & Fabric Edge Troubleshooting |
| 15 | Advanced | Stack/SVL Split-Brain & ISSU Recovery |
| 16 | Advanced | Catalyst Hardware ASIC & TCAM Troubleshooting |
| 17 | Advanced | EPC, ELAM & FED Packet Capture |
| 18 | Advanced | Campus Telemetry: Model-Driven & gNMI/YANG |

- All 18 bound to all 4 LANSW shift teams (SHIFT1-4) so catalog stays cross-shift consistent.
- Each gets 18 `SkillLevelContent` rows (6 Education L1 / 6 Exposure L2 / 6 Experience L3) via `_content_rows()`.
- Certs: foundational/core → `CCNA` + `CCNP-ENCOR`; advanced → `CCIE-EI`.
- Pre-step: detaches all `SkillTeam` rows for the 4 LANSW shifts before creating the 18 — idempotent within a reseed.

**7 users on `TAC-ENT-LANSW-SHIFT2` (team_id=2)**, password `password123`:

| Email | Role | Reports to |
|-------|------|-----------|
| `alice@matrixpro.com` | manager | (none) |
| `bob@matrixpro.com` | engineer | alice |
| `caden@matrixpro.com` | engineer | alice |
| `daniela@matrixpro.com` | engineer | alice |
| `ethan@matrixpro.com` | engineer | alice |
| `fiona@matrixpro.com` | engineer | alice |
| `grace@matrixpro.com` | engineer | alice |

**Plans (6 engineers × 18 = 108 plan_skills)**:
- Each engineer gets ALL 18 LANSW skills.
- Status from deterministic weighted pool (`rng = random.Random(20260524)`): ~30% mastered / ~50% developing / ~10% planned / remaining 10 sub-weighted 3/5/2. Verified Bob: 4 mastered / 13 developing / 1 planned. Across the 6: 4-8 mastered, 7-13 developing, 1-3 planned.
- **Mastered**: all 18 content rows complete in `UserContentCompletion` with `completed_at` spread across last 6 months. `proficiency_level=5`. One `PlanSkillTrainingLog` entry (`type=action`, current-quarter).
- **Developing**: subset of 3E rows complete (Education always, Exposure partial, Experience rare) — `completed_at` within current quarter. `proficiency_level` 2/3/4/5 by 3E depth. One in-progress log.
- **Planned**: 0 completions, `proficiency_level=NULL`, 0 logs.

**Verification (post-seed)**:
- Bob (`id=43`): 18 skills, 174 `UserContentCompletion` rows, 31 `PlanSkillTrainingLog` rows.
  - Mastered "Layer 2 Switching Fundamentals" → 18 completions, prof=5, 1 log ✅
  - Developing "VLANs, Trunking & VTP" → 13 completions, prof=5, 1 log ✅
  - Planned "Spanning Tree: STP, RSTP & MST" → 0 completions, prof=null, 0 logs ✅
- Alice (mgr, `team_id=2`): `GET /api/plans/` returns 6 plans, each 18 skills ✅.
- Final DB counts: 84 teams, **70 skills** (52 base + 18 LANSW), 1260 content rows, 48 users, 26 plans, 227 plan_skills.

**Cert-name lookup gotcha**: `CERT_CATALOG` rows are `(code, name, description)`; persisted as `Certificate.name = <full name>`. Overlay queries by name, uses internal `cert_code_to_name` dict mapping `"CCNA" → "Cisco Certified Network Associate"`, `"CCNP-ENCOR" → "CCNP Enterprise Core"`, `"CCIE-EI" → "CCIE Enterprise Infrastructure"` — must stay in sync with `CERT_CATALOG` in main seed body.

**Stale references to retire**:
- §9 "Test Credentials" + README "Demo Credentials" table — alice/bob are NOW on `TAC-ENT-LANSW-SHIFT2` (LANSW Shift-2), not Wi-Fi 6. Carol/Dave/Eve no longer exist as those names — the global reseed uses `mgr-<area>@` / `eng-<area>@` for all OTHER teams.
- Previous "25 managers + 25 engineers" stat — current totals: 1 admin + 20 base managers + 20 base engineers + 1 LANSW mgr (alice) + 6 LANSW engineers = **48 users**.

**Files touched**: `backend/app/seed.py` — added `timedelta` to datetime import; added `LANSW_SHIFT2_SKILLS` + `LANSW_SHIFT2_USERS` constants and `_seed_lansw_shift2()` helper above `run()`; wired call into `run()` after main plan loop.

### Personalized 3E Content for LANSW Shift-2 (current)

Adds per-engineer `UserLevelContent` rows on top of the global catalog so each LANSW Shift-2 engineer sees realistic personal 3E items in My Plan, unique per persona, never duplicating the catalog.

**Personas (`LANSW_ENGINEER_PERSONAS` in `backend/app/seed.py`)** — one per engineer, drives the template pool:

| Engineer | Tone | Specialization | Sample item flavor |
|----------|------|----------------|--------------------|
| bob@ | lab-first | Lab automation & repro engineer | "Build a CML sandbox reproducing the top-3 issues" / "Automate a regression suite in pyATS" |
| caden@ | customer-first | Customer-facing escalation engineer & mentor | "Co-pilot 3 customer calls" / "Own ≥3 high-touch escalations end-to-end" |
| daniela@ | forensic | Deep-dive packet-level troubleshooter | "Capture & dissect a live flow with EPC+ELAM" / "Drive a forwarding-plane RCA" |
| ethan@ | writer | Documentation & RCA writer | "RCA template library" / "Publish 2 KB articles covering common pitfalls" |
| fiona@ | innovator | AI/automation & innovation engineer | "Wire LLM-assisted log triage into a lab pipeline" / "Ship an AIOps prototype" |
| grace@ | learner | Junior engineer ramping on fundamentals | "Anki flashcards" / "Shadow 2 SRs with a senior" / "Own a sev-3 SR with mentor review" |

**Generator (`_personal_items_for(skill_name, persona, level, rng)`)**: returns 1-2 items per (engineer, skill, level=1/2/3), parameterized by persona tone. Each item is a tuple `(content_type, title, description, url_or_None)`. Description always namedrops the engineer + a persona interest (`pyATS`, `mentoring`, `EPC`, etc.) so items read as that engineer's actual personal artifacts. Pool size: 2 items per (tone, level), randomly shuffled, sliced to 1-2.

**Completion rules**:
- `mastered` → all personal items complete; `completed_at` ∈ last 300 days.
- `developing` → probabilistic per level: L1 (Education) 85% done, L2 (Exposure) 45%, L3 (Experience) 15%; `completed_at` ∈ last 85 days.
- `planned` → nothing complete, no `completed_at`.

**Volume (verified after seed)**:
- **496** `UserLevelContent` rows total across 6 engineers × 18 skills × 3 levels × 1-2 items.
- Per-engineer distribution: bob=83, caden=86, daniela=80, ethan=83, fiona=83, grace=81 (variance from `rng.randint(1, 2)` slice).
- Completion by status: mastered 160/160 done; developing 154/(154+128)≈55%; planned 0/54.

**Validation (sqlite-level, post-seed)**: sample of Bob's items confirms persona voice intact ("Bob's lab notebook — Layer 2 Switching Fundamentals repro recipes", "Automate a … regression suite in pyATS"); distinct titles per skill; no overlap with global `skill_level_content` rows. Items consumed by `routers/plans.py:851` and rendered alongside catalog items with `is_user_content=true`.

**Files touched**: `backend/app/seed.py` only — added `UserLevelContent` to model imports, added `LANSW_ENGINEER_PERSONAS` dict + `_PERSONAL_VERB_BY_LEVEL` + `_personal_items_for()` helper above `_seed_lansw_shift2()`, injected per-(engineer, skill) personalization block inside the plan-building loop after the status branch.


---

## 15. Search Implementation — COMPLETE ✅

**Status**: Production-Ready (May 25, 2026)  
**Lines of Code**: 4,450+ (production + tests + docs)  
**Test Coverage**: 32/32 passing (100%)  
**Load Tested**: 100k items, 186.4 queries/sec concurrent

### Overview
Full-text search endpoint for skill development content with fuzzy matching, proximity-based result grouping, cursor pagination, and comprehensive load testing.

### Architecture
- **FTS5 virtual table** with trigram tokenizer (~80% typo tolerance)
- **Proximity bucketing** (engineer → team → domain → global) with BM25 ranking
- **Cursor-based pagination** (stable across insertions/deletions)
- **Trigger-based sync** (real-time) + nightly batch job (safety net)
- **Full RBAC** enforcement (server-side)

### API Endpoint
```
GET /api/plans/{engineer_id}/skills/{skill_id}/content/search
  ?q=<query>&level=<1|2|3>&limit=<1-1000>&cursor=<base64>
```

Response: Grouped results by proximity bucket, next_cursor, has_more, total_count.

### Performance (100k items)
| Metric | Value |
|--------|-------|
| Item generation | 20,977 items/sec |
| Query latency (limit 1000) | 3.42ms |
| Query latency (filtered) | 21–148ms |
| Concurrent queries (50) | 186.4 queries/sec |
| Pagination latency | 0.52ms avg |

### Capacity & Scaling
- **SQLite**: ≤100k items, ≤20 concurrent users, <100ms p95 latency
- **Postgres**: ≤1M items, 100+ concurrent users, <50ms p95 latency
- **Migration**: 2–4 hours (documented in `docs/postgres_migration_runbook.md`)

### Files
**Core** (6 files, 750 lines):
- `backend/app/migrations.py` — FTS5 setup, 6 indexes, 3 sync triggers
- `backend/app/search_utils.py` — SearchCursor, ProximityBucketer, BM25Ranker
- `backend/app/routers/search.py` — FastAPI endpoint, RBAC, cursor pagination
- `backend/app/tasks.py` — Nightly sync job, orphaned entry detection
- `backend/app/main.py` — Search router registration, migrations startup
- `backend/app/routers/__init__.py` — Search module export

**Tests** (3 files, 1,242 lines, 32 tests):
- `backend/tests/test_search.py` — 21 unit tests
- `backend/tests/test_search_integration.py` — 7 integration tests
- `backend/tests/test_search_load.py` — 4 load tests (100k items)

**Documentation** (7 files, 2,458 lines):
- `docs/search_architecture.md` — Complete architecture decision document
- `docs/postgres_migration_runbook.md` — Phase 1–5 migration guide
- `docs/IMPLEMENTATION_SUMMARY.md` — Deployment checklist
- `SEARCH_IMPLEMENTATION_CHECKLIST.md` — Quick reference
- `DEPLOYMENT_VERIFICATION.md` — Pre-deployment verification
- `SEARCH_README.md` — Main entry point
- `LOAD_TEST_RESULTS.md` — Comprehensive load test report
- `SEARCH_IMPLEMENTATION_COMPLETE.md` — Final completion summary

### Key Decisions
1. **FTS5 + cursor pagination** (8.3/10) vs application-layer ranking (6.8/10)
2. **Trigger-based sync** (real-time) + nightly batch (safety net)
3. **Base64-encoded JSON cursor** for stable pagination
4. **Single query with CASE-based bucketing** (avoid N+1)

### Deployment
```bash
# Pre-deployment
cd backend && python -m pytest tests/test_search*.py -v
cp data/matrixpro.db data/matrixpro.db.backup.$(date +%s)

# Production
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
sqlite3 data/matrixpro.db "SELECT COUNT(*) FROM user_content_fts;"

# Schedule nightly sync (APScheduler, Celery, or cron)
```

### Verification Checklist
- ✅ All 6 implementation files compile (Python 3.14)
- ✅ All 32 tests passing (100%)
- ✅ Load tests validated at 100k items
- ✅ Query performance <100ms (95th percentile)
- ✅ Concurrent query capacity 186.4 queries/sec
- ✅ Pagination stable across all pages
- ✅ RBAC enforced server-side
- ✅ FTS5 index created and synced
- ✅ Nightly sync job implemented
- ✅ Postgres migration path documented
- ✅ Deployment steps documented
- ✅ All documentation complete

### Git Commits
- `4a86e1d` — Initial search implementation (6 files, 750 lines)
- `fa44067` — Test fixture fixes (imports, model fields)
- `d341793` — Load test suite + results (680+ lines, 32/32 passing)
- `fd4b861` — Final completion summary

### Next Steps
1. Deploy to production (follow deployment steps above)
2. Monitor query performance in real-world usage
3. Plan Postgres migration when scale increases (items > 50k OR users > 20)
4. Refer to `SEARCH_README.md` for quick start

**Project Status**: ✅ **COMPLETE** — Ready for immediate production deployment.

---

## 16. Context-Scoped Personalized Learning Content Library — IN PROGRESS

**Status**: Tickets 1–8 complete; browser e2e + tests + html→md migration CLI pending.
**Scope**: Replaces the "Add My Item" flow on My Plan → Skill Card with a dual-purpose library: (a) Create New (Markdown-source-of-truth editor), (b) Discover Existing (elastic search with 3-tier org-proximity ranking, multi-select, FULL-copy import).

### Architecture Decisions (locked)
- **1A**: Reject levels 4–5 at API boundary (level ∈ {1,2,3} enforced server-side).
- **2C**: Owner-only mutation via `_require_owner` dep on user-content PUT/DELETE/complete.
- **3A**: Hard delete (FTS5 trigger removes index row).
- **4A**: `user_level_content.description_format` ∈ {`legacy_html`,`markdown`}; SQL default `legacy_html`; Python default `markdown`.
- **5A**: `plan_skill_id` nullable + `ON DELETE SET NULL` so user content survives plan-skill removal.
- **6A**: Store raw Markdown; sanitize once with DOMPurify on render.
- **6B**: FULL replacement of `openUserContentEditor` (legacy editor deleted).
- **6C**: Backend html→md conversion at import via `markdownify(heading_style="ATX")`.
- **6D**: Create-tab is a two-step wizard (metadata → editor).
- **6E**: Discover default shows team recent (empty `q`).
- **6F**: Partial imports → toast + keep modal open + highlight skipped cards.

### API (router prefix `/api/plans`, registered `main.py:44`)
- `GET /{eid}/skills/{sid}/library/search?level=N&q=…&cursor=…&limit=20` → flat `{results:[{id,title,description,description_format,url,created_at,user_id,is_private,owner_name,bucket,bucket_label,score,is_mine}], next_cursor, has_more}`. Frontend groups by bucket client-side via `groupByBucket()`.
- `POST /{eid}/skills/{sid}/library/import?level=N` body `LibraryImportRequest{source_ids:list[int]}` → `{imported:[UserContentResponse], skipped:[{id,reason}]}`. Skip reasons: `not_found` | `scope_mismatch` | `private` | `duplicate`. Position starts `max+10` from 1000; import cap 50.
- User-content CRUD lives in `routers/plans.py`: `POST /{eid}/skills/{plan_skill_id}/user-content`, `PUT/DELETE .../{item_id}`, `POST .../complete`.
- 3-tier ranking constants: `BUCKET_LABELS={1:"From my team",2:"From my domain",3:"From other teams"}`; cursor shape `{bucket, score, id}` base64-encoded.

### Data Model Changes (`backend/app/models/plan.py:117`)
- `user_level_content` columns: `id, plan_skill_id (nullable, ON DELETE SET NULL), user_id, skill_id, level, type, title, description, description_format, url, is_private (NOT NULL DEFAULT 0), position, created_at, updated_at, source_user_content_id`.
- FTS5 virtual table `user_content_fts` tokenizer `'trigram case_sensitive 0'`; sync triggers on INSERT/UPDATE/DELETE.

### Frontend
- **New components**:
  - `frontend/js/components/library-modal.js` — tabs `create|discover`; create-tab two-step wizard; discover-tab infinite-scroll (IntersectionObserver, 250ms debounce); multi-select (50 cap); skipped-card highlight after partial import.
  - `frontend/js/components/markdown-editor.js` — Quill 2.0.3 (markdown source); marked@12.0.2 for render; turndown@7.2.0 for legacy paste; DOMPurify@3.1.7 whitelist render-time only. Config `gfm:true, breaks:true, headerIds:false, mangle:false`.
- **Wiring** (`frontend/js/pages/my-plan.js`): `openLibraryModal` imported L8; called from add-item button L1448 + bulk-add bucket L1544; legacy `openUserContentEditor` fully removed (file is 2346 lines).
- **CSS**: `frontend/css/style.css §7.20 Library Modal` (~380 new lines, lines 2289–2818). All 52 BEM selectors styled via theme tokens (`--bg-card`, `--bg-card-soft`, `--border-soft`, `--accent`, `--accent-soft` w/ rgba fallback, `--text-primary`, `--text-secondary`, `--radius-md`, `--radius-lg`, `--space-*`, `--motion-fast` w/ 0.15s fallback). Sub-sections: Layout, Tabs, Create wizard, Discover, Cards, Footer & status, Focus & motion. Hardcoded colors limited to danger `#ef4444` + amber `#f59e0b` (with alpha). `prefers-reduced-motion` respected; `:focus-visible` rings on all interactive elements.

### Cache Versions (current)
- `frontend/index.html`: `style.css?v=25`, `app.js?v=36`.
- `frontend/js/app.js`: `pages/my-plan.js?v=24`.
- `library-modal.js`, `markdown-editor.js` have no `?v=` pin — cache-bust transitively via `my-plan.js?v=24`.

### Library Modal CSS gotchas (v=24)
- **Global form-input rule leaks into modal**: `input, select, textarea { width: 100%; … }` from global form styles forces `.library-modal__card-cb` (Discover checkbox) and `.library-modal__privacy-cb` (Create checkbox) to 100% width unless explicitly overridden. Fixed at style.css L2649 and L2498 with `width: auto; flex: 0 0 auto; padding: 0; border: 0; background: transparent` defensive overrides.
- **`mp-form-hint` and `form-group` carry their own `margin-bottom` (12px and 16px)** from global form helpers. When placed inside a flex container with `gap: 16px`, the bottom margins **stack** on top of the flex gap, yielding 28–32px effective spacing instead of 16px. Fixed at style.css ~L2410 with `.library-modal__step-panel > .mp-form-hint, .library-modal__step-panel > .form-group { margin: 0 }` — neutralizes legacy margins so flex `gap` is the single source of vertical rhythm.
- **`.btn` inside flex column stretches to 100%** because `.btn { display: flex }` + parent `flex-direction: column` makes `align-items: stretch` (the default) blow buttons out to full column width. Fixed for `.library-modal__next-btn` and `.library-modal__back-btn` with `align-self: flex-end; flex: 0 0 auto; min-width: 160px; width: auto`.
- **Stepper separator visual weight**: 60px × 1px line floated mid-gap between pills. Tightened to `flex: 0 1 32px; height: 2px; border-radius: 2px` so it visually anchors between pill centerlines.

### Test Fixtures (Bob — LANSW Shift-2)
- `bob@matrixpro.com` / `password123`
- `user_id=43`, `plan_id=43`, `team_id=2` (`TAC-ENT-LANSW-SHIFT2`)
- `skill_id=53` = "Layer 2 Switching Fundamentals" (L1), `plan_skill_id=120`
- Verified backend smoke (post-`created_at` SQLite-string fix in `library.py` results-builder ~L210):
  - Library search no-q → 5 L1 results, bucket=1, `has_more=true`
  - Import POST `{source_ids:[417]}` → new ULC id=497, `source_user_content_id=417`, `position=11`, `description_format='markdown'`
  - FTS5 trigram: `q=switching` matches imported row; `q=catalyst` returns 0 (confirmed via SQL — no L1 catalyst content in skill 53)
- 28/28 search regression tests still passing.

### Backend Files Touched
- `backend/app/routers/library.py` — NEW. Search L94–250 + import L256–356. `created_at` string-safe coercion `~L210` (SQLite returns str not datetime from raw SQL).
- `backend/app/routers/plans.py` — owner-only deps (L89, L823, L1065/1149/1215/1273).
- `backend/app/routers/search.py` — 3-tier ranking rewrite.
- `backend/app/schemas/plan.py` — `LibraryImportRequest{source_ids}` L179; `UserContentCreate/Update` L138/148.
- `backend/app/main.py` — library router registered L44.
- `backend/app/migrations.py` — idempotent rewrite (FTS5 + nullable FK + format column).
- `backend/app/seed.py` — re-runnable via `python -m app.seed` (LANSW personas preserved).
- `backend/requirements.txt` — `markdownify>=0.13.1`.

### Tickets — ALL COMPLETE ✅
- **9**: ✅ DONE — `backend/tests/test_library.py` 21/21 green. Coverage: scope-leak (skill_id/level boundaries), privacy filter (own private visible, others' private hidden), import roundtrip (source_user_content_id preserved, FULL copy semantics), html→md conversion via markdownify on import, deduplication detection, position assignment (max+10 step), 3-tier bucketing (team/domain/others), cursor pagination correctness, FTS5 trigram fuzzy match. Full suite: 49/49 (21 library + 28 search regression). Sample run: `21 passed, 694 warnings in 1.08s`.
- **10**: ✅ DONE — `backend/app/migrations_html_to_md.py` (136 lines). Idempotent CLI; dry-run by default; `--apply` commits in 100-row batches; `--db PATH` overrides `DATABASE_URL` before `app.database` import. Empty descriptions flip format flag only. Verified `--help` clean + dry-run reports `0 legacy_html row(s)` against current reseeded DB (expected — no pre-library content exists yet).
- **Browser e2e** (Playwright): ✅ DONE — login as bob@matrixpro.com → `/my-plan` (18 skills) → click `.mp-card` opens skill-detail modal with full 3E content + Bob's personalized "lab notebook" item visible (Ticket 7 personas working) → `openLibraryModal` invocation renders modal with Create/Discover tabs and "Add Education Item" title → Discover tab fetches `/api/plans/43/skills/53/library/search` and renders 9 cards with search input. End-to-end smoke PASSES.

### Cursor Bugfix (post-Ticket-9)
- `backend/app/routers/library.py:183` — within-bucket cursor pagination was using `id > :cursor_id` (returned newer rows that were already shown). Fixed to `id < :cursor_id` to descend monotonically with `ORDER BY id DESC`. Test case: ids 1–9 sorted `created_at DESC` = [9..1]; old `id > 7` returned [9,8] (already-shown duplicates); fix `id < 7` yields [6,5,4] correctly.

### Reseed Footgun (CRITICAL)
- `backend/tests/test_search_integration.py` calls `Base.metadata.drop_all` against the live `data/matrixpro.db` (not an in-memory test DB). Running this test wipes the seeded users/plans/skills, breaking subsequent UI login attempts.
- **Mitigation**: After running `pytest tests/test_search_integration.py`, ALWAYS re-run `python -m app.seed` before starting the frontend dev server.
- Verified post-reseed state: 48 users, 26 plans, 70 skills, 1260 SkillLevelContent rows, 227 plan_skills. Login + my-plan flow re-validated.

### Final Cache Versions (production-ready)
- `frontend/index.html`: `style.css?v=21`, `app.js?v=36` ✅
- `frontend/js/app.js`: `pages/my-plan.js?v=24` ✅
- All transitive imports (library-modal.js, markdown-editor.js) bust via my-plan.js parent ✅

### Stale references retired
- "Add My Item" button labels in `my-plan.js` — now reads "+ Add My {Education|Exposure|Experience} Item" launching Library Modal.
- `openUserContentEditor` (legacy modal builder) — deleted from `my-plan.js`.


---

## 17. Catalog Tombstone-Delete + Non-Technical Skill Toggle (current)

**Status**: Implemented + verified (8/8 Playwright tests PASS, both themes). Uncommitted at HEAD `6a924d3`.

### Feature 1 — Cascade-Delete (Tombstone)
Admin Catalog gets a **Delete** danger button alongside the existing Edit/Archive controls. Two-branch behavior:

- **Hard delete** (zero engineers have it in any plan): row is removed from `skills` plus all assoc tables (`SkillTag`, `SkillTeam`, `SkillCertificate`, `SkillCategoryAssignment`, `SkillLevelContent`).
- **Tombstone delete** (≥1 engineer has it in their plan): `skills` row kept with `is_archived=True` + `is_orphaned=True`; all catalog assocs stripped; `PlanSkill`, `PlanSkillTrainingLog`, `UserLevelContent`, `UserContentCompletion` rows **preserved untouched**. Skill becomes a per-engineer personal artifact.

Confirmation uses a **typed-confirmation modal** showing engineer count + log count. Danger button stays disabled until the user types the exact skill name.

**Backend**:
- `models/skill.py:35` — `is_orphaned: bool` column (default False).
- `migrations.py` — `_ensure_skills_columns()` idempotent ALTER for legacy DBs.
- `routers/skills.py:519` — `GET /api/skills/{id}/cascade-preview` returns `{engineer_count, log_count, will_tombstone}`.
- `routers/skills.py:563-607` — `DELETE /api/skills/{id}/cascade` (admin only). Branches at L589 on engineer count.
- `routers/plans.py:164` — `PlanSkillResponse.is_orphaned` populated from joined skill.
- Existing soft-archive `DELETE /api/skills/{id}` **unchanged** (Archive button still works independently).

**Frontend**:
- `catalog.js:932-939` — Delete danger button next to Edit/Archive.
- `catalog.js:2392+` — `handleCascadeDeleteSkill` typed-confirm modal.
- `my-plan.js:734-737` — amber "Personal — removed from catalog" badge when `plan_skill.is_orphaned === true`.
- `style.css` §7.21/§7.22/§7.23 — danger button, typed-confirm modal, orphan badge styles (token-driven, light+dark).


### Skill Modal Redesign (v=19) — Sectioned Layout + Functional Non-Tech Toggle

**Structure**:
1. **Identity** (Name, Description, Tags)
2. **Classification** (Non-Technical Toggle, Category Picker)
3. **Associations** (Teams ↔ NTECH Shifts swap, Certifications)
4. **Visual** (Icon Picker, collapsed by default)

**Toggle Behavior & Confirmation**:
- Replaced the old checkbox with an iOS-style toggle switch (`.toggle-switch`).
- It is now visible and functional in **both** Create and Edit modes.
- In Edit mode, flipping the toggle and submitting triggers a typed confirmation flow via `showConfirm`. The prompt is populated by pre-fetching `GET /api/skills/{id}/reclassify-preview` on modal open.
- The confirm dialog lists how many engineers will be affected.

**Sticky Chrome inside `.modal-body`**:
- The main modal `.modal-header` and `.modal-footer` are moved via JS into `.modal-body` and given `.skill-edit-modal__sticky-header` / `.skill-edit-modal__sticky-footer` classes.
- This allows them to stay sticky while the `.modal-body` handles all scrolling. `margin` compensations handle the `.modal-body` padding.
- `showModal`'s native Promise-based flow relies on closures, so reparenting the elements doesn't break their event handlers.

**CSS Hooks & Specificity (§7.24)**:
- `.skill-edit-section`, `.skill-edit-section__header`, `.skill-edit-section__title`, `.skill-edit-section__body`
- `.skill-edit-classification-row` and `.skill-ntech-toggle-group`
- `.toggle-switch`, `.toggle-switch__input`, `.toggle-switch__track`, `.toggle-switch__thumb`
- `prefers-reduced-motion` applies to the thumb and track transitions.
- Focus outline relies on `.toggle-switch__input:focus-visible + .toggle-switch__track`.

**Cache Versions Bumps**:
- `frontend/index.html` → `css/style.css?v=39`, `js/app.js?v=37`
- `frontend/js/app.js` → `pages/catalog.js?v=19`

### Feature 2 — Non-Technical Skill Toggle (Legacy Create-only)
Create Skill modal gets a "Non-Technical Skill" checkbox above the team picker. When ON:
- Standard team picker hidden, replaced by NTECH-GEN-SHIFT{1..4} 4-shift checkbox group (all checked by default).
- Banner explains "This skill will be added to the Non-Technical catalog across all 4 shifts."
- Backend auto-routes skill under domain `NTECH` and creates `SkillTeam` rows for selected NTECH shift teams (ids 81-84).
- Validation rejects mixing NTECH teams with regular teams.

Edit modal does **not** get the toggle (intentional — change-of-classification not supported; admin can delete + recreate).

**Backend**:
- `schemas/skill.py` — `SkillCreate.is_non_technical: bool` (default False).
- `routers/skills.py` — `create_skill` validates + auto-assigns NTECH-GEN teams when flag set.
- `routers/skills.py` — `GET /api/skills/ntech-teams` returns the 4 shift teams for the picker.

**Frontend**:
- `catalog.js:1897-1925` — Toggle + NTECH picker (Create modal only; guarded by `mode === 'create'`).
- `catalog.js:2280-2295` — `readSkillForm` extended to emit `is_non_technical` + `team_ids` from NTECH picker.

### Cache versions (current)
- `frontend/index.html`: `style.css?v=38`, `app.js?v=37`
- `frontend/js/app.js`: `pages/my-plan.js?v=27`, `pages/catalog.js?v=18`

### Verification (8/8 PASS, dual-theme)
1. Hard delete skill 8 (0 engineers) → row gone, 404 on GET ✅
2. Tombstone delete skill 53 (6 engineers, 6 logs) → `is_archived=is_orphaned=True`, plan_skills intact ✅
3. Orphan badge on bob's My Plan, light + dark ✅
4. Non-Tech toggle in Create modal → 4 NTECH shifts visible + banner ✅
5a. Edit modal has NO Non-Tech toggle ✅
5b. Archive still works (separate code path from cascade) ✅
5c. Kanban + category chip filters unaffected ✅
6. Reseed clean: 70 skills, 48 users, 26 plans ✅

Screenshots stored in repo work area: `ntech-toggle-on-{light,dark}.png`, `orphan-badge-{light,dark}.png`, `regression-myplan-dark.png`.

### Critical implementation notes
- **NTECH team ids 81-84** are seeded by the global TAC reseed (§14) — do not hardcode IDs; resolve by `Team.name LIKE 'TAC-NTECH-GEN-SHIFT%'` if reseed pattern changes.
- **Cascade preserves**: `PlanSkill, PlanSkillTrainingLog, UserLevelContent, UserContentCompletion`. **Strips**: `SkillTag, SkillTeam, SkillCertificate, SkillCategoryAssignment, SkillLevelContent`.
- `is_orphaned` is a **separate flag** from `is_archived` so future admin UI can distinguish "archived for retirement" vs "deleted but tombstoned for owners".
- Typed-confirmation modal is the same primitive as the destructive delete patterns elsewhere — reuse, don't reimplement.

---

## 18. App Icon — Matrix Brackets / 3×3 Status Grid (current)

Custom MatrixPro app icon. Concept: matrix brackets framing a 3×3 grid of three glyphs that map 1:1 to `PlanSkillStatus` enum values — filled rounded square = `developing`, outlined circle = `planned`, square+check = `mastered`. **Theme-aware**: dark variant (navy bg + light-blue ink `#0a1628` / `#5cb1ff`) for dark mode, light variant (white bg + accent-blue ink `#ffffff` / `#3b82f6`) for light mode. Same artwork survives 16-px favicon → 192-px launcher.

### Files & wiring
- **`frontend/icon.svg`** — standalone SVG (dark variant) for browser favicon via `<link rel="icon" type="image/svg+xml" href="icon.svg?v=1">` in `index.html` head. Favicon stays dark across browser themes (acceptable for tab favicons; could later be enhanced with `prefers-color-scheme` media queries inside the SVG if desired).
- **`frontend/index.html` body top** — hidden `<svg width="0" height="0">` block defining TWO `<symbol>`s: `mp-icon-dark` and `mp-icon-light`. Any surface in the app renders both via:
  ```html
  <span class="brand-tile">
    <svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--dark"><use href="#mp-icon-dark"/></svg>
    <svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--light"><use href="#mp-icon-light"/></svg>
  </span>
  ```
  CSS hides the inactive variant based on `[data-theme]`. **This is reusable infrastructure** — future branded surfaces (login splash, error pages, OG card embed, PDF cover) should mount the same `<span class="brand-tile">` markup, not duplicate the SVG.
- **Nav top-left** (`index.html:80-87`): `.nav-brand .brand-tile` rendered at 32×32 with `border-radius: 7px`. Replaces the previous placeholder 4-rect outline.
- **Home page hero** (`pages/home.js`): `.home-hero__brand` is a horizontal flex lockup `[56px tile][gap 18px][MatrixPro wordmark, 36px/800]`. Replaces the earlier standalone 96px icon. Wordmark uses `--text-primary` so it inherits theme-appropriate color automatically.
- **`docs/design/app-icon-mockup.html`** — design proposal mockup with 4 variants (Dark / Light / Tile / Mono). Source of truth for canonical artwork; future `apple-touch-icon`, `android-chrome-{192,512}` PNG generation should sample from `mp-icon-tile` symbol there.

### CSS hooks (`frontend/css/style.css`)
- L391 — `.brand-tile` — shared base (overflow hidden, position relative, line-height 0).
- L398 — `.brand-tile .brand-tile__art--light { display: none }` + `[data-theme="light"]` overrides flip visibility. **All four visibility rules at `(0,2,0)` / `(0,3,0)` specificity** so they win over the size rule and the legacy `.nav-brand svg` rule was removed (was forcing 24×24 SVG inside 32×32 tile).
- L410 — `.nav-brand .brand-tile` — 32×32 / 7px radius / dark-theme drop shadow; `[data-theme="light"]` override at L420 lightens the shadow for light-surface mounting.
- L9188 — `.home-hero__brand` — inline-flex container, 18px gap, 32px bottom margin, 520ms entrance animation (`home-hero-icon-in`). Animation honors `prefers-reduced-motion` at L9230.
- L9197 — `.home-hero__brand .brand-tile` — 56×56 / 13px radius / multi-stop drop shadow scaled for hero size. Light-theme shadow override at L9207.
- L9214 — `.home-hero__brand-name` — `clamp(28px, 3.2vw, 36px)`, weight 800, letter-spacing -0.02em, `--text-primary` color (theme-adaptive).
- **Hero rebalanced**: `.home-hero` top margin 72→64, `.home-hero__title` size `clamp(36, 5vw, 56)` → `clamp(32, 4.2vw, 48)`, `.home-hero__cta` bottom margin 80→64. Result: brand lockup + title + subtitle + stats + CTAs + start of 3E section all above the fold at 1440×900.

### Theme-aware swap mechanism (DO NOT replace with JS)
Both icon variants are mounted in the DOM simultaneously per surface; CSS `display: none` hides the inactive one. This keeps theme switching instant (no flash, no re-render) and works without any JS theme-listener — `Store.set('theme', ...)` flips `[data-theme]` on `<html>` and the SVG visibility updates synchronously. Total DOM cost: 2 extra `<svg><use/></svg>` per surface (~20 bytes each rendered).

### Cache versions bumped (current)
- `frontend/index.html`: `style.css?v=54`, `app.js?v=45`
- `frontend/js/app.js`: `pages/home.js?v=11`

### Verification
- Playwright dual-theme verification confirmed (bob@matrixpro.com session):
  - **Dark**: nav tile + hero brand lockup show dark-variant artwork (`navy bg + #5cb1ff ink`).
  - **Light**: same elements show light-variant artwork (`white bg + #3b82f6 ink`); shadow overrides applied correctly.
  - DOM visibility check: `getComputedStyle().display` confirms exactly one variant per tile is `block`, the other is `none` in each theme.
- LSP diagnostics clean across `home.js`, `index.html`, `style.css`.
- Brand lockup visual: `[56px tile][18px gap][MatrixPro 36px/800] = 235px wide, 56px tall` centered on hero.
