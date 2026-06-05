---
name: matrixpro-backend-fastapi
description: Use for MatrixPro backend changes involving FastAPI routers, SQLAlchemy models, schemas, RBAC, migrations, and API behavior. Encodes the repo's actual backend patterns and failure modes.
---

# MatrixPro Backend FastAPI

Use this skill when changing backend behavior in `backend/app`.

## Backend stack reality

- FastAPI app with router-per-domain structure
- SQLAlchemy 2.0 models
- SQLite in local/dev, Docker-supported deployment
- JWT auth with role-based access checks
- No formal migration framework; schema evolution is handled by idempotent startup helpers and seed logic

## Files that usually move together

- Model change → `models/*.py`, often `schemas/*.py`, router queries, seed, migration helper
- Endpoint change → router + schema + frontend caller + verification
- RBAC change → router dependencies + access helper usage + frontend visibility if relevant

## Mandatory backend patterns

### Router ordering matters

Static/special routes must stay before `/{id}`-style routes. This is especially important in:

- `backend/app/routers/teams.py`
- `backend/app/routers/skills.py`
- `backend/app/routers/certification.py`

### Use auth helpers correctly

- `require_role(...)` already returns a dependency wrapper.
- Do **not** wrap it in `Depends()` again.

### Preserve server-side RBAC

UI restrictions are never enough. Every access rule must be enforced in the route layer.

### Match existing response shapes

Do not casually rename keys or nesting. Frontend pages often depend on exact payload structure.

## Schema/data-change checklist

When you add or change persistence:

1. Update the SQLAlchemy model.
2. Update Pydantic schemas.
3. Add or extend startup migration logic if existing DBs need compatibility.
4. Update seed behavior if demo data should exercise the new feature.
5. Verify the API with a real request path when possible.

## Query and mutation guidance

- Prefer existing relationship/query style already used in neighboring routes.
- Keep deletes/cascades explicit when the codebase already handles them manually.
- Be careful with soft-delete vs hard-delete semantics. MatrixPro uses both intentionally.

## High-risk backend zones

- `routers/plans.py` — dense business logic
- `routers/skills.py` — catalog/admin flows and deletion behavior
- `seed.py` — destructive reseed logic and demo realism
- startup migration helpers — can affect every local DB

## Verification expectations

Minimum after backend edits:

1. Run diagnostics on touched backend files.
2. Hit the relevant API path or a narrow smoke test.
3. If data shape changed, confirm the frontend caller still matches.

Good verification examples:

- auth change → login + protected endpoint
- schema change → seed or GET/POST roundtrip
- delete/archive change → preview endpoint + mutation + resulting GET behavior

## Avoid these mistakes

- inventing a repository/service layer for a small localized change
- changing enum/storage values without checking seed and UI labels
- adding hidden side effects to read routes unless the surrounding module already works that way
- assuming SQLAlchemy LSP noise means runtime failure

## Done looks like

- route behavior is correct,
- schema matches the actual payload,
- RBAC is enforced server-side,
- and local DB compatibility was considered explicitly.
