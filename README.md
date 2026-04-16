# MatrixPro

**Skill Development Planning & Tracking for TAC Engineering Teams**

MatrixPro is a corporate web application that helps TAC Engineers and their managers collaboratively build, track, and manage individual skill development plans. It provides visibility into skill development at the individual, team, and organisational level.

---

## Features

### My Plan — Personal Development Kanban
- Drag-and-drop kanban board with three stages: **Pipeline**, **In Development**, **Proficiency**
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
- Search, filter by domain/team, and view detailed skill cards
- Each skill includes proficiency-level content: recommended courses, certifications, reading, links, and actions
- Admin CRUD for managing the catalog

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

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env — set a strong JWT_SECRET

docker compose up --build
```

The app will be available at **http://localhost** (nginx serves the frontend and proxies `/api` to the backend).

### Local Development

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # Creates DB + seed data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (separate terminal)
cd frontend
python3 -m http.server 3000
```

Backend API: **http://localhost:8000** | Frontend: **http://localhost:3000**

---

## Demo Credentials

The seed script creates the following test accounts (password for all: `password123`):

| Email | Role | Team |
|-------|------|------|
| admin@matrixpro.com | Admin | — |
| alice@matrixpro.com | Manager | Wi-Fi 6 |
| bob@matrixpro.com | Engineer | Wi-Fi 6 |
| carol@matrixpro.com | Manager | WLAN Controllers |
| dave@matrixpro.com | Engineer | WLAN Controllers |
| eve@matrixpro.com | Engineer | Firewall |

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
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## License

Internal use only.
