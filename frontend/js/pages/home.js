import { Store } from '../state.js';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const ICONS = {
  myPlan: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
  myTeam: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  catalog: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  skillExplorer: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
};

// ─── Module definitions ───────────────────────────────────────────────────────

const MODULES = [
  {
    key: 'myPlan',
    label: 'My Plan',
    desc: 'View and manage your skill development plan',
    route: '#/my-plan',
    minRole: 'engineer',
    icon: ICONS.myPlan,
    color: '#3b82f6',
  },
  {
    key: 'myTeam',
    label: 'My Team',
    desc: 'Team skills matrix and progress overview',
    route: '#/my-team',
    minRole: 'manager',
    icon: ICONS.myTeam,
    color: '#22c55e',
  },
  {
    key: 'catalog',
    label: 'Catalog Explorer',
    desc: 'Browse and search the skill catalog',
    route: '#/catalog',
    minRole: 'engineer',
    icon: ICONS.catalog,
    color: '#f59e0b',
  },
  {
    key: 'skillExplorer',
    label: 'Skill Explorer',
    desc: 'Find engineers by skill, compare teams',
    route: '#/skill-explorer',
    minRole: 'engineer',
    icon: ICONS.skillExplorer,
    color: '#a855f7',
  },
];

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_ORDER = { engineer: 0, manager: 1, admin: 2 };

function roleAllows(userRole, minRole) {
  if (!minRole) return true;
  if (!userRole) return false;
  return (ROLE_ORDER[userRole] ?? -1) >= (ROLE_ORDER[minRole] ?? 0);
}

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
    const progress = 1 - Math.pow(1 - elapsed / duration, 3); // ease-out cubic
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

function createElement(tag, props) {
  const el = document.createElement(tag);
  if (!props) return el;
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'htmlFor') el.htmlFor = v;
    else el.setAttribute(k, v);
  });
  return el;
}

// ─── Stat cards ───────────────────────────────────────────────────────────────

function buildStatCard(label, valueEl) {
  const card = createElement('div', {
    style: [
      'background:rgba(22,29,41,0.7);',
      'backdrop-filter:blur(12px);',
      '-webkit-backdrop-filter:blur(12px);',
      'border:1px solid rgba(59,130,246,0.15);',
      'border-radius:16px;',
      'padding:24px 32px;',
      'text-align:center;',
      'min-width:180px;',
      'flex:1;',
    ].join(''),
  });

  card.appendChild(valueEl);

  const labelEl = createElement('div', {
    style: 'font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-top:8px;',
    textContent: label,
  });
  card.appendChild(labelEl);

  return card;
}

function buildStatSection() {
  const row = createElement('div', {
    style: 'display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin:32px 0;',
  });

  const statDefs = [
    { key: 'total_engineers', label: 'Engineers' },
    { key: 'total_teams',     label: 'Teams' },
    { key: 'total_skills',    label: 'Skills' },
  ];

  const valueEls = {};
  statDefs.forEach(({ key, label }) => {
    const valueEl = createElement('div', {
      style: 'font-size:36px;font-weight:800;color:var(--text-primary);',
      textContent: '—',
    });
    valueEls[key] = valueEl;
    row.appendChild(buildStatCard(label, valueEl));
  });

  // Fetch stats async (no auth required)
  fetch('/api/stats')
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(data => {
      statDefs.forEach(({ key }) => {
        const val = typeof data[key] === 'number' ? data[key] : 0;
        animateCountUp(valueEls[key], val);
      });
    })
    .catch(() => {
      // Silently degrade — leave "—" placeholders
    });

  return row;
}

// ─── Module nav cards ─────────────────────────────────────────────────────────

function buildModuleCard(mod) {
  const card = createElement('div', {
    style: [
      'background:var(--bg-card);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-lg);',
      'padding:24px;',
      'cursor:pointer;',
      'transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s;',
      'display:flex;flex-direction:column;gap:12px;',
    ].join(''),
  });

  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-2px)';
    card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    card.style.borderColor = `${mod.color}55`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '';
    card.style.borderColor = 'var(--border-soft)';
  });
  card.addEventListener('click', () => {
    window.location.hash = mod.route;
  });

  // Icon wrapper
  const iconWrap = createElement('div', {
    style: `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;background:${mod.color}22;color:${mod.color};`,
  });
  iconWrap.innerHTML = mod.icon;
  card.appendChild(iconWrap);

  const nameEl = createElement('h3', {
    style: 'font-size:16px;font-weight:700;color:var(--text-primary);margin:0;',
    textContent: mod.label,
  });
  card.appendChild(nameEl);

  const descEl = createElement('p', {
    style: 'font-size:13px;color:var(--text-secondary);margin:0;line-height:1.5;',
    textContent: mod.desc,
  });
  card.appendChild(descEl);

  return card;
}

function buildModuleGrid(userRole) {
  const visible = MODULES.filter(m => roleAllows(userRole, m.minRole));

  const grid = createElement('div', {
    style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:900px;margin:0 auto;',
  });

  visible.forEach(mod => {
    grid.appendChild(buildModuleCard(mod));
  });

  return grid;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function mountHome(container) {
  container.innerHTML = '';

  const user = Store.get('user');

  // Full-viewport gradient wrapper
  const page = createElement('div', {
    style: [
      'background:linear-gradient(135deg,#0d1117 0%,#111d3a 30%,#0f2847 60%,#0d1117 100%);',
      'min-height:calc(100vh - 60px);',
      'display:flex;flex-direction:column;align-items:center;',
      'padding:60px 24px 80px;',
    ].join(''),
  });

  // Hero section
  const hero = createElement('div', {
    style: 'text-align:center;max-width:640px;width:100%;',
  });

  // Logo mark + title
  const titleEl = createElement('h1', {
    style: 'font-size:42px;font-weight:800;color:var(--text-primary);letter-spacing:-1px;margin-bottom:12px;',
    textContent: 'MatrixPro',
  });
  hero.appendChild(titleEl);

  const taglineEl = createElement('p', {
    style: 'font-size:17px;color:var(--text-secondary);margin-bottom:8px;',
    textContent: 'Build, track, and manage skill development plans',
  });
  hero.appendChild(taglineEl);

  // User greeting or sign-in prompt
  if (user) {
    const greetingEl = createElement('p', {
      style: 'font-size:15px;color:var(--text-muted);margin-top:6px;',
      textContent: `Welcome back, ${user.name}`,
    });
    hero.appendChild(greetingEl);
  } else {
    const signInBtn = createElement('button', {
      style: [
        'margin-top:16px;',
        'background:var(--accent);',
        'color:#fff;',
        'border:none;',
        'border-radius:var(--radius-md);',
        'padding:10px 28px;',
        'font-size:15px;font-weight:600;',
        'cursor:pointer;',
        'transition:background 0.15s;',
      ].join(''),
      textContent: 'Sign In',
    });
    signInBtn.addEventListener('mouseenter', () => { signInBtn.style.background = 'var(--accent-strong)'; });
    signInBtn.addEventListener('mouseleave', () => { signInBtn.style.background = 'var(--accent)'; });
    signInBtn.addEventListener('click', () => { window.location.hash = '#/login'; });
    hero.appendChild(signInBtn);
  }

  page.appendChild(hero);

  // Stat cards
  page.appendChild(buildStatSection());

  // Section label
  const sectionLabel = createElement('div', {
    style: 'font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:20px;text-align:center;',
    textContent: 'Quick Access',
  });
  page.appendChild(sectionLabel);

  // Module navigation grid
  page.appendChild(buildModuleGrid(user?.role ?? null));

  container.appendChild(page);
}
