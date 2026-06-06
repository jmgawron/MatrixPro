# Catalog Module — Visual Review & Redesign Brief

**Scope:** Visual / presentation only. No functional changes to tabs, filters, tree navigation, CRUD, modals, or API behavior.

**Reference implementation:** `frontend/js/pages/catalog.js`, `frontend/css/style.css` (§ Catalog V2, §7.17 category sections, `.tool-card`).

---

## Current State Summary

The catalog is functionally rich: three tabs (Organization / Certification / Non-Technical), domain→team tree sidebar, shift filters, search/sort, category-grouped skill grid, admin actions, and a polished skill-detail modal. Visually it works but reads as **assembled from generic primitives** rather than a cohesive “catalog explorer” experience.

| Area | Current | Visual gap |
|------|---------|------------|
| **Page hero** | Large `mp-title` + subtitle + 3 stat blocks | Hero consumes ~180px; stats duplicate information available in tree/grid; no connection to active filter |
| **Tabs** | Underline tabs in `catalog-tab-bar` | No tab counts; Cert / Non-Technical tabs feel identical to Org |
| **Toolbar** | Search + Sort + Shift pills + tag filter + archived + Create | Flat row, weak hierarchy; search has no icon/affordance; shift pills compete with tabs |
| **Tree panel** | 280px gradient sidebar, basic `tree-item` | No panel title or filter summary; depth levels hard to scan; active node doesn’t show breadcrumb |
| **Category sections** | Editorial uppercase headers + chevron (§7.17) | Sections stack with only a hairline divider; category color/icon not echoed on cards |
| **Skill cards** | `.tool-card` — icon+name, team chips, cert badges, desc, tags | Dense chip rows; category invisible on card; admin buttons appear on hover only (good) but add visual noise; cards vary wildly in height |
| **Grid** | `grid-3` uniform columns | No density option; long descriptions break rhythm |
| **Page atmosphere** | Flat `cat-wrapper` on default page bg | Home page has mesh glow; catalog feels colder/darker by comparison |

---

## Visual Improvement Themes (non-functional)

### 1. Information hierarchy
- Collapse hero stats into a **compact context strip** showing active filter + result count + org totals.
- Elevate **search** as the primary control (icon, wider field, subtle glass background).
- Demote sort/shift/archive to **secondary chip row** below search.

### 2. Category ↔ card parity
- Echo category identity on each card: **4px left accent rail** + small category pill (matches My Plan chip vocabulary).
- Strengthen section headers with **category-tinted band** (not a heavy box — transparent + left gradient rule).

### 3. Card composition
- **Unified meta footer**: teams + certs on one row with dot separators; tags on second row.
- **Fixed icon well** (48×48) with soft category-tinted background.
- **2-line description clamp** for consistent card height in grid.
- Optional **“View details →”** affordance on hover (visual only; still opens same modal).

### 4. Tree sidebar polish
- Panel header: “Browse by organization” + mini search.
- **Sticky domain group labels** (ENT / DC / COLL / SEC).
- Active item: accent rail + subtle glow (extend existing `.tree-item.active`).

### 5. Tabs & shifts
- **Segmented tabs** with optional counts (`Organization · 70`).
- Shift filters as **toggle chip group** labeled “Shifts” with compact S1–S4 pills (same behavior, clearer grouping).

### 6. Atmosphere
- Subtle **radial mesh** behind catalog content (reuse home `--home-bg` / glow tokens).
- Wrap main content (tree + grid) in a **single glass card shell** for depth.

---

## Mockup Concepts

Open `catalog-visual-redesign-mockups.html` in a browser (with `style.css` from frontend):

| Concept | Name | Focus |
|---------|------|--------|
| **A** | Refined Cards | Category accent rails, unified meta footer, glass cards, compact hero |
| **B** | Command Strip | Merged toolbar, segmented tabs, tree panel header, filter context chip |
| **C** | Editorial Bands | Full-width category bands, larger section typography, airy grid |

All three preserve: same tabs, tree structure, shift toggles, card click → detail, Edit/Archive/Delete on hover.

---

## Recommended path (if approved)

1. **Phase 1 (low risk):** Concept A card styles + category section bands — CSS-only in `style.css`, minimal `catalog.js` class hooks on `buildSkillCard` / `buildCategorySection`.
2. **Phase 2:** Concept B toolbar/tab strip — restructure DOM wrappers in `buildPageShell` / `buildToolbar` (markup only, same handlers).
3. **Phase 3:** Tree panel header + domain group labels — cosmetic labels in `renderTreeForTab`.

**Out of scope:** list view toggle, new filters, card layout mode persistence, animation beyond existing transitions.

---

## Files

- `docs/design/catalog-visual-redesign-mockups.html` — interactive 3-concept mockups + light/dark toggle
- This brief — audit + implementation notes
