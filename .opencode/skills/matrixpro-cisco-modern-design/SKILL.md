---
name: matrixpro-cisco-modern-design
description: Use for MatrixPro UI work that should follow the Cisco Modern dark-first glassmorphic style while still fitting this repo's existing vanilla-JS SPA, token-driven CSS, and established interaction patterns.
---

# MatrixPro Cisco Modern Design

Use this skill for MatrixPro visual work that should feel consistent with Cisco Modern internal tooling.

This is a **repo-local adaptation** of the broader `cisco-modern-ui-style` skill. The global skill explains the design language; this local skill explains how to apply that language safely inside MatrixPro.

## When to use this skill

- redesigning or polishing MatrixPro pages
- adding new cards, panels, filters, dashboards, or admin views
- improving spacing, hierarchy, or visual clarity
- building new UI that should feel aligned with Sherlock/GenAI-Wireless styling already present in this repo

Also load:

- `matrixpro-frontend-spa`
- global `cisco-modern-ui-style`
- `ui-ux-pro-max` when the task is strongly visual or UX-heavy

## Core principle

Do **not** paste a generic Cisco Modern landing page into MatrixPro.

Instead, translate Cisco Modern design cues into MatrixPro’s existing system:

- existing CSS custom properties
- existing page shells and component structure
- existing modal/toast/skeleton patterns
- existing dark/light theme switching

## What Cisco Modern means inside MatrixPro

### Keep

- dark-first visual hierarchy
- soft glassmorphic surfaces where appropriate
- restrained blue-accent emphasis
- elevated cards and panels with subtle borders
- clear information hierarchy with polished spacing
- pill-style interactive controls when they match surrounding patterns

### Do not overdo

- heavy gradients on every surface
- decorative blur where it hurts readability
- oversized hero-marketing layouts inside dense workflow pages
- generic marketing-page patterns that conflict with app workflows

MatrixPro is an operational product, not a brochure site.

## Preferred visual approach for this repo

### 1. Evolve existing tokens before adding new ones

Prefer existing variables in `frontend/css/style.css`.

Only add tokens when a real reuse pattern exists.

### 2. Polish structure before adding effects

The best MatrixPro visual improvements usually come from:

- better spacing
- clearer grouping
- calmer borders and surfaces
- stronger typography hierarchy
- more deliberate empty state and action placement

Not from adding more chrome.

### 3. Fit each page's job

- **Admin/Catalog**: denser information, strong grouping, sharp action clarity
- **My Plan**: supportive, personal, progress-focused, content readability first
- **My Team / Explorer**: comparison clarity, scanability, visual rhythm in data-heavy layouts
- **Home**: can carry slightly more presentation polish than the operational pages

## Implementation guidance

### Styling

- work inside `frontend/css/style.css`
- use feature-specific selectors
- prefer token reuse over ad hoc values
- check both dark and light theme outcomes

### Markup/JS

- keep the existing vanilla-JS module structure
- reuse current component primitives
- avoid introducing a new UI abstraction layer

### Interaction design

- destructive actions still need clear confirmation
- async states should use existing skeleton/loading patterns
- dense admin workflows should favor clarity over visual flourish

## Concrete design cues to borrow from Cisco Modern

- sticky or visually anchored top controls when they improve orientation
- elevated sections with soft borders instead of hard boxes
- accent used to indicate selection, focus, and primary action — not everything
- subtle hover glow or inset ring rather than harsh shadows
- compact status pills and segmented control patterns

## MatrixPro-specific anti-patterns

- replacing working dense layouts with airy marketing-card grids that hide information
- adding a second competing design language beside the current one
- introducing standalone component CSS that ignores the global token system
- using Cisco Modern as a reason to break existing page-level consistency

## Verification checklist for design changes

After making Cisco Modern-inspired UI changes, verify:

1. the page still feels like MatrixPro, not a different app
2. dark theme and light theme both hold up
3. spacing and overflow are stable at realistic desktop sizes
4. hover/focus states are visible but not noisy
5. existing workflows remain faster or clearer, not just prettier

## Done looks like

- the page looks more polished and more Cisco-modern,
- the result still matches MatrixPro's existing design system,
- and the visual upgrade improves usability rather than competing with it.
