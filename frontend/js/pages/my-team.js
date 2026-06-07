import { api, API_BASE } from '../api.js';
import { ensureEcharts } from '../utils/cdn-loader.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { el } from '../utils/dom.js';
import { getSkillIconSVG } from '../components/icons.js';
import { AVATAR_CATALOG } from '../components/avatars.js';
import {
  getMatrixCellStyle,
  isStalled,
  MATRIX_LEGEND_ITEMS,
  getLegendIcon,
  STALLED_DAYS,
} from '../components/matrix-style.js?v=3';

// ─── Category chip icons (match My Plan filter style) ──────────────────────
const CATEGORY_CHIP_SVG = {
  seedling: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4 3-7 8-7-1 5-4 7-8 7z"/><path d="M12 14c0-3-2-5-6-5 1 4 3 5 6 5z"/></svg>',
  diamond: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M9 3 6 9l6 12"/><path d="m15 3 3 6-6 12"/></svg>',
  atom: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>',
  sparkles: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"/><path d="M19 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/><path d="M5 4l.7 1.5L7 6l-1.3.5L5 8l-.7-1.5L3 6l1.3-.5L5 4z"/></svg>',
  layers: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
};
const CATEGORY_CHIP_ICON_MAP = {
  foundational: 'seedling',
  core: 'diamond',
  advanced: 'atom',
  ai_future: 'sparkles',
  'ai-future': 'sparkles',
};
function categoryChipIcon(slug, size) {
  const name = CATEGORY_CHIP_ICON_MAP[slug] || 'layers';
  const span = document.createElement('span');
  span.className = 'mp-icon';
  span.style.fontSize = size || '14px';
  span.innerHTML = CATEGORY_CHIP_SVG[name] || CATEGORY_CHIP_SVG.layers;
  return span;
}

// ─── Skill Category helpers (Phase 1: Overview/Matrix/Reporting integration) ──

const CATEGORY_ORDER = ['foundational', 'core', 'advanced', 'ai_future'];
const CATEGORY_LABEL_FALLBACK = {
  foundational: 'Foundational',
  core: 'Core',
  advanced: 'Advanced',
  ai_future: 'AI & Future Skills',
};
const CATEGORY_ACCENT = {
  foundational: 'var(--cat-foundational-accent)',
  core: 'var(--cat-core-accent)',
  advanced: 'var(--cat-advanced-accent)',
  ai_future: 'var(--cat-ai-accent)',
  uncategorized: '#94a3b8',
};

function _cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const UNCATEGORIZED_SLUG = 'uncategorized';
const UNCATEGORIZED_LABEL = 'Uncategorized';

function _normalizeCategorySlug(slug) {
  if (!slug) return UNCATEGORIZED_SLUG;
  return String(slug).replace(/-/g, '_').toLowerCase();
}

function _primaryCategory(item) {
  const cats = Array.isArray(item?.categories) ? item.categories : [];
  if (cats.length === 0) {
    return { slug: UNCATEGORIZED_SLUG, name: UNCATEGORIZED_LABEL, sort_order: 99 };
  }
  const sorted = [...cats].sort((a, b) => {
    const ao = typeof a.sort_order === 'number' ? a.sort_order : 99;
    const bo = typeof b.sort_order === 'number' ? b.sort_order : 99;
    return ao - bo;
  });
  const c = sorted[0];
  return {
    slug: _normalizeCategorySlug(c.slug),
    name: c.name || CATEGORY_LABEL_FALLBACK[_normalizeCategorySlug(c.slug)] || UNCATEGORIZED_LABEL,
    sort_order: typeof c.sort_order === 'number' ? c.sort_order : 99,
  };
}

function _groupByCategory(items) {
  const groups = new Map();
  items.forEach(item => {
    const cat = _primaryCategory(item);
    if (!groups.has(cat.slug)) {
      groups.set(cat.slug, { slug: cat.slug, name: cat.name, sort_order: cat.sort_order, items: [] });
    }
    groups.get(cat.slug).items.push(item);
  });
  const orderIndex = slug => {
    const idx = CATEGORY_ORDER.indexOf(slug);
    return idx === -1 ? 90 : idx;
  };
  return Array.from(groups.values()).sort((a, b) => orderIndex(a.slug) - orderIndex(b.slug));
}

function _computeAIReadiness(perSkillStats) {
  if (!Array.isArray(perSkillStats) || perSkillStats.length === 0) {
    return { pct: 0, ready: 0, total: 0 };
  }
  const aiSkills = perSkillStats.filter(s => {
    const cats = s.categories || [];
    return cats.some(c => _normalizeCategorySlug(c.slug) === 'ai_future');
  });
  if (aiSkills.length === 0) return { pct: 0, ready: 0, total: 0 };
  const ready = aiSkills.filter(s => (s.avg_proficiency ?? 0) >= 3).length;
  const pct = Math.round((ready / aiSkills.length) * 100);
  return { pct, ready, total: aiSkills.length };
}

function _categoryCoverageSummary(perSkillStats) {
  const groups = _groupByCategory(perSkillStats);
  return groups.map(g => {
    const items = g.items;
    const avgCoverage = items.length
      ? Math.round(items.reduce((acc, s) => acc + (s.coverage_pct ?? 0), 0) / items.length)
      : 0;
    return { slug: g.slug, name: g.name, count: items.length, avg_coverage_pct: avgCoverage };
  });
}

function _strongestAndWeakestCategory(coverageSummary) {
  if (!coverageSummary || coverageSummary.length === 0) {
    return { strongest: null, weakest: null };
  }
  const sorted = [...coverageSummary].sort((a, b) => b.avg_coverage_pct - a.avg_coverage_pct);
  return { strongest: sorted[0], weakest: sorted[sorted.length - 1] };
}

function _computePlanEngagement(perEngineerStats, totalEngineers) {
  const total = Array.isArray(perEngineerStats) && perEngineerStats.length > 0
    ? perEngineerStats.length
    : (totalEngineers || 0);
  if (total === 0) return { pct: 0, active: 0, total: 0 };
  if (!Array.isArray(perEngineerStats) || perEngineerStats.length === 0) {
    return { pct: 0, active: 0, total };
  }
  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const active = perEngineerStats.filter(e => {
    const ts = e?.last_activity_at;
    if (!ts) return false;
    const parsed = Date.parse(ts);
    return Number.isFinite(parsed) && parsed >= cutoffMs;
  }).length;
  const pct = Math.round((active / total) * 100);
  return { pct, active, total };
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _container = null;
let _teamId = null;
let _matrixData = null;
let _statsData = null;
let _activityData = null;
let _activityHasMore = false;
let _activityLoading = false;
let _activityObserver = null;
const ACTIVITY_PAGE_SIZE = 30;
let _visibleSkillIds = null;
let _searchQuery = '';
let _bulkMode = false;
let _selectedEngIds = new Set();
let _charts = [];
let _resizeHandler = null;
let _tooltipEl = null;
let _drawerEl = null;
let _drawerOverlay = null;
let _matrixActiveCategories = null;

// ─── Tab panel element references ────────────────────────────────────────────

let _tabPanels = {};
let _tabButtons = {};
let _tabLoaded = {};
let _activeTab = 'overview';
let _matrixBodyEl = null;
let _overviewBodyEl = null;
let _reportingBodyEl = null;
let _bulkBarEl = null;
let _bulkCountEl = null;
let _statsRowEl = null;

// ─── Reporting tab state ──────────────────────────────────────────────────────

let _changeLogsData = null;
let _reportFromDate = '';
let _reportToDate = '';
let _reportEngineerId = '';

// ─── Mouse tracking for tooltip ───────────────────────────────────────────────

let _mouseX = 0;
let _mouseY = 0;

document.addEventListener('mousemove', (e) => {
  _mouseX = e.clientX;
  _mouseY = e.clientY;
});

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountMyTeam(container, params) {
  _container = container;
  container.innerHTML = '';

  _teamId = null;
  _matrixData = null;
  _statsData = null;
  _activityData = null;
  _activityHasMore = false;
  _activityLoading = false;
  if (_activityObserver) { try { _activityObserver.disconnect(); } catch (_) {} _activityObserver = null; }
  _visibleSkillIds = null;
  _searchQuery = '';
  _bulkMode = false;
  _selectedEngIds = new Set();
  _charts = [];
  _matrixActiveCategories = null;
  _resizeHandler = null;
  _tabPanels = {};
  _tabButtons = {};
  _tabLoaded = {};
  _activeTab = Store.get('myTeamTab') || 'overview';
  _matrixBodyEl = null;
  _overviewBodyEl = null;
  _reportingBodyEl = null;
  _bulkBarEl = null;
  _bulkCountEl = null;
  _statsRowEl = null;
  _changeLogsData = null;
  _reportFromDate = '';
  _reportToDate = '';
  _reportEngineerId = '';

  buildTooltip();
  buildDrawerElements();
  buildPageShell(container);

  const user = Store.get('user');
  if (user?.role === 'admin') {
    loadAdminTeamSelector();
  } else {
    loadManagerTeam();
  }

  _resizeHandler = () => {
    _charts.forEach(c => {
      try { c.resize(); } catch (_e) { /* disposed */ }
    });
  };
  window.addEventListener('resize', _resizeHandler);

  return () => {
    _charts.forEach(c => {
      try {
        if (typeof echarts !== 'undefined') echarts.dispose(c);
      } catch (_e) { /* disposed */ }
    });
    _charts = [];

    if (_tooltipEl && _tooltipEl.parentNode) _tooltipEl.parentNode.removeChild(_tooltipEl);
    _tooltipEl = null;

    if (_drawerEl && _drawerEl.parentNode) _drawerEl.parentNode.removeChild(_drawerEl);
    _drawerEl = null;

    if (_drawerOverlay && _drawerOverlay.parentNode) _drawerOverlay.parentNode.removeChild(_drawerOverlay);
    _drawerOverlay = null;

    if (_resizeHandler) window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  };
}

// ─── Manager team auto-detect ─────────────────────────────────────────────────

async function loadManagerTeam() {
  try {
    const teams = await api.get('/api/teams/');
    const user = Store.get('user');
    if (!teams || teams.length === 0) {
      if (_overviewBodyEl) renderEmptyState(_overviewBodyEl);
      return;
    }
    // Manager with team_id — find matching team
    let targetTeam = null;
    if (user?.team_id) {
      targetTeam = teams.find(t => t.id === user.team_id);
    }
    if (!targetTeam) targetTeam = teams[0];
    loadAllData(targetTeam.id);
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
    if (_overviewBodyEl) renderErrorState(_overviewBodyEl, err.message, () => loadManagerTeam());
  }
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadAllData(teamId) {
  _teamId = teamId;

  if (_overviewBodyEl) showSkeleton(_overviewBodyEl, 'cards');
  if (_matrixBodyEl) showSkeleton(_matrixBodyEl, 'table');
  if (_reportingBodyEl) showSkeleton(_reportingBodyEl, 'list');

  const matrixUrl = teamId ? `/api/teams/matrix?team_id=${teamId}` : '/api/teams/matrix';
  const statsUrl = teamId ? `/api/teams/stats?team_id=${teamId}` : '/api/teams/stats';
  const activityUrl = teamId
    ? `/api/teams/activity?team_id=${teamId}&limit=${ACTIVITY_PAGE_SIZE}&offset=0`
    : `/api/teams/activity?limit=${ACTIVITY_PAGE_SIZE}&offset=0`;

  try {
    const [matrix, stats, activity] = await Promise.all([
      api.get(matrixUrl),
      api.get(statsUrl).catch(() => null),
      api.get(activityUrl).catch(() => ({ items: [] })),
      ensureEcharts(),
    ]);

    _matrixData = matrix;
    _statsData = stats;
    _activityData = activity;
    const _initialItems = Array.isArray(activity?.items) ? activity.items : [];
    const _initialTotal = Number.isFinite(activity?.total) ? activity.total : _initialItems.length;
    _activityHasMore = _initialItems.length < _initialTotal;
    _activityLoading = false;
    _visibleSkillIds = null;
    _matrixActiveCategories = null;
    _tabLoaded = {};

    updateHeaderStats();
    renderActiveTab();
  } catch (err) {
    const msg = err.message || 'Failed to load team data';
    showToast(msg, 'error');
    if (_overviewBodyEl) renderErrorState(_overviewBodyEl, msg, () => loadAllData(teamId));
    if (_matrixBodyEl) renderErrorState(_matrixBodyEl, msg, () => loadAllData(teamId));
    if (_reportingBodyEl) renderErrorState(_reportingBodyEl, msg, () => loadAllData(teamId));
  }
}

async function loadAdminTeamSelector() {
  try {
    const teams = await api.get('/api/teams/');
    if (!_statsRowEl) return;

    _statsRowEl.innerHTML = '';

    const selectorBlock = el('div', { className: 'stat-block' });
    selectorBlock.style.minWidth = '200px';
    const selectLabel = el('div', { className: 'stat-block-label' });
    selectLabel.textContent = 'Select Team';
    const select = el('select', {
      className: 'form-select',
      style: 'width:auto;min-width:200px;font-size:13px;margin-top:4px;',
    });

    const placeholder = el('option', { value: '' });
    placeholder.textContent = '— Choose a team —';
    select.appendChild(placeholder);

    teams.forEach(t => {
      const opt = el('option', { value: String(t.id) });
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const tid = select.value;
      if (tid) loadAllData(Number(tid));
    });

    selectorBlock.appendChild(selectLabel);
    selectorBlock.appendChild(select);
    _statsRowEl.appendChild(selectorBlock);
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
  }
}

// ─── Header stats ─────────────────────────────────────────────────────────────

function updateHeaderStats() {
  if (!_statsRowEl || !_matrixData) return;

  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';

  // For admin, keep the selector and append stats; for manager, replace entirely
  if (isAdmin) {
    // Remove existing stat blocks except the first one (team selector)
    const children = Array.from(_statsRowEl.children);
    children.forEach((child, i) => {
      if (i > 0) child.remove();
    });
  } else {
    _statsRowEl.innerHTML = '';
  }

  const engineers = Array.isArray(_matrixData.engineers) ? _matrixData.engineers : [];
  const skills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];

  const stats = [
    { value: _matrixData.team_name || 'Team', label: 'Team Name', isText: true },
    { value: engineers.length, label: 'Engineers', isText: false },
    { value: skills.length, label: 'Team Skills', isText: false },
  ];

  // For admin, skip team name since we have the selector
  const displayStats = isAdmin ? stats.slice(1) : stats;

  displayStats.forEach(({ value, label, isText }) => {
    const block = el('div', { className: 'stat-block' });
    const valEl = el('div', { className: 'stat-block-value' });
    valEl.textContent = String(value);
    if (isText) valEl.style.fontSize = '16px';
    const labelEl = el('div', { className: 'stat-block-label' });
    labelEl.textContent = label;
    block.appendChild(valEl);
    block.appendChild(labelEl);
    _statsRowEl.appendChild(block);
  });
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = el('div', { className: 'mp-wrapper' });

  // Hero header
  const header = el('div', { className: 'mp-header' });
  const headerText = el('div', { className: 'mp-header-text' });
  const title = el('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('My Team '));
  const gradientSpan = el('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Command Center';
  title.appendChild(gradientSpan);
  const subtitle = el('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Team analytics, skills matrix, and development tracking';
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);

  _statsRowEl = el('div', { className: 'stats-row', id: 'mt-stats-row' });
  header.appendChild(_statsRowEl);
  wrapper.appendChild(header);

  // Tab bar
  const tabBar = el('div', {
    className: 'skill-detail-tabs',
    role: 'tablist',
    'aria-label': 'Team management tabs',
  });

  const tabDefs = [
    { name: 'overview', label: 'Overview' },
    { name: 'matrix', label: 'Matrix' },
    { name: 'reporting', label: 'Reporting' },
  ];

  tabDefs.forEach(({ name, label }) => {
    const btn = el('button', {
      className: 'skill-detail-tab' + (name === _activeTab ? ' active' : ''),
      role: 'tab',
      'aria-selected': String(name === _activeTab),
      'data-tab': name,
    });
    btn.textContent = label;
    btn.addEventListener('click', () => activateTab(name));
    tabBar.appendChild(btn);
    _tabButtons[name] = btn;
  });

  tabBar.addEventListener('keydown', (e) => {
    const names = tabDefs.map(t => t.name);
    const focused = document.activeElement;
    const currentTab = focused?.dataset?.tab;
    if (!currentTab || !names.includes(currentTab)) return;
    const idx = names.indexOf(currentTab);
    if (e.key === 'ArrowRight') {
      const next = names[(idx + 1) % names.length];
      activateTab(next);
      _tabButtons[next].focus();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      const prev = names[(idx - 1 + names.length) % names.length];
      activateTab(prev);
      _tabButtons[prev].focus();
      e.preventDefault();
    }
  });

  wrapper.appendChild(tabBar);

  // Overview panel
  const overviewPanel = el('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'overview' ? 'display:block' : 'display:none',
  });
  _overviewBodyEl = el('div', { className: 'mt-overview-body' });
  overviewPanel.appendChild(_overviewBodyEl);
  _tabPanels['overview'] = overviewPanel;

  // Matrix panel
  const matrixPanel = el('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'matrix' ? 'display:block' : 'display:none',
  });
  const matrixControls = buildMatrixControls();
  matrixPanel.appendChild(matrixControls);
  _bulkBarEl = buildBulkBar();
  matrixPanel.appendChild(_bulkBarEl);
  _matrixBodyEl = el('div', { className: 'mt-matrix-body' });
  matrixPanel.appendChild(_matrixBodyEl);
  _tabPanels['matrix'] = matrixPanel;

  // Reporting panel
  const reportingPanel = el('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'reporting' ? 'display:block' : 'display:none',
  });
  const reportingControls = buildReportingControls();
  reportingPanel.appendChild(reportingControls);
  _reportingBodyEl = el('div', { className: 'mt-reporting-body' });
  reportingPanel.appendChild(_reportingBodyEl);
  _tabPanels['reporting'] = reportingPanel;

  wrapper.appendChild(overviewPanel);
  wrapper.appendChild(matrixPanel);
  wrapper.appendChild(reportingPanel);

  container.appendChild(wrapper);
}

// ─── Tab activation ───────────────────────────────────────────────────────────

function activateTab(tabName) {
  _activeTab = tabName;
  Store.set('myTeamTab', tabName);

  Object.entries(_tabButtons).forEach(([name, btn]) => {
    const active = name === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  Object.entries(_tabPanels).forEach(([name, panel]) => {
    panel.style.display = name === tabName ? 'block' : 'none';
  });

  if (!_tabLoaded[tabName] && _matrixData) {
    renderTab(tabName);
  }
}

function renderActiveTab() {
  _tabLoaded = {};
  renderTab(_activeTab);
}

function renderTab(tabName) {
  if (tabName === 'overview') {
    renderOverviewTab();
    _tabLoaded['overview'] = true;
  } else if (tabName === 'matrix') {
    renderMatrixTab();
    _tabLoaded['matrix'] = true;
  } else if (tabName === 'reporting') {
    renderReportingTab();
    _tabLoaded['reporting'] = true;
  }
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function renderOverviewTab() {
  if (!_overviewBodyEl) return;
  _overviewBodyEl.innerHTML = '';

  const perSkillStats = (Array.isArray(_statsData?.per_skill_stats) && _statsData.per_skill_stats.length > 0)
    ? _statsData.per_skill_stats
    : buildFallbackPerSkillStats();

  const coveragePct = _statsData?.coverage_pct ?? 0;
  const criticalGaps = _statsData?.critical_gaps ?? 0;
  const activeDev = _statsData?.active_developments ?? 0;
  const completions30d = _statsData?.completions_30d ?? 0;
  const totalEngineers = _statsData?.total_engineers ?? (_matrixData?.engineers?.length ?? 0);
  const totalSkills = _statsData?.total_skills ?? (_matrixData?.skills?.length ?? 0);

  const aiReadiness = _computeAIReadiness(perSkillStats);
  const coverageSummary = _categoryCoverageSummary(perSkillStats);
  const { strongest, weakest } = _strongestAndWeakestCategory(coverageSummary);
  const engagement = _computePlanEngagement(_statsData?.per_engineer_stats, totalEngineers);

  const kpiGrid = el('div', { className: 'mt-kpi-grid' });
  const kpiDefs = [
    { label: 'Team Coverage', value: coveragePct, suffix: '%', sub: `${totalEngineers} engineers \u00b7 ${totalSkills} skills`, variant: 'accent' },
    { label: 'Critical Gaps', value: criticalGaps, suffix: '', sub: 'Skills below 30% coverage', variant: 'danger' },
    { label: 'Active Developments', value: activeDev, suffix: '', sub: 'Skills in progress', variant: 'warning' },
    { label: '30-day Completions', value: completions30d, suffix: '', sub: 'Achieved proficiency', variant: 'success' },
  ];
  kpiDefs.forEach(({ label, value, suffix, sub, variant }) => {
    const card = el('div', { className: `mt-kpi-card mt-kpi-card--${variant}` });
    const labelEl = el('div', { className: 'mt-kpi-label' });
    labelEl.textContent = label;
    const valueEl = el('div', { className: 'mt-kpi-value' });
    valueEl.textContent = '0' + (suffix || '');
    const subEl = el('div', { className: 'mt-kpi-sub' });
    subEl.textContent = sub;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(subEl);
    kpiGrid.appendChild(card);
    animateCountUp(valueEl, value, suffix);
  });
  _overviewBodyEl.appendChild(kpiGrid);

  const catKpiGrid = el('div', { className: 'mt-kpi-grid mt-kpi-grid--category' });
  const catKpiDefs = [
    {
      label: 'AI Readiness Score',
      value: aiReadiness.pct,
      suffix: '%',
      sub: aiReadiness.total > 0
        ? `${aiReadiness.ready} of ${aiReadiness.total} AI skills at L3+`
        : 'No AI & Future skills mapped',
      variant: 'ai-future',
    },
    {
      label: 'Strongest Capability',
      value: strongest ? strongest.avg_coverage_pct : 0,
      suffix: '%',
      sub: strongest ? `${strongest.name} \u00b7 ${strongest.count} skills` : 'No skills mapped',
      variant: strongest ? strongest.slug : 'accent',
    },
    {
      label: 'Highest Risk Area',
      value: weakest ? weakest.avg_coverage_pct : 0,
      suffix: '%',
      sub: weakest ? `${weakest.name} \u00b7 ${weakest.count} skills` : 'No skills mapped',
      variant: weakest ? weakest.slug : 'danger',
    },
    {
      label: 'Plan Engagement',
      value: engagement.pct,
      suffix: '%',
      sub: engagement.total > 0
        ? `${engagement.active} of ${engagement.total} engineers active in last 14 days`
        : 'No engineers in team',
      variant: 'success',
    },
  ];
  catKpiDefs.forEach(({ label, value, suffix, sub, variant }) => {
    const card = el('div', { className: `mt-kpi-card mt-kpi-card--${variant}` });
    const labelEl = el('div', { className: 'mt-kpi-label' });
    labelEl.textContent = label;
    const valueEl = el('div', { className: 'mt-kpi-value' });
    valueEl.textContent = '0' + (suffix || '');
    const subEl = el('div', { className: 'mt-kpi-sub' });
    subEl.textContent = sub;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(subEl);
    catKpiGrid.appendChild(card);
    animateCountUp(valueEl, value, suffix);
  });
  _overviewBodyEl.appendChild(catKpiGrid);

  const dashCols = el('div', { className: 'mt-dash-cols' });

  const radarCard = el('div', { className: 'mt-dash-card' });
  radarCard.style.flex = '3';
  const radarHeader = el('div', { className: 'mt-dash-card-header' });
  radarHeader.textContent = 'Coverage by Skill Category';
  const radarBody = el('div', { className: 'mt-dash-card-body' });
  const radarGridEl = el('div', { className: 'mt-radar-grid' });
  radarBody.appendChild(radarGridEl);
  radarCard.appendChild(radarHeader);
  radarCard.appendChild(radarBody);
  dashCols.appendChild(radarCard);

  const activityCard = el('div', { className: 'mt-dash-card' });
  activityCard.style.flex = '2';
  const activityHeader = el('div', { className: 'mt-dash-card-header' });
  const activityTitle = el('span');
  activityTitle.textContent = 'Recent Activity';
  const activityItems = Array.isArray(_activityData?.items) ? _activityData.items : (Array.isArray(_activityData) ? _activityData : []);
  const activityTotal = Number.isFinite(_activityData?.total) ? _activityData.total : activityItems.length;
  const activityBadge = el('span', {
    className: 'mt-activity-badge-count',
    style: 'margin-left:8px;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:9999px;font-size:11px;padding:1px 8px;color:var(--text-muted);',
  });
  activityBadge.textContent = activityTotal > activityItems.length
    ? `${activityItems.length} / ${activityTotal}`
    : String(activityItems.length);
  activityHeader.appendChild(activityTitle);
  activityHeader.appendChild(activityBadge);
  const activityBody = el('div', {
    className: 'mt-dash-card-body mt-activity-scroll',
    style: 'max-height:560px;min-height:340px;overflow-y:auto;',
  });
  renderActivityFeed(activityBody, activityItems);
  attachActivityLazyLoad(activityBody);
  activityCard.appendChild(activityHeader);
  activityCard.appendChild(activityBody);
  dashCols.appendChild(activityCard);

  _overviewBodyEl.appendChild(dashCols);

  if (perSkillStats.length > 0) {
    const gapCard = el('div', { className: 'mt-dash-card', style: 'margin-top:16px;' });
    const gapHeader = el('div', { className: 'mt-dash-card-header' });
    gapHeader.textContent = 'Skill Coverage by Category';
    const gapBody = el('div', { className: 'mt-dash-card-body' });
    renderCategoryCoverageSections(gapBody, perSkillStats);
    gapCard.appendChild(gapHeader);
    gapCard.appendChild(gapBody);
    _overviewBodyEl.appendChild(gapCard);
  }

  requestAnimationFrame(() => {
    if (perSkillStats.length > 0) {
      renderCategoryRadarGrid(radarGridEl, perSkillStats);
    }
  });
}

function buildFallbackPerSkillStats() {
  if (!_matrixData) return [];
  const skills = _matrixData.skills || [];
  const engineers = _matrixData.engineers || [];
  return skills.map(skill => {
    let covered = 0;
    let profSum = 0;
    let profCount = 0;
    engineers.forEach(eng => {
      const cell = (eng.cells || {})[String(skill.id)];
      if (cell && cell.status !== 'not_in_plan') {
        covered++;
        if (typeof cell.proficiency_level === 'number') {
          profSum += cell.proficiency_level;
          profCount++;
        }
      }
    });
    const pct = engineers.length > 0 ? Math.round((covered / engineers.length) * 100) : 0;
    const avgProf = profCount > 0 ? profSum / profCount : 0;
    return {
      skill_id: skill.id,
      skill_name: skill.name,
      coverage_pct: pct,
      avg_proficiency: avgProf,
      categories: Array.isArray(skill.categories) ? skill.categories : [],
    };
  });
}

function renderCategoryRadarGrid(container, perSkillStats) {
  container.innerHTML = '';
  const groups = _groupByCategory(perSkillStats);
  if (groups.length === 0) {
    const empty = el('div', { className: 'mt-radar-empty' });
    empty.textContent = 'No skills available for radar visualization.';
    container.appendChild(empty);
    return;
  }
  groups.forEach(group => {
    const cell = el('div', { className: 'mt-radar-cell' });
    const cellHeader = el('div', { className: 'mt-radar-cell-header' });
    const title = el('span', { className: 'mt-radar-cell-title' });
    title.textContent = group.name;
    const count = el('span', { className: 'mt-radar-cell-count' });
    count.textContent = `${group.items.length} skill${group.items.length === 1 ? '' : 's'}`;
    cellHeader.appendChild(title);
    cellHeader.appendChild(count);
    cell.appendChild(cellHeader);

    const chartEl = el('div', { className: 'mt-radar-cell-chart' });
    cell.appendChild(chartEl);
    container.appendChild(cell);

    const accent = CATEGORY_ACCENT[group.slug] || CATEGORY_ACCENT.uncategorized;
    if (group.items.length < 3) {
      renderCategoryBarFallback(chartEl, group.items, accent);
    } else {
      renderRadarChart(chartEl, group.items, accent);
    }
  });
}

function renderCategoryBarFallback(container, items, accent) {
  if (typeof echarts === 'undefined') return;
  const cc = _getChartColors();
  const chart = echarts.init(container, cc.theme);
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = Array.isArray(params) ? params[0] : params;
        const full = items[p.dataIndex]?.skill_name || p.name;
        const pct = (items[p.dataIndex]?.coverage_pct ?? 0).toFixed(0);
        return `<strong>${full}</strong><br/>Coverage: ${pct}%`;
      },
    },
    grid: { left: 90, right: 24, top: 16, bottom: 16, containLabel: false },
    xAxis: {
      type: 'value', min: 0, max: 100,
      axisLine: { lineStyle: { color: cc.gridColor } },
      axisLabel: { color: cc.textMuted, fontSize: 10 },
      splitLine: { lineStyle: { color: cc.gridColor } },
    },
    yAxis: {
      type: 'category',
      data: items.map(s => s.skill_name.length > 22 ? s.skill_name.slice(0, 20) + '\u2026' : s.skill_name),
      axisLine: { lineStyle: { color: cc.gridColor } },
      axisTick: { show: false },
      axisLabel: { color: cc.textMuted, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: items.map(s => s.coverage_pct ?? 0),
      itemStyle: { color: accent, borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 18,
    }],
  };
  chart.setOption(option);
  _charts.push(chart);
}

function renderCategoryCoverageSections(container, perSkillStats) {
  container.innerHTML = '';
  const groups = _groupByCategory(perSkillStats);
  groups.forEach(group => {
    const accent = CATEGORY_ACCENT[group.slug] || CATEGORY_ACCENT.uncategorized;
    const section = el('div', { className: 'mt-cat-section' });
    const header = el('div', { className: 'mt-cat-section-header' });
    const dot = el('span', { className: 'mt-cat-section-dot', style: `background:${accent};` });
    const name = el('span', { className: 'mt-cat-section-name' });
    name.textContent = group.name;
    const count = el('span', { className: 'mt-cat-section-count' });
    count.textContent = `${group.items.length}`;
    header.appendChild(dot);
    header.appendChild(name);
    header.appendChild(count);
    section.appendChild(header);

    const gapList = el('div', { className: 'mt-gap-list' });
    const sorted = [...group.items].sort((a, b) => (a.coverage_pct ?? 0) - (b.coverage_pct ?? 0));
    sorted.forEach(s => {
      const pct = s.coverage_pct ?? 0;
      const color = pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)';
      const row = el('div', { className: 'mt-gap-row' });
      const nameEl = el('div', { className: 'mt-gap-name' });
      nameEl.textContent = s.skill_name;
      nameEl.title = s.skill_name;
      const barWrap = el('div', { className: 'mt-gap-bar-wrap' });
      const barFill = el('div', { className: 'mt-gap-bar-fill', style: `width:${pct}%;background:${color};` });
      barWrap.appendChild(barFill);
      const pctEl = el('div', { className: 'mt-gap-pct' });
      pctEl.textContent = `${pct}%`;
      row.appendChild(nameEl);
      row.appendChild(barWrap);
      row.appendChild(pctEl);
      gapList.appendChild(row);
    });
    section.appendChild(gapList);
    container.appendChild(section);
  });
}

function _getChartColors() {
  const cs = getComputedStyle(document.documentElement);
  const isLight = document.body.getAttribute('data-theme') === 'light';
  return {
    textMuted: cs.getPropertyValue('--text-muted').trim() || (isLight ? '#64748b' : '#8aa0bd'),
    gridColor: isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)',
    splitColors: isLight
      ? ['rgba(59,130,246,0.03)', 'rgba(59,130,246,0.07)']
      : ['rgba(59,130,246,0.04)', 'rgba(59,130,246,0.08)'],
    theme: isLight ? undefined : 'dark',
  };
}

function renderRadarChart(container, perSkillStats, accent) {
  if (typeof echarts === 'undefined') return;
  const cc = _getChartColors();
  const chart = echarts.init(container, cc.theme);
  const color = accent || '#3b82f6';
  const fullNames = perSkillStats.map(s => s.skill_name);
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const vals = Array.isArray(p.value) ? p.value : [];
        const rows = fullNames.map((n, i) =>
          `<div style="display:flex;justify-content:space-between;gap:16px;">
             <span>${n}</span><strong>${(vals[i] ?? 0).toFixed(0)}%</strong>
           </div>`
        ).join('');
        return `<div style="min-width:220px;"><strong>Coverage by skill</strong>${rows}</div>`;
      },
    },
    radar: {
      shape: 'polygon',
      splitNumber: 4,
      indicator: perSkillStats.map(s => ({
        name: s.skill_name.length > 15 ? s.skill_name.slice(0, 12) + '...' : s.skill_name,
        max: 100,
      })),
      splitArea: { areaStyle: { color: cc.splitColors } },
      axisLine: { lineStyle: { color: cc.gridColor, width: 1 } },
      splitLine: { lineStyle: { color: cc.gridColor, width: 1 } },
      name: { textStyle: { color: cc.textMuted, fontSize: 11 } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: perSkillStats.map(s => s.coverage_pct),
        name: 'Coverage %',
        areaStyle: { opacity: 0.18, color },
        lineStyle: { color, width: 2 },
        itemStyle: { color },
      }],
    }],
  };
  chart.setOption(option);
  _charts.push(chart);
}

function _getActivityBadge(item) {
  const raw = (item.title || item.description || '').toLowerCase();
  if (raw.startsWith('completed:')) {
    const val = raw.slice('completed:'.length).trim();
    if (val === 'false') return { label: 'Uncompleted', cls: 'mt-badge--warning' };
    return { label: 'Completed', cls: 'mt-badge--success' };
  }
  if (raw.includes('completed a training')) return { label: 'Completed', cls: 'mt-badge--success' };
  if (raw.includes('uncompleted')) return { label: 'Uncompleted', cls: 'mt-badge--warning' };
  if (raw.includes('added to plan') || raw.startsWith('training_log:')) return { label: 'Added', cls: 'mt-badge--info' };
  if (raw.includes('removed')) return { label: 'Removed', cls: 'mt-badge--danger' };
  if (raw.startsWith('status:')) return { label: 'Moved', cls: 'mt-badge--accent' };
  if (raw.startsWith('proficiency_level:')) return { label: 'Level Up', cls: 'mt-badge--accent' };
  if (item.type === 'training_log') return { label: 'Training', cls: 'mt-badge--info' };
  if (item.type === 'audit') return { label: 'Updated', cls: 'mt-badge--muted' };
  return null;
}

function renderActivityFeed(container, items, { append = false } = {}) {
  if (!append) container.innerHTML = '';

  container.querySelectorAll('.mt-activity-sentinel, .mt-activity-end, .mt-activity-loading').forEach(n => n.remove());

  if (!append && (!items || items.length === 0)) {
    const empty = el('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No recent activity';
    container.appendChild(empty);
    return;
  }

  (items || []).forEach(item => {
    const row = el('div', { className: 'mt-activity-item' });
    const avatar = el('div', { className: 'mt-activity-avatar' });
    const avatarEntry = item.actor_avatar ? AVATAR_CATALOG.find(a => a.id === item.actor_avatar) : null;
    if (avatarEntry) {
      avatar.innerHTML = avatarEntry.svg;
    } else {
      avatar.textContent = getInitials(item.actor_name || item.engineer_name || '?');
    }
    const body = el('div', { className: 'mt-activity-body' });
    const text = el('div', { className: 'mt-activity-text' });
    const actorName = item.actor_name || item.engineer_name || 'Unknown';
    const desc = formatActivityTitle(item.title || item.description || '', item.skill_name);
    text.innerHTML = `<strong>${escapeHtml(actorName)}</strong> ${desc}`;
    const meta = el('div', { className: 'mt-activity-meta' });
    const badge = _getActivityBadge(item);
    if (badge) {
      const badgeEl = el('span', { className: `mt-activity-badge ${badge.cls}` });
      badgeEl.textContent = badge.label;
      meta.appendChild(badgeEl);
    }
    const time = el('span', { className: 'mt-activity-time' });
    time.textContent = relativeTime(item.occurred_at);
    meta.appendChild(time);
    body.appendChild(text);
    body.appendChild(meta);
    row.appendChild(avatar);
    row.appendChild(body);
    container.appendChild(row);
  });

  if (_activityHasMore) {
    const sentinel = el('div', { className: 'mt-activity-sentinel', style: 'height:1px;' });
    container.appendChild(sentinel);
  } else if (container.children.length > 0) {
    const end = el('div', {
      className: 'mt-activity-end',
      style: 'text-align:center;padding:12px 8px;color:var(--text-muted);font-size:12px;',
    });
    end.textContent = '— End of activity —';
    container.appendChild(end);
  }
}

function _updateActivityBadge() {
  if (!_overviewBodyEl) return;
  const badge = _overviewBodyEl.querySelector('.mt-activity-badge-count');
  if (!badge) return;
  const loaded = Array.isArray(_activityData?.items) ? _activityData.items.length : 0;
  const total = Number.isFinite(_activityData?.total) ? _activityData.total : loaded;
  badge.textContent = total > loaded ? `${loaded} / ${total}` : String(loaded);
}

async function _loadMoreActivity(scrollEl) {
  if (_activityLoading || !_activityHasMore) return;
  _activityLoading = true;

  scrollEl.querySelectorAll('.mt-activity-sentinel').forEach(n => n.remove());
  const loadingEl = el('div', {
    className: 'mt-activity-loading',
    style: 'text-align:center;padding:10px 8px;color:var(--text-muted);font-size:12px;',
  });
  loadingEl.textContent = 'Loading more…';
  scrollEl.appendChild(loadingEl);

  const offset = Array.isArray(_activityData?.items) ? _activityData.items.length : 0;
  const url = _teamId
    ? `/api/teams/activity?team_id=${_teamId}&limit=${ACTIVITY_PAGE_SIZE}&offset=${offset}`
    : `/api/teams/activity?limit=${ACTIVITY_PAGE_SIZE}&offset=${offset}`;

  try {
    const page = await api.get(url);
    const newItems = Array.isArray(page?.items) ? page.items : [];
    const total = Number.isFinite(page?.total) ? page.total : (offset + newItems.length);

    if (!Array.isArray(_activityData?.items)) _activityData = { items: [], total };
    _activityData.items = _activityData.items.concat(newItems);
    _activityData.total = total;
    _activityHasMore = _activityData.items.length < total && newItems.length > 0;

    loadingEl.remove();
    renderActivityFeed(scrollEl, newItems, { append: true });
    _updateActivityBadge();
  } catch (err) {
    loadingEl.remove();
    const errEl = el('div', {
      className: 'mt-activity-loading',
      style: 'text-align:center;padding:10px 8px;color:var(--danger,#ef4444);font-size:12px;cursor:pointer;',
    });
    errEl.textContent = 'Failed to load — click to retry';
    errEl.addEventListener('click', () => {
      errEl.remove();
      _activityLoading = false;
      _loadMoreActivity(scrollEl);
    });
    scrollEl.appendChild(errEl);
    return;
  } finally {
    _activityLoading = false;
  }

  attachActivityLazyLoad(scrollEl);
}

function attachActivityLazyLoad(scrollEl) {
  if (!scrollEl) return;
  if (_activityObserver) { try { _activityObserver.disconnect(); } catch (_) {} _activityObserver = null; }
  if (!_activityHasMore) return;

  const sentinel = scrollEl.querySelector('.mt-activity-sentinel');
  if (!sentinel || typeof IntersectionObserver === 'undefined') {
    const onScroll = () => {
      if (!_activityHasMore || _activityLoading) return;
      if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 80) {
        _loadMoreActivity(scrollEl);
      }
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return;
  }

  _activityObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        _loadMoreActivity(scrollEl);
        break;
      }
    }
  }, { root: scrollEl, rootMargin: '120px 0px', threshold: 0 });

  _activityObserver.observe(sentinel);
}

// ─── Matrix controls ──────────────────────────────────────────────────────────

function buildMatrixControls() {
  const controls = el('div', { className: 'mt-matrix-controls' });

  const searchInput = el('input', {
    className: 'mt-matrix-search form-input',
    type: 'text',
    placeholder: 'Search engineers...',
  });
  let _debounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => {
      _searchQuery = searchInput.value.trim().toLowerCase();
      if (_tabLoaded['matrix']) renderMatrixTable();
    }, 200);
  });

  const skillFilter = el('select', { className: 'form-select', style: 'width:auto;max-width:280px;' });
  const filterAll = el('option', { value: '' });
  filterAll.textContent = 'All skills';
  skillFilter.appendChild(filterAll);
  skillFilter.id = 'mt-skill-filter';
  skillFilter.dataset.empty = 'true';

  skillFilter.addEventListener('change', () => {
    const val = skillFilter.value;
    skillFilter.dataset.empty = val ? 'false' : 'true';
    _visibleSkillIds = val ? new Set([Number(val)]) : null;
    if (_tabLoaded['matrix']) renderMatrixTable();
  });

  const bulkBtn = el('button', { className: 'btn btn-secondary btn-sm' });
  bulkBtn.textContent = 'Bulk Assign';
  bulkBtn.addEventListener('click', () => {
    _bulkMode = !_bulkMode;
    _selectedEngIds = new Set();
    bulkBtn.classList.toggle('active', _bulkMode);
    if (_bulkBarEl) _bulkBarEl.style.display = _bulkMode ? 'flex' : 'none';
    if (_tabLoaded['matrix']) renderMatrixTable();
  });

  const csvBtn = el('button', { className: 'matrix-csv-btn' });
  const csvSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  csvSvg.setAttribute('width', '14');
  csvSvg.setAttribute('height', '14');
  csvSvg.setAttribute('viewBox', '0 0 24 24');
  csvSvg.setAttribute('fill', 'none');
  csvSvg.setAttribute('stroke', 'currentColor');
  csvSvg.setAttribute('stroke-width', '2');
  csvSvg.setAttribute('stroke-linecap', 'round');
  csvSvg.setAttribute('stroke-linejoin', 'round');
  csvSvg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>';
  csvBtn.appendChild(csvSvg);
  csvBtn.appendChild(document.createTextNode(' Export CSV'));
  csvBtn.addEventListener('click', () => {
    if (!_matrixData) return;
    downloadExport(`/api/export/teams/${_matrixData.team_id}/matrix/csv`, 'team_matrix.csv');
  });

  const legend = buildLegend();

  controls.appendChild(searchInput);
  controls.appendChild(skillFilter);
  controls.appendChild(csvBtn);
  controls.appendChild(legend);
  controls.appendChild(bulkBtn);

  return controls;
}

function buildBulkBar() {
  const bar = el('div', { className: 'mt-bulk-bar', style: 'display:none;' });

  _bulkCountEl = el('span', { style: 'color:var(--text-secondary);font-size:14px;' });
  _bulkCountEl.textContent = '0 selected';

  const assignBtn = el('button', { className: 'btn btn-primary btn-sm' });
  assignBtn.textContent = 'Assign Skill';
  assignBtn.addEventListener('click', () => {
    if (_selectedEngIds.size === 0) {
      showToast('Select at least one engineer', 'warning');
      return;
    }
    openBulkAssignModal();
  });

  const cancelBtn = el('button', { className: 'btn btn-secondary btn-sm' });
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    _bulkMode = false;
    _selectedEngIds = new Set();
    if (bar) bar.style.display = 'none';
    const bulkToggle = _container?.querySelector('.btn.btn-secondary.btn-sm');
    if (bulkToggle) bulkToggle.classList.remove('active');
    if (_tabLoaded['matrix']) renderMatrixTable();
  });

  bar.appendChild(_bulkCountEl);
  bar.appendChild(assignBtn);
  bar.appendChild(cancelBtn);

  return bar;
}

// ─── Matrix tab ───────────────────────────────────────────────────────────────

function renderMatrixTab() {
  if (!_matrixBodyEl || !_matrixData) return;
  populateSkillFilter();
  renderMatrixCategoryChips();
  renderMatrixTable();
}

function renderMatrixCategoryChips() {
  if (!_matrixBodyEl || !_matrixData) return;
  const existing = document.getElementById('mt-matrix-category-toolbar');
  if (existing) existing.remove();

  const allSkills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];
  const presentSlugs = new Set();
  let hasUncategorized = false;
  allSkills.forEach(s => {
    const cats = Array.isArray(s.categories) ? s.categories : [];
    if (cats.length === 0) { hasUncategorized = true; return; }
    cats.forEach(c => { if (c && c.slug) presentSlugs.add(_normalizeCategorySlug(c.slug)); });
  });
  const orderedSlugs = CATEGORY_ORDER.filter(slug => presentSlugs.has(slug));
  Array.from(presentSlugs).forEach(slug => { if (!orderedSlugs.includes(slug)) orderedSlugs.push(slug); });
  if (hasUncategorized) orderedSlugs.push(UNCATEGORIZED_SLUG);

  if (_matrixActiveCategories === null) {
    _matrixActiveCategories = new Set(orderedSlugs);
  }

  const toolbar = el('div', {
    id: 'mt-matrix-category-toolbar',
    className: 'mp-filter-chips mt-matrix-category-chips',
  });

  orderedSlugs.forEach(slug => {
    const isActive = _matrixActiveCategories.has(slug);
    const chip = el('button', {
      className: 'mp-filter-chip' + (isActive ? ' active' : ''),
      type: 'button',
    });
    chip.setAttribute('data-category', slug);
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    chip.appendChild(categoryChipIcon(slug, '14px'));
    const label = el('span', { className: 'mp-filter-chip__label' });
    label.textContent = CATEGORY_LABEL_FALLBACK[slug] || (slug === UNCATEGORIZED_SLUG ? UNCATEGORIZED_LABEL : slug);
    chip.appendChild(label);
    chip.addEventListener('click', () => {
      if (_matrixActiveCategories.has(slug)) {
        if (_matrixActiveCategories.size <= 1) return;
        _matrixActiveCategories.delete(slug);
      } else {
        _matrixActiveCategories.add(slug);
      }
      renderMatrixCategoryChips();
      renderMatrixTable();
    });
    toolbar.appendChild(chip);
  });

  _matrixBodyEl.parentNode.insertBefore(toolbar, _matrixBodyEl);
}

function populateSkillFilter() {
  const filterSelect = document.getElementById('mt-skill-filter');
  if (!filterSelect || !_matrixData) return;
  while (filterSelect.options.length > 1) filterSelect.remove(1);
  const skills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];
  skills.forEach(skill => {
    const opt = el('option', { value: String(skill.id) });
    opt.textContent = skill.name;
    filterSelect.appendChild(opt);
  });
}

function renderMatrixTable() {
  if (!_matrixBodyEl || !_matrixData) return;
  _matrixBodyEl.innerHTML = '';

  const allEngineers = Array.isArray(_matrixData.engineers) ? _matrixData.engineers : [];
  const allSkills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];

  const engineers = _searchQuery
    ? allEngineers.filter(e => (e.name || '').toLowerCase().includes(_searchQuery))
    : allEngineers;

  const skills = _visibleSkillIds
    ? allSkills.filter(s => _visibleSkillIds.has(s.id))
    : allSkills;

  if (engineers.length === 0) {
    renderEmptyState(_matrixBodyEl);
    return;
  }

  if (skills.length === 0) {
    const noSkills = el('div', { className: 'empty-state empty-state--inline' });
    noSkills.textContent = 'No skills match the current filter.';
    _matrixBodyEl.appendChild(noSkills);
    return;
  }

  const activeCategories = _matrixActiveCategories || new Set(CATEGORY_ORDER.concat([UNCATEGORIZED_SLUG]));

  const groups = new Map();
  CATEGORY_ORDER.forEach(slug => { if (activeCategories.has(slug)) groups.set(slug, []); });
  if (activeCategories.has(UNCATEGORIZED_SLUG)) groups.set(UNCATEGORIZED_SLUG, []);

  skills.forEach(skill => {
    const cats = Array.isArray(skill.categories) ? skill.categories : [];
    if (cats.length === 0) {
      if (activeCategories.has(UNCATEGORIZED_SLUG)) {
        groups.get(UNCATEGORIZED_SLUG).push(skill);
      }
      return;
    }
    cats.forEach(c => {
      const slug = _normalizeCategorySlug(c.slug);
      if (activeCategories.has(slug)) {
        if (!groups.has(slug)) groups.set(slug, []);
        groups.get(slug).push(skill);
      }
    });
  });

  let totalRendered = 0;
  groups.forEach((groupSkills, slug) => {
    if (groupSkills.length === 0) return;
    totalRendered += groupSkills.length;

    const section = el('div', { className: 'mt-matrix-section' });
    section.setAttribute('data-category', slug);

    const header = el('div', { className: 'mt-matrix-section__header' });
    const accent = CATEGORY_ACCENT[slug] || CATEGORY_ACCENT[UNCATEGORIZED_SLUG];
    header.style.setProperty('--mt-cat-accent', accent);

    const iconEl = categoryChipIcon(slug, '18px');
    iconEl.classList.add('mt-matrix-section__icon');
    header.appendChild(iconEl);

    const title = el('h3', { className: 'mt-matrix-section__title' });
    title.textContent = CATEGORY_LABEL_FALLBACK[slug] || (slug === UNCATEGORIZED_SLUG ? UNCATEGORIZED_LABEL : slug);
    header.appendChild(title);

    const countBadge = el('span', { className: 'mt-matrix-section__count' });
    countBadge.textContent = `${groupSkills.length} skill${groupSkills.length === 1 ? '' : 's'}`;
    header.appendChild(countBadge);

    section.appendChild(header);
    section.appendChild(buildMatrixSectionTable(engineers, groupSkills));
    _matrixBodyEl.appendChild(section);
  });

  if (totalRendered === 0) {
    const noMatches = el('div', { className: 'empty-state empty-state--inline' });
    noMatches.textContent = 'No skills match the current category filter.';
    _matrixBodyEl.appendChild(noMatches);
    return;
  }

  const summary = buildSummaryRow(engineers, skills);
  _matrixBodyEl.appendChild(summary);
}

function buildMatrixSectionTable(engineers, skills) {
  const scrollWrap = el('div', { className: 'matrix-scroll' });
  const table = el('table', { className: 'matrix-table' });

  const colgroup = document.createElement('colgroup');
  const nameCol = document.createElement('col');
  nameCol.style.width = '180px';
  colgroup.appendChild(nameCol);
  if (_bulkMode) {
    const checkCol = document.createElement('col');
    checkCol.style.width = '36px';
    colgroup.appendChild(checkCol);
  }
  skills.forEach(() => {
    const col = document.createElement('col');
    col.style.width = `${Math.floor((100 - 15) / skills.length)}%`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = el('thead');
  const headerRow = el('tr');

  const cornerTh = el('th', { className: 'matrix-th-corner' });
  cornerTh.textContent = 'Engineer';
  headerRow.appendChild(cornerTh);

  if (_bulkMode) {
    const checkTh = el('th', { className: 'matrix-th-corner', style: 'width:36px;' });
    checkTh.textContent = '\u2713';
    headerRow.appendChild(checkTh);
  }

  skills.forEach(skill => {
    const th = el('th', { className: 'matrix-th-skill' });
    const nameWrap = el('div', { className: 'matrix-th-name' });

    th.title = skill.name;

    if (skill.icon) {
      const iconSvg = getSkillIconSVG(skill.icon, 14);
      if (iconSvg) {
        const iconSpan = el('span', { style: 'margin-right:4px;display:inline-flex;vertical-align:middle;opacity:0.7;' });
        iconSpan.innerHTML = iconSvg;
        nameWrap.appendChild(iconSpan);
      }
    }
    nameWrap.appendChild(document.createTextNode(skill.name));
    th.appendChild(nameWrap);
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = el('tbody');

  engineers.forEach((engineer) => {
    const tr = el('tr', { className: 'matrix-row' });

    tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(59,130,246,.06)'; });
    tr.addEventListener('mouseleave', () => { tr.style.background = ''; });

    const nameTd = el('td', { className: 'matrix-td-name' });
    const nameSpan = el('span', { className: 'matrix-engineer-name' });
    nameSpan.textContent = engineer.name || `Engineer ${engineer.id}`;

    const drillIcon = el('span', { className: 'matrix-drill-icon' });
    const drillSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drillSvg.setAttribute('width', '11');
    drillSvg.setAttribute('height', '11');
    drillSvg.setAttribute('viewBox', '0 0 24 24');
    drillSvg.setAttribute('fill', 'none');
    drillSvg.setAttribute('stroke', 'currentColor');
    drillSvg.setAttribute('stroke-width', '2.5');
    drillSvg.setAttribute('stroke-linecap', 'round');
    drillSvg.setAttribute('stroke-linejoin', 'round');
    drillSvg.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
    drillIcon.appendChild(drillSvg);
    nameSpan.appendChild(drillIcon);
    nameTd.appendChild(nameSpan);

    nameTd.addEventListener('click', () => {
      openDrawer(engineer.id, engineer.name || `Engineer ${engineer.id}`);
    });

    nameTd.addEventListener('mouseenter', () => {
      showTooltip(nameTd, `Click to view ${engineer.name || 'engineer'}'s profile`);
    });
    nameTd.addEventListener('mouseleave', hideTooltip);

    tr.appendChild(nameTd);

    if (_bulkMode) {
      const checkTd = el('td', {
        className: 'matrix-cell',
        style: 'background:var(--bg-elevated);border:1px solid var(--border-soft);cursor:pointer;',
      });
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = _selectedEngIds.has(engineer.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          _selectedEngIds.add(engineer.id);
        } else {
          _selectedEngIds.delete(engineer.id);
        }
        if (_bulkCountEl) _bulkCountEl.textContent = `${_selectedEngIds.size} selected`;
      });
      checkTd.appendChild(checkbox);
      tr.appendChild(checkTd);
    }

    const cells = engineer.cells || {};
    skills.forEach(skill => {
      const cell = cells[String(skill.id)] || { status: 'not_in_plan', proficiency_level: null };
      const td = buildMatrixCell(cell, engineer, skill);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scrollWrap.appendChild(table);
  return scrollWrap;
}

// ─── Matrix cell ──────────────────────────────────────────────────────────────

function buildMatrixCell(cell, engineer, skill) {
  const style = getMatrixCellStyle(cell);

  const td = el('td', { className: style.cssClass });

  if (style.iconHtml) {
    const iconEl = el('span', { className: 'matrix-cell-icon' });
    iconEl.innerHTML = style.iconHtml;
    td.appendChild(iconEl);
  }

  td.addEventListener('mouseenter', () => {
    td.style.filter = 'brightness(1.18)';
    showTooltip(td, buildTooltipContent(cell, engineer, skill));
  });
  td.addEventListener('mouseleave', () => {
    td.style.filter = '';
    hideTooltip();
  });

  return td;
}

function buildTooltipContent(cell, engineer, skill) {
  const style = getMatrixCellStyle(cell);
  const levelLabels = { 1: 'Beginner', 2: 'Working Knowledge', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert' };
  let levelPart = '';
  if ((cell.status === 'developing' || cell.status === 'mastered') && cell.proficiency_level) {
    levelPart = ` \u00b7 ${levelLabels[cell.proficiency_level] || `L${cell.proficiency_level}`}`;
  }
  const stalledPart = style.stalled ? ` \u00b7 Stalled (${STALLED_DAYS}+ days)` : '';
  return `${engineer.name} \u2014 ${skill.name}\n${style.label}${levelPart}${stalledPart}`;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function buildLegend() {
  const legend = el('div', { className: 'matrix-legend' });
  MATRIX_LEGEND_ITEMS.forEach(({ kind, label }) => {
    const chip = el('div', { className: `matrix-legend-chip matrix-legend-chip--${kind}` });
    const iconHtml = getLegendIcon(kind);
    if (iconHtml) {
      const iconWrap = el('span', { className: 'matrix-legend-chip-icon' });
      iconWrap.innerHTML = iconHtml;
      chip.appendChild(iconWrap);
    }
    chip.appendChild(document.createTextNode(label));
    legend.appendChild(chip);
  });
  return legend;
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function buildSummaryRow(engineers, skills) {
  const wrap = el('div', { className: 'matrix-summary' });
  let covered = 0;
  let inDev = 0;
  let proficient = 0;

  engineers.forEach(eng => {
    const cells = eng.cells || {};
    skills.forEach(skill => {
      const cell = cells[String(skill.id)];
      if (!cell || cell.status === 'not_in_plan') return;
      covered++;
      if (cell.status === 'developing') inDev++;
      if (cell.status === 'mastered') proficient++;
    });
  });

  const totalCells = engineers.length * skills.length;
  const coverage = totalCells > 0 ? Math.round((covered / totalCells) * 100) : 0;

  const stats = [
    { label: 'Engineers', value: String(engineers.length) },
    { label: 'Skills', value: String(skills.length) },
    { label: 'Coverage', value: `${coverage}%` },
    { label: 'Developing', value: String(inDev) },
    { label: 'Mastered', value: String(proficient) },
  ];

  stats.forEach(({ label, value }) => {
    const pill = el('div', { className: 'stat-pill' });
    const strong = el('strong');
    strong.textContent = value;
    pill.appendChild(strong);
    pill.appendChild(document.createTextNode(` ${label}`));
    wrap.appendChild(pill);
  });

  return wrap;
}

// ─── Reporting tab ────────────────────────────────────────────────────────────

function buildReportingControls() {
  const controls = el('div', { className: 'mt-matrix-controls' });

  // Default date range: last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  _reportFromDate = thirtyDaysAgo.toISOString().split('T')[0];
  _reportToDate = now.toISOString().split('T')[0];

  const fromLabel = el('label', { className: 'form-label', style: 'font-size:12px;color:var(--text-muted);margin-right:4px;white-space:nowrap;align-self:center;' });
  fromLabel.textContent = 'From';
  const fromInput = el('input', {
    className: 'form-input',
    type: 'date',
    value: _reportFromDate,
    style: 'width:auto;font-size:13px;',
  });
  fromInput.addEventListener('change', () => { _reportFromDate = fromInput.value; });

  const toLabel = el('label', { className: 'form-label', style: 'font-size:12px;color:var(--text-muted);margin-right:4px;white-space:nowrap;align-self:center;' });
  toLabel.textContent = 'To';
  const toInput = el('input', {
    className: 'form-input',
    type: 'date',
    value: _reportToDate,
    style: 'width:auto;font-size:13px;',
  });
  toInput.addEventListener('change', () => { _reportToDate = toInput.value; });

  const engineerSelect = el('select', {
    className: 'form-select',
    style: 'width:auto;max-width:220px;font-size:13px;',
    id: 'mt-report-engineer',
  });
  const allOption = el('option', { value: '' });
  allOption.textContent = 'All Engineers';
  engineerSelect.appendChild(allOption);
  engineerSelect.addEventListener('change', () => { _reportEngineerId = engineerSelect.value; });

  const applyBtn = el('button', { className: 'btn btn-primary btn-sm' });
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => fetchChangeLogs());

  const spacer = el('div', { style: 'flex:1 1 auto;' });

  const analyzeBtn = el('button', {
    className: 'btn btn-primary btn-sm mt-analyze-btn',
    id: 'mt-analyze-btn',
    title: 'Generate an AI-powered progress report for the selected scope',
  });
  analyzeBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;vertical-align:middle;">' +
    '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/>' +
    '<path d="M19 14l.8 2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-1z"/>' +
    '</svg>Analyze Progress';
  analyzeBtn.addEventListener('click', () => runAnalyzeProgress(analyzeBtn));

  controls.appendChild(fromLabel);
  controls.appendChild(fromInput);
  controls.appendChild(toLabel);
  controls.appendChild(toInput);
  controls.appendChild(engineerSelect);
  controls.appendChild(applyBtn);
  controls.appendChild(spacer);
  controls.appendChild(analyzeBtn);

  return controls;
}

function renderReportingTab() {
  if (!_reportingBodyEl) return;

  // Populate engineer selector
  populateReportingEngineers();

  // Auto-fetch last 30 days
  fetchChangeLogs();
}

function populateReportingEngineers() {
  const select = document.getElementById('mt-report-engineer');
  if (!select || !_matrixData) return;
  while (select.options.length > 1) select.remove(1);
  const engineers = Array.isArray(_matrixData.engineers) ? _matrixData.engineers : [];
  engineers.forEach(eng => {
    const opt = el('option', { value: String(eng.id) });
    opt.textContent = eng.name || `Engineer ${eng.id}`;
    select.appendChild(opt);
  });
}

async function fetchChangeLogs() {
  if (!_reportingBodyEl || !_teamId) return;
  showSkeleton(_reportingBodyEl, 'list');

  let url = `/api/teams/change-logs?team_id=${_teamId}`;
  if (_reportFromDate) url += `&from_date=${_reportFromDate}`;
  if (_reportToDate) url += `&to_date=${_reportToDate}`;
  if (_reportEngineerId) url += `&engineer_id=${_reportEngineerId}`;

  try {
    const data = await api.get(url);
    _changeLogsData = data;
    renderChangeLogs(data);
  } catch (err) {
    _reportingBodyEl.innerHTML = '';
    renderErrorState(_reportingBodyEl, err.message || 'Failed to load change logs', () => fetchChangeLogs());
  }
}

// ─── AI Progress Analysis ─────────────────────────────────────────────────────

function renderMarkdownToHtml(md) {
  if (!md) return '';
  const escape = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const inline = (s) => escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Pre-process: split single-line pipe-tables (LLMs sometimes emit the whole
  // table on one line) into multi-line GFM tables so the parser below works.
  const splitInlineTables = (text) => {
    const tableRegex = /(\|[^\n|]+(?:\|[^\n|]+)+\|(?:\s*\|[^\n|]*(?:\|[^\n|]*)+\|){2,})/g;
    return text.replace(tableRegex, (match) => {
      if (match.includes('\n')) return match;
      const cells = match.split('|').map((c) => c.trim());
      if (cells.length && cells[0] === '') cells.shift();
      if (cells.length && cells[cells.length - 1] === '') cells.pop();
      const sepIdx = cells.findIndex((c) => /^:?-{3,}:?$/.test(c));
      if (sepIdx < 1) return match;
      const colCount = sepIdx;
      const rows = [];
      for (let i = 0; i < cells.length; i += colCount) {
        rows.push('| ' + cells.slice(i, i + colCount).join(' | ') + ' |');
      }
      return '\n' + rows.join('\n') + '\n';
    });
  };

  const lines = splitInlineTables(md.replace(/\r\n/g, '\n')).split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;
  let paraBuf = [];

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inline(paraBuf.join(' '))}</p>`);
      paraBuf = [];
    }
  };
  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const isTableRow = (s) => /^\s*\|.+\|\s*$/.test(s);
  const isTableSep = (s) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(s);
  const splitRow = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');

    // GFM table: header row + separator row + body rows.
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara(); closeLists();
      const headers = splitRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      const thead = `<thead><tr>${headers.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    if (!line.trim()) { flushPara(); closeLists(); continue; }

    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) {
      flushPara(); closeLists();
      const level = Math.min(h[1].length, 6);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    const ol = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ol) {
      flushPara();
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const ul = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (ul) {
      flushPara();
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushPara(); closeLists();
      out.push('<hr>');
      continue;
    }

    closeLists();
    paraBuf.push(line);
  }
  flushPara(); closeLists();
  return out.join('\n');
}

async function runAnalyzeProgress(triggerBtn) {
  if (triggerBtn && triggerBtn.disabled) return;
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.dataset.originalLabel = triggerBtn.innerHTML;
    triggerBtn.innerHTML =
      '<span class="mt-analyze-spinner" aria-hidden="true"></span>Analyzing…';
  }

  const restoreBtn = () => {
    if (triggerBtn && triggerBtn.dataset.originalLabel) {
      triggerBtn.innerHTML = triggerBtn.dataset.originalLabel;
      delete triggerBtn.dataset.originalLabel;
      triggerBtn.disabled = false;
    }
  };

  const payload = {
    team_id: _teamId,
    engineer_id: _reportEngineerId ? Number(_reportEngineerId) : null,
    from_date: _reportFromDate || null,
    to_date: _reportToDate || null,
  };

  let loadingBody = el('div', { className: 'mt-analyze-loading' });
  loadingBody.innerHTML =
    '<div class="mt-analyze-loading-spinner" aria-hidden="true"></div>' +
    '<h4>Generating progress report…</h4>' +
    '<p class="mt-analyze-loading-status">Collecting plan data and change history.</p>' +
    '<p class="mt-analyze-loading-hint">This usually takes 10-40 seconds.</p>';

  showModal({
    title: 'AI Progress Analysis',
    body: loadingBody,
    actions: [{ label: 'Cancel', value: 'cancel', className: 'btn btn-secondary' }],
    modalClass: 'mt-analyze-modal',
  });

  const statusEl = loadingBody.querySelector('.mt-analyze-loading-status');
  const statusMessages = [
    'Collecting plan data and change history…',
    'Summarizing skill backlog…',
    'Asking the LLM to draft the report…',
    'Polishing the markdown output…',
  ];
  let statusIdx = 0;
  const statusTimer = setInterval(() => {
    statusIdx = (statusIdx + 1) % statusMessages.length;
    if (statusEl) statusEl.textContent = statusMessages[statusIdx];
  }, 4000);

  try {
    const result = await api.post('/api/reporting/analyze', payload);
    clearInterval(statusTimer);
    renderAnalyzeResult(result);
  } catch (err) {
    clearInterval(statusTimer);
    renderAnalyzeError(err.message || 'Failed to generate report');
  } finally {
    restoreBtn();
  }
}

function renderAnalyzeError(message) {
  const body = el('div', { className: 'mt-analyze-error' });
  body.innerHTML =
    '<div class="mt-analyze-error-icon" aria-hidden="true">⚠</div>' +
    `<h4>Unable to generate report</h4><p>${escapeHtml(message)}</p>`;
  showModal({
    title: 'AI Progress Analysis',
    body,
    actions: [{ label: 'Close', value: 'close', className: 'btn btn-secondary' }],
    modalClass: 'mt-analyze-modal',
  });
}

function renderAnalyzeResult(result) {
  const wrap = el('div', { className: 'mt-analyze-result' });

  const targetName = result?.target_name || 'Team';
  const period = [];
  if (result?.from_date) period.push(`from ${result.from_date}`);
  if (result?.to_date) period.push(`to ${result.to_date}`);
  const periodText = period.length ? period.join(' ') : 'No date range applied';

  const generatedAt = result?.generated_at
    ? new Date(result.generated_at).toLocaleString()
    : '—';
  const generatedBy = result?.generated_by || '—';

  const header = el('div', { className: 'mt-analyze-result-header' });
  header.innerHTML =
    `<div class="mt-analyze-result-title">${escapeHtml(targetName)}</div>` +
    `<div class="mt-analyze-result-meta">${escapeHtml(periodText)} • Generated ${escapeHtml(generatedAt)} • By ${escapeHtml(generatedBy)}</div>`;

  const content = el('div', { className: 'mt-analyze-result-content markdown-body' });
  content.innerHTML = renderMarkdownToHtml(result?.markdown || '');

  wrap.appendChild(header);
  wrap.appendChild(content);

  let exporting = false;

  showModal({
    title: 'AI Progress Analysis',
    body: wrap,
    actions: [
      { label: 'Close', value: 'close', className: 'btn btn-secondary' },
      { label: 'Export to PDF', value: 'pdf', className: 'btn btn-primary mt-analyze-pdf-btn' },
    ],
    modalClass: 'mt-analyze-modal mt-analyze-modal--result',
  }).then(async (choice) => {
    if (choice !== 'pdf' || exporting) return;
    exporting = true;
    await exportAnalyzeToPdf(result);
  });
}

async function exportAnalyzeToPdf(result) {
  try {
    const token = localStorage.getItem('matrixpro_token');
    const body = {
      markdown: result.markdown,
      target_name: result.target_name,
      from_date: result.from_date,
      to_date: result.to_date,
      generated_at: result.generated_at,
      generated_by: result.generated_by,
    };
    const res = await fetch(`${API_BASE}/api/reporting/analyze/pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `PDF export failed (${res.status})`);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safeName = (result.target_name || 'report').replace(/\s+/g, '_');
    a.download = `progress-analysis-${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast({ message: 'PDF downloaded', type: 'success' });
  } catch (err) {
    showToast({ message: err.message || 'PDF export failed', type: 'error' });
  }
}

function renderChangeLogs(data) {
  if (!_reportingBodyEl) return;
  _reportingBodyEl.innerHTML = '';

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  if (entries.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No changes found for the selected period.';
    _reportingBodyEl.appendChild(empty);
    return;
  }

  // ─── Category KPI strip ────────────────────────────────────────────────
  const catCounts = {};
  CATEGORY_ORDER.forEach(slug => { catCounts[slug] = 0; });
  catCounts[UNCATEGORIZED_SLUG] = 0;
  entries.forEach(entry => {
    const cats = Array.isArray(entry.categories) ? entry.categories : [];
    if (cats.length === 0) {
      catCounts[UNCATEGORIZED_SLUG] += 1;
    } else {
      const seen = new Set();
      cats.forEach(c => {
        const slug = _normalizeCategorySlug(c?.slug);
        if (!seen.has(slug)) {
          catCounts[slug] = (catCounts[slug] || 0) + 1;
          seen.add(slug);
        }
      });
    }
  });

  const kpiGrid = el('div', { className: 'mt-kpi-grid mt-kpi-grid--category', style: 'margin-bottom:16px;' });
  CATEGORY_ORDER.forEach(slug => {
    const label = CATEGORY_LABEL_FALLBACK[slug] || slug;
    const card = el('div', { className: `mt-kpi-card mt-kpi-card--${slug}`, 'data-category': slug });
    const labelEl = el('div', { className: 'mt-kpi-label' });
    labelEl.textContent = label;
    const valueEl = el('div', { className: 'mt-kpi-value' });
    valueEl.textContent = String(catCounts[slug] || 0);
    const subEl = el('div', { className: 'mt-kpi-sub' });
    subEl.textContent = (catCounts[slug] || 0) === 1 ? 'change' : 'changes';
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(subEl);
    kpiGrid.appendChild(card);
  });
  if (catCounts[UNCATEGORIZED_SLUG] > 0) {
    const card = el('div', { className: 'mt-kpi-card mt-kpi-card--uncategorized', 'data-category': UNCATEGORIZED_SLUG });
    const labelEl = el('div', { className: 'mt-kpi-label' });
    labelEl.textContent = UNCATEGORIZED_LABEL;
    const valueEl = el('div', { className: 'mt-kpi-value' });
    valueEl.textContent = String(catCounts[UNCATEGORIZED_SLUG]);
    const subEl = el('div', { className: 'mt-kpi-sub' });
    subEl.textContent = catCounts[UNCATEGORIZED_SLUG] === 1 ? 'change' : 'changes';
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(subEl);
    kpiGrid.appendChild(card);
  }
  _reportingBodyEl.appendChild(kpiGrid);

  // ─── Summary bar (total + audit + training pills) ──────────────────────
  const summaryBar = el('div', { className: 'matrix-summary', style: 'margin-bottom:16px;' });
  const totalPill = el('div', { className: 'stat-pill' });
  const totalStrong = el('strong');
  totalStrong.textContent = String(entries.length);
  totalPill.appendChild(totalStrong);
  totalPill.appendChild(document.createTextNode(' Total Changes'));
  summaryBar.appendChild(totalPill);

  const auditCount = entries.filter(e => e.type === 'audit').length;
  const trainingCount = entries.filter(e => e.type === 'training').length;
  if (auditCount > 0) {
    const auditPill = el('div', { className: 'stat-pill' });
    const auditStrong = el('strong');
    auditStrong.textContent = String(auditCount);
    auditPill.appendChild(auditStrong);
    auditPill.appendChild(document.createTextNode(' Audit'));
    summaryBar.appendChild(auditPill);
  }
  if (trainingCount > 0) {
    const trainPill = el('div', { className: 'stat-pill' });
    const trainStrong = el('strong');
    trainStrong.textContent = String(trainingCount);
    trainPill.appendChild(trainStrong);
    trainPill.appendChild(document.createTextNode(' Training'));
    summaryBar.appendChild(trainPill);
  }
  _reportingBodyEl.appendChild(summaryBar);

  // ─── Category-grouped feed ─────────────────────────────────────────────
  const sectionEntries = {};
  CATEGORY_ORDER.forEach(slug => { sectionEntries[slug] = []; });
  sectionEntries[UNCATEGORIZED_SLUG] = [];
  entries.forEach(entry => {
    const cats = Array.isArray(entry.categories) ? entry.categories : [];
    if (cats.length === 0) {
      sectionEntries[UNCATEGORIZED_SLUG].push(entry);
    } else {
      const seen = new Set();
      cats.forEach(c => {
        const slug = _normalizeCategorySlug(c?.slug);
        if (!seen.has(slug) && sectionEntries[slug]) {
          sectionEntries[slug].push(entry);
          seen.add(slug);
        }
      });
    }
  });

  const sectionOrder = [...CATEGORY_ORDER, UNCATEGORIZED_SLUG];
  sectionOrder.forEach(slug => {
    const slugEntries = sectionEntries[slug] || [];
    if (slugEntries.length === 0) return;
    const label = slug === UNCATEGORIZED_SLUG
      ? UNCATEGORIZED_LABEL
      : (CATEGORY_LABEL_FALLBACK[slug] || slug);
    const accent = CATEGORY_ACCENT[slug] || 'var(--text-muted)';

    const section = el('div', { className: 'mt-matrix-section', 'data-category': slug, style: 'margin-bottom:20px;' });
    const sectionHeader = el('div', { className: 'mt-matrix-section__header' });
    const dot = el('span', { className: 'mt-matrix-section__dot' });
    dot.style.background = accent;
    const sectionLabel = el('span', { className: 'mt-matrix-section__title' });
    sectionLabel.textContent = label;
    const sectionCount = el('span', { className: 'mt-matrix-section__count' });
    sectionCount.textContent = String(slugEntries.length);
    sectionHeader.appendChild(dot);
    sectionHeader.appendChild(sectionLabel);
    sectionHeader.appendChild(sectionCount);
    section.appendChild(sectionHeader);

    const skillGroups = {};
    slugEntries.forEach(entry => {
      const key = entry.skill_name || 'General';
      if (!skillGroups[key]) skillGroups[key] = [];
      skillGroups[key].push(entry);
    });

    Object.entries(skillGroups).forEach(([skillName, groupEntries]) => {
      const card = el('div', { className: 'mt-dash-card', style: 'margin-bottom:12px;' });

      const cardHeader = el('div', { className: 'mt-dash-card-header', style: 'cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between;' });
      const headerLeft = el('div', { style: 'display:flex;align-items:center;gap:8px;' });
      const chevronSpan = el('span', { style: 'display:inline-flex;transition:transform 0.2s;' });
      chevronSpan.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      const nameSpan = el('span');
      nameSpan.textContent = skillName;
      headerLeft.appendChild(chevronSpan);
      headerLeft.appendChild(nameSpan);

      const countBadge = el('span', {
        style: 'background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:9999px;font-size:11px;padding:1px 8px;color:var(--text-muted);',
      });
      countBadge.textContent = String(groupEntries.length);

      cardHeader.appendChild(headerLeft);
      cardHeader.appendChild(countBadge);

      const cardBody = el('div', { className: 'mt-dash-card-body' });

      let collapsed = false;
      cardHeader.addEventListener('click', () => {
        collapsed = !collapsed;
        cardBody.style.display = collapsed ? 'none' : 'block';
        chevronSpan.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
      });

      groupEntries.forEach(entry => {
        const item = el('div', { className: 'mt-activity-item' });

        const avatar = el('div', { className: 'mt-activity-avatar' });
        if (entry.type === 'training') {
          avatar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
          avatar.style.background = 'rgba(59,130,246,.15)';
          avatar.style.color = 'var(--accent)';
        } else {
          avatar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
          avatar.style.background = 'rgba(245,158,11,.15)';
          avatar.style.color = 'var(--warning)';
        }

        const body = el('div', { className: 'mt-activity-body' });
        const text = el('div', { className: 'mt-activity-text' });

        const engineerName = entry.engineer_name || entry.changed_by || 'Unknown';

        if (entry.type === 'training') {
          const title = entry.title || 'Training completed';
          const notes = entry.notes ? ` \u2014 ${entry.notes}` : '';
          text.innerHTML = `<strong>${escapeHtml(engineerName)}</strong> ${escapeHtml(title)}${escapeHtml(notes)}`;
        } else {
          const field = entry.field || '';
          const oldVal = entry.old_value || '\u2014';
          const newVal = entry.new_value || '\u2014';
          const changedBy = entry.changed_by || engineerName;
          if (field) {
            text.innerHTML = `<strong>${escapeHtml(changedBy)}</strong> changed <em>${escapeHtml(field)}</em>: ${escapeHtml(oldVal)} \u2192 ${escapeHtml(newVal)}`;
          } else {
            text.innerHTML = `<strong>${escapeHtml(changedBy)}</strong> made a change`;
          }
        }

        const time = el('div', { className: 'mt-activity-time' });
        time.textContent = relativeTime(entry.date);

        body.appendChild(text);
        body.appendChild(time);
        item.appendChild(avatar);
        item.appendChild(body);
        cardBody.appendChild(item);
      });

      card.appendChild(cardHeader);
      card.appendChild(cardBody);
      section.appendChild(card);
    });

    _reportingBodyEl.appendChild(section);
  });
}

// ─── Engineer drawer ──────────────────────────────────────────────────────────

function buildDrawerElements() {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const overlay = el('div', { className: 'drawer-overlay' });
  const drawer = el('div', { className: 'drawer' });

  const drawerHeader = el('div', { className: 'drawer-header' });
  const drawerTitle = el('h3', { style: 'margin:0;font-size:16px;font-weight:600;color:var(--text-primary);' });
  drawerTitle.textContent = 'Engineer Profile';
  const drawerClose = el('button', { className: 'drawer-close', 'aria-label': 'Close drawer' });
  drawerClose.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  drawerClose.addEventListener('click', closeDrawer);
  drawerHeader.appendChild(drawerTitle);
  drawerHeader.appendChild(drawerClose);
  drawer.appendChild(drawerHeader);

  const drawerBody = el('div', { className: 'drawer-body' });
  drawer.dataset.bodyRef = 'true';
  drawer.appendChild(drawerBody);

  overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeDrawer();
  });

  modalRoot.appendChild(overlay);
  modalRoot.appendChild(drawer);

  _drawerEl = drawer;
  _drawerOverlay = overlay;
}

async function openDrawer(engineerId, engineerName) {
  if (!_drawerEl || !_drawerOverlay) return;

  _drawerOverlay.classList.add('open');
  _drawerEl.classList.add('open');

  const drawerBody = _drawerEl.querySelector('.drawer-body');
  if (!drawerBody) return;

  showSkeleton(drawerBody, 'list');

  try {
    const plan = await api.get(`/api/plans/${engineerId}`);
    drawerBody.innerHTML = '';
    renderDrawerContent(drawerBody, engineerId, engineerName, plan);
  } catch (err) {
    drawerBody.innerHTML = '';
    const errEl = el('div', { className: 'empty-state empty-state--compact' });
    errEl.textContent = err.message || 'Failed to load engineer profile';
    const retryBtn = el('button', { className: 'btn btn-secondary btn-sm', style: 'margin-top:12px;' });
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => openDrawer(engineerId, engineerName));
    drawerBody.appendChild(errEl);
    drawerBody.appendChild(retryBtn);
  }
}

function renderDrawerContent(drawerBody, engineerId, engineerName, plan) {
  // Engineer header
  const engHeader = el('div', { className: 'drawer-eng-header' });
  const avatar = el('div', { className: 'drawer-eng-avatar' });
  avatar.textContent = getInitials(engineerName);
  avatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)';
  const meta = el('div', { className: 'drawer-eng-meta' });
  const nameEl = el('div', { className: 'drawer-eng-name' });
  nameEl.textContent = engineerName;
  const roleEl = el('div', { className: 'drawer-eng-role' });
  roleEl.textContent = 'Engineer';
  const viewLink = el('a', {
    href: `#/my-plan/${engineerId}`,
    style: 'font-size:13px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:6px;',
  });
  viewLink.textContent = 'View Full Plan \u2192';
  viewLink.addEventListener('click', closeDrawer);
  meta.appendChild(nameEl);
  meta.appendChild(roleEl);
  meta.appendChild(viewLink);
  engHeader.appendChild(avatar);
  engHeader.appendChild(meta);
  drawerBody.appendChild(engHeader);

  // Skills progress
  const skills = Array.isArray(plan.skills) ? plan.skills : [];

  const progressSection = el('div', { className: 'drawer-section' });
  const progressTitle = el('div', { className: 'drawer-section-title' });
  progressTitle.textContent = 'Skills Progress';
  progressSection.appendChild(progressTitle);

  if (skills.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No skills in plan yet';
    progressSection.appendChild(empty);
  } else {
    skills.forEach(planSkill => {
      const item = el('div', { className: 'drawer-progress-item' });
      const skillName = el('div', { className: 'drawer-progress-name' });
      skillName.textContent = planSkill.skill_name || 'Unknown';
      const barWrap = el('div', { className: 'drawer-progress-bar' });
      const statusPct = planSkill.status === 'planned' ? 25 : planSkill.status === 'developing' ? 60 : 100;
      const barFill = el('div', { className: 'drawer-progress-fill', style: `width:${statusPct}%;` });
      barWrap.appendChild(barFill);
      const statusSlug = ['planned', 'developing', 'mastered'].includes(planSkill.status)
        ? planSkill.status
        : 'unknown';
      const statusChip = el('span', {
        className: `drawer-progress-status status-chip status-chip--${statusSlug}`,
      });
      statusChip.textContent = planSkill.status === 'planned' ? 'Planned' : planSkill.status === 'developing' ? 'Developing' : 'Mastered';
      item.appendChild(skillName);
      item.appendChild(barWrap);
      item.appendChild(statusChip);
      progressSection.appendChild(item);
    });
  }

  drawerBody.appendChild(progressSection);

  // Recent training timeline
  const allLogs = [];
  skills.forEach(planSkill => {
    const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    logs.forEach(log => allLogs.push({ ...log, skill_name: planSkill.skill_name || 'Unknown' }));
  });

  allLogs.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
  const recentLogs = allLogs.slice(0, 5);

  const timelineSection = el('div', { className: 'drawer-section' });
  const timelineTitle = el('div', { className: 'drawer-section-title' });
  timelineTitle.textContent = 'Recent Training';
  timelineSection.appendChild(timelineTitle);

  if (recentLogs.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No training logs yet';
    timelineSection.appendChild(empty);
  } else {
    recentLogs.forEach(log => {
      const item = el('div', { className: 'drawer-timeline-item' });
      const dot = el('div', { className: 'drawer-timeline-dot' });
      const textEl = el('div', { className: 'drawer-timeline-text' });
      textEl.textContent = `${log.skill_name} \u2014 ${log.description || 'Training completed'}`;
      const dateEl = el('div', { className: 'drawer-timeline-date' });
      dateEl.textContent = relativeTime(log.completed_at);
      item.appendChild(dot);
      item.appendChild(textEl);
      item.appendChild(dateEl);
      timelineSection.appendChild(item);
    });
  }

  drawerBody.appendChild(timelineSection);

  // Skill distribution radar
  if (skills.length > 0) {
    const radarSection = el('div', { className: 'drawer-section' });
    const radarTitle = el('div', { className: 'drawer-section-title' });
    radarTitle.textContent = 'Skill Distribution';
    radarSection.appendChild(radarTitle);
    const radarEl = el('div', { style: 'height:220px;' });
    radarSection.appendChild(radarEl);
    drawerBody.appendChild(radarSection);

    requestAnimationFrame(() => {
      if (typeof echarts === 'undefined') return;
      const skillsWithLevel = skills.filter(s => s.proficiency_level || s.status !== 'not_in_plan');
      if (skillsWithLevel.length === 0) return;
      const cc = _getChartColors();
      const chart = echarts.init(radarEl, cc.theme);
      const option = {
        backgroundColor: 'transparent',
        radar: {
          shape: 'polygon',
          splitNumber: 4,
          indicator: skillsWithLevel.map(s => ({
            name: (s.skill_name || '').length > 12 ? (s.skill_name || '').slice(0, 10) + '\u2026' : (s.skill_name || 'Skill'),
            max: 100,
          })),
          splitArea: { areaStyle: { color: cc.splitColors } },
          axisLine: { lineStyle: { color: cc.gridColor, width: 1 } },
          splitLine: { lineStyle: { color: cc.gridColor, width: 1 } },
          name: { textStyle: { color: cc.textMuted, fontSize: 10 } },
        },
        series: [{
          type: 'radar',
          data: [{
            value: skillsWithLevel.map(s => {
              const lvl = s.proficiency_level;
              if (lvl === 1) return 33;
              if (lvl === 2) return 66;
              if (lvl === 3) return 100;
              if (s.status === 'planned') return 15;
              if (s.status === 'developing') return 50;
              if (s.status === 'mastered') return 100;
              return 0;
            }),
            areaStyle: { opacity: 0.15, color: _cssVar('--cat-advanced-accent', '#3b82f6') },
            lineStyle: { color: _cssVar('--cat-advanced-accent', '#3b82f6'), width: 2 },
            itemStyle: { color: _cssVar('--cat-advanced-accent', '#3b82f6') },
          }],
        }],
      };
      chart.setOption(option);
      _charts.push(chart);
    });
  }
}

function closeDrawer() {
  if (_drawerEl) _drawerEl.classList.remove('open');
  if (_drawerOverlay) _drawerOverlay.classList.remove('open');
}

// ─── Bulk assign modal ────────────────────────────────────────────────────────

async function openBulkAssignModal() {
  const selectedIds = Array.from(_selectedEngIds);
  const selectedNames = selectedIds.map(id => {
    const eng = _matrixData?.engineers?.find(e => e.id === id);
    return eng?.name || `Engineer ${id}`;
  });

  let catalogSkills = [];
  try {
    catalogSkills = await api.get('/api/skills/');
  } catch (_e) {
    showToast('Failed to load skill catalog', 'error');
    return;
  }

  const activeSkills = Array.isArray(catalogSkills) ? catalogSkills.filter(s => !s.is_archived) : [];

  const bodyEl = el('div');

  const skillGroup = el('div', { className: 'form-group' });
  const skillLabel = el('label', { className: 'form-label' });
  skillLabel.textContent = 'Skill to assign';
  const skillSelect = el('select', { className: 'form-select' });
  const skillPlaceholder = el('option', { value: '' });
  skillPlaceholder.textContent = '\u2014 Select a skill \u2014';
  skillSelect.appendChild(skillPlaceholder);
  activeSkills.forEach(s => {
    const opt = el('option', { value: String(s.id) });
    opt.textContent = s.name;
    skillSelect.appendChild(opt);
  });
  skillGroup.appendChild(skillLabel);
  skillGroup.appendChild(skillSelect);

  const statusGroup = el('div', { className: 'form-group' });
  const statusLabel = el('label', { className: 'form-label' });
  statusLabel.textContent = 'Initial status';
  const statusSelect = el('select', { className: 'form-select' });
  [{ value: 'planned', label: 'Planned' }, { value: 'developing', label: 'Developing' }].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);

  const summaryEl = el('div', {
    style: 'font-size:13px;color:var(--text-secondary);margin-bottom:12px;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-soft);',
  });
  const updateSummary = () => {
    const skillOpt = skillSelect.options[skillSelect.selectedIndex];
    const skillName = skillOpt?.value ? skillOpt.textContent : '(no skill selected)';
    summaryEl.textContent = `Assign "${skillName}" to ${selectedIds.length} engineer${selectedIds.length !== 1 ? 's' : ''}: ${selectedNames.join(', ')}`;
  };
  skillSelect.addEventListener('change', updateSummary);
  updateSummary();

  const notesGroup = el('div', { className: 'form-group' });
  const notesLabel = el('label', { className: 'form-label' });
  notesLabel.textContent = 'Notes (optional)';
  const notesInput = el('textarea', { className: 'form-input', rows: '2', placeholder: 'Optional notes...' });
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesInput);

  bodyEl.appendChild(skillGroup);
  bodyEl.appendChild(statusGroup);
  bodyEl.appendChild(summaryEl);
  bodyEl.appendChild(notesGroup);

  showModal({
    title: 'Bulk Assign Skill',
    body: bodyEl,
    confirmText: 'Assign',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const skillId = Number(skillSelect.value);
      if (!skillId) {
        showToast('Please select a skill', 'warning');
        return;
      }
      const skillName = skillSelect.options[skillSelect.selectedIndex]?.textContent || 'Skill';
      const status = statusSelect.value || 'planned';
      const notes = notesInput.value.trim() || null;

      try {
        await api.post('/api/plans/bulk-assign', {
          engineer_ids: selectedIds,
          skill_id: skillId,
          status,
          notes,
          skip_existing: true,
        });
        showToast(`Assigned "${skillName}" to ${selectedIds.length} engineer${selectedIds.length !== 1 ? 's' : ''}`, 'success');
        _bulkMode = false;
        _selectedEngIds = new Set();
        if (_bulkBarEl) _bulkBarEl.style.display = 'none';
        await loadAllData(_teamId);
      } catch (err) {
        showToast(err.message || 'Bulk assign failed', 'error');
      }
    },
  });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function buildTooltip() {
  if (_tooltipEl) return;
  const tip = document.createElement('div');
  tip.id = 'team-matrix-tooltip';
  tip.className = 'matrix-tooltip';
  document.body.appendChild(tip);
  _tooltipEl = tip;
}

function showTooltip(_el, content) {
  if (!_tooltipEl) return;
  _tooltipEl.textContent = content;
  _tooltipEl.style.opacity = '1';
  _tooltipEl.style.left = `${_mouseX + 14}px`;
  _tooltipEl.style.top = `${_mouseY + 14}px`;
}

function hideTooltip() {
  if (!_tooltipEl) return;
  _tooltipEl.style.opacity = '0';
}

// ─── Empty / error states ─────────────────────────────────────────────────────

function renderEmptyState(container) {
  const state = el('div', { className: 'empty-state' });
  const icon = el('div', { className: 'empty-state-icon' });
  icon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const title = el('h3');
  title.textContent = 'No Direct Reports';
  const desc = el('p');
  desc.textContent = "You don't have any engineers reporting to you yet.";
  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(desc);
  container.appendChild(state);
}

function renderErrorState(container, msg, retryFn) {
  container.innerHTML = '';
  const state = el('div', { className: 'empty-state empty-state--error' });
  const icon = el('div', { className: 'empty-state-icon' });
  icon.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const title = el('div', { className: 'empty-state-title' });
  title.textContent = 'Failed to load team data';
  const descEl = el('div', { className: 'empty-state-desc' });
  descEl.textContent = msg || 'Please try refreshing.';
  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(descEl);
  if (typeof retryFn === 'function') {
    const retryBtn = el('button', { className: 'btn btn-primary btn-sm' });
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', retryFn);
    state.appendChild(retryBtn);
  }
  container.appendChild(state);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function animateCountUp(target, value, suffix) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || value === 0) {
    target.textContent = String(value) + (suffix || '');
    return;
  }
  const duration = 800;
  const start = performance.now();
  function tick(now) {
    const elapsed = Math.min(now - start, duration);
    const progress = 1 - Math.pow(1 - elapsed / duration, 3);
    target.textContent = String(Math.round(value * progress)) + (suffix || '');
    if (elapsed < duration) requestAnimationFrame(tick);
    else target.textContent = String(value) + (suffix || '');
  }
  requestAnimationFrame(tick);
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatActivityTitle(raw, skillName) {
  const skill = skillName ? ` on <em>${escapeHtml(skillName)}</em>` : '';
  if (!raw) return skill || '';

  const lower = raw.toLowerCase();
  if (lower.startsWith('proficiency_level:')) {
    const lvl = raw.split(':')[1]?.trim() || '';
    return `set proficiency to level ${escapeHtml(lvl)}${skill}`;
  }
  if (lower.startsWith('status:')) {
    const st = raw.split(':')[1]?.trim().replace(/_/g, ' ') || '';
    return `moved to <em>${escapeHtml(st)}</em>${skill}`;
  }
  if (lower.startsWith('training_log:')) {
    const msg = raw.slice('training_log:'.length).trim();
    return `${escapeHtml(msg)}${skill}`;
  }
  if (lower.startsWith('completed:')) {
    const val = raw.slice('completed:'.length).trim().toLowerCase();
    if (val === 'true') return `completed a training${skill}`;
    if (val === 'false') return `uncompleted a training${skill}`;
    return `completed ${escapeHtml(raw.slice('completed:'.length).trim())}${skill}`;
  }

  if (raw.includes('Moved from') || raw.includes('Added to plan')) {
    return escapeHtml(raw);
  }

  return `${escapeHtml(raw)}${skill}`;
}

function isStagnant(cell) {
  return isStalled(cell);
}

async function downloadExport(url, filename) {
  try {
    const token = localStorage.getItem('matrixpro_token');
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (err) {
    showToast(err.message || 'Export failed', 'error');
  }
}
