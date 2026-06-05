---
name: matrixpro-docs-and-handoff
description: Use when MatrixPro changes alter project truth. Covers what must be reflected in AGENTS.md, README.md, and contributor-facing handoff notes so future contributors inherit accurate context.
---

# MatrixPro Docs and Handoff

Use this skill when a change affects how future contributors understand or operate the repo.

## Two documentation layers in MatrixPro

### `README.md`

Use for stable contributor-facing basics:

- setup
- run commands
- demo credentials
- feature overview

### `AGENTS.md`

Use for living project memory:

- current architecture nuances
- gotchas and traps
- cache versions when operationally important
- seed dataset specifics
- recent feature behavior and validation notes

## When docs must be updated

Update docs when you changed:

- canonical demo users or seeded workflows
- architecture or storage behavior contributors rely on
- required verification steps
- cache/versioning conventions
- a subtle trap that would waste future contributor time

## Documentation style for this repo

- prefer concrete facts over vague summaries
- name real file paths
- include actual endpoint names, route names, or class names when relevant
- call out stale information explicitly when replacing old truth

## Handoff checklist

If a change is meaningful enough that another contributor could trip over it later, capture:

1. what changed,
2. where it changed,
3. how it was verified,
4. what old assumption is now obsolete.

## What not to do

- do not duplicate large design docs unnecessarily
- do not update README for purely transient debugging notes
- do not leave seed or workflow changes undocumented

## Done looks like

- a new contributor can pull the repo, read the docs, and not inherit stale mental models about the area you changed.
