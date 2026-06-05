# MatrixPro

**Skill Development Planning & Tracking for TAC Engineering Teams**

MatrixPro is a corporate web application that helps TAC Engineers and their managers collaboratively build, track, and manage individual skill development plans. It provides visibility into skill development at the individual, team, and organisational level.

---

## Features

### My Plan — Personal Development Kanban
- Drag-and-drop kanban board with three stages: **Pipeline**, **In Development**, **Proficiency**
- **Category chips** filter the current section by skill classification (Foundational / Core / Advanced / AI & Future Skills). Skills group by category; multi-category skills appear in each matching group. Filter state persists across section switches.
- Add skills from the catalog, track progress through the 3E Framework (Education → Exposure → Experience)
- Training log for recording courses, certifications, and hands-on activities
- PDF and CSV export of your development plan

### My Team — Skills Matrix
- 2D matrix view showing all team members vs. assigned skills
- Sticky headers for easy navigation of large teams
- Drill-down into individual engineer plans
- CSV export of team skill data

### Catalog Explorer
- Browse the full skill catalog organised by **Organisation → Domain → Team**
- **Skill Classification** — Organization tab groups skills into 4 tiers (Foundational, Core, Advanced, AI & Future Skills). Skills can belong to multiple tiers. Collapsible category sections with Core expanded by default.
- Search, filter by domain/team, and view detailed skill cards
- Each skill includes proficiency-level content: recommended courses, certifications, reading, links, and actions
- Admin CRUD for managing the catalog (category assignment via multi-select picker in Edit modal)

### Skill Explorer
- Search for engineers by skill across the entire organisation
- Cross-team skill comparison with overlap percentage
- Import skills from other teams into your development plan

### Start Page
- Live system metrics (engineers, teams, skills)
- Role-aware navigation cards to all modules
- 3E Framework explainer section

### Administration
- User management (CRUD) with role assignment
- Team management
- Skill catalog administration
- Feedback review dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Database | SQLite + SQLAlchemy 2.0 |
| Auth | JWT (PyJWT) + bcrypt |
| Frontend | Vanilla JS (ES modules) — no build step, no framework |
| Design System | Dark-first glassmorphic UI with CSS custom properties |
| PDF Export | WeasyPrint |
| Infrastructure | Docker Compose (FastAPI + nginx) |

---

## Quick Start

### Automated Setup (macOS & Linux)

```bash
git clone https://github.com/jmgawron/MatrixPro.git
cd MatrixPro
./setup.sh       # Installs dependencies, creates venv, seeds database
./start.sh       # Starts backend + frontend, opens browser
```

`setup.sh` detects your OS and installs system packages automatically:
- **macOS** — via Homebrew (`python@3.11`, `pango`, `cairo`, etc.)
- **Debian/Ubuntu** — via apt
- **Fedora/RHEL** — via dnf
- **Arch** — via pacman

It also generates a random `JWT_SECRET` in `.env` and seeds the database with demo data.

`start.sh` launches both servers in the foreground and opens **http://localhost:3000** in your browser. Press `Ctrl+C` to stop. Ports are configurable via environment variables:

```bash
MATRIXPRO_BACKEND_PORT=9000 MATRIXPRO_FRONTEND_PORT=4000 ./start.sh
```

### Docker

```bash
cp .env.example .env
docker compose up --build
```

The app will be available at **http://localhost** (nginx serves the frontend and proxies `/api` to the backend).

### Manual Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In a separate terminal:
cd frontend
python3 -m http.server 3000
```

Backend API: **http://localhost:8000** | Frontend: **http://localhost:3000**

> **Note (PDF export):** WeasyPrint requires system-level libraries (`pango`, `cairo`). The setup script installs these automatically. In Docker, they're included in the image. Without them, PDF export will return a 500 error — all other features work fine.

---

## Demo Credentials

The seed script creates 48 test accounts (password for all: `password123`):

### LANSW Shift-2 Team (`TAC-ENT-LANSW-SHIFT2`) — demo-ready dataset

| Email | Role |
|-------|------|
| admin@matrixpro.com | Admin |
| alice@matrixpro.com | Manager (LANSW Shift-2) |
| bob@matrixpro.com | Engineer (LANSW Shift-2) |
| caden@matrixpro.com | Engineer (LANSW Shift-2) |
| daniela@matrixpro.com | Engineer (LANSW Shift-2) |
| ethan@matrixpro.com | Engineer (LANSW Shift-2) |
| fiona@matrixpro.com | Engineer (LANSW Shift-2) |
| grace@matrixpro.com | Engineer (LANSW Shift-2) |

Each LANSW Shift-2 engineer has **all 18 LAN Switching skills** assigned with realistic status distribution (~30% mastered, ~50% developing, ~10% planned), full 3E completion tracking, proficiency levels, and timestamped training logs.

### All other teams (20 technology areas × 4 shifts)

One manager + one engineer per area on SHIFT1, following the pattern:
`mgr-<area>@matrixpro.com` / `eng-<area>@matrixpro.com`

Area codes: `lansw`, `rout`, `wlan`, `sda`, `sdwan`, `dnac`, `aci`, `nexus`, `ucs`, `mds`, `hci`, `cucm`, `cube`, `webex`, `cms`, `fw`, `ftd`, `ise`, `amp`, `umbrella`.

Example: `mgr-aci@matrixpro.com` (Manager, ACI Shift-1), `eng-fw@matrixpro.com` (Engineer, Firewall Shift-1).

---

## Role-Based Access Control

All permissions are enforced server-side.

| Capability | Engineer | Manager | Admin |
|-----------|----------|---------|-------|
| View/edit own plan | Yes | Yes | Yes |
| View team members' plans | — | Own team | All |
| Team skills matrix | — | Own team | All |
| Skill catalog (read) | Yes | Yes | Yes |
| Skill catalog (write) | — | — | Yes |
| User & team management | — | — | Yes |
| Skill Explorer | Yes | Yes | Yes |
| PDF/CSV export | Own plan | Team plans | All |

---

## API

37 REST endpoints organised under:

- **`/api/auth`** — Login, session info
- **`/api/users`** — User CRUD (admin)
- **`/api/teams`** — Team CRUD, skills matrix
- **`/api/skills`** — Skill catalog, explorer, cross-team comparison
- **`/api/plans`** — Development plans, skill management, training logs
- **`/api/export`** — PDF/CSV export
- **`/api/feedback`** — User feedback collection
- **`/api/health`** — Health check
- **`/api/stats`** — Public system metrics

---

## Environment Variables

| Variable | Description | Default |
|----------|------------|---------|
| `JWT_SECRET` | Secret key for JWT signing | `change-me` |
| `DATABASE_URL` | SQLAlchemy database URL | `sqlite:////data/matrixpro.db` |
| `JWT_EXPIRY_HOURS` | Token expiry in hours | `24` |

---

## Project Structure

```
MatrixPro/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── dependencies.py      # Auth & RBAC helpers
│   │   ├── seed.py              # Database seeding
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   └── routers/             # API route handlers
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html               # SPA shell
│   ├── css/style.css            # Full design system (~7,200 lines)
│   └── js/
│       ├── app.js               # App init & routing
│       ├── router.js            # Hash-based SPA router
│       ├── state.js             # Pub/sub state store
│       ├── api.js               # Fetch wrapper with JWT
│       ├── components/          # Reusable UI components
│       └── pages/               # Page modules
├── setup.sh                     # One-command environment setup
├── start.sh                     # Launch app + open browser
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## Contributor Skills for OpenCode

This repo now includes project-local OpenCode skills under `.opencode/skills/` to help additional contributors work consistently with MatrixPro's patterns.

Recommended starting point:

- `matrixpro-contributor-onboarding`

Then load the skill that matches the area you are changing:

- `matrixpro-backend-fastapi`
- `matrixpro-frontend-spa`
- `matrixpro-cisco-modern-design`
- `matrixpro-seed-and-demo-data`
- `matrixpro-verification-and-regression`
- `matrixpro-docs-and-handoff`

These skills capture project-specific rules that are easy to miss, especially around the no-build frontend, FastAPI route ordering, cache-busting, seed-data realism, and the use of `AGENTS.md` as active project memory.

For UI polish or redesign work, use `matrixpro-cisco-modern-design` together with `matrixpro-frontend-spa`. It adapts the Cisco Modern design language to MatrixPro's existing token system and workflow-heavy screens.

---

## License

Internal use only.
