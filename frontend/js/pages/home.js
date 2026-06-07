import { Store } from '../state.js';
import { api } from '../api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

const BRAND_TILE_HTML = '<svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--dark"><use href="#mp-icon-dark"/></svg><svg viewBox="0 0 256 256" class="brand-tile__art brand-tile__art--light"><use href="#mp-icon-light"/></svg>';

const ICONS = {
  eyebrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
  stalled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  updated: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  matrix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
};

const THREE_E_STEPS = [
  {
    title: 'Education',
    desc: 'Structured learning — courses, reading, and certifications that build your foundation.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  },
  {
    title: 'Exposure',
    desc: 'Hands-on practice through labs, shadowing, and guided real-world tasks.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  },
  {
    title: 'Experience',
    desc: 'Mastery through complex scenarios, mentoring others, and driving outcomes.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  },
];

// ─── News feed ────────────────────────────────────────────────────────────────

function activitySuffix(ev) {
  const type = ev.activity_type;
  if (type === 'action_added' || type === 'action_completed') return 'training log entry added';
  if (type === 'content_created' || type === 'content_updated') return 'personal learning item updated';
  if (type === 'resync') return 'catalog content refreshed';
  if (type === 'skill_added') return 'added to your plan';
  if (type === 'status_changed') return `status changed to ${ev.new || 'updated'}`;
  return (ev.activity_label || 'plan activity').toLowerCase();
}

function teamActivityText(item) {
  const actor = item.actor_name || 'Teammate';
  const skill = item.skill_name;
  if (item.type === 'training_log' && skill) {
    return `<strong>${escHtml(actor)}</strong> logged activity on <strong>${escHtml(skill)}</strong>`;
  }
  if (item.type === 'audit' && item.title?.startsWith('status:')) {
    const status = item.title.split(':')[1]?.trim() || 'updated';
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    if (skill) {
      return `<strong>${escHtml(actor)}</strong> moved to <strong>${escHtml(label)}</strong> on ${escHtml(skill)} in team matrix`;
    }
    return `<strong>${escHtml(actor)}</strong> updated matrix status to <strong>${escHtml(label)}</strong>`;
  }
  if (item.type === 'audit' && skill) {
    return `<strong>${escHtml(actor)}</strong> updated <strong>${escHtml(skill)}</strong> in team matrix`;
  }
  return `<strong>${escHtml(actor)}</strong> — ${escHtml(item.title || 'team activity')}`;
}

async function buildNewsFeed(user) {
  const items = [];
  const weekAgo = Date.now() - 7 * 86400000;
  const isManager = user.role === 'manager';

  const lastLoginIso = localStorage.getItem('matrixpro_last_login');
  const loginTs = lastLoginIso ? Date.parse(lastLoginIso) : Date.now();
  items.push({
    type: 'login',
    meta: 'Last login',
    html: `You signed in as <strong>${escHtml(user.email)}</strong>`,
    time: formatDateTime(lastLoginIso || new Date().toISOString()),
    sortKey: loginTs,
    isLogin: true,
  });

  const fetches = [];

  if (!isManager) {
    fetches.push(
      api.get(`/api/reports/plans/${user.id}/stagnation?days=60`).then((stagnation) => {
        if (!stagnation?.skills?.length) return;
        for (const skill of stagnation.skills.slice(0, 2)) {
          const days = skill.days_since_last_activity ?? 60;
          items.push({
            type: 'stalled',
            meta: 'Stalled skill',
            html: `<strong>${escHtml(skill.skill_name)}</strong> — no plan activity in ${days} days`,
            time: 'Needs attention',
            sortKey: Date.now() - days * 86400000,
          });
        }
      }).catch(() => {}),
      api.get(`/api/reports/plans/${user.id}/activity?sort=desc`).then((activity) => {
        if (!activity?.skills) return;
        const flat = [];
        for (const sk of activity.skills) {
          for (const ev of sk.events || []) flat.push({ ...ev, skill_name: sk.skill_name });
        }
        flat.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        for (const ev of flat.slice(0, 4)) {
          if (ev.activity_type === 'status_changed') continue;
          items.push({
            type: 'updated',
            meta: 'Recently updated',
            html: `<strong>${escHtml(ev.skill_name)}</strong> — ${escHtml(activitySuffix(ev))}`,
            time: formatDateTime(ev.timestamp),
            sortKey: Date.parse(ev.timestamp) || 0,
          });
        }
      }).catch(() => {}),
    );
  }

  if (user.team_id || isManager) {
    const teamQuery = isManager ? '/api/teams/activity?limit=12' : `/api/teams/activity?team_id=${user.team_id}&limit=12`;
    fetches.push(
      api.get(teamQuery).then((teamActivity) => {
        if (!teamActivity?.items?.length) return;
        for (const item of teamActivity.items) {
          if (!isManager && item.actor_name === user.name && item.type !== 'audit') continue;
          items.push({
            type: 'matrix',
            meta: item.type === 'audit' && item.title?.startsWith('status:') ? 'Matrix change' : 'Team matrix',
            html: teamActivityText(item),
            time: formatDateTime(item.occurred_at),
            sortKey: new Date(item.occurred_at).getTime() || 0,
          });
        }
      }).catch(() => {}),
    );

    if (isManager) {
      fetches.push(
        api.get('/api/teams/change-logs').then((logs) => {
          for (const entry of (logs?.entries || []).slice(0, 4)) {
            const eng = entry.engineer_name || 'Engineer';
            const skill = entry.skill_name || 'skill';
            let html;
            if (entry.type === 'training') {
              html = `<strong>${escHtml(eng)}</strong> — training log on <strong>${escHtml(skill)}</strong>`;
            } else if (entry.field === 'status') {
              html = `<strong>${escHtml(eng)}</strong> moved to <strong>${escHtml(entry.new_value || 'updated')}</strong> on ${escHtml(skill)}`;
            } else {
              html = `<strong>${escHtml(eng)}</strong> updated <strong>${escHtml(skill)}</strong>`;
            }
            items.push({
              type: 'updated',
              meta: 'Team activity',
              html,
              time: formatDateTime(entry.date),
              sortKey: Date.parse(entry.date) || 0,
            });
          }
        }).catch(() => {}),
      );
    }
  }

  await Promise.all(fetches);

  items.sort((a, b) => b.sortKey - a.sortKey);

  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = `${item.type}:${item.html}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 8) break;
  }

  const newCount = deduped.filter((i) => !i.isLogin && i.sortKey >= weekAgo).length;
  return { items: deduped, newCount };
}

function renderNewsItem(item) {
  const article = h('article', { className: 'hm-a__news-item' });
  const icon = h('span', { className: `hm-a__news-icon hm-a__news-icon--${item.type}` });
  icon.innerHTML = ICONS[item.type] || ICONS.updated;
  article.appendChild(icon);
  const body = h('div', { className: 'hm-a__news-body' });
  body.appendChild(h('div', { className: 'hm-a__news-meta', textContent: item.meta }));
  const text = h('p', { className: 'hm-a__news-text' });
  text.innerHTML = item.html;
  body.appendChild(text);
  body.appendChild(h('div', { className: 'hm-a__news-time', textContent: item.time }));
  article.appendChild(body);
  return article;
}

function renderNewsSkeleton(feedEl) {
  feedEl.innerHTML = '';
  for (let i = 0; i < 4; i += 1) {
    feedEl.appendChild(h('div', { className: 'hm-a__news-skeleton' }));
  }
}

function buildNewsPanel(user) {
  const panel = h('div', { className: 'hm-a__news' });
  const bar = h('div', { className: 'hm-a__news-bar' });
  const barTitle = h('div', { className: 'hm-a__news-bar-title' });
  barTitle.innerHTML = ICONS.bell;
  barTitle.appendChild(document.createTextNode('Quick updates & news'));
  bar.appendChild(barTitle);
  const badge = h('span', { className: 'hm-a__news-badge', textContent: '…' });
  bar.appendChild(badge);
  panel.appendChild(bar);

  const feed = h('div', { className: 'hm-a__news-feed' });
  renderNewsSkeleton(feed);
  panel.appendChild(feed);

  buildNewsFeed(user).then(({ items, newCount }) => {
    feed.innerHTML = '';
    badge.textContent = newCount > 0 ? `${newCount} new` : 'Up to date';
    if (!items.length) {
      feed.appendChild(h('p', {
        className: 'hm-a__news-empty',
        textContent: 'No recent updates — check back after activity on your plan.',
      }));
      return;
    }
    items.forEach((item) => feed.appendChild(renderNewsItem(item)));
  }).catch(() => {
    feed.innerHTML = '';
    feed.appendChild(h('p', {
      className: 'hm-a__news-empty',
      textContent: 'Unable to load updates right now.',
    }));
    badge.textContent = '';
  });

  return panel;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function buildGuestHeroColumn() {
  const col = h('div', { className: 'hm-a__guest-copy' });

  const eyebrow = h('div', { className: 'hm-a__eyebrow' });
  eyebrow.innerHTML = ICONS.eyebrow;
  eyebrow.appendChild(document.createTextNode('TAC Skill Development Platform'));
  col.appendChild(eyebrow);

  const wordmark = h('h1', { className: 'hm-a__wordmark', 'aria-label': 'MatrixPro' });
  wordmark.appendChild(h('span', { className: 'hm-a__wordmark-matrix', textContent: 'Matrix' }));
  wordmark.appendChild(h('span', { className: 'hm-a__wordmark-pro', textContent: 'Pro' }));
  col.appendChild(wordmark);

  const tagline = h('p', { className: 'hm-a__guest-tagline' });
  tagline.innerHTML = '<span class="mp-title-gradient">Your skills. Your plan. Your growth.</span>';
  col.appendChild(tagline);

  col.appendChild(h('p', {
    className: 'hm-a__lead hm-a__lead--guest',
    textContent: 'MatrixPro gives TAC engineers a structured path from learning to mastery — track development plans, explore the skill catalog, and grow through the 3E model.',
  }));

  const cta = h('div', { className: 'hm-a__cta hm-a__cta--guest' });
  cta.appendChild(ctaButton('#/login', 'Sign In to Get Started', 'primary'));
  col.appendChild(cta);

  return col;
}

function buildBrandShowcase() {
  const aside = h('aside', { className: 'hm-a__brand-showcase', 'aria-label': 'MatrixPro logo' });

  const orbit = h('div', { className: 'hm-a__brand-orbit' });
  const stage = h('div', { className: 'hm-a__brand-stage' });
  stage.appendChild(h('div', { className: 'hm-a__brand-glow' }));
  stage.appendChild(h('div', { className: 'hm-a__brand-ring hm-a__brand-ring--1' }));
  stage.appendChild(h('div', { className: 'hm-a__brand-ring hm-a__brand-ring--2' }));
  stage.appendChild(h('div', { className: 'hm-a__brand-shimmer', 'aria-hidden': 'true' }));

  const logo3d = h('div', { className: 'hm-a__brand-logo-3d' });
  const logoWrap = h('span', { className: 'brand-tile hm-a__brand-logo', 'aria-hidden': 'true' });
  logoWrap.innerHTML = BRAND_TILE_HTML;
  logo3d.appendChild(logoWrap);
  logo3d.appendChild(h('span', { className: 'hm-a__brand-shadow', 'aria-hidden': 'true' }));
  stage.appendChild(logo3d);

  orbit.appendChild(stage);
  aside.appendChild(orbit);

  return aside;
}

function buildHeroColumn(user) {
  const col = h('div');
  const isManager = user?.role === 'manager';

  const eyebrow = h('div', { className: 'hm-a__eyebrow' });
  eyebrow.innerHTML = ICONS.eyebrow;
  eyebrow.appendChild(document.createTextNode(isManager ? 'TAC Team Leadership' : 'TAC Skill Development'));
  col.appendChild(eyebrow);

  const headline = h('div', { className: 'hm-a__headline' });
  const brandTile = h('span', { className: 'brand-tile hm-a__headline-icon', 'aria-hidden': 'true' });
  brandTile.innerHTML = BRAND_TILE_HTML;
  headline.appendChild(brandTile);
  const copy = h('div', { className: 'hm-a__headline-copy' });
  const title = h('h1', { className: 'hm-a__title' });
  if (isManager) {
    title.innerHTML = 'Know your team.<br><span class="mp-title-gradient">Grow their skills.<br>Shape the future.</span>';
  } else {
    title.innerHTML = 'Your skills.<br><span class="mp-title-gradient">Your plan.<br>Your growth.</span>';
  }
  copy.appendChild(title);
  headline.appendChild(copy);
  col.appendChild(headline);

  col.appendChild(h('p', {
    className: 'hm-a__lead',
    textContent: isManager
      ? 'MatrixPro helps you understand, develop, and grow your team with clarity. Build aligned development plans, visualize capability gaps, and guide continuous improvement across your organization.'
      : 'MatrixPro provides the structure to turn those efforts into progress—helping you set goals, develop new capabilities, and continuously grow throughout your career.',
  }));

  const cta = h('div', { className: 'hm-a__cta' });
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
    cta.appendChild(ctaButton(ctaHref, ctaLabel, 'primary'));
    cta.appendChild(ctaButton('#/catalog', 'Browse Catalog', 'secondary'));
  } else {
    cta.appendChild(ctaButton('#/login', 'Get Started', 'primary'));
  }
  col.appendChild(cta);

  return col;
}

function build3ETimeline({ compact = false } = {}) {
  const wrap = h('div', {
    id: 'home-3e',
    className: compact ? 'hm-a__3e hm-a__3e--compact' : 'hm-a__3e',
  });
  wrap.appendChild(h('div', {
    className: 'hm-a__section-label',
    textContent: 'The 3E development model',
  }));
  const timeline = h('div', { className: 'hm-a__timeline' });
  THREE_E_STEPS.forEach(({ title, desc, icon }) => {
    const step = h('div', { className: 'hm-a__step' });
    const iconWrap = h('div', { className: 'hm-a__step-icon' });
    iconWrap.innerHTML = icon;
    step.appendChild(iconWrap);
    step.appendChild(h('h3', { textContent: title }));
    step.appendChild(h('p', { textContent: desc }));
    timeline.appendChild(step);
  });
  wrap.appendChild(timeline);
  return wrap;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function mountHome(container) {
  container.innerHTML = '';

  const user = Store.get('user');
  const page = h('div', { className: user ? 'home-page hm-a' : 'home-page hm-a hm-a--guest' });
  page.appendChild(h('div', { className: 'hm-a__mesh' }));
  if (!user) page.appendChild(h('div', { className: 'hm-a__mesh hm-a__mesh--guest' }));

  const inner = h('div', { className: 'hm-a__inner' });
  const heroGrid = h('div', { className: 'hm-a__hero-grid' });

  if (user) {
    heroGrid.appendChild(buildHeroColumn(user));
    heroGrid.appendChild(buildNewsPanel(user));
  } else {
    heroGrid.classList.add('hm-a__hero-grid--guest');
    heroGrid.appendChild(buildGuestHeroColumn());
    heroGrid.appendChild(buildBrandShowcase());
  }

  inner.appendChild(heroGrid);
  inner.appendChild(build3ETimeline({ compact: !user }));
  page.appendChild(inner);

  if (!user) {
    const appVersion = Store.get('appVersion');
    if (appVersion) {
      page.appendChild(h('footer', {
        className: 'hm-a__version',
        textContent: `App Version ${appVersion}`,
      }));
    }
  }

  container.appendChild(page);
}
