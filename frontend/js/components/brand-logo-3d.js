/**
 * Guest hero brand visual — holographic matrix stage.
 * Uses canonical #mp-icon-dark / #mp-icon-light symbols from index.html.
 */

const ICON_SVG = `
  <svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--dark" aria-hidden="true">
    <use href="#mp-icon-dark"/>
  </svg>
  <svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--light" aria-hidden="true">
    <use href="#mp-icon-light"/>
  </svg>`;

/** Grid cell centers (% of 256 viewBox) — matches mp-icon symbol layout */
const GRID_CELLS = [
  { x: 32.03, y: 30.47, kind: 'developing', cx: 82, cy: 78, delay: 0 },
  { x: 50, y: 30.47, kind: 'planned', cx: 128, cy: 78, delay: 0.55 },
  { x: 67.97, y: 30.47, kind: 'mastered', cx: 174, cy: 78, delay: 1.1 },
  { x: 32.03, y: 50, kind: 'planned', cx: 82, cy: 128, delay: 1.65 },
  { x: 50, y: 50, kind: 'developing', cx: 128, cy: 128, delay: 2.2 },
  { x: 67.97, y: 50, kind: 'mastered', cx: 174, cy: 128, delay: 2.75 },
  { x: 32.03, y: 69.53, kind: 'developing', cx: 82, cy: 178, delay: 3.3 },
  { x: 50, y: 69.53, kind: 'mastered', cx: 128, cy: 178, delay: 3.85 },
  { x: 67.97, y: 69.53, kind: 'planned', cx: 174, cy: 178, delay: 4.4 },
];

function buildBeamsSvg() {
  const hub = { x: 128, y: 128 };
  const lines = GRID_CELLS.map((c, i) =>
    `<line class="brand-stage__beam" data-i="${i}" x1="${hub.x}" y1="${hub.y}" x2="${c.cx}" y2="${c.cy}"/>`
  ).join('');
  return `<svg viewBox="0 0 256 256" class="brand-stage__beams-svg" aria-hidden="true">${lines}</svg>`;
}

function initParticles(canvas, motion) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const particles = Array.from({ length: 52 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 1.8,
    vx: (Math.random() - 0.5) * 0.00035,
    vy: -0.0002 - Math.random() * 0.00045,
    a: 0.15 + Math.random() * 0.55,
    hue: Math.random() > 0.82 ? 'gold' : 'blue',
  }));

  let raf = 0;
  let running = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running || document.hidden) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const isLight = document.body.getAttribute('data-theme') === 'light';
    particles.forEach((p) => {
      if (motion) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        if (p.x < -0.05 || p.x > 1.05) p.vx *= -1;
      }
      const px = p.x * w;
      const py = p.y * h;
      const color = p.hue === 'gold'
        ? `rgba(229, 199, 107, ${p.a})`
        : (isLight ? `rgba(59, 130, 246, ${p.a})` : `rgba(92, 177, 255, ${p.a})`);
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }

  resize();
  frame();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

/**
 * @param {HTMLElement} host
 * @returns {() => void}
 */
export function initBrandLogo3D(host) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reducedMotion;

  host.className = 'brand-stage';
  host.innerHTML = `
    <canvas class="brand-stage__canvas" aria-hidden="true"></canvas>
    <div class="brand-stage__halo" aria-hidden="true"></div>
    <div class="brand-stage__ring brand-stage__ring--outer" aria-hidden="true"></div>
    <div class="brand-stage__ring brand-stage__ring--inner" aria-hidden="true"></div>
    <div class="brand-stage__beams" aria-hidden="true">${buildBeamsSvg()}</div>
    <div class="brand-stage__float">
      <div class="brand-stage__swing">
        <div class="brand-stage__tilt">
          <div class="brand-stage__prism">
            <div class="brand-stage__icon brand-tile">${ICON_SVG}</div>
            <div class="brand-stage__cells" aria-hidden="true"></div>
            <div class="brand-stage__sheen" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="brand-stage__pedestal" aria-hidden="true"></div>
  `;

  const canvas = host.querySelector('.brand-stage__canvas');
  const floatEl = host.querySelector('.brand-stage__tilt');
  const cellsWrap = host.querySelector('.brand-stage__cells');
  const beams = host.querySelectorAll('.brand-stage__beam');

  GRID_CELLS.forEach((cell) => {
    const el = document.createElement('span');
    el.className = `brand-stage__cell brand-stage__cell--${cell.kind}`;
    el.style.left = `${cell.x}%`;
    el.style.top = `${cell.y}%`;
    if (motion) el.style.animationDelay = `${cell.delay}s`;
    cellsWrap.appendChild(el);
  });

  beams.forEach((line, i) => {
    if (motion) line.style.animationDelay = `${GRID_CELLS[i].delay * 0.15}s`;
  });

  if (motion) host.classList.add('brand-stage--motion');

  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;
  let parallaxRaf = 0;

  function applyTilt() {
    if (motion) {
      tiltX += (targetX - tiltX) * 0.08;
      tiltY += (targetY - tiltY) * 0.08;
      floatEl.style.setProperty('--tilt-x', `${tiltY}deg`);
      floatEl.style.setProperty('--tilt-y', `${tiltX}deg`);
      parallaxRaf = requestAnimationFrame(applyTilt);
    }
  }

  function onPointerMove(e) {
    const rect = host.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    targetX = px * 14;
    targetY = -py * 10;
  }

  function onPointerLeave() {
    targetX = 0;
    targetY = 0;
  }

  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerleave', onPointerLeave);

  if (motion) {
    parallaxRaf = requestAnimationFrame(applyTilt);
  }

  const stopParticles = initParticles(canvas, motion);

  return () => {
    cancelAnimationFrame(parallaxRaf);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerleave', onPointerLeave);
    stopParticles();
    host.innerHTML = '';
    host.className = '';
  };
}
