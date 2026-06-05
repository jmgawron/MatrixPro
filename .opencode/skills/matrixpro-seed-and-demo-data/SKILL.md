---
name: matrixpro-seed-and-demo-data
description: Use for changes to MatrixPro's seed data, demo accounts, taxonomy, and realistic content generation. Treats the seed as a product artifact, not throwaway data.
---

# MatrixPro Seed and Demo Data

Use this skill when touching `backend/app/seed.py`, demo credentials, catalog taxonomy, or seeded workflows.

## Why this matters

In MatrixPro, seeded data is central to demos, screenshots, validation, and contributor understanding. A seed change can silently invalidate docs, manual QA steps, and UI assumptions.

## Core rule

Treat seed changes like product changes.

If you change the demo world, update the repo memory that explains that world.

## Seed responsibilities in this repo

The seed currently drives:

- domains and teams
- user roster and manager relationships
- skill catalog and category assignments
- certifications
- development plans and statuses
- training logs and personalized 3E content
- realistic LANSW Shift-2 demo dataset

## Seed-change workflow

1. Read the current seed-related sections in `AGENTS.md`.
2. Edit `backend/app/seed.py` surgically.
3. Rerun the seed intentionally, knowing it is destructive.
4. Verify key counts and at least one representative user flow.
5. Update `README.md` and/or `AGENTS.md` if contributor-facing truth changed.

## Required caution areas

### Destructive reset

`python -m app.seed` rebuilds the local data world. Never run it casually if preserving the current DB matters.

### Enum and label drift

UI labels and stored enum values are not always the same. Check code before changing plan statuses or content types.

### Downstream references

A seed change may require updates to:

- README credential tables
- AGENTS dataset notes
- screenshots or manual QA assumptions
- tests that depend on seeded IDs or users

## Good verification after seed edits

- reseed completes without error
- `GET /api/health` works
- admin login works
- representative plan/catalog/team endpoints return expected counts
- one named demo user still has the expected experience

## Avoid these mistakes

- changing seeded identities without documenting the new canonical accounts
- assuming old IDs still mean the same thing after reseeding
- updating the seed but not the contributor docs that explain it
- treating demo data realism as optional

## Done looks like

- the seeded environment is internally coherent,
- documented contributor entry points still work,
- and the new dataset was verified from both API and user-flow perspectives.
