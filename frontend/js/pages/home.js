import { Store } from '../state.js';
import { API_BASE } from '../api.js';

// ─── Count-up animation ───────────────────────────────────────────────────────

function animateCountUp(el, target) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || target === 0) {
    el.textContent = String(target);
    return;
  }

  const duration = 800;
  const start = performance.now();

  function tick(now) {
    const elapsed = Math.min(now - start, duration);
    const progress = 1 - Math.pow(1 - elapsed / duration, 3);
    const current = Math.round(target * progress);
    el.textContent = String(current);
    if (elapsed < duration) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = String(target);
    }
  }

  requestAnimationFrame(tick);
}

// ─── createElement helper ─────────────────────────────────────────────────────

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') el.className = v;
      else if (k === 'textContent') el.textContent = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  }
  return el;
}

// ─── Stats row (ide.cisco.com style — inline in hero) ─────────────────────────

function buildStatsRow() {
  const wrapper = h('div', {
    style: [
      'display:flex;align-items:center;justify-content:center;',
      'gap:48px;flex-wrap:wrap;',
    ].join(''),
  });

  const statDefs = [
    { key: 'total_engineers', label: 'Engineers' },
    { key: 'total_teams', label: 'Teams' },
    { key: 'total_skills', label: 'Skills' },
  ];

  const valueEls = {};

  statDefs.forEach(({ key, label }) => {
    const numEl = h('div', {
      style: 'font-size:36px;font-weight:700;color:var(--text-primary);line-height:1;',
      textContent: '—',
    });
    valueEls[key] = numEl;

    const labelEl = h('div', {
      style: 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-top:6px;',
      textContent: label,
    });

    const statBlock = h('div', { style: 'text-align:center;' }, numEl, labelEl);
    wrapper.appendChild(statBlock);
  });

  fetch(`${API_BASE}/api/stats`)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      statDefs.forEach(({ key }) => {
        const val = typeof data[key] === 'number' ? data[key] : 0;
        animateCountUp(valueEls[key], val);
      });
    })
    .catch(() => {});

  return wrapper;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function mountHome(container) {
  container.innerHTML = '';

  const user = Store.get('user');

  // Full-page wrapper with radial glow background
  const page = h('div', {
    style: [
      'background:var(--home-bg);',
      'min-height:calc(100vh - 60px);',
      'display:flex;flex-direction:column;align-items:center;',
      'position:relative;overflow:hidden;',
    ].join(''),
  });

  // Radial glow behind hero (subtle blue orb)
  const glow = h('div', {
    style: [
      'position:absolute;top:-200px;left:50%;transform:translateX(-50%);',
      'width:900px;height:600px;',
      'background:radial-gradient(ellipse at center, var(--home-glow) 0%, transparent 70%);',
      'pointer-events:none;z-index:0;',
    ].join(''),
  });
  page.appendChild(glow);

  // Content layer
  const content = h('div', {
    style: 'position:relative;z-index:1;width:100%;display:flex;flex-direction:column;align-items:center;padding:0 24px;',
  });

  // ── Announcement pill ──
  const pill = h('div', {
    style: [
      'display:inline-flex;align-items:center;gap:8px;',
      'margin-top:72px;margin-bottom:28px;',
      'padding:6px 18px;',
      'border-radius:9999px;',
      'background:var(--home-pill-bg);',
      'border:1px solid var(--home-pill-border);',
      'font-size:13px;font-weight:500;color:var(--text-secondary);',
    ].join(''),
  });
  const pillDot = h('span', {
    style: 'width:6px;height:6px;border-radius:50%;background:#00AEEF;flex-shrink:0;',
  });
  pill.appendChild(pillDot);
  pill.appendChild(document.createTextNode('Skill Development Platform'));
  content.appendChild(pill);

  // ── Title with gradient ──
  const title = h('h1', {
    style: [
      'font-size:clamp(36px, 5vw, 56px);font-weight:800;',
      'line-height:1.1;letter-spacing:-0.02em;',
      'text-align:center;margin-bottom:16px;',
      'color:var(--text-primary);',
    ].join(''),
  });
  // First line normal, second line gradient
  title.appendChild(document.createTextNode('Skill Development'));
  title.appendChild(h('br'));
  const gradientSpan = h('span', {
    style: [
      'background:linear-gradient(90deg, #00C6FF 0%, #0072FF 100%);',
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;',
      'background-clip:text;',
    ].join(''),
    textContent: 'for TAC Engineers',
  });
  title.appendChild(gradientSpan);
  content.appendChild(title);

  // ── Subtitle ──
  const subtitle = h('p', {
    style: [
      'font-size:18px;color:var(--text-muted);',
      'text-align:center;max-width:600px;line-height:1.6;',
      'margin-bottom:40px;',
    ].join(''),
    textContent: 'Build, track, and manage individual skill development plans with kanban workflows, team matrices, and cross-team analytics.',
  });
  content.appendChild(subtitle);

  // ── Stats row ──
  const stats = buildStatsRow();
  stats.style.marginBottom = '40px';
  content.appendChild(stats);

  // ── CTA buttons ──
  const ctaRow = h('div', {
    style: 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:80px;',
  });

  if (user) {
    // Primary CTA
    const primaryBtn = h('a', {
      style: [
        'display:inline-flex;align-items:center;gap:8px;',
        'background:#00AEEF;color:#fff;',
        'padding:12px 28px;border-radius:8px;',
        'font-size:15px;font-weight:600;',
        'text-decoration:none;cursor:pointer;',
        'transition:transform 0.15s, box-shadow 0.15s;',
        'border:none;',
      ].join(''),
      href: '#/my-plan',
      textContent: 'Go to My Plan',
    });
    const arrow = h('span', { style: 'display:inline-flex;align-items:center;' });
    arrow.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    primaryBtn.appendChild(arrow);
    primaryBtn.addEventListener('mouseenter', () => {
      primaryBtn.style.transform = 'translateY(-1px)';
      primaryBtn.style.boxShadow = '0 6px 20px rgba(0,174,239,0.35)';
    });
    primaryBtn.addEventListener('mouseleave', () => {
      primaryBtn.style.transform = '';
      primaryBtn.style.boxShadow = '';
    });
    ctaRow.appendChild(primaryBtn);

    // Secondary CTA
    const secBtn = h('a', {
      style: [
        'display:inline-flex;align-items:center;gap:8px;',
        'background:var(--home-card-bg);',
        'border:1px solid var(--home-card-border);',
        'color:var(--text-secondary);',
        'padding:12px 28px;border-radius:8px;',
        'font-size:15px;font-weight:600;',
        'text-decoration:none;cursor:pointer;',
        'transition:transform 0.15s, border-color 0.15s, color 0.15s;',
      ].join(''),
      href: '#/catalog',
      textContent: 'Browse Catalog',
    });
    secBtn.addEventListener('mouseenter', () => {
      secBtn.style.borderColor = 'var(--text-muted)';
      secBtn.style.color = 'var(--text-primary)';
    });
    secBtn.addEventListener('mouseleave', () => {
      secBtn.style.borderColor = 'var(--home-card-border)';
      secBtn.style.color = 'var(--text-secondary)';
    });
    ctaRow.appendChild(secBtn);
  } else {
    const signInBtn = h('a', {
      style: [
        'display:inline-flex;align-items:center;gap:8px;',
        'background:#00AEEF;color:#fff;',
        'padding:12px 28px;border-radius:8px;',
        'font-size:15px;font-weight:600;',
        'text-decoration:none;cursor:pointer;',
        'transition:transform 0.15s, box-shadow 0.15s;',
        'border:none;',
      ].join(''),
      href: '#/login',
    });
    signInBtn.textContent = 'Get Started';
    const arrow2 = h('span', { style: 'display:inline-flex;align-items:center;' });
    arrow2.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    signInBtn.appendChild(arrow2);
    signInBtn.addEventListener('mouseenter', () => {
      signInBtn.style.transform = 'translateY(-1px)';
      signInBtn.style.boxShadow = '0 6px 20px rgba(0,174,239,0.35)';
    });
    signInBtn.addEventListener('mouseleave', () => {
      signInBtn.style.transform = '';
      signInBtn.style.boxShadow = '';
    });
    ctaRow.appendChild(signInBtn);
  }
  content.appendChild(ctaRow);

  page.appendChild(content);
  container.appendChild(page);
}
