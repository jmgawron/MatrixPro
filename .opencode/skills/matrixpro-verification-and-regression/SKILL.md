---
name: matrixpro-verification-and-regression
description: Use after MatrixPro changes to choose the right validation path: diagnostics, narrow backend smoke tests, manual browser checks, seed sanity checks, and regression awareness for known hotspot flows.
---

# MatrixPro Verification and Regression

Use this skill whenever you need to verify a MatrixPro change.

## Verification philosophy for this repo

MatrixPro does not have strong automated guardrails. Verification must be explicit and tailored to the exact change.

Always start narrow, but do not skip the real user flow.

## Minimum verification ladder

### For any code change

1. Run diagnostics on modified files.
2. Inspect for accidental syntax/import issues.

### For backend changes

Add one of:

- targeted API request
- narrow pytest if available
- login + impacted endpoint smoke

### For frontend changes

Add one of:

- manual browser path through the changed page
- modal/form flow verification
- theme verification when CSS changed

### For seed/data changes

Add:

- reseed
- count/shape checks
- demo-user validation

## Known high-value regression zones

Check these when nearby code changes:

- login and token restore
- My Plan skill cards, 3E content, and modal flows
- Catalog create/edit/delete behaviors
- admin destructive actions with confirmation
- route ordering-sensitive endpoints
- frontend cache-busted module loading

## Recommended validation combinations

### Router/schema change

- diagnostics
- real request to changed endpoint
- inspect frontend caller compatibility if used by UI

### Page/module change

- diagnostics
- page load in browser
- action flow exercised end-to-end

### CSS change

- browser verification
- dark + light theme check
- responsiveness or overflow check if layout moved

### Seed change

- reseed
- login
- one representative API path
- one representative UI path

## Regression mindset

Do not just prove the new thing works. Also check what was easy to break nearby.

Typical examples:

- a modal redesign can break combobox sizing or sticky footer behavior
- a delete flow can break orphaned plan rendering
- a cache bump omission can make good code look broken

## Done looks like

- modified files are clean,
- the intended scenario works,
- and the nearest likely regression path was checked once on purpose.
