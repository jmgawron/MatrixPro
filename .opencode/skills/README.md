# MatrixPro local OpenCode skills

These are project-local skills for contributors working on MatrixPro.

## Included skills

- `matrixpro-contributor-onboarding` — repo orientation and contributor workflow
- `matrixpro-backend-fastapi` — backend API, models, schemas, RBAC, migrations
- `matrixpro-frontend-spa` — vanilla-JS SPA, CSS system, cache-busting, modal/state patterns
- `matrixpro-cisco-modern-design` — MatrixPro-specific adaptation of Cisco Modern dark-first UI styling
- `matrixpro-seed-and-demo-data` — seed realism, demo accounts, destructive reseed workflow
- `matrixpro-verification-and-regression` — validation strategy and hotspot regression checks
- `matrixpro-docs-and-handoff` — README/AGENTS update rules and contributor handoff

## Recommended usage

- Start broad: `matrixpro-contributor-onboarding`
- Then load the subsystem skill that matches the task.
- For visual work, combine `matrixpro-frontend-spa` + `matrixpro-cisco-modern-design`, and optionally the global `cisco-modern-ui-style` + `ui-ux-pro-max` skills.

## Why these exist

MatrixPro has a lot of project-specific behavior that is easy for new contributors to miss:

- no-build frontend constraints
- large shared CSS with cache-busting requirements
- Cisco Modern visual language needs repo-specific adaptation, not direct copy-paste
- router ordering constraints in FastAPI
- seed data as a product artifact
- `AGENTS.md` as active project memory

These local skills shorten onboarding and reduce repeated mistakes.
