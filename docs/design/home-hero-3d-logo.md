# Home Hero — Extruded 3D Logo

**Status:** Design mockup (awaiting approval)  
**Interactive mockup:** `docs/design/home-hero-3d-logo-mockup.html`  
**Replaces:** CSS `rotateX/Y` tilt on flat SVG in `.hm-a__brand-logo-3d` (home brand showcase)

---

## Concept

Upgrade the home page brand showcase from a **flat SVG on a tilting card** to a **true volumetric object** built from the same geometry as `mp-icon-dark` / `mp-icon-light`:

| SVG element | 3D representation |
|-------------|-------------------|
| Background rect | Rounded base plate (physical material, clearcoat) |
| Matrix brackets | Tube geometry along bracket paths, glass-metallic rim |
| Developing tile (filled square) | Extruded rounded box, emissive pulse + Z lift |
| Planned tile (circle) | Torus ring, opacity breathe |
| Mastered tile (square + check) | Extruded tile + embossed check, specular sweep |

The 3×3 grid layout and status semantics stay **1:1 with the app icon** — users already know this visual language from nav + favicon.

---

## Why not CSS 3D?

Current implementation (`hm-a-logo-3d` keyframes) rotates a **flat texture**. There is no parallax between bracket depth and grid cells, no edge lighting, and no per-cell animation. A WebGL extrusion reads as a **crafted product mark**, aligned with the Sherlock / GenAI-Wireless glass + accent aesthetic.

---

## Mockup features

**Important:** The WebGL version requires a local HTTP server — opening the HTML file directly (`file://`) blocks Three.js from loading in most browsers.

```bash
cd docs/design && python3 -m http.server 8765
# → http://localhost:8765/home-hero-3d-logo-mockup.html
```

Until WebGL loads, a **CSS 3D fallback** (layered plate + cells) is visible in the hero canvas area.

Open `home-hero-3d-logo-mockup.html` in a browser:

- **Hero context** — logo embedded in proposed home layout beside headline copy
- **Dark / Light** theme toggle — material palette swap (same topology)
- **Motion toggle** — full choreography vs static pose
- **OrbitControls** — drag to orbit, scroll to zoom
- **UnrealBloomPass** — accent emissive bloom on grid cells
- **Comparison panel** — current CSS tilt vs proposed extrusion
- **`prefers-reduced-motion`** — mockup respects OS setting on load

---

## Animation choreography

1. **Group idle** — slow yaw/pitch oscillation + vertical float (9s loop, matches current timing)
2. **Developing cells** — emissive intensity + Z position pulse (staggered phases)
3. **Planned cells** — ring opacity + scale breathe
4. **Mastered cells** — tile lift + subtle check wobble
5. **Rim light orbit** — accent point light circles the object
6. **Auto-rotate** — gentle OrbitControls autoRotate (user drag overrides)

Reduced motion: static pose at `rotateX(8deg) rotateY(-10deg)`, no cell pulses, no auto-rotate.

---

## Production implementation sketch

| Concern | Approach |
|---------|----------|
| **Load** | Lazy-import Three.js only on `mountHome()` when brand showcase renders |
| **Mount point** | Replace `.hm-a__brand-logo` inner SVG with `<canvas>` inside existing `.hm-a__brand-logo-3d` |
| **Fallback** | Keep current `BRAND_TILE_HTML` SVG if `WebGLRenderer` fails or `prefers-reduced-motion` |
| **Theme** | Subscribe to `Store.on('theme', …)` → swap materials (same as mockup palettes) |
| **Bundle** | Tree-shake Three.js (~45KB gz); optional merge geometry for single draw call |
| **Lifecycle** | Dispose renderer + cancel rAF on route teardown; pause when `document.hidden` |
| **Nav icon** | Stay flat SVG (16–32px) — 3D only on home hero showcase |

Suggested module: `frontend/js/components/brand-logo-3d.js` exporting `mountBrandLogo3d(container, { theme }) → cleanup`.

---

## Approval checklist

- [ ] 3D object reads clearly at 160–220px (brand showcase size)
- [ ] Dark + light themes both acceptable
- [ ] Motion feels premium, not distracting
- [ ] Performance acceptable on integrated GPU
- [ ] Fallback SVG path confirmed
- [ ] Proceed to production implementation in `home.js` + new component

---

## Related files

- `frontend/index.html` — `#mp-icon-dark`, `#mp-icon-light` symbol definitions
- `frontend/js/pages/home.js` — `buildBrandShowcase()`, `BRAND_TILE_HTML`
- `frontend/css/style.css` — `.hm-a__brand-logo-3d`, `@keyframes hm-a-logo-3d`
- `docs/design/app-icon-mockup.html` — flat icon design reference
