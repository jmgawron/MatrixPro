# Skill Catalog Modal — Visual Polish Proposal

**Status:** Mockup for review (not implemented)  
**Interactive preview:** `docs/design/skill-catalog-modal-visual-polish-mockup.html`  
**Scope:** Cosmetic only — no layout or functional rearrangement  
**Production targets:** `frontend/css/style.css` §7.25 catalog/sdm rules, scoped under `.catalog-unified-modal`

---

## Goal

Make the unified skill catalog modal feel more **premium and inviting** while staying **enterprise-professional** — aligned with MatrixPro’s Sherlock / GenAI-Wireless design language (dark-first, glass accents, Cisco blue `#3b82f6` / `#00AEEF`).

---

## Current state (baseline)

| Area | Today |
|------|--------|
| Modal shell | Flat `--bg-panel`, single `--shadow-lg`, 1px `--border-strong` |
| Header | Plain sticky bar; icon tile is flat rgba blue fill |
| Meta block | Simple `--bg-card-soft` box |
| Tabs | Underline style, minimal hover |
| 3E track | Functional bubbles + connectors; focus ring is subtle |
| List column | Flat `--bg-card-soft`; items are text rows |
| Reader | White-space content; toolbar is utilitarian |
| Footer | Hidden until dirty; no glass or accent emphasis |
| Details form | Existing section cards — adequate but flat |

**Strengths:** Clear hierarchy, My Plan parity, accessible contrast.  
**Gap:** Surfaces feel “flat admin UI” rather than a flagship catalog experience.

---

## Proposed enhancements (layout unchanged)

### 1. Modal shell & backdrop

- **Layered elevation:** outer ambient shadow + tighter contact shadow (depth without heaviness).
- **Top accent hairline:** 2px `--brand-gradient` strip on modal top edge (signature MatrixPro chrome).
- **Border luminance:** pseudo-element gradient border (lighter top edge, darker bottom) for subtle dimension.
- **Backdrop:** stronger blur + radial vignette behind modal (mockup stage only; production uses `.modal-overlay`).

### 2. Header hero band

- **Soft gradient wash** behind header (`radial` accent at top-left, fades to `--bg-panel`).
- **Icon tile upgrade:** diagonal gradient fill, 1px inner highlight, soft colored glow matching accent.
- **Title typography:** weight 800, `-0.025em` letter-spacing — sharper without changing size.
- **Description:** slightly increased line-height; muted secondary stays readable.

### 3. Meta panel (glass card)

- **Frosted surface:** `backdrop-filter: blur(12px)` + semi-transparent `--bg-card-soft`.
- **Inner top highlight:** 1px rgba white / accent at 8% opacity (dark) for “lit edge”.
- **Chip polish:** existing chips unchanged structurally; meta labels get tighter uppercase tracking.

### 4. Content | Details tabs

- **Segmented pill track:** tabs sit in inset `--bg-card-soft` rail with rounded container.
- **Active tab:** filled pill with `--accent-soft` bg + accent text (instead of underline-only).
- **Hover:** gentle background lift, no layout shift.

### 5. 3E vertical track (Content tab)

- **Section focus card:** expanded section gets soft tinted wash + 1px colored outline (education green / exposure cyan / experience purple — existing semantic colors).
- **Bubble nodes:** radial gradient fills + micro shadow; focused bubble gets outer glow ring.
- **Connectors:** vertical gradient stroke (fade at ends) instead of flat line.
- **List items:** rounded rows; **active** = left 3px accent bar + soft fill; **pending** = amber left bar + title accent color (extends existing `.catalog-list-item--pending`).

### 6. Reader column

- **Surface contrast:** reader column one step lighter/darker than list for separation without new borders.
- **Toolbar:** frosted bar, bottom hairline separator.
- **Type meta pill:** small uppercase badge (`course · Education`) with semantic tint background.
- **Prose:** comfortable 1.65 line-height; link uses accent with underline on hover.

### 7. Details tab sections

- **Section headers:** optional 32px gradient rule under title (accent → transparent).
- **Association cards:** existing `.skill-assoc-section` gets inset shadow + hover border brighten.
- **No form control changes** — only container surfaces.

### 8. Footer (Save / Discard)

- **Glass footer bar** when visible (`backdrop-filter`, top border).
- **Dirty state:** accent top border pulse (respects `prefers-reduced-motion`).
- **Save Details button:** subtle `--brand-gradient` fill + soft blue shadow (primary stays recognizable).
- **Status text:** accent color when dirty (already partially present).

---

## What we are *not* changing

- Two-column Content layout (3E list + reader)
- Details tab section order (Identity → Classification → Associations → Visual)
- RBAC, Save Details flow, drag-reorder, item editor placement
- Font family (system stack) — no new web fonts
- Component markup structure (CSS-only polish)

---

## Theme behavior

All rules have **`[data-theme="light"]` overrides**:

- Reduce glow intensity (shadows use rgba black at lower alpha).
- Glass surfaces use higher opacity whites instead of dark translucency.
- Gradient washes toned down to avoid “neon” on light backgrounds.

---

## Accessibility & motion

- Contrast maintained ≥ 4.5:1 for body text; accent used for emphasis only.
- Focus rings preserved on all interactive elements.
- Animations limited to **opacity / box-shadow / border-color** ≤ 280ms.
- `prefers-reduced-motion: reduce` disables footer pulse and bubble glow transitions.

---

## Implementation plan (after approval)

1. Add scoped block in `style.css`: `.catalog-unified-modal.catalog-skill-modal { … }` (~180–220 lines).
2. Optional: 3–4 CSS custom properties for polish (`--catalog-modal-glow`, etc.) on `:root` for theme tuning.
3. Bump `style.css?v=` in `index.html`.
4. Visual QA: dark + light, dirty footer, pending list items, Details tab, engineer browse-only (no broken affordances).

**Estimated diff:** CSS only, no JS changes.

---

## Mockup usage

Open `skill-catalog-modal-visual-polish-mockup.html` in a browser (serve from repo root or open via local HTTP so `style.css` resolves).

| Control | Purpose |
|---------|---------|
| **Current / Polished** | Toggle enhancement layer |
| **Content / Details / Unsaved** | View states |
| **Light / Dark** | Theme parity check |

Approve the **Polished** column to proceed with CSS implementation.
