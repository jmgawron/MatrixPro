# My Plan Module — Visual Review & Redesign Brief

**Scope:** Visual / presentation only. No functional changes to navigation, filters, drag-and-drop, modals, API, or RBAC.

**Reference implementation:** `frontend/js/pages/my-plan.js`, `frontend/css/style.css` (§MP, §7.19 category groups, §7.25 skill detail modal).

**Interactive mockups:** `docs/design/my-plan-visual-redesign-mockups.html`

---

## Current State Summary

My Plan is functionally complete: sidebar section nav, category grouping, quick filters, skill cards with progress, skill detail modal, Add Skill chooser, Reporting. Visually it reads as **assembled from several design generations** rather than one cohesive surface.

| Area | Current | Visual gap |
|------|---------|------------|
| **Page hero** | Large title + 5 stat blocks | Stats duplicate sidebar counts; icons defined in JS but not rendered |
| **Layout** | 200px sidebar + content panel | Crowded sidebar; flat page bg vs Home mesh glow |
| **Content header** | Title + category chips + search in one row | Chips wrap awkwardly; category toolbar uses sidebar border-left style |
| **Skill cards** | Icon + gauge + bar + prof inline styles | Top row overloaded; dual progress indicators |
| **Sidebar filters** | Domain pills, vertical 3E tiles, prof numbers | Three different filter UX patterns |
| **Category groups** | Editorial headers (§7.19) | No category accent rail; no tie to active section color |
| **Empty states** | Plain inline text | No hierarchy or visual affordance |

---

## Visual Improvement Themes

### 1. Compact hero / context strip
- Reduce to 3 metrics: Total · Developing · Mastered (or active section + progress)
- Render stat icons (already in `updateStatsRow` data)
- Demote log counts to secondary placement

### 2. Command strip content header
- Row 1: section title + count | search (glass, icon)
- Row 2: horizontal category pills with ✓ (Catalog/Library pattern), scroll on overflow

### 3. Refined skill cards
- 40×40 icon well + **4px category accent rail** (not section-gradient well)
- **Single** bottom progress bar (remove radial gauge from card face)
- Proficiency via CSS classes (`.mp-prof-badge--1` … `--5`), not inline rgba
- 2-line name clamp; softer empty notes styling

### 4. Unified sidebar filters
- Horizontal colored 3E chips (match Library modal)
- Optional filter disclosure when none active
- Reporting as ghost/secondary; Add Skill remains primary

### 5. Category group bands
- Category-colored left rail on headers + count pill tint
- Align with Catalog §7.17 editorial pattern

### 6. Section atmosphere
- Status-colored top/left rail on content panel per active section
- Section icon beside content title

### 7. Page atmosphere
- Subtle radial mesh (`--home-glow`)
- Glass shell wrapping sidebar + content

### 8. Empty states
- Icon + title + description hierarchy; styled browse affordance

---

## Mockup Concepts

Open `my-plan-visual-redesign-mockups.html` in a browser (links `frontend/css/style.css`):

| Tab | Name | Focus |
|-----|------|--------|
| **Overview** | Before / After | Side-by-side for stats, header, filters, cards, empty state |
| **Current** | Production-like | Today's layout reproduced for comparison |
| **A** | Refined Cards | Catalog-parity cards, category rails, single progress |
| **B** | Command Strip | Two-row header, horizontal category scroll |
| **C** | Dashboard Shell | Glass wrapper, mesh glow, compact stats, filter disclosure |
| **Recommended** | Combined | All themes integrated — suggested production target |

All tabs preserve: same sections, filters, card click → modal, drag targets, Add Skill / Reporting actions.

---

## Recommended Implementation Path

1. **Phase 1 (CSS + tiny hooks):** Stats icons, status content rail, proficiency badge classes, empty state, search styling
2. **Phase 2 (cards):** Single progress bar, accent rail, footer tokens
3. **Phase 3 (header):** Command strip markup reorder, category pill scroll strip
4. **Phase 4 (shell):** Glass wrapper, mesh, unified sidebar filters, filter disclosure
5. **Phase 5:** Category band accents; remove dead kanban CSS

**Out of scope:** New filters, layout mode persistence, API changes, kanban restoration.

---

## Files

- `docs/design/my-plan-visual-redesign-mockups.html` — interactive mockups + light/dark toggle
- This brief — audit + implementation notes
