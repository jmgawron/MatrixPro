/**
 * Guest hero brand visual — extruded WebGL Matrix logo (Three.js r162).
 * Ported from docs/design/home-hero-3d-logo-mockup.html with CSS layered fallback.
 */

const LAYER_SVGS = {
  dark: {
    plate: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="48" fill="#0a1628"/></svg>',
    brackets: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#7cc1ff" stroke-width="6" stroke-linecap="round"><path d="M 60 44 Q 36 44 36 68 L 36 188 Q 36 212 60 212"/><path d="M 196 44 Q 220 44 220 68 L 220 188 Q 220 212 196 212"/></g></svg>',
    grid: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect x="64" y="60" width="36" height="36" rx="8" fill="#5cb1ff"/><circle cx="128" cy="78" r="16" fill="none" stroke="#5cb1ff" stroke-width="4"/><g transform="translate(156 60)"><rect width="36" height="36" rx="8" fill="#5cb1ff"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#0a1628" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="82" cy="128" r="16" fill="none" stroke="#5cb1ff" stroke-width="4"/><rect x="110" y="110" width="36" height="36" rx="8" fill="#5cb1ff"/><g transform="translate(156 110)"><rect width="36" height="36" rx="8" fill="#5cb1ff"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#0a1628" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><rect x="64" y="160" width="36" height="36" rx="8" fill="#5cb1ff"/><g transform="translate(110 160)"><rect width="36" height="36" rx="8" fill="#5cb1ff"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#0a1628" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="174" cy="178" r="16" fill="none" stroke="#5cb1ff" stroke-width="4"/></svg>',
  },
  light: {
    plate: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" rx="48" fill="#ffffff"/></svg>',
    brackets: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#3b82f6" stroke-width="6" stroke-linecap="round"><path d="M 60 44 Q 36 44 36 68 L 36 188 Q 36 212 60 212"/><path d="M 196 44 Q 220 44 220 68 L 220 188 Q 220 212 196 212"/></g></svg>',
    grid: '<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect x="64" y="60" width="36" height="36" rx="8" fill="#3b82f6"/><circle cx="128" cy="78" r="16" fill="none" stroke="#3b82f6" stroke-width="4"/><g transform="translate(156 60)"><rect width="36" height="36" rx="8" fill="#3b82f6"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="82" cy="128" r="16" fill="none" stroke="#3b82f6" stroke-width="4"/><rect x="110" y="110" width="36" height="36" rx="8" fill="#3b82f6"/><g transform="translate(156 110)"><rect width="36" height="36" rx="8" fill="#3b82f6"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#0a1628" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><rect x="64" y="160" width="36" height="36" rx="8" fill="#3b82f6"/><g transform="translate(110 160)"><rect width="36" height="36" rx="8" fill="#3b82f6"/><path d="M 9 19 L 16 26 L 27 13" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="174" cy="178" r="16" fill="none" stroke="#3b82f6" stroke-width="4"/></svg>',
  },
};

const ICON_CELLS = [
  { kind: 'developing', phase: 0.0, rect: [64, 60] },
  { kind: 'planned', phase: 0.4, ring: [128, 78] },
  { kind: 'mastered', phase: 0.8, rect: [156, 60] },
  { kind: 'planned', phase: 1.2, ring: [82, 128] },
  { kind: 'developing', phase: 1.6, rect: [110, 110] },
  { kind: 'mastered', phase: 2.0, rect: [156, 110] },
  { kind: 'developing', phase: 2.4, rect: [64, 160] },
  { kind: 'mastered', phase: 2.8, rect: [110, 160] },
  { kind: 'planned', phase: 3.2, ring: [174, 178] },
];

const BRACKET_PATHS = {
  left: [
    { type: 'q', p0: [60, 44], p1: [36, 44], p2: [36, 68] },
    { type: 'l', p0: [36, 68], p1: [36, 188] },
    { type: 'q', p0: [36, 188], p1: [36, 212], p2: [60, 212] },
  ],
  right: [
    { type: 'q', p0: [196, 44], p1: [220, 44], p2: [220, 68] },
    { type: 'l', p0: [220, 68], p1: [220, 188] },
    { type: 'q', p0: [220, 188], p1: [220, 212], p2: [196, 212] },
  ],
};

const CHECK_LOCAL = [[9, 19], [16, 26], [27, 13]];

const PALETTE = {
  dark: {
    plate: 0x0a1628,
    accent: 0x5cb1ff,
    bracket: 0x7cc1ff,
    check: 0x0a1628,
    emissive: 0x5cb1ff,
  },
  light: {
    plate: 0xffffff,
    accent: 0x3b82f6,
    bracket: 0x3b82f6,
    check: 0xffffff,
    emissive: 0x3b82f6,
  },
};

const ICON_UNITS = 256;
const ICON_SIZE = 2.4;
const S = ICON_SIZE / ICON_UNITS;
const PLATE_DEPTH = 0.07;
const BRACKET_STROKE = 6;
const BRACKET_TUBE = (BRACKET_STROKE / 2) * S;
const TILE = 36;
const TILE_RX = 8;
const TILE_DEPTH = 0.13;
const RING_R = 16;
const RING_STROKE = 4;
const RING_TUBE = (RING_STROKE / 2) * S;

function getTheme() {
  return document.body.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function probeWebGL() {
  try {
    const test = document.createElement('canvas');
    const attrs = { failIfMajorPerformanceCaveat: false, antialias: false };
    return !!(test.getContext('webgl2', attrs) || test.getContext('webgl', attrs) || test.getContext('experimental-webgl', attrs));
  } catch {
    return false;
  }
}

function loadThreeModules() {
  return Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
  ]).then(([three, roundedBox, orbit, composer, renderPass, bloom]) => ({
    THREE: three,
    RoundedBoxGeometry: roundedBox.RoundedBoxGeometry,
    OrbitControls: orbit.OrbitControls,
    EffectComposer: composer.EffectComposer,
    RenderPass: renderPass.RenderPass,
    UnrealBloomPass: bloom.UnrealBloomPass,
  }));
}

function createWebGLRenderer(THREE, targetCanvas) {
  const attempts = [
    { antialias: true, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
  ];
  let lastErr;
  for (const opts of attempts) {
    try {
      return new THREE.WebGLRenderer({ canvas: targetCanvas, ...opts });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Error creating WebGL context.');
}

/**
 * @param {HTMLElement} host
 * @returns {() => void}
 */
export function initBrandLogo3D(host) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let destroyed = false;
  const cleanups = [];

  const state = {
    theme: getTheme(),
    motion: !reducedMotion,
    mode: 'fallback',
    drag: { active: false, x: 0, y: 0, rotX: 11, rotY: -16 },
  };

  host.className = 'brand-logo-3d fallback-mode';
  host.innerHTML = `
    <div class="brand-logo-3d__halo" aria-hidden="true"></div>
    <div class="brand-logo-3d__ring" aria-hidden="true"></div>
    <div class="brand-logo-3d__ring brand-logo-3d__ring--outer" aria-hidden="true"></div>
    <div class="brand-logo-3d__fallback" aria-hidden="true">
      <div class="brand-logo-3d__fallback-scene"></div>
    </div>
    <canvas class="brand-logo-3d__canvas" aria-hidden="true"></canvas>
  `;

  const fallbackEl = host.querySelector('.brand-logo-3d__fallback');
  const sceneEl = host.querySelector('.brand-logo-3d__fallback-scene');
  const canvas = host.querySelector('.brand-logo-3d__canvas');

  function activateFallbackMode() {
    state.mode = 'fallback';
    host.classList.add('fallback-mode');
    host.classList.remove('webgl-mode');
    fallbackEl.classList.remove('hidden');
    buildLayeredFallback();
  }

  function activateWebGLMode() {
    state.mode = 'webgl';
    host.classList.remove('fallback-mode');
    host.classList.add('webgl-mode');
    fallbackEl.classList.add('hidden');
  }

  function applySceneTransform() {
    if (state.motion && state.mode === 'fallback') {
      sceneEl.style.transform = '';
      return;
    }
    sceneEl.style.transform = `rotateX(${state.drag.rotX}deg) rotateY(${state.drag.rotY}deg)`;
  }

  function buildLayeredFallback() {
    const layers = LAYER_SVGS[state.theme];
    sceneEl.innerHTML = '';
    sceneEl.classList.toggle('motion-on', state.motion && state.mode === 'fallback');
    [
      ['plate', 'brand-logo-3d__layer--plate'],
      ['brackets', 'brand-logo-3d__layer--brackets'],
      ['grid', 'brand-logo-3d__layer--grid'],
    ].forEach(([key, cls]) => {
      const layer = document.createElement('div');
      layer.className = `brand-logo-3d__layer ${cls}`;
      layer.innerHTML = layers[key];
      sceneEl.appendChild(layer);
    });
    const shadow = document.createElement('div');
    shadow.className = 'brand-logo-3d__shadow';
    shadow.setAttribute('aria-hidden', 'true');
    sceneEl.appendChild(shadow);
    applySceneTransform();
  }

  function onThemeChange(next) {
    state.theme = next;
    buildLayeredFallback();
    webglRef?.rebuildLogo?.();
  }

  const themeObserver = new MutationObserver(() => {
    const next = getTheme();
    if (next !== state.theme) onThemeChange(next);
  });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  cleanups.push(() => themeObserver.disconnect());

  function onPointerDown(e) {
    if (state.mode !== 'fallback') return;
    state.drag.active = true;
    state.drag.x = e.clientX;
    state.drag.y = e.clientY;
    fallbackEl.classList.add('is-dragging');
    sceneEl.classList.remove('motion-on');
    fallbackEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!state.drag.active) return;
    const dx = e.clientX - state.drag.x;
    const dy = e.clientY - state.drag.y;
    state.drag.x = e.clientX;
    state.drag.y = e.clientY;
    state.drag.rotY += dx * 0.35;
    state.drag.rotX -= dy * 0.35;
    state.drag.rotX = Math.max(-28, Math.min(28, state.drag.rotX));
    applySceneTransform();
  }

  function endDrag() {
    if (!state.drag.active) return;
    state.drag.active = false;
    fallbackEl.classList.remove('is-dragging');
    if (state.motion) sceneEl.classList.add('motion-on');
  }

  fallbackEl.addEventListener('pointerdown', onPointerDown);
  fallbackEl.addEventListener('pointermove', onPointerMove);
  fallbackEl.addEventListener('pointerup', endDrag);
  fallbackEl.addEventListener('pointercancel', endDrag);
  cleanups.push(() => {
    fallbackEl.removeEventListener('pointerdown', onPointerDown);
    fallbackEl.removeEventListener('pointermove', onPointerMove);
    fallbackEl.removeEventListener('pointerup', endDrag);
    fallbackEl.removeEventListener('pointercancel', endDrag);
  });

  buildLayeredFallback();

  /** @type {{ dispose?: () => void, rebuildLogo?: () => void } | null} */
  let webglRef = null;

  async function bootWebGL() {
    if (destroyed || !probeWebGL()) {
      activateFallbackMode();
      return;
    }

    try {
      const mods = await loadThreeModules();
      if (destroyed) return;

      const { THREE, RoundedBoxGeometry, OrbitControls, EffectComposer, RenderPass, UnrealBloomPass } = mods;

      let theme = state.theme;
      let motionEnabled = state.motion;
      let animRaf = 0;

      function sx(v) { return (v - ICON_UNITS / 2) * S; }
      function sy(v) { return -(v - ICON_UNITS / 2) * S; }
      function v3(x, y, z = 0) { return new THREE.Vector3(sx(x), sy(y), z); }

      const renderer = createWebGLRenderer(THREE, canvas);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0, 3.55);

      const controls = new OrbitControls(camera, canvas);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 2.8;
      controls.maxDistance = 5.5;
      controls.autoRotate = motionEnabled;
      controls.autoRotateSpeed = 0.45;

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.45, 0.4, 0.35);
      composer.addPass(bloom);

      const logoGroup = new THREE.Group();
      scene.add(logoGroup);
      const animCells = [];

      function sampleQuadratic(p0, p1, p2, segments, z) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const u = 1 - t;
          const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
          const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
          pts.push(v3(x, y, z));
        }
        return pts;
      }

      function sampleLine(p0, p1, segments, z) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          pts.push(v3(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, z));
        }
        return pts;
      }

      function buildBracketCurve(side, z) {
        const segs = BRACKET_PATHS[side];
        const points = [];
        segs.forEach((seg, idx) => {
          let part;
          if (seg.type === 'q') part = sampleQuadratic(seg.p0, seg.p1, seg.p2, 28, z);
          else part = sampleLine(seg.p0, seg.p1, 32, z);
          if (idx > 0) part.shift();
          points.push(...part);
        });
        return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.35);
      }

      function makeCheckShape() {
        const shape = new THREE.Shape();
        const cx = TILE / 2;
        const cy = TILE / 2;
        CHECK_LOCAL.forEach(([x, y], i) => {
          const px = (x - cx) * S;
          const py = -(y - cy) * S;
          if (i === 0) shape.moveTo(px, py);
          else shape.lineTo(px, py);
        });
        return shape;
      }

      function rectCenter(x, y) {
        return [x + TILE / 2, y + TILE / 2];
      }

      function clearLights() {
        scene.children.filter((c) => c.isLight).forEach((l) => scene.remove(l));
      }

      function disposeGroupChildren() {
        while (logoGroup.children.length) {
          const c = logoGroup.children[0];
          logoGroup.remove(c);
          c.traverse?.((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
              else o.material.dispose();
            }
          });
        }
        animCells.length = 0;
      }

      function rebuildLogo() {
        theme = state.theme;
        clearLights();
        disposeGroupChildren();

        const p = PALETTE[theme];
        const zBracket = PLATE_DEPTH / 2 + BRACKET_TUBE * 0.6;
        const zTileBase = PLATE_DEPTH / 2 + TILE_DEPTH / 2;

        const plateMesh = new THREE.Mesh(
          new THREE.BoxGeometry(ICON_SIZE, ICON_SIZE, PLATE_DEPTH),
          new THREE.MeshPhysicalMaterial({
            color: p.plate,
            metalness: 0.2,
            roughness: 0.45,
            clearcoat: 0.4,
            clearcoatRoughness: 0.3,
          }),
        );
        logoGroup.add(plateMesh);

        const bracketMat = new THREE.MeshPhysicalMaterial({
          color: p.bracket,
          metalness: 0.75,
          roughness: 0.22,
          emissive: p.bracket,
          emissiveIntensity: 0.12,
        });
        ['left', 'right'].forEach((side) => {
          const curve = buildBracketCurve(side, zBracket);
          const tubeGeo = new THREE.TubeGeometry(curve, 120, BRACKET_TUBE, 14, false);
          logoGroup.add(new THREE.Mesh(tubeGeo, bracketMat));
        });

        const tileW = TILE * S;
        const tileR = TILE_RX * S;

        ICON_CELLS.forEach((cell) => {
          const g = new THREE.Group();
          g.userData = { phase: cell.phase, kind: cell.kind, baseZ: zTileBase };

          if (cell.kind === 'planned') {
            const [cx, cy] = cell.ring;
            g.position.set(sx(cx), sy(cy), zTileBase);
            const torus = new THREE.Mesh(
              new THREE.TorusGeometry(RING_R * S, RING_TUBE, 20, 64),
              new THREE.MeshPhysicalMaterial({
                color: p.accent,
                metalness: 0.65,
                roughness: 0.28,
                emissive: p.emissive,
                emissiveIntensity: 0.22,
              }),
            );
            g.add(torus);
            g.userData.mesh = torus;
          } else {
            const [rx, ry] = cell.rect;
            const [cx, cy] = rectCenter(rx, ry);
            g.position.set(sx(cx), sy(cy), zTileBase);
            const tile = new THREE.Mesh(
              new RoundedBoxGeometry(tileW, tileW, TILE_DEPTH, 5, tileR),
              new THREE.MeshPhysicalMaterial({
                color: p.accent,
                metalness: 0.22,
                roughness: 0.34,
                emissive: p.emissive,
                emissiveIntensity: cell.kind === 'mastered' ? 0.28 : 0.38,
              }),
            );
            g.add(tile);
            g.userData.mesh = tile;

            if (cell.kind === 'mastered') {
              const checkGeo = new THREE.ExtrudeGeometry(makeCheckShape(), {
                depth: TILE_DEPTH * 0.45,
                bevelEnabled: false,
              });
              checkGeo.center();
              const check = new THREE.Mesh(
                checkGeo,
                new THREE.MeshStandardMaterial({ color: p.check, roughness: 0.45 }),
              );
              check.position.z = TILE_DEPTH / 2 + TILE_DEPTH * 0.12;
              g.add(check);
              g.userData.check = check;
            }
          }

          logoGroup.add(g);
          animCells.push(g);
        });

        const amb = new THREE.AmbientLight(0xffffff, theme === 'dark' ? 0.55 : 0.65);
        const key = new THREE.DirectionalLight(0xffffff, theme === 'dark' ? 1.35 : 1.0);
        key.position.set(2, 3, 4);
        const rim = new THREE.PointLight(p.accent, theme === 'dark' ? 2.0 : 1.2, 14);
        rim.position.set(-2.5, -1, 3);
        const fill = new THREE.PointLight(0x818cf8, 0.45, 10);
        fill.position.set(2, -2, 2);
        [amb, key, rim, fill].forEach((l) => scene.add(l));
      }

      function resize() {
        const rect = host.getBoundingClientRect();
        const w = Math.max(280, Math.floor(rect.width));
        const h = Math.max(280, Math.floor(rect.height || rect.width));
        renderer.setSize(w, h, false);
        composer.setSize(w, h);
        bloom.resolution.set(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      const clock = new THREE.Clock();

      function animate() {
        animRaf = requestAnimationFrame(animate);
        if (destroyed || document.hidden) return;

        const t = clock.getElapsedTime();

        if (motionEnabled) {
          logoGroup.rotation.x = Math.sin(t * 0.35) * 0.06 + 0.04;
          logoGroup.rotation.y = Math.sin(t * 0.22) * 0.08;
          logoGroup.position.y = Math.sin(t * 0.5) * 0.04;

          animCells.forEach((g) => {
            const phase = g.userData.phase;
            const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
            if (g.userData.kind === 'developing') {
              g.position.z = g.userData.baseZ + pulse * 0.025;
              g.userData.mesh.material.emissiveIntensity = 0.28 + pulse * 0.22;
            } else if (g.userData.kind === 'planned') {
              g.userData.mesh.material.emissiveIntensity = 0.15 + pulse * 0.2;
              g.scale.setScalar(0.98 + pulse * 0.04);
            } else {
              g.position.z = g.userData.baseZ + pulse * 0.02;
              if (g.userData.check) {
                g.userData.check.rotation.z = Math.sin(t * 2 + phase) * 0.04;
              }
            }
          });

          const rim = scene.children.find((c) => c.isPointLight && c.color.getHex() === PALETTE[theme].accent);
          if (rim) {
            rim.position.x = Math.cos(t * 0.4) * 2.8;
            rim.position.y = Math.sin(t * 0.55) * 1.8;
          }
        }

        controls.update();
        composer.render();
      }

      webglRef = {
        rebuildLogo,
        setMotion(on) {
          motionEnabled = on;
          controls.autoRotate = on;
        },
        dispose() {
          cancelAnimationFrame(animRaf);
          controls.dispose();
          disposeGroupChildren();
          clearLights();
          composer.dispose();
          renderer.dispose();
        },
      };

      rebuildLogo();
      requestAnimationFrame(() => {
        if (destroyed) return;
        resize();
        activateWebGLMode();
        canvas.classList.add('is-ready');
      });

      const resizeObs = new ResizeObserver(resize);
      resizeObs.observe(host);
      window.addEventListener('resize', resize);
      cleanups.push(() => {
        resizeObs.disconnect();
        window.removeEventListener('resize', resize);
      });

      animate();
    } catch (err) {
      console.warn('Brand logo WebGL unavailable:', err);
      if (!destroyed) activateFallbackMode();
    }
  }

  bootWebGL();

  return () => {
    destroyed = true;
    webglRef?.dispose?.();
    webglRef = null;
    cleanups.forEach((fn) => fn());
    host.innerHTML = '';
    host.className = '';
  };
}
