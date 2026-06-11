# Catalog Skill Cards — No Team Rows (4 Concepts)

**Goal:** Remove owner/consumer team chips from catalog grid cards. Team association stays in the **skill detail / edit modal** only. All card actions (edit, duplicate, join/leave consumer, delete) are unchanged.

**Open mockup:** `catalog-skill-card-no-teams-mockup.html` (dark/light toggle, 4 concepts)

---

## Shared rules (all concepts)

| On card | In modal only |
|---------|----------------|
| Skill name, icon, description | Owner teams |
| Category accent (rail, pill, or zone) | Consumer teams |
| Certificate badges (click → cert filter) | Join / leave consumer |
| Tags (max 4 + overflow) | Full team management |
| Manager hover actions (edit, duplicate, delete) | Reclassify / access preview |

**Removed from card:** `.tool-card-meta-row`, owner chip row, consumer chip row, empty “Consumers: None” placeholder.

---

## Concept 1 — Editorial Atlas

**Personality:** Calm, readable, closest to current MatrixPro polish.

```
┌─▌──────────────────────────────┐
│ ▌ [icon]  Skill Title      ⋯  │
│ ▌         CORE                 │
│ ▌  Two-line description that   │
│ ▌  gets more vertical space…   │
│ ▌ ─────────────────────────── │
│ ▌ CCNP · CCNA    tag · tag     │
└─▌──────────────────────────────┘
```

- **4px category left rail** (existing token)
- **Category pill** under title (uppercase, 10px)
- **Description expanded** to 3-line clamp — fills space freed by removing team rows
- **Single footer band:** certs left, tags right, hairline separator
- **Best for:** Safest rollout, minimal JS/DOM change

---

## Concept 2 — Glass Monument

**Personality:** Bold hero energy aligned with Start Page / home hero mesh.

```
┌──────────────────────────────┐
│ ░░░ gradient category wash ░░ │
│      ┌──────┐                │
│      │ ICON │  (56px well)   │
│      └──────┘                │
│  Skill Title                 │
│  Description…                │
│  [cert] [cert]               │
│  tag  tag  tag     details → │
└──────────────────────────────┘
```

- **Top 40%** category-tinted glass band (`color-mix` with `--cat-*-accent`)
- **Inverted icon well** — solid accent, white glyph
- **Hover:** accent glow + “View details →” (opens modal with teams)
- **Best for:** Demo impact, marketing screenshots, smaller catalogs

---

## Concept 3 — Horizon Strip

**Personality:** Dense horizontal scan — optimized for 70+ skills per section.

```
┌──────────────────────────────┐
│ ████ category cap bar (5px)  │
│ [ico] Title          [CCNP]  │
│       2-line desc…           │
│       tag · tag · tag        │
└──────────────────────────────┘
```

- **Full-width category cap** instead of left rail
- **Icon + text column** + **cert pill docked right** (align-self start)
- **Lowest card height** of the four (~120–140px)
- **Best for:** LANSW-scale grids, managers scanning many skills quickly

---

## Concept 4 — Split Ledger

**Personality:** Editorial bento — category color as structural column.

```
┌──────┬───────────────────────┐
│ CORE │ Skill Title       ⋯  │
│ [ico]│ Description block…   │
│  ·   │ CCNP  CCNA           │
│  ·   │ tag  tag  tag        │
└──────┴───────────────────────┘
```

- **Left column ~72px** — vertical category label + icon, gradient rail
- **Right column** — all readable content
- **Strong category grouping** when scrolling a mixed section
- **Best for:** Organization tab with collapsible category sections

---

## Recommendation matrix

| Priority | Pick |
|----------|------|
| Lowest risk / fastest ship | **1 Editorial Atlas** |
| Bold but on-brand | **2 Glass Monument** |
| Maximum density | **3 Horizon Strip** |
| Category-forward browsing | **4 Split Ledger** |

---

## Vivid set (concepts 5–8)

See **`catalog-skill-card-vivid-mockup.html`** — same no-team rule, **spectrum palette** (emerald / violet / teal / rose / amber), gradients, glow, subtle motion.

| # | Name | Visual signature |
|---|------|------------------|
| 5 | **Aurora Frame** | Animated gradient border ring + inner glass |
| 6 | **Sunset Prism** | Layered coral/violet/teal washes + gold certs |
| 7 | **Neon Luminous** | Dark canvas, neon halo, light sweep |
| 8 | **Depth Mesh** | Internal mesh + grain, floating icon, hover tilt |

| Priority | Pick (vivid) |
|----------|----------------|
| Premium polish, still readable | **5 Aurora Frame** |
| Liked 5 but on-brand (gray/blue) | **Aurora Slate** — `catalog-skill-card-aurora-slate-mockup.html` |
| Warm / editorial | **6 Sunset Prism** |
| High contrast, dark-first | **7 Neon Luminous** |
| Depth without heavy color | **8 Depth Mesh** |

### Aurora Slate — muted Concept 5 (recommended)

**File:** `catalog-skill-card-aurora-slate-mockup.html`

Same structure as **Aurora Frame** (2px animated gradient ring → inner glass panel → icon + category + title + desc + certs/tags). Palette locked to existing tokens:

| Element | Tokens |
|---------|--------|
| Page mesh | `--accent-glow`, `--bg-page` |
| Border ring | Slate grays ↔ `#5cb1ff` ↔ `#3b82f6` (14s cycle, not rainbow) |
| Category label + icon tint | `--cat-foundational-accent` … `--cat-ai-accent` |
| Inner panel | `--bg-card` + inset highlight |
| Certs | Neutral `--bg-elevated` pills (not gold) |
| Meta icons | 14px award badge (certs row) + tag label (tags row); `--text-muted`, accent on hover |
| Title | Solid `--text-primary` (no gradient text) |

Category differences are **subtle blue-gray steps**, not emerald/violet/rose.

---

## Implementation notes

1. **`buildSkillCard()`** — delete `ownerRow` / `consumerRow` blocks; keep modal + action handlers.
2. **CSS** — new BEM block e.g. `.cat-skill-card--atlas` vs modifying `.tool-card` globally.
3. **Modal** — no change required; ownership UI already lives in `showSkillDetailModal` / edit modal.
4. **Add mode** — “Add to My Plan” CTA remains on card footer when `_addMode` is active.
5. **Accessibility** — card `aria-label` can omit teams; modal remains source of truth for association.

---

## Files

| File | Purpose |
|------|---------|
| `catalog-skill-card-no-teams-mockup.html` | Interactive comparison (4 tabs) |
| `catalog-skill-card-vivid-mockup.html` | Vivid comparison (concepts 5–8) |
| `catalog-skill-card-aurora-slate-mockup.html` | Muted Aurora Frame (gray/black/blue) |
| `catalog-skill-card-no-teams-design.md` | This document |
