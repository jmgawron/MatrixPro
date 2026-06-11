# Catalog Category Section Skins — Clean & Light

Interactive mockup: **`catalog-category-section-skins-mockup.html`**

**Scope:** Visual treatment of `.catalog-category-section` headers only.  
**Unchanged:** Editorial Stack layout, collapse behavior, tree, toolbar, tabs, card grid, Aurora Slate cards.

---

## Skins at a glance

| Skin | Name | Character |
|------|------|-----------|
| **0** | Baseline | Production §7.17 — uppercase, count pill, border-between |
| **A** | Whisper | Hairline top rule, sentence-case 500 weight, middot count |
| **B** | Air | No borders/icons, whitespace tiers, micro uppercase label |
| **C** | Thread | Faint left accent bar in `--cat-*-accent`, no horizontal rules |
| **D** | Lumen | Open section: 45% `--bg-card-soft` wash + inner divider |
| **E** | Silk | Dotted header rule, quiet title + plain count |
| **F** | Feather | Compact micro-header; open title tints to category accent |

---

## Wireframe (structure identical for all skins)

```
[chevron] [icon] Category name                    count
─────────────────────────────────────────────────────  ← styling varies
  [Aurora card]  [Aurora card]

[chevron] [icon] Next category …
```

---

## Recommendation

| Goal | Pick |
|------|------|
| Lightest feel, minimal chrome | **A Whisper** or **B Air** |
| Subtle category color without boxes | **C Thread** |
| Clear “open drawer” for expanded Core | **D Lumen** |
| Editorial / catalog index feel | **E Silk** |
| Smallest header, accent when open | **F Feather** |

**Suggested default:** **A Whisper** or **C Thread** — pairs well with Aurora Slate cards without competing visual weight.

---

## Implementation

Add modifier on `.catalog-category-sections` wrapper, e.g. `.catalog-category-sections--whisper`, with overrides in `style.css` §7.17. No JS changes beyond optional class on container.

Related: `catalog-skill-card-aurora-slate-mockup.html`, `catalog-page-category-layouts-design.md` (layout propositions — separate concern).
