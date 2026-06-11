# Skill Grid Card — Visual Design Concepts

**Scope:** Layout and presentation only. No functional changes, workflow changes, or information removal.

**Reference:** `frontend/js/pages/catalog.js` (`buildSkillCard`), `frontend/css/style.css` (`.tool-card`).

**Interactive mockups:**
- Refined concepts: `skill-grid-card-concepts-mockup.html` (light/dark + wireframe toggle)
- Bold concepts (superseded): `skill-grid-card-concepts-bold-mockup.html`
- **Panel context (current):** `skill-grid-card-panel-mockup.html` — full right panel with category sections, hero-aligned cards, manager icon actions, app-toned colors

---

## Panel Context Mockup (current recommendation)

Open `skill-grid-card-panel-mockup.html`. Presents the proposed **Hero Catalog Card** (`.hc-card`) inside the real Organization tab right panel: tree sidebar, category sections (Foundational / Core / Advanced / AI & Future), and `grid-3` layout.

### Hero-aligned card design

| Zone | Treatment |
|------|-----------|
| **Accent** | 3px left rail using existing `--cat-*-accent` tokens (slate/blue tones, not saturated category fills) |
| **Header** | Soft gradient at 7% tint — matches home hero `hm-a__mesh` / `home-pill` atmosphere |
| **Icon** | 44px soft well with category-tinted border (production `tool-card-icon` pattern) |
| **Meta** | Single row: teams · cert (unified, not stacked chip rows) |
| **Body** | 2-line description + tag footer with hairline rule |
| **Hover** | Subtle lift + `View details →` affordance |

### Manager-only admin icons

Floating icon toolbar (top-right, glass backdrop) appears on card hover **for managers/admins only**:

| Icon | Action | Notes |
|------|--------|-------|
| Pencil | Edit | Opens existing skill modal |
| Copy | Duplicate | **New** — pre-fills Create modal from source skill |
| Trash | Delete | Existing cascade-delete flow |

Toggle **View as → Engineer** in the mockup chrome to verify icons are fully hidden. Engineers see identical card content with no layout shift (manager padding reserved only when `data-viewer="manager"`).

### Color tone adjustments (vs bold variants)

- Removed saturated gradient rails and solid accent icon fills
- Category color appears only as: left rail, 7% header wash, 14% icon well — all via `color-mix()` with `--hc-tint`
- Uses production tokens: `--home-pill-bg`, `--shadow-panel`, `catalog-tab-wrapper` glass shell
- Category section headers reuse `.catalog-category-header` gradient from §7.27 polish

### Section behavior

Matches production defaults: **Core expanded**, Foundational / Advanced / AI collapsed. Section headers use real `.catalog-category-*` classes with icons. Click headers to toggle collapse in the mockup.

---

## Bold Variants (amplified)

Each refined concept (A–D) has a **bold** counterpart that pushes visual weight further without adding or removing fields.

| Bold name | Based on | Key amplifications |
|-----------|----------|-------------------|
| **A′ Monument Zones** | Sectioned Atlas | 8px glowing category rail; solid accent icon well; 2-column boxed meta cells; full-width accent tag band |
| **B′ Billboard Hero** | Hero Header | Saturated radial hero; 18px/900 title; 58px icon; frosted association strip; 5px accent tag-tray spine |
| **C′ Signal Stack** | Badge Cloud | 5px category cap bar; accent-bordered description; split assoc/tags panels; full-size chips |
| **D′ Chromatic Rail** | Split Ledger | 76px gradient color rail; vertical category label; cert icon row; edge-to-edge accent tag footer |

### Bold design principles

1. **Category color is structural** — not just a 4px rail, but gradients, caps, rails, and footers tinted per category (Core / Foundational / Advanced / AI).
2. **Typography jumps one weight step** — titles move to 900 weight at 17–18px; labels use accent color instead of muted gray.
3. **Icons invert** — solid accent background with white glyph (vs soft tint wells).
4. **Zones use 2px rules** — stronger separators between header / meta / body / footer.
5. **Hover gains accent glow** — `box-shadow` uses category color at 35% opacity.

### Bold recommendation

| Use case | Pick |
|----------|------|
| Maximum scan impact in demos | **B′ Billboard** |
| Category-heavy Organization tab | **A′ Monument** or **D′ Chromatic** |
| Still need density at scale | **C′ Signal** (bold but shortest) |
| Safest bold rollout | **B′** — same DOM shape as refined B, mostly CSS amplification |

**Caveat:** Bold cards need explicit **archived / orphan / light-theme** variants so saturated heroes don't clash with amber tombstone badges or washed-out light surfaces.

---

## Current Baseline

Each catalog skill card (`.tool-card`) displays five information fields in this vertical order:

| Field | Implementation |
|-------|----------------|
| **Skill title** | `.tool-card-name` beside 44×44 icon in `.tool-card-header` |
| **Associated teams** | `.tool-card-badges` with `triage-chip triage-signal` (max 2 visible + overflow) |
| **Certificate** | Separate `.tool-card-badges` row with `meta-badge--cert` |
| **Description** | `.tool-card-desc` — 2-line clamp, ~120 char truncate |
| **Tags** | `.tool-card-tags` with `triage-chip triage-feedback` (max 4 + overflow) |

**Visual gaps:** Teams and certs compete at equal weight in back-to-back chip rows. The description is sandwiched between association metadata and taxonomy tags. Card height varies with chip wrap. The icon shares the header row with the title, reducing title prominence.

---

## Concept Comparison

| | **A · Sectioned** | **B · Hero Header** | **C · Badge Cloud** | **D · Split Ledger** |
|---|---|---|---|---|
| **Primary anchor** | Labeled zones | Title in hero band | Title + description | Icon rail + title |
| **Associations** | Labeled groups | Inline under title | Unified chip cloud | Certs above teams in column |
| **Tags** | Dashed footer zone | Contained tray | Mixed into chip cloud | Bottom rule separator |
| **Height** | Tallest (+~12px) | Medium | Shortest | Medium |
| **Grid density** | Good | Good | Best | Good |
| **DOM change** | Moderate (zone wrappers) | Low (header/body split) | Low (reorder only) | Highest (2-column grid) |
| **Recommended for** | Org tab, category sections | Default evolution path | Large catalogs (70+ skills) | Manager/admin comparison views |

---

## Concept A — Sectioned Atlas

### Wireframe

```
┌─▌──────────────────────────────────┐
│ ▌ [icon]  Skill Title               │  ← Zone 1: Identity (soft bg)
├─▌──────────────────────────────────┤
│ ▌ TEAMS    [chip] [chip] [+2]       │  ← Zone 2: Labeled meta
│ ▌ CERTS    [CCNP Enterprise Core]   │
├─▌──────────────────────────────────┤
│ ▌ Description text clamped to       │  ← Zone 3: Narrative
│ ▌ two lines maximum…                │
├─▌ - - - - - - - - - - - - - - - - -│
│ ▌ [tag] [tag] [tag] [tag]           │  ← Zone 4: Taxonomy (dashed rule)
└─▌──────────────────────────────────┘
  ↑ 4px category accent rail
```

### Rationale

Horizontal zones create predictable scan lanes. Micro-labels ("Teams", "Certification") with 12px icons disambiguate chip types without introducing new color vocabulary. The category accent rail (already used via `data-category-slug`) connects cards to their collapsible section headers.

### Hierarchy improvement

1. Title (zone 1, boldest)
2. Associations (zone 2, labeled, grouped)
3. Description (zone 3, secondary text)
4. Tags (zone 4, visually demoted by dashed separator)

### Advantages

- Clearest association parsing when scanning 18+ cards per category
- Labels help new users distinguish team vs. cert chips
- Consistent internal rhythm reduces height variance

### Trade-offs

- ~12px taller than current
- Labels feel redundant on skills with a single team and one cert
- Requires zone wrapper markup in `buildSkillCard` (CSS-only zones possible with pseudo-elements, but labels need DOM)

---

## Concept B — Hero Header

### Wireframe

```
┌─────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Tinted hero band
│  [48px icon]  Skill Title (16/800)  │
│  [team] [team] [+2] · [CCNP Core]   │  ← Inline associations
├─────────────────────────────────────┤
│  Description text clamped to two    │
│  lines with comfortable line-height │
│  ┌───────────────────────────────┐  │
│  │ [tag] [tag] [tag] [tag]      │  │  ← Tag tray (soft box)
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Rationale

Elevates the skill name to hero status — matching how engineers mentally index skills ("I need the Catalyst 9000 skill"). Collapsing teams and certs into one association line reduces vertical stops from 5 to 3. The tag tray borrows the `.skill-category-picker` bordered-card pattern already in the Edit Skill modal.

### Hierarchy improvement

1. Title (hero, 16px/800)
2. Associations (inline, smaller chips)
3. Description (body text)
4. Tags (contained tray, tertiary)

### Advantages

- Strongest title prominence — best "evolution not revolution" option
- Reuses existing chip and badge tokens unchanged
- Tag tray creates an unambiguous taxonomy boundary
- Subtle hero gradient adds depth consistent with home page mesh

### Trade-offs

- Inline association line wraps awkwardly with 3+ teams AND 2+ certs
- Hero tint needs archived/orphan state variants
- Slightly less compact than Concept C

---

## Concept C — Badge-Centric Compact

### Wireframe

```
┌─────────────────────────────────────┐
│ [sm icon]  Skill Title              │
│ Description clamped to two lines…    │
│ ASSOCIATIONS & TAGS                  │
│ [team] [team] [+2] [CCNP]            │
│ ─────────────────────────────────── │
│ [tag] [tag] [tag] [tag]             │
└─────────────────────────────────────┘
```

### Rationale

Optimizes for catalog browsing at scale (70+ LANSW skills). Title and description form a tight reading block; all chips consolidate into one scannable cloud. Semantic color (signal = teams, cert = blue badge, feedback = tags) provides differentiation without structural separation.

### Hierarchy improvement

1. Title + description (read as a unit)
2. Chip cloud (scan by color)
3. Tags separated by hairline within cloud

### Advantages

- Shortest card height — best 3-column grid density
- Chip-forward layout aligns with filter chips, category chips, and shift pills
- Minimal DOM restructuring (reorder existing elements)

### Trade-offs

- Icon reduced to 36px — less visual identity per skill
- Associations and tags share one region — can feel busy
- "Associations & tags" label may be too small for accessibility at 9px

---

## Concept D — Split Ledger

### Wireframe

```
┌────┬────────────────────────────────┐
│    │ Skill Title                    │
│ 🔲 │ [CCNP Enterprise Core]         │  ← Certs elevated
│ ·  │ [team] [team] [+2]             │  ← Teams explicit
│ ·  │ Description clamped to two     │
│ ·  │ lines…                         │
│ 4  ├────────────────────────────────┤
│teams│ [tag] [tag] [tag] [tag]       │
└────┴────────────────────────────────┘
 ↑ 56px icon rail
```

### Rationale

Borrowed from dashboard/list hybrid patterns. The left rail provides a consistent visual anchor across grid rows — useful when titles vary wildly in length. Team density is signaled by decorative pips on the rail (with full team names in chips for accessibility). Certs appear above teams in the content column, reflecting cert-track importance in TAC workflows.

### Hierarchy improvement

1. Title (content column top)
2. Certification (directly under title)
3. Teams (explicit chip row)
4. Description
5. Tags (footer with top rule)

### Advantages

- Most distinctive layout while staying on-brand
- Rail creates strong left-edge alignment in grids
- Cert-before-team order matches how engineers search cert-aligned skills
- Side-by-side comparison feels natural

### Trade-offs

- 56px rail narrows description column
- Rail team pips are decorative only — chips still required
- Largest structural change (CSS grid on card, new rail markup)
- May feel unfamiliar on first encounter

---

## Recommendation

| Priority | Concept | Rationale |
|----------|---------|-----------|
| **1st choice** | **B · Hero Header** | Best balance of hierarchy improvement, design-system fidelity, and implementation simplicity. Feels like a natural polish of the current card. |
| **2nd choice** | **A · Sectioned Atlas** | If category-section browsing is the primary use case (Organization tab with 18 skills per group). |
| **Density option** | **C · Badge Cloud** | If card count per viewport is the top constraint. |
| **Differentiation option** | **D · Split Ledger** | If the catalog needs a stronger visual identity distinct from My Plan cards. |

### Implementation path (if approved)

All concepts are **CSS + markup-only** in `buildSkillCard` — no API, handler, or modal changes.

1. Add a `tool-card--variant-{a|b|c|d}` class hook (or data attribute) for A/B testing.
2. Phase 1: Ship Concept B styles in `style.css` §7.x; bump `catalog.js` cache version.
3. Phase 2: Optionally add Concept A section labels behind a feature flag or admin preview toggle.
4. Validate at 1280px+ with Playwright: card height variance, hover admin actions, overflow popovers, archived state, light/dark themes.

---

## Files

| File | Purpose |
|------|---------|
| `skill-grid-card-concepts-mockup.html` | Interactive 4-concept mockup + current baseline |
| `skill-grid-card-concepts-design.md` | This brief |

**Related (broader catalog context):** `catalog-visual-redesign-mockups.html` covers page-level concepts; this brief focuses exclusively on the skill grid card component.
