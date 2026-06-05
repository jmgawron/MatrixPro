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

const ARROW_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

function ctaButton(href, label, variant = 'primary') {
  const btn = h('a', {
    className: variant === 'primary' ? 'btn btn-primary' : 'btn btn-secondary',
    href,
  });
  btn.appendChild(document.createTextNode(label));
  const arrow = h('span', { style: 'display:inline-flex;align-items:center;' });
  arrow.innerHTML = ARROW_SVG;
  btn.appendChild(arrow);
  return btn;
}

// ─── Stats state ──────────────────────────────────────────────────────────────

let _homeValueEls = {};

async function fetchStats() {
  try {
    const r = await fetch(`${API_BASE}/api/stats`);
    if (!r.ok) return;
    const data = await r.json();
    ['total_engineers', 'total_teams', 'total_skills'].forEach((key) => {
      const el = _homeValueEls[key];
      if (el) {
        animateCountUp(el, typeof data[key] === 'number' ? data[key] : 0);
      }
    });
  } catch { /* non-critical */ }
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function buildStatsRow() {
  const wrapper = h('div', { className: 'stats-row' });

  const statDefs = [
    { key: 'total_engineers', label: 'Engineers' },
    { key: 'total_teams', label: 'Teams' },
    { key: 'total_skills', label: 'Skills' },
  ];

  _homeValueEls = {};

  statDefs.forEach(({ key, label }) => {
    const numEl = h('div', { className: 'stat-block-value', textContent: '—' });
    _homeValueEls[key] = numEl;
    const labelEl = h('div', { className: 'stat-block-label', textContent: label });
    wrapper.appendChild(h('div', { className: 'stat-block' }, numEl, labelEl));
  });

  fetchStats();
  return wrapper;
}

// ─── 3E Philosophy Section ────────────────────────────────────────────────────

const EDUCATION_ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
const EXPOSURE_ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
const EXPERIENCE_ICON = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

const THREE_E_CARDS = [
  {
    title: 'Education',
    tagline: 'Build your foundation through structured learning.',
    desc: 'Focus on completing courses, training programs, and reading materials to understand core concepts. This stage is about absorbing knowledge, learning terminology, and developing a strong theoretical foundation.',
    icon: EDUCATION_ICON,
  },
  {
    title: 'Exposure',
    tagline: 'Turn knowledge into hands-on practice.',
    desc: 'Apply what you\'ve learned through labs, simulations, shadowing, or small real-world tasks. This stage helps you build confidence, experiment, and identify gaps in your understanding.',
    icon: EXPOSURE_ICON,
  },
  {
    title: 'Experience',
    tagline: 'Demonstrate mastery and create impact.',
    desc: 'At this stage, you have developed both theoretical and practical expertise. You apply skills across different scenarios, solve complex problems, and share knowledge with others. This is where you refine expertise, mentor others, and drive meaningful outcomes.',
    icon: EXPERIENCE_ICON,
  },
];

function build3ESection() {
  const section = h('div', { className: 'home-3e-section' });

  const sectionTitle = h('h2', { className: 'home-3e-heading' });
  sectionTitle.appendChild(document.createTextNode('The '));
  sectionTitle.appendChild(h('span', { className: 'home-3e-heading-accent', textContent: '3E' }));
  sectionTitle.appendChild(document.createTextNode(' Model'));

  const sectionSub = h('p', {
    className: 'home-3e-subheading',
    textContent: 'Education · Exposure · Experience — the philosophy behind every skill development plan.',
  });

  section.appendChild(sectionTitle);
  section.appendChild(sectionSub);

  const grid = h('div', { className: 'home-3e-grid' });

  THREE_E_CARDS.forEach(({ title, tagline, desc, icon }) => {
    const card = h('div', { className: 'home-3e-card' });
    const cardHeader = h('div', { className: 'home-3e-card-header' });
    const iconWrap = h('div', { className: 'home-3e-icon' });
    iconWrap.innerHTML = icon;
    cardHeader.appendChild(iconWrap);
    cardHeader.appendChild(h('h3', { className: 'home-3e-card-title', textContent: title }));
    card.appendChild(cardHeader);
    card.appendChild(h('p', { className: 'home-3e-card-tagline', textContent: tagline }));
    card.appendChild(h('p', { className: 'home-3e-card-desc', textContent: desc }));
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function mountHome(container) {
  container.innerHTML = '';

  const user = Store.get('user');
  const page = h('div', { className: 'home-page' });
  page.appendChild(h('div', { className: 'home-page__glow' }));

  const content = h('div', { className: 'home-page__content' });
  const hero = h('div', { className: 'home-hero' });

  const title = h('h1', { className: 'home-hero__title' });
  title.appendChild(document.createTextNode('Skill Development Platform'));
  title.appendChild(h('br'));
  title.appendChild(h('span', { className: 'mp-title-gradient', textContent: 'for TAC Engineers' }));
  hero.appendChild(title);

  hero.appendChild(h('p', {
    className: 'home-hero__subtitle',
    textContent: 'Build, track, and manage individual skill development plans with kanban workflows, team matrices, and cross-team analytics.',
  }));

  const stats = buildStatsRow();
  stats.className = 'stats-row home-hero__stats';
  hero.appendChild(stats);

  const ctaRow = h('div', { className: 'home-hero__cta' });
  if (user) {
    let ctaHref = '#/my-plan';
    let ctaLabel = 'Go to My Plan';
    if (user.role === 'admin') {
      ctaHref = '#/admin';
      ctaLabel = 'Go to Admin Panel';
    } else if (user.role === 'manager') {
      ctaHref = '#/my-team';
      ctaLabel = 'Go to My Team';
    }
    ctaRow.appendChild(ctaButton(ctaHref, ctaLabel, 'primary'));
    ctaRow.appendChild(ctaButton('#/catalog', 'Browse Catalog', 'secondary'));
  } else {
    ctaRow.appendChild(ctaButton('#/login', 'Get Started', 'primary'));
  }
  hero.appendChild(ctaRow);

  content.appendChild(hero);
  content.appendChild(build3ESection());
  page.appendChild(content);
  container.appendChild(page);
}
