---
name: matrixpro-frontend-spa
description: Use for MatrixPro frontend changes in the vanilla-JS SPA. Covers page/module structure, modal and state patterns, cache-busting, and safe editing of the large shared CSS system.
---

# MatrixPro Frontend SPA

Use this skill for any work under `frontend/`.

## Frontend architecture

MatrixPro is a no-build SPA:

- ES modules loaded directly in the browser
- hash-based routing
- one global stylesheet
- local component primitives for modal, toast, skeleton, nav, theme

This means small mistakes are visible immediately and cache issues are common.

## Primary files

- `frontend/index.html` — shell and top-level asset version pins
- `frontend/js/app.js` — route registration and import graph
- `frontend/js/router.js` — router behavior
- `frontend/js/api.js` — authenticated fetch wrapper
- `frontend/js/components/*` — reusable UI primitives
- `frontend/js/pages/*` — feature pages
- `frontend/css/style.css` — design tokens + every component style

## Mandatory frontend patterns

### Reuse primitives

Use existing helpers when possible:

- modal: `showModal`, `showConfirm`
- toast: `showToast`
- skeleton loaders for async views
- state: `Store.get/set/on`

### Keep modules plain and local

Do not introduce a framework, bundler, JSX, or CSS framework.

### Preserve route contract

Each page mounts through the existing page export pattern. Keep mount signatures aligned with the rest of the app.

## CSS rules for this repo

### Respect token-driven styling

Prefer existing CSS custom properties over fresh hardcoded values.

### Beware shared selectors

`frontend/css/style.css` is global. Before adding a selector:

1. search for adjacent component patterns,
2. look for specificity conflicts,
3. check both dark and light themes.

### Prefer local, descriptive hooks

When adding styles, use feature-specific class names instead of broad element selectors.

## Cache-busting rule

If you change directly loaded assets, update the relevant version pins.

Typical places:

- `frontend/index.html` for `style.css?v=...` or `app.js?v=...`
- `frontend/js/app.js` for page-module import query params

If the UI looks unchanged after a code edit, suspect cache first.

## High-risk frontend zones

- `frontend/css/style.css`
- `frontend/js/pages/my-plan.js`
- `frontend/js/pages/catalog.js`
- `frontend/js/pages/my-team.js`
- `frontend/js/pages/admin.js`

## Visual work guidance

For layout, styling, or polish tasks, also load:

- `cisco-modern-ui-style`
- `ui-ux-pro-max`

MatrixPro’s aesthetic is dark-first, polished, and token-driven — not generic bootstrap-like UI.

## Verification expectations

Minimum after frontend edits:

1. Run diagnostics on touched JS files.
2. Load the affected page/flow.
3. Verify dark and light themes when styling changed.
4. Confirm modals, confirmations, and toasts still behave correctly.
5. Re-check any cache-busted imports actually reloaded.

## Avoid these mistakes

- forgetting to bump versioned imports after CSS or page changes
- duplicating utilities that already exist nearby unless the codebase intentionally keeps them local
- adding styles that accidentally affect unrelated pages
- replacing confirmation modals with browser-native confirms

## Done looks like

- the page still fits the existing MatrixPro interaction model,
- styling is theme-safe,
- and the actual browser flow was exercised after the change.
