# Home Hero Logo Redesign — Design Brief

**Status:** Implemented (Proposition D — Orbital Beacon)  
**Mockup file:** `docs/design/home-hero-logo-redesign-mockup.html`  
**Base asset:** `frontend/icon.svg` / `#mp-icon-dark` / `#mp-icon-light` symbols

---

## Context

The home page currently uses two logo treatments:

| Audience | Location | Current treatment |
|----------|----------|-------------------|
| **Logged-in** | Inline with headline (`72×72`) | Static dual-theme SVG tile |
| **Guest** | Right-column showcase (`~320px`) | Three.js WebGL extruded logo + CSS fallback |

Goal: unify around a more polished, animated treatment derived from the canonical SVG — theme-aware, on-brand, and performant.

---

## Design tokens (from `style.css`)

| Token | Dark | Light |
|-------|------|-------|
| `--accent` | `#5cb1ff` | `#3b82f6` |
| `--accent-glow` | `rgba(92,177,255,.35)` | `rgba(59,130,246,.22)` |
| Plate bg | `#0a1628` gradient | `#ffffff` |
| Bracket stroke | `#7cc1ff` | `#3b82f6` |
| Status planned | `#94a3b8` | `#94a3b8` |
| Status developing | `#5cb1ff` | `#3b82f6` |
| Status mastered | `#e5c76b` | `#e5c76b` |

All propositions honor `prefers-reduced-motion: reduce` (animations disabled).

---

## Four propositions

### A — Glass Aurora *(recommended)*

- **Concept:** Frosted glass envelope around the full icon + slow conic-gradient aurora halo + gentle float + periodic shimmer sweep.
- **Why:** Best alignment with Sherlock / GenAI glassmorphism. Premium without competing with headline copy.
- **Animation:** 5.5s float, 18s aurora spin, 6s shimmer — all subtle.
- **Implementation:** Pure CSS + inline SVG; no WebGL dependency.
- **Scale:** Works at both 72px (headline) and 320px (guest showcase).

### B — Status Pulse Matrix

- **Concept:** Full icon with CSS overlay pulses on each 3×3 cell using semantic plan-status colors.
- **Why:** Directly communicates the product metaphor (planned → developing → mastered).
- **Animation:** Staggered 2.4s cell pulses; dashed outer rings rotate slowly.
- **Implementation:** SVG base + positioned `.logo-b__cell` spans.
- **Trade-off:** Busier at small sizes; best if product story is the priority.

### C — Depth Parallax

- **Concept:** Icon split into plate / brackets / grid layers with CSS `preserve-3d` extrusion, holographic overlay, floor reflection.
- **Why:** Rich depth similar to current WebGL logo but ~10× lighter (no Three.js).
- **Animation:** 8s gentle tilt oscillation.
- **Implementation:** Three layered SVGs + CSS transforms.
- **Trade-off:** 3D effect reduced at 72px; strongest at guest hero size.

### D — Orbital Beacon

- **Concept:** Radar pulses, two orbiting accent dots, vertical scan line, central glow beacon.
- **Why:** Maximum visual impact for guest landing — logo as hero focal point.
- **Animation:** 3.2s radial pulses, 12s/18s orbits, 4s scan sweep.
- **Implementation:** Pure CSS decorations around scaled-down icon core.
- **Trade-off:** Most dramatic; may feel heavy next to headline at 72px.

---

## Recommended implementation plan (post-approval)

1. Create `frontend/js/components/brand-logo-animated.js` — single component, `variant: 'a'|'b'|'c'|'d'`, `size: 'headline'|'showcase'`.
2. Replace static `BRAND_TILE_HTML` in `home.js` with animated component (headline size).
3. Replace or augment `brand-logo-3d.js` guest showcase with chosen variant at showcase size.
4. Add CSS section `§7.xx Home Hero Animated Logo` in `style.css`.
5. Bump cache versions in `index.html` / `app.js`.

---

## How to review

Open the mockup in a browser:

```bash
open docs/design/home-hero-logo-redesign-mockup.html
```

Toggle **Dark theme** / **Light theme** buttons. Compare all four cards and the 72px in-context strip at the bottom.

Reply with **A**, **B**, **C**, or **D** to proceed with implementation.
