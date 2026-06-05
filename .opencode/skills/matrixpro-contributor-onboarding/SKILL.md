---
name: matrixpro-contributor-onboarding
description: Start here for any MatrixPro change. Explains repo architecture, active hotspots, contributor workflow, and the non-obvious constraints that must be respected before touching backend, frontend, seed data, or docs.
---

# MatrixPro Contributor Onboarding

Use this skill first when you are new to the repo or when a task touches more than one subsystem.

## What MatrixPro is

MatrixPro is a FastAPI + SQLite + vanilla-JS SPA for TAC engineer skill planning. It has three especially important characteristics:

- The backend is small-framework Python with SQLAlchemy models and router-heavy business logic.
- The frontend has **no build step**. Everything is shipped as ES modules and one large CSS file.
- Seed data is part of the product experience, not just test scaffolding. Demo flows depend on it.

## First files to read

Read these before making meaningful changes:

1. `AGENTS.md` — project memory, architecture, gotchas, current dataset status.
2. `README.md` — setup commands and current demo credentials.
3. The exact files you plan to change.

If the task is visual, also load `cisco-modern-ui-style` and `ui-ux-pro-max`.

## Architecture map

### Backend

- Entry: `backend/app/main.py`
- Config: `backend/app/config.py`
- DB/session: `backend/app/database.py`
- Auth/RBAC: `backend/app/dependencies.py`
- Routers: `backend/app/routers/*.py`
- Models: `backend/app/models/*.py`
- Schemas: `backend/app/schemas/*.py`
- Seed: `backend/app/seed.py`

### Frontend

- Shell: `frontend/index.html`
- Router bootstrap: `frontend/js/app.js`
- Route engine: `frontend/js/router.js`
- API client: `frontend/js/api.js`
- Shared components: `frontend/js/components/*`
- Pages: `frontend/js/pages/*`
- Styling: `frontend/css/style.css`

## MatrixPro working rules

### 1. Respect the existing patterns

- Keep backend work inside routers/schemas/models rather than inventing a new layer unless the task truly demands it.
- Keep frontend work in plain ES modules and existing page/component patterns.
- Use the existing modal/toast/skeleton primitives instead of inventing substitutes.

### 2. Treat `AGENTS.md` as active operational memory

It contains current reality that may be newer than README notes, including:

- seed topology
- status enum clarifications
- cache-busting versions
- CSS specificity traps
- known regression footguns

### 3. Assume manual verification is part of the job

There is no mature CI safety net. After edits, validate the exact flows you changed.

### 4. Minimize blast radius

- `frontend/css/style.css` is huge and shared.
- `backend/app/seed.py` is destructive and easy to destabilize.
- `backend/app/routers/plans.py`, `skills.py`, and large frontend pages are hotspot files.

## Standard contributor workflow

1. Read `AGENTS.md` and the target files.
2. Search for an existing pattern before writing code.
3. Make the smallest coherent change.
4. Verify the modified files with diagnostics.
5. Run the narrowest meaningful runtime check.
6. Update docs only if the repo truth changed.

## Common pitfalls

- Do not assume build tooling exists.
- Do not assume seed data is disposable.
- Do not break route ordering in FastAPI routers.
- Do not forget frontend cache-busting when changing directly imported page modules or global CSS.
- Do not trust stale docs over code plus `AGENTS.md`.

## When to switch to more specific skills

- Backend API/model/RBAC work → `matrixpro-backend-fastapi`
- SPA page/component/CSS work → `matrixpro-frontend-spa`
- Seed/demo dataset work → `matrixpro-seed-and-demo-data`
- Verification/regression work → `matrixpro-verification-and-regression`
- Docs/update handoff work → `matrixpro-docs-and-handoff`

## Definition of done

A MatrixPro contribution is not done until:

- the code follows local patterns,
- modified flows were validated,
- no new cache/version mismatch was introduced,
- and any project-memory changes were recorded in `AGENTS.md` if they matter cross-session.
