# Catalog Page — Category Layout Propositions

Interactive mockup: **`catalog-page-category-layouts-mockup.html`**

Full **Organization** tab shell (hero, stats, tabs, toolbar, domain/team tree) with **Aurora Slate** skill cards and **four ways** to present category groups.

Cards use the agreed rules: **no owner/consumer rows** on cards; cert/tag meta icons; teams in modal only.

---

## Shared page chrome (all propositions)

```
┌─────────────────────────────────────────────────────────────┐
│ Skill Catalog                    [70 Skills][84 Teams][27 Certs] │
│ [Organization] [Certification] [Non-Technical]              │
│ Shifts 1·2·3·4   Filter by tag…              Sort · Name A→Z │
├──────────────┬──────────────────────────────────────────────┤
│ ENT          │  ← category layout varies (4 propositions)   │
│  LANSW-S2 ●  │                                              │
│  ROUT-S1     │                                              │
│ DC           │                                              │
│  ACI-S1      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

---

## Proposition 1 — Editorial Stack (baseline)

**Personality:** Current production §7.17 — minimal, scannable, lowest migration cost.

```
▼ CORE · ◆ · 2
  [Aurora card] [Aurora card]

▶ FOUNDATIONAL · 🌱 · 2
▶ ADVANCED · ⚛ · 2
▶ AI & FUTURE · ✦ · 2
```

| Pros | Cons |
|------|------|
| Already implemented | Aurora cards can feel “floating” without container |
| Familiar collapsible UX | Long scroll with 70+ skills |
| Matches My Plan category typography | Weak visual boundary between tiers |

**Best when:** Ship Aurora cards quickly without restructuring catalog layout.

---

## Proposition 2 — Glass Vault

**Personality:** Each category is a **rounded glass panel** with accent top bar + inner grid.

```
┌─ Core ───────────────────────────── 2 ─┐
│ [card] [card]                         │
└───────────────────────────────────────┘

┌─ Foundational ─────────────────── 2 ─┐
│ (collapsed)                           │
└───────────────────────────────────────┘
```

| Pros | Cons |
|------|------|
| Strong grouping for premium Aurora cards | +vertical padding vs P1 |
| Accent bar maps to `--cat-*-accent` | More CSS surface area |
| Collapse still supported | Panels stack heavily on small viewports |

**Best when:** You want category tiers to feel like **vault drawers** without changing navigation model.

---

## Proposition 3 — Category Rail

**Personality:** Sticky **left category navigator** inside skills panel + anchor sections (My Plan chip pattern at catalog scale).

```
┌ Jump to ─┐  Core · 2 skills
│ Found. 2 │  [card] [card]
│ ● Core 2 │  ─────────────────
│ Adv.   2 │  Advanced · 2 skills
│ AI     2 │  [card] [card]
└──────────┘
```

| Pros | Cons |
|------|------|
| Fast jump in long catalogs | Narrower card column (~2-up grid) |
| Rail stays visible while scrolling | Two navigation systems (tree + rail) |
| Clear “you are here” for tier | Rail redundant if only one category expanded |

**Best when:** LANSW-scale datasets (18+ skills per tier) and managers jump between tiers often.

---

## Proposition 4 — Focus Strip

**Personality:** Horizontal **category pills** filter to **one tier at a time** + optional hero blurb.

```
[All 8] [Foundational 2] [● Core 2] [Advanced 2] [AI 2]

┌ Core ────────────────────────────────────────┐
│ Day-to-day operational skills…               │
└──────────────────────────────────────────────┘
[card] [card]
```

| Pros | Cons |
|------|------|
| Least vertical scroll per session | Cannot scan across tiers at once (unless “All”) |
| Hero strip explains tier purpose | Extra click to compare Foundational vs Core |
| Full width for 2-up Aurora grid | “All” mode reintroduces long scroll |

**Best when:** Engineers browse **one classification tier deeply** (e.g. only Core ops skills).

---

## Recommendation matrix

| Priority | Pick |
|----------|------|
| Fastest ship (cards only) | **P1 Editorial Stack** + Aurora Slate cards |
| Best visual fit for Aurora Slate | **P2 Glass Vault** |
| Large catalog / power users | **P3 Category Rail** |
| Reduced scroll / focused browsing | **P4 Focus Strip** |

**Suggested combo:** Aurora Slate cards + **P2 Glass Vault** — premium card frame inside contained tier panels, still collapsible, on-brand gray/blue accents.

---

## Implementation notes

1. **`buildCategorySection()`** — branch on layout mode flag or replace wrapper class (`catalog-category-section` vs `cp-glass-section`).
2. **Cards** — swap `buildSkillCard()` output to Aurora Slate BEM block; remove team rows.
3. **P3 rail** — reuse `.mp-filter-chips--inline` tokens; wire `scrollIntoView` + `IntersectionObserver` for active state.
4. **P4 strip** — reuse `.mp-filter-chip`; filter skills client-side (category slug) instead of re-fetch.
5. **Default collapse** — keep Core expanded, others collapsed (matches current org tab behavior).

---

## Related files

| File | Purpose |
|------|---------|
| `catalog-page-category-layouts-mockup.html` | Full page interactive mockup |
| `catalog-skill-card-aurora-slate-mockup.html` | Card-level Aurora Slate detail |
| `catalog-skill-card-no-teams-design.md` | Card concepts + vivid set |
