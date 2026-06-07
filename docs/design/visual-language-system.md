# MatrixPro — Unified Visual Language (Investigation)

**Status:** Design review — visual / CSS only, no functional changes  
**Entry point:** `docs/design/visual-language-modules.html` (module-by-module presenter)  
**Reference mockup:** `home-hero-3d-logo-mockup.html` (canonical token + panel vocabulary)

---

## Executive summary

Production MatrixPro uses the **Sherlock / GenAI-Wireless** token stack in `frontend/css/style.css`, but individual pages were built in **different generations**. Mockups in `docs/design/` converge on a tighter **enterprise glass** language: deeper navy surfaces, brighter accent ink in dark mode, larger radii, radial page atmosphere, editorial uppercase labels, pill controls, and unified status chips.

**Recommendation:** Roll out as **token + primitive layer first**, then **one module at a time** — each module keeps its DOM and behavior; only CSS classes and non-semantic wrappers change.

---

## Mockup visual language (target)

Extracted from `home-hero-3d-logo-mockup.html`, `home-page-redesign-mockups.html`, and modal polish mockups.

### Color & atmosphere

| Token | Dark (mockup) | Production dark today | Delta |
|-------|---------------|----------------------|-------|
| Page bg | `#070b12` + dual radial glows | `#0d1117` flat | Mockups add **ambient mesh** (accent top-right, indigo bottom-left) |
| Panel / card | `#0d1119` / `#121824` | `#11161f` / `#161d29` | Mockups are **deeper, less gray-green** |
| Accent | `#5cb1ff` (ink) + `#3b82f6` (CTA) | `#3b82f6` only | Dark mode mockups use **lighter cyan ink** on navy |
| Accent glow | `rgba(92,177,255,.35)` | ad-hoc per page | Standardize as `--accent-glow` |
| Border | `rgba(255,255,255,.07)` | `--border-soft` similar | Align to single rgba recipe |

### Shape & elevation

| Property | Mockup | Production | Delta |
|----------|--------|------------|-------|
| Panel radius | `--radius-xl: 28px` | `--radius-lg: 14px` max on cards | **2× rounder** shells on hero/modals |
| Buttons (secondary) | `999px` pill, 13px/600 | mixed `.btn` radii | Unify to **pill secondary**, **12px rect primary** |
| Panel shadow | `0 24px 64px rgba(0,0,0,.28)` | `--shadow-lg` lighter | **Deeper contact + ambient** pair |
| Glass | `backdrop-filter: blur(12px)` on meta/toolbars | partial (library modal) | Extend to **search bars, meta strips, sticky headers** |

### Typography

| Role | Mockup | Production |
|------|--------|------------|
| Eyebrow | 11px / 700 / `0.16em` uppercase / accent | varies (`hm-a__eyebrow`, section labels) |
| Page title | clamp 28–38px / 700–800 / `-0.02em` | `mp-title` similar but heavier stats row |
| Panel label | 11px / 700 / `0.14em` uppercase / muted | inconsistent |
| Body | 14–15px / 1.65 lh / secondary | 14px ok |
| Gradient headline | `135deg accent → indigo → sky` | `mp-title-gradient` exists — **reuse everywhere** |

### Controls

| Control | Mockup pattern | Production gap |
|---------|----------------|----------------|
| Tabs (secondary) | Pill track, active = accent fill + border | Catalog uses underline tabs |
| Chips / filters | Pill + ✓, `accent-soft` active ring | My Plan sidebar uses border-left variant |
| Badges | 10px uppercase pill, accent border | mixed |
| CTA primary | `#2563eb` fill + colored shadow | `.btn-primary` close |
| CTA secondary | transparent + soft border | ok |

### Status semantics (cross-module)

From `visual-consistency-preview.html` — **must unify before module polish**:

| Status | Foreground | Meaning |
|--------|------------|---------|
| Planned | slate `#94a3b8` | hollow / ring in icon grid |
| Developing | `#00AEEF` / `#5cb1ff` | solid tile |
| Mastered | `#22c55e` | tile + check |

Today: modal, explorer, overview, and my-team each use **different chip colors**. Module mockups assume this table.

### Motion

- Hero / logo: slow orbit / 11s ease-in-out tilt  
- Micro-interactions: **150ms** border + glow ring (`0 0 0 3px var(--accent-glow)`)  
- `prefers-reduced-motion`: static tilt, no spin  
- Tab hidden: pause WebGL / heavy animation (already in brand logo component)

---

## Production vs mockup — module matrix

| # | Module | Mockup file(s) | Coverage | Primary visual gaps |
|---|--------|----------------|----------|---------------------|
| 0 | **Design foundation** | `visual-consistency-preview.html` | ✅ Tokens + chips | Status chip unification, token migration |
| 1 | **Global shell** | *(inline in module hub)* | ⚠️ Stub | Nav flat bar; no page mesh; theme toggle styling |
| 2 | **Home** | `home-page-redesign-mockups.html`, `home-hero-3d-logo-mockup.html` | ✅ Full | Guest hero + 3D logo shipped; logged-in command center partial |
| 3 | **Login** | *(inline stub)* | ⚠️ Stub | Plain form card; no brand lockup atmosphere |
| 4 | **My Plan** | `my-plan-visual-redesign-mockups.html`, `skill-detail-modal-mockup.html`, `library-modal-redesign-mockup.html`, `my-plan-reporting-mockup.html` | ✅ Full | Dense cards, dual progress, sidebar filter patterns |
| 5 | **Catalog** | `catalog-visual-redesign-mockups.html`, `skill-card-demo.html` | ✅ Full | Flat hero, underline tabs, `.tool-card` density |
| 6 | **Catalog skill modal** | `skill-catalog-modal-visual-polish-mockup.html`, `skill-catalog-unified-editor-mockup.html` | ✅ Full | Flat shell; underline tabs; 3E track utilitarian |
| 7 | **Skill detail (plan)** | `skill-detail-modal-mockup.html`, `skill-modal-3e-rail-mockup.html` | ✅ Full | Parity with catalog modal polish |
| 8 | **Library modal** | `library-modal-redesign-mockup.html` | ✅ Implemented CSS §7.20 — polish pass optional |
| 9 | **My Team** | *(inline stub)* | ⚠️ Stub | Matrix grid sticky headers; chart cards; bulk assign bar |
| 10 | **Skill Explorer** | *(inline stub)* | ⚠️ Stub | Compare table; overlap viz; import CTA row |
| 11 | **Admin** | *(inline stub)* | ⚠️ Stub | CRUD tables; tab bar; icon picker density |
| 12 | **Settings** | *(inline stub)* | ⚠️ Stub | Narrow form column; avatar picker |

---

## How to adjust production (no functional changes)

### Layer 0 — Tokens (`style.css` `:root`)

Add / remap without breaking existing vars:

```css
:root {
  --accent-glow: rgba(92, 177, 255, 0.35);
  --radius-xl: 28px;
  --shadow-panel: 0 24px 64px rgba(0, 0, 0, 0.28);
  --mesh-accent: radial-gradient(1200px 700px at 85% -5%, var(--accent-glow), transparent 55%);
  /* status-* from visual-consistency-preview */
}
[data-theme="light"] {
  --accent-glow: rgba(59, 130, 246, 0.22);
  --shadow-panel: 0 20px 48px rgba(15, 23, 42, 0.08);
}
```

Optional dark accent ink shift: `--accent: #5cb1ff` (keep `--accent-strong: #3b82f6` for buttons).

### Layer 1 — Primitives

| Primitive | Action |
|-----------|--------|
| `.panel` / `.glass-shell` | New wrapper: xl radius + panel shadow + 1px border |
| `.page-mesh` | Absolute radial layers on `[data-page]` — Home already has `hm-a__mesh` |
| `.eyebrow`, `.panel-label` | Single typography recipe |
| `.btn-pill` | Secondary controls (filters, mockup chrome) |
| `.status-chip--*` | Replace ad-hoc chip colors app-wide |
| `.segment-tabs` | Pill track for Catalog / modal tabs |

### Layer 2 — Module CSS scopes

Only touch scoped sections — **no JS logic changes**:

| Module | CSS section | JS touch |
|--------|-------------|----------|
| Home | `§ hm-a` | none (3D logo done) |
| Catalog | `§ Catalog V2`, `.tool-card` | class hooks on wrappers only |
| My Plan | `§ MP`, `§7.19`, `§7.25` | optional wrapper divs |
| Modals | `§7.20`, `§7.24`, `.catalog-unified-modal` | none |
| My Team | `§ matrix` | none |
| Admin | `§ admin` | none |

### Layer 3 — Per-module approval

Use `visual-language-modules.html` stepper: review module → approve → implement CSS phase → bump `style.css?v=N` only for that module.

---

## Recommended rollout order

1. **Foundation** — status chips + tokens + buttons (fixes inconsistency everywhere)  
2. **Global shell** — nav + page mesh wrapper  
3. **Home** — align guest hero typography to mockup panels (3D logo done)  
4. **Catalog** — highest traffic; card + toolbar polish  
5. **My Plan** — cards + command strip (matches catalog vocabulary)  
6. **Catalog unified modal** — flagship surface  
7. **Skill detail + Library modals** — reuse modal chrome kit  
8. **My Team → Explorer → Admin → Settings → Login** — new mockups then CSS  

---

## Files

| File | Purpose |
|------|---------|
| `visual-language-system.md` | This investigation |
| `visual-language-modules.html` | Interactive module-by-module presenter |
| `visual-consistency-preview.html` | Token + status chip before/after |
| `home-hero-3d-logo-mockup.html` | Canonical color / panel / CTA reference |

---

## Preview

```bash
cd docs/design && python3 -m http.server 8765
# → http://localhost:8765/visual-language-modules.html
```

Use **Next module** in the hub to walk through each area one at a time.
