import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { createElement } from '../utils/dom.js';

// ─── Module state ─────────────────────────────────────────────────────────────

let _container = null;
let _teamId = null;
let _matrixData = null;
let _statsData = null;
let _activityData = null;
let _visibleSkillIds = null;
let _searchQuery = '';
let _bulkMode = false;
let _selectedEngIds = new Set();
let _charts = [];
let _resizeHandler = null;
let _tooltipEl = null;
let _drawerEl = null;
let _drawerOverlay = null;

// ─── Tab panel element references ────────────────────────────────────────────

let _tabPanels = {};
let _tabButtons = {};
let _tabLoaded = {};
let _activeTab = 'summary';
let _matrixBodyEl = null;
let _summaryBodyEl = null;
let _analysisBodyEl = null;
let _bulkBarEl = null;
let _bulkCountEl = null;

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
  _visibleSkillIds = null;
  _searchQuery = '';
  _bulkMode = false;
  _selectedEngIds = new Set();
  _charts = [];
  _resizeHandler = null;
  _tabPanels = {};
  _tabButtons = {};
  _tabLoaded = {};
  _activeTab = Store.get('myTeamTab') || 'summary';
  _matrixBodyEl = null;
  _summaryBodyEl = null;
  _analysisBodyEl = null;
  _bulkBarEl = null;
  _bulkCountEl = null;

  buildTooltip();
  buildDrawerElements();
  buildPageShell(container);

  const user = Store.get('user');
  if (user?.role === 'admin') {
    loadAdminTeamSelector();
  } else {
    loadAllData(null);
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

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadAllData(teamId) {
  _teamId = teamId;

  if (_summaryBodyEl) showSkeleton(_summaryBodyEl, 'cards');
  if (_matrixBodyEl) showSkeleton(_matrixBodyEl, 'table');
  if (_analysisBodyEl) showSkeleton(_analysisBodyEl, 'list');

  const matrixUrl = teamId ? `/api/teams/matrix?team_id=${teamId}` : '/api/teams/matrix';
  const statsUrl = teamId ? `/api/teams/stats?team_id=${teamId}` : '/api/teams/stats';
  const activityUrl = teamId ? `/api/teams/activity?team_id=${teamId}&limit=20` : '/api/teams/activity?limit=20';

  try {
    const [matrix, stats, activity] = await Promise.all([
      api.get(matrixUrl),
      api.get(statsUrl).catch(() => null),
      api.get(activityUrl).catch(() => ({ items: [] })),
    ]);

    _matrixData = matrix;
    _statsData = stats;
    _activityData = activity;
    _visibleSkillIds = null;
    _tabLoaded = {};

    renderActiveTab();
  } catch (err) {
    const msg = err.message || 'Failed to load team data';
    showToast(msg, 'error');
    if (_summaryBodyEl) renderErrorState(_summaryBodyEl, msg, () => loadAllData(teamId));
    if (_matrixBodyEl) renderErrorState(_matrixBodyEl, msg, () => loadAllData(teamId));
    if (_analysisBodyEl) renderErrorState(_analysisBodyEl, msg, () => loadAllData(teamId));
  }
}

async function loadAdminTeamSelector() {
  try {
    const teams = await api.get('/api/teams/');
    if (!_summaryBodyEl) return;

    const selectorWrap = createElement('div', {
      style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:64px 24px;',
    });

    const label = createElement('p', {
      style: 'font-size:15px;color:var(--text-secondary);',
    });
    label.textContent = 'Select a team to view its management dashboard:';

    const select = createElement('select', {
      className: 'form-select',
      style: 'width:auto;min-width:260px;font-size:14px;',
    });

    const placeholder = createElement('option', { value: '' });
    placeholder.textContent = '— Choose a team —';
    select.appendChild(placeholder);

    teams.forEach(t => {
      const opt = createElement('option', { value: String(t.id) });
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const tid = select.value;
      if (tid) loadAllData(Number(tid));
    });

    selectorWrap.appendChild(label);
    selectorWrap.appendChild(select);

    if (_summaryBodyEl) {
      _summaryBodyEl.innerHTML = '';
      _summaryBodyEl.appendChild(selectorWrap);
    }
    if (_matrixBodyEl) {
      _matrixBodyEl.innerHTML = '';
      _matrixBodyEl.appendChild(selectorWrap.cloneNode(true));
      const clonedSelect = _matrixBodyEl.querySelector('select');
      if (clonedSelect) {
        clonedSelect.addEventListener('change', () => {
          const tid = clonedSelect.value;
          if (tid) loadAllData(Number(tid));
        });
      }
    }
    if (_analysisBodyEl) {
      _analysisBodyEl.innerHTML = '';
    }
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
  }
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', { className: 'mp-wrapper' });

  const header = createElement('div', { className: 'mp-header' });
  const headerText = createElement('div', { className: 'mp-header-text' });
  const title = createElement('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('My Team '));
  const gradientSpan = createElement('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Command Center';
  title.appendChild(gradientSpan);
  const subtitle = createElement('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Team analytics, skills matrix, and development tracking';
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);
  wrapper.appendChild(header);

  const tabBar = createElement('div', {
    className: 'skill-detail-tabs',
    role: 'tablist',
    'aria-label': 'Team management tabs',
  });

  const tabDefs = [
    { name: 'summary', label: 'Summary' },
    { name: 'matrix', label: 'Matrix' },
    { name: 'analysis', label: 'Analysis' },
  ];

  tabDefs.forEach(({ name, label }) => {
    const btn = createElement('button', {
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

  const summaryPanel = createElement('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'summary' ? 'display:block' : 'display:none',
  });
  _summaryBodyEl = createElement('div', { className: 'mt-summary-body' });
  summaryPanel.appendChild(_summaryBodyEl);
  _tabPanels['summary'] = summaryPanel;

  const matrixPanel = createElement('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'matrix' ? 'display:block' : 'display:none',
  });
  const matrixControls = buildMatrixControls();
  matrixPanel.appendChild(matrixControls);
  _bulkBarEl = buildBulkBar();
  matrixPanel.appendChild(_bulkBarEl);
  _matrixBodyEl = createElement('div', { className: 'mt-matrix-body' });
  matrixPanel.appendChild(_matrixBodyEl);
  _tabPanels['matrix'] = matrixPanel;

  const analysisPanel = createElement('div', {
    className: 'skill-detail-tab-panel',
    role: 'tabpanel',
    style: _activeTab === 'analysis' ? 'display:block' : 'display:none',
  });
  _analysisBodyEl = createElement('div', { className: 'mt-analysis-body' });
  analysisPanel.appendChild(_analysisBodyEl);
  _tabPanels['analysis'] = analysisPanel;

  wrapper.appendChild(summaryPanel);
  wrapper.appendChild(matrixPanel);
  wrapper.appendChild(analysisPanel);

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
  if (tabName === 'summary') {
    renderSummaryTab();
    _tabLoaded['summary'] = true;
  } else if (tabName === 'matrix') {
    renderMatrixTab();
    _tabLoaded['matrix'] = true;
  } else if (tabName === 'analysis') {
    renderAnalysisTab();
    _tabLoaded['analysis'] = true;
  }
}

// ─── Summary tab ─────────────────────────────────────────────────────────────

function renderSummaryTab() {
  if (!_summaryBodyEl) return;
  _summaryBodyEl.innerHTML = '';

  const kpiGrid = createElement('div', { className: 'mt-kpi-grid' });

  const coveragePct = _statsData?.coverage_pct ?? 0;
  const criticalGaps = _statsData?.critical_gaps ?? 0;
  const activeDev = _statsData?.active_developments ?? 0;
  const completions30d = _statsData?.completions_30d ?? 0;
  const totalEngineers = _statsData?.total_engineers ?? (_matrixData?.engineers?.length ?? 0);
  const totalSkills = _statsData?.total_skills ?? (_matrixData?.skills?.length ?? 0);

  const kpiDefs = [
    { label: 'Team Coverage', value: coveragePct, suffix: '%', sub: `${totalEngineers} engineers · ${totalSkills} skills`, variant: 'accent' },
    { label: 'Critical Gaps', value: criticalGaps, suffix: '', sub: 'Skills below 30% coverage', variant: 'danger' },
    { label: 'Active Developments', value: activeDev, suffix: '', sub: 'Skills in progress', variant: 'warning' },
    { label: '30-day Completions', value: completions30d, suffix: '', sub: 'Achieved proficiency', variant: 'success' },
  ];

  kpiDefs.forEach(({ label, value, suffix, sub, variant }) => {
    const card = createElement('div', { className: `mt-kpi-card mt-kpi-card--${variant}` });
    const labelEl = createElement('div', { className: 'mt-kpi-label' });
    labelEl.textContent = label;
    const valueEl = createElement('div', { className: 'mt-kpi-value' });
    valueEl.textContent = '0' + suffix;
    const subEl = createElement('div', { className: 'mt-kpi-sub' });
    subEl.textContent = sub;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    card.appendChild(subEl);
    kpiGrid.appendChild(card);
    animateCountUp(valueEl, value, suffix);
  });

  _summaryBodyEl.appendChild(kpiGrid);

  const dashCols = createElement('div', { className: 'mt-dash-cols' });

  const radarCard = createElement('div', { className: 'mt-dash-card' });
  radarCard.style.flex = '3';
  const radarHeader = createElement('div', { className: 'mt-dash-card-header' });
  radarHeader.textContent = 'Team Skill Radar';
  const radarBody = createElement('div', { className: 'mt-dash-card-body' });
  const radarChartEl = createElement('div', { style: 'height:400px;' });
  radarBody.appendChild(radarChartEl);
  radarCard.appendChild(radarHeader);
  radarCard.appendChild(radarBody);
  dashCols.appendChild(radarCard);

  const activityCard = createElement('div', { className: 'mt-dash-card' });
  activityCard.style.flex = '2';
  const activityHeader = createElement('div', { className: 'mt-dash-card-header' });
  const activityTitle = createElement('span');
  activityTitle.textContent = 'Recent Activity';
  const activityItems = Array.isArray(_activityData?.items) ? _activityData.items : (Array.isArray(_activityData) ? _activityData : []);
  const activityBadge = createElement('span', {
    style: 'margin-left:8px;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:9999px;font-size:11px;padding:1px 8px;color:var(--text-muted);',
  });
  activityBadge.textContent = String(activityItems.length);
  activityHeader.appendChild(activityTitle);
  activityHeader.appendChild(activityBadge);
  const activityBody = createElement('div', { className: 'mt-dash-card-body', style: 'max-height:340px;overflow-y:auto;' });
  renderActivityFeed(activityBody, activityItems);
  activityCard.appendChild(activityHeader);
  activityCard.appendChild(activityBody);
  dashCols.appendChild(activityCard);

  _summaryBodyEl.appendChild(dashCols);

  requestAnimationFrame(() => {
    const perSkillStats = _statsData?.per_skill_stats;
    if (Array.isArray(perSkillStats) && perSkillStats.length > 0) {
      renderRadarChart(radarChartEl, perSkillStats);
    } else if (_matrixData?.skills?.length > 0) {
      const fallbackStats = buildFallbackPerSkillStats();
      if (fallbackStats.length > 0) renderRadarChart(radarChartEl, fallbackStats);
    }
  });
}

function buildFallbackPerSkillStats() {
  if (!_matrixData) return [];
  const skills = _matrixData.skills || [];
  const engineers = _matrixData.engineers || [];
  return skills.map(skill => {
    let covered = 0;
    engineers.forEach(eng => {
      const cell = (eng.cells || {})[String(skill.id)];
      if (cell && cell.status !== 'not_in_plan') covered++;
    });
    const pct = engineers.length > 0 ? Math.round((covered / engineers.length) * 100) : 0;
    return { skill_name: skill.name, coverage_pct: pct };
  });
}

function renderRadarChart(el, perSkillStats) {
  if (typeof echarts === 'undefined') return;
  const chart = echarts.init(el, 'dark');
  const option = {
    backgroundColor: 'transparent',
    radar: {
      indicator: perSkillStats.map(s => ({
        name: s.skill_name.length > 15 ? s.skill_name.slice(0, 12) + '...' : s.skill_name,
        max: 100,
      })),
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      name: { textStyle: { color: 'var(--text-muted)', fontSize: 11 } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: perSkillStats.map(s => s.coverage_pct),
        name: 'Coverage %',
        areaStyle: { opacity: 0.15, color: '#3b82f6' },
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
      }],
    }],
  };
  chart.setOption(option);
  _charts.push(chart);
}

function renderActivityFeed(container, items) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = createElement('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No recent activity';
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = createElement('div', { className: 'mt-activity-item' });
    const avatar = createElement('div', { className: 'mt-activity-avatar' });
    avatar.textContent = getInitials(item.actor_name || item.engineer_name || '?');
    const body = createElement('div', { className: 'mt-activity-body' });
    const text = createElement('div', { className: 'mt-activity-text' });
    const actorName = item.actor_name || item.engineer_name || 'Unknown';
    const desc = formatActivityTitle(item.title || item.description || '', item.skill_name);
    text.innerHTML = `<strong>${escapeHtml(actorName)}</strong> ${desc}`;
    const time = createElement('div', { className: 'mt-activity-time' });
    time.textContent = relativeTime(item.occurred_at);
    body.appendChild(text);
    body.appendChild(time);
    row.appendChild(avatar);
    row.appendChild(body);
    container.appendChild(row);
  });
}

// ─── Matrix controls ──────────────────────────────────────────────────────────

function buildMatrixControls() {
  const controls = createElement('div', { className: 'mt-matrix-controls' });

  const searchInput = createElement('input', {
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

  const skillFilter = createElement('select', { className: 'form-select', style: 'width:auto;max-width:280px;font-size:13px;' });
  const filterAll = createElement('option', { value: '' });
  filterAll.textContent = 'All skills';
  skillFilter.appendChild(filterAll);
  skillFilter.id = 'mt-skill-filter';

  skillFilter.addEventListener('change', () => {
    const val = skillFilter.value;
    _visibleSkillIds = val ? new Set([Number(val)]) : null;
    if (_tabLoaded['matrix']) renderMatrixTable();
  });

  const bulkBtn = createElement('button', { className: 'btn btn-secondary btn-sm' });
  bulkBtn.textContent = 'Bulk Assign';
  bulkBtn.addEventListener('click', () => {
    _bulkMode = !_bulkMode;
    _selectedEngIds = new Set();
    bulkBtn.classList.toggle('active', _bulkMode);
    if (_bulkBarEl) _bulkBarEl.style.display = _bulkMode ? 'flex' : 'none';
    if (_tabLoaded['matrix']) renderMatrixTable();
  });

  const csvBtn = createElement('button', { className: 'matrix-csv-btn' });
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
  controls.appendChild(bulkBtn);
  controls.appendChild(csvBtn);
  controls.appendChild(legend);

  return controls;
}

function buildBulkBar() {
  const bar = createElement('div', { className: 'mt-bulk-bar', style: 'display:none;' });

  _bulkCountEl = createElement('span', { style: 'color:var(--text-secondary);font-size:14px;' });
  _bulkCountEl.textContent = '0 selected';

  const assignBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
  assignBtn.textContent = 'Assign Skill';
  assignBtn.addEventListener('click', () => {
    if (_selectedEngIds.size === 0) {
      showToast('Select at least one engineer', 'warning');
      return;
    }
    openBulkAssignModal();
  });

  const cancelBtn = createElement('button', { className: 'btn btn-secondary btn-sm' });
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
  renderMatrixTable();
}

function populateSkillFilter() {
  const filterSelect = document.getElementById('mt-skill-filter');
  if (!filterSelect || !_matrixData) return;
  while (filterSelect.options.length > 1) filterSelect.remove(1);
  const skills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];
  skills.forEach(skill => {
    const opt = createElement('option', { value: String(skill.id) });
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
    const noSkills = createElement('div', { className: 'empty-state empty-state--inline' });
    noSkills.textContent = 'No skills match the current filter.';
    _matrixBodyEl.appendChild(noSkills);
    return;
  }

  const scrollWrap = createElement('div', { className: 'matrix-scroll' });
  const table = createElement('table', { className: 'matrix-table' });

  const colgroup = document.createElement('colgroup');
  const nameCol = document.createElement('col');
  nameCol.style.width = '180px';
  colgroup.appendChild(nameCol);
  if (_bulkMode) {
    const checkCol = document.createElement('col');
    checkCol.style.width = '36px';
    colgroup.appendChild(checkCol);
  }
  const skillColCount = skills.length;
  skills.forEach(() => {
    const col = document.createElement('col');
    col.style.width = `${Math.floor((100 - 15) / skillColCount)}%`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  const thead = createElement('thead');
  const headerRow = createElement('tr');

  const cornerTh = createElement('th', { className: 'matrix-th-corner' });
  cornerTh.textContent = 'Engineer';
  headerRow.appendChild(cornerTh);

  if (_bulkMode) {
    const checkTh = createElement('th', { className: 'matrix-th-corner', style: 'width:36px;' });
    checkTh.textContent = '✓';
    headerRow.appendChild(checkTh);
  }

  skills.forEach(skill => {
    const th = createElement('th', { className: 'matrix-th-skill' });
    const nameWrap = createElement('div', { className: 'matrix-th-name' });
    nameWrap.textContent = skill.name;
    th.appendChild(nameWrap);
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createElement('tbody');

  engineers.forEach((engineer) => {
    const tr = createElement('tr', { className: 'matrix-row' });

    tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(59,130,246,.06)'; });
    tr.addEventListener('mouseleave', () => { tr.style.background = ''; });

    const nameTd = createElement('td', { className: 'matrix-td-name' });
    const nameSpan = createElement('span', { className: 'matrix-engineer-name' });
    nameSpan.textContent = engineer.name || `Engineer ${engineer.id}`;

    const drillIcon = createElement('span', { className: 'matrix-drill-icon' });
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
      const checkTd = createElement('td', {
        className: 'matrix-cell',
        style: 'background:var(--bg-elevated);border:1px solid var(--border-soft);cursor:pointer;',
      });
      const checkbox = createElement('input', { type: 'checkbox' });
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
  _matrixBodyEl.appendChild(scrollWrap);

  const summary = buildSummaryRow(engineers, skills);
  _matrixBodyEl.appendChild(summary);
}

// ─── Matrix cell ──────────────────────────────────────────────────────────────

function buildMatrixCell(cell, engineer, skill) {
  const { bg, border, icon } = getCellStyle(cell);
  const stagnant = isStagnant(cell);

  const td = createElement('td', {
    className: 'matrix-cell' + (stagnant ? ' matrix-cell--stagnant' : ''),
    style: `background:${bg};border:1px solid ${border};`,
  });

  if (icon) {
    const iconEl = createElement('span', { className: 'matrix-cell-icon' });
    iconEl.innerHTML = icon;
    td.appendChild(iconEl);
  }

  td.addEventListener('mouseenter', () => {
    td.style.filter = 'brightness(1.25)';
    showTooltip(td, buildTooltipContent(cell, engineer, skill));
  });
  td.addEventListener('mouseleave', () => {
    td.style.filter = '';
    hideTooltip();
  });

  return td;
}

function getCellStyle(cell) {
  const { status, proficiency_level } = cell;
  const checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const clockSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  if (status === 'not_in_plan') {
    return { bg: 'var(--bg-elevated)', border: 'var(--border-soft)', icon: '<span style="color:var(--text-muted);font-size:16px;opacity:.4">—</span>' };
  }

  if (status === 'planned') {
    return { bg: 'rgba(245,158,11,.18)', border: 'rgba(245,158,11,.4)', icon: clockSvg };
  }

  if (status === 'developing' || status === 'mastered') {
    const level = proficiency_level;
    const showCheck = status === 'mastered';
    const devIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    if (level === 1) {
      return { bg: 'rgba(34,197,94,.18)', border: 'rgba(34,197,94,.35)', icon: showCheck ? checkSvg : devIcon };
    }
    if (level === 2) {
      return { bg: 'rgba(34,197,94,.42)', border: 'rgba(34,197,94,.55)', icon: showCheck ? checkSvg : devIcon };
    }
    if (level === 3) {
      return { bg: 'rgba(34,197,94,.75)', border: 'rgba(34,197,94,.85)', icon: showCheck ? checkSvg : devIcon };
    }
    return { bg: 'rgba(245,158,11,.18)', border: 'rgba(245,158,11,.4)', icon: clockSvg };
  }

  return { bg: 'var(--bg-elevated)', border: 'var(--border-soft)', icon: null };
}

function buildTooltipContent(cell, engineer, skill) {
  const statusLabels = {
    not_in_plan: 'Not in Plan',
    planned: 'Planned',
    developing: 'Developing',
    mastered: 'Mastered',
  };
  const levelLabels = { 1: 'Education', 2: 'Exposure', 3: 'Experience' };
  const statusLabel = statusLabels[cell.status] || cell.status;
  let levelPart = '';
  if ((cell.status === 'developing' || cell.status === 'mastered') && cell.proficiency_level) {
    levelPart = ` · ${levelLabels[cell.proficiency_level] || `L${cell.proficiency_level}`}`;
  }
  const stagnantPart = isStagnant(cell) ? ' · Stagnant (90+ days)' : '';
  return `${engineer.name} — ${skill.name}\n${statusLabel}${levelPart}${stagnantPart}`;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function buildLegend() {
  const legend = createElement('div', { className: 'matrix-legend' });
  const items = [
    { label: 'Not in Plan', bg: 'var(--bg-elevated)', border: 'var(--border-soft)', text: 'var(--text-muted)' },
    { label: 'Planned', bg: 'rgba(245,158,11,.18)', border: 'rgba(245,158,11,.5)', text: 'var(--text-secondary)' },
    { label: 'Education', bg: 'rgba(34,197,94,.18)', border: 'rgba(34,197,94,.4)', text: 'var(--text-secondary)' },
    { label: 'Exposure', bg: 'rgba(34,197,94,.42)', border: 'rgba(34,197,94,.6)', text: 'var(--text-secondary)' },
    { label: 'Experience', bg: 'rgba(34,197,94,.75)', border: 'rgba(34,197,94,.8)', text: '#fff' },
  ];
  items.forEach(({ label, bg, border, text }) => {
    const chip = createElement('div', {
      className: 'matrix-legend-chip',
      style: `background:${bg};border:1px solid ${border};color:${text};`,
    });
    chip.textContent = label;
    legend.appendChild(chip);
  });
  return legend;
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function buildSummaryRow(engineers, skills) {
  const wrap = createElement('div', { className: 'matrix-summary' });
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
    const pill = createElement('div', { className: 'stat-pill' });
    const strong = createElement('strong');
    strong.textContent = value;
    pill.appendChild(strong);
    pill.appendChild(document.createTextNode(` ${label}`));
    wrap.appendChild(pill);
  });

  return wrap;
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────

function renderAnalysisTab() {
  if (!_analysisBodyEl) return;
  _analysisBodyEl.innerHTML = '';

  const perSkillStats = _statsData?.per_skill_stats;
  const stats = Array.isArray(perSkillStats) && perSkillStats.length > 0
    ? perSkillStats
    : buildFallbackPerSkillStats();

  const sorted = [...stats].sort((a, b) => a.coverage_pct - b.coverage_pct);

  const gapCard = createElement('div', { className: 'mt-dash-card' });
  const gapHeader = createElement('div', { className: 'mt-dash-card-header' });
  gapHeader.textContent = 'Skill Coverage Analysis';
  const gapBody = createElement('div', { className: 'mt-dash-card-body' });

  if (sorted.length === 0) {
    const empty = createElement('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No skill data available';
    gapBody.appendChild(empty);
  } else {
    const gapList = createElement('div', { className: 'mt-gap-list' });

    sorted.forEach(s => {
      const pct = s.coverage_pct ?? 0;
      const color = pct < 30 ? 'var(--danger)' : pct < 60 ? 'var(--warning)' : 'var(--success)';

      const row = createElement('div', { className: 'mt-gap-row' });
      const name = createElement('div', { className: 'mt-gap-name' });
      name.textContent = s.skill_name;
      const barWrap = createElement('div', { className: 'mt-gap-bar-wrap' });
      const barFill = createElement('div', { className: 'mt-gap-bar-fill', style: `width:${pct}%;background:${color};` });
      barWrap.appendChild(barFill);
      const pctEl = createElement('div', { className: 'mt-gap-pct' });
      pctEl.textContent = `${pct}%`;

      row.appendChild(name);
      row.appendChild(barWrap);
      row.appendChild(pctEl);
      gapList.appendChild(row);
    });

    gapBody.appendChild(gapList);
  }

  gapCard.appendChild(gapHeader);
  gapCard.appendChild(gapBody);
  _analysisBodyEl.appendChild(gapCard);

  if (sorted.length > 0) {
    const chartCard = createElement('div', { className: 'mt-dash-card', style: 'margin-top:16px;' });
    const chartHeader = createElement('div', { className: 'mt-dash-card-header' });
    chartHeader.textContent = 'Coverage Distribution';
    const chartBody = createElement('div', { className: 'mt-dash-card-body' });
    const chartEl = createElement('div', { style: 'height:300px;' });
    chartBody.appendChild(chartEl);
    chartCard.appendChild(chartHeader);
    chartCard.appendChild(chartBody);
    _analysisBodyEl.appendChild(chartCard);

    requestAnimationFrame(() => renderCoverageChart(chartEl, sorted));
  }
}

function renderCoverageChart(el, sorted) {
  if (typeof echarts === 'undefined') return;
  const chart = echarts.init(el, 'dark');
  const colors = sorted.map(s => s.coverage_pct < 30 ? '#ef4444' : s.coverage_pct < 60 ? '#f59e0b' : '#22c55e');
  const option = {
    backgroundColor: 'transparent',
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: (v) => `${v}%`, color: 'var(--text-muted)' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    yAxis: {
      type: 'category',
      data: sorted.map(s => s.skill_name.length > 20 ? s.skill_name.slice(0, 18) + '…' : s.skill_name),
      axisLabel: { color: 'var(--text-muted)', fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: sorted.map((s, i) => ({ value: s.coverage_pct, itemStyle: { color: colors[i] } })),
      barMaxWidth: 24,
    }],
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0];
        return `${p.name}: ${p.value}%`;
      },
    },
  };
  chart.setOption(option);
  _charts.push(chart);
}

// ─── Engineer drawer ──────────────────────────────────────────────────────────

function buildDrawerElements() {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const overlay = createElement('div', { className: 'drawer-overlay' });
  const drawer = createElement('div', { className: 'drawer' });

  const drawerHeader = createElement('div', { className: 'drawer-header' });
  const drawerTitle = createElement('h3', { style: 'margin:0;font-size:16px;font-weight:600;color:var(--text-primary);' });
  drawerTitle.textContent = 'Engineer Profile';
  const drawerClose = createElement('button', { className: 'drawer-close', 'aria-label': 'Close drawer' });
  drawerClose.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  drawerClose.addEventListener('click', closeDrawer);
  drawerHeader.appendChild(drawerTitle);
  drawerHeader.appendChild(drawerClose);
  drawer.appendChild(drawerHeader);

  const drawerBody = createElement('div', { className: 'drawer-body' });
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
    const errEl = createElement('div', { className: 'empty-state empty-state--compact' });
    errEl.textContent = err.message || 'Failed to load engineer profile';
    const retryBtn = createElement('button', { className: 'btn btn-secondary btn-sm', style: 'margin-top:12px;' });
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => openDrawer(engineerId, engineerName));
    drawerBody.appendChild(errEl);
    drawerBody.appendChild(retryBtn);
  }
}

function renderDrawerContent(drawerBody, engineerId, engineerName, plan) {
  const engHeader = createElement('div', { className: 'drawer-eng-header' });
  const avatar = createElement('div', { className: 'drawer-eng-avatar' });
  avatar.textContent = getInitials(engineerName);
  avatar.style.background = 'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)';
  const meta = createElement('div', { className: 'drawer-eng-meta' });
  const nameEl = createElement('div', { className: 'drawer-eng-name' });
  nameEl.textContent = engineerName;
  const roleEl = createElement('div', { className: 'drawer-eng-role' });
  roleEl.textContent = 'Engineer';
  const viewLink = createElement('a', {
    href: `#/my-plan/${engineerId}`,
    style: 'font-size:13px;color:var(--accent);text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:6px;',
  });
  viewLink.textContent = 'View Full Plan →';
  viewLink.addEventListener('click', closeDrawer);
  meta.appendChild(nameEl);
  meta.appendChild(roleEl);
  meta.appendChild(viewLink);
  engHeader.appendChild(avatar);
  engHeader.appendChild(meta);
  drawerBody.appendChild(engHeader);

  const skills = Array.isArray(plan.skills) ? plan.skills : [];

  const progressSection = createElement('div', { className: 'drawer-section' });
  const progressTitle = createElement('div', { className: 'drawer-section-title' });
  progressTitle.textContent = 'Skills Progress';
  progressSection.appendChild(progressTitle);

  if (skills.length === 0) {
    const empty = createElement('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No skills in plan yet';
    progressSection.appendChild(empty);
  } else {
    skills.forEach(planSkill => {
      const item = createElement('div', { className: 'drawer-progress-item' });
      const skillName = createElement('div', { className: 'drawer-progress-name' });
      skillName.textContent = planSkill.skill_name || 'Unknown';
      const barWrap = createElement('div', { className: 'drawer-progress-bar' });
      const statusPct = planSkill.status === 'planned' ? 25 : planSkill.status === 'developing' ? 60 : 100;
      const barFill = createElement('div', { className: 'drawer-progress-fill', style: `width:${statusPct}%;` });
      barWrap.appendChild(barFill);
      const statusChip = createElement('span', { className: 'drawer-progress-status triage-chip' });
      statusChip.textContent = planSkill.status === 'planned' ? 'Planned' : planSkill.status === 'developing' ? 'Developing' : 'Mastered';
      if (planSkill.status === 'planned') statusChip.style.background = 'rgba(245,158,11,.2)';
      else if (planSkill.status === 'developing') statusChip.style.background = 'rgba(59,130,246,.2)';
      else statusChip.style.background = 'rgba(34,197,94,.2)';
      item.appendChild(skillName);
      item.appendChild(barWrap);
      item.appendChild(statusChip);
      progressSection.appendChild(item);
    });
  }

  drawerBody.appendChild(progressSection);

  const allLogs = [];
  skills.forEach(planSkill => {
    const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    logs.forEach(log => allLogs.push({ ...log, skill_name: planSkill.skill_name || 'Unknown' }));
  });

  allLogs.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime());
  const recentLogs = allLogs.slice(0, 5);

  const timelineSection = createElement('div', { className: 'drawer-section' });
  const timelineTitle = createElement('div', { className: 'drawer-section-title' });
  timelineTitle.textContent = 'Recent Training';
  timelineSection.appendChild(timelineTitle);

  if (recentLogs.length === 0) {
    const empty = createElement('div', { className: 'empty-state empty-state--compact' });
    empty.textContent = 'No training logs yet';
    timelineSection.appendChild(empty);
  } else {
    recentLogs.forEach(log => {
      const item = createElement('div', { className: 'drawer-timeline-item' });
      const dot = createElement('div', { className: 'drawer-timeline-dot' });
      const textEl = createElement('div', { className: 'drawer-timeline-text' });
      textEl.textContent = `${log.skill_name} — ${log.description || 'Training completed'}`;
      const dateEl = createElement('div', { className: 'drawer-timeline-date' });
      dateEl.textContent = relativeTime(log.completed_at);
      item.appendChild(dot);
      item.appendChild(textEl);
      item.appendChild(dateEl);
      timelineSection.appendChild(item);
    });
  }

  drawerBody.appendChild(timelineSection);

  if (skills.length > 0) {
    const radarSection = createElement('div', { className: 'drawer-section' });
    const radarTitle = createElement('div', { className: 'drawer-section-title' });
    radarTitle.textContent = 'Skill Distribution';
    radarSection.appendChild(radarTitle);
    const radarEl = createElement('div', { style: 'height:220px;' });
    radarSection.appendChild(radarEl);
    drawerBody.appendChild(radarSection);

    requestAnimationFrame(() => {
      if (typeof echarts === 'undefined') return;
      const skillsWithLevel = skills.filter(s => s.proficiency_level || s.status !== 'not_in_plan');
      if (skillsWithLevel.length === 0) return;
      const chart = echarts.init(radarEl, 'dark');
      const option = {
        backgroundColor: 'transparent',
        radar: {
          indicator: skillsWithLevel.map(s => ({
            name: (s.skill_name || '').length > 12 ? (s.skill_name || '').slice(0, 10) + '…' : (s.skill_name || 'Skill'),
            max: 100,
          })),
          splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'] } },
          axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
          name: { textStyle: { color: 'var(--text-muted)', fontSize: 10 } },
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
            areaStyle: { opacity: 0.15, color: '#a855f7' },
            lineStyle: { color: '#a855f7', width: 2 },
            itemStyle: { color: '#a855f7' },
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

  const bodyEl = createElement('div');

  const skillGroup = createElement('div', { className: 'form-group' });
  const skillLabel = createElement('label', { className: 'form-label' });
  skillLabel.textContent = 'Skill to assign';
  const skillSelect = createElement('select', { className: 'form-select' });
  const skillPlaceholder = createElement('option', { value: '' });
  skillPlaceholder.textContent = '— Select a skill —';
  skillSelect.appendChild(skillPlaceholder);
  activeSkills.forEach(s => {
    const opt = createElement('option', { value: String(s.id) });
    opt.textContent = s.name;
    skillSelect.appendChild(opt);
  });
  skillGroup.appendChild(skillLabel);
  skillGroup.appendChild(skillSelect);

  const statusGroup = createElement('div', { className: 'form-group' });
  const statusLabel = createElement('label', { className: 'form-label' });
  statusLabel.textContent = 'Initial status';
  const statusSelect = createElement('select', { className: 'form-select' });
  [{ value: 'planned', label: 'Planned' }, { value: 'developing', label: 'Developing' }].forEach(({ value, label }) => {
    const opt = createElement('option', { value });
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);

  const summaryEl = createElement('div', {
    style: 'font-size:13px;color:var(--text-secondary);margin-bottom:12px;padding:10px 12px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-soft);',
  });
  const updateSummary = () => {
    const skillOpt = skillSelect.options[skillSelect.selectedIndex];
    const skillName = skillOpt?.value ? skillOpt.textContent : '(no skill selected)';
    summaryEl.textContent = `Assign "${skillName}" to ${selectedIds.length} engineer${selectedIds.length !== 1 ? 's' : ''}: ${selectedNames.join(', ')}`;
  };
  skillSelect.addEventListener('change', updateSummary);
  updateSummary();

  const notesGroup = createElement('div', { className: 'form-group' });
  const notesLabel = createElement('label', { className: 'form-label' });
  notesLabel.textContent = 'Notes (optional)';
  const notesInput = createElement('textarea', { className: 'form-input', rows: '2', placeholder: 'Optional notes...' });
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
  const state = createElement('div', { className: 'empty-state' });
  const icon = createElement('div', { className: 'empty-state-icon' });
  icon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const title = createElement('h3');
  title.textContent = 'No Direct Reports';
  const desc = createElement('p');
  desc.textContent = "You don't have any engineers reporting to you yet.";
  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(desc);
  container.appendChild(state);
}

function renderErrorState(container, msg, retryFn) {
  container.innerHTML = '';
  const state = createElement('div', { className: 'empty-state empty-state--error' });
  const icon = createElement('div', { className: 'empty-state-icon' });
  icon.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const title = createElement('div', { className: 'empty-state-title' });
  title.textContent = 'Failed to load team data';
  const descEl = createElement('div', { className: 'empty-state-desc' });
  descEl.textContent = msg || 'Please try refreshing.';
  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(descEl);
  if (typeof retryFn === 'function') {
    const retryBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', retryFn);
    state.appendChild(retryBtn);
  }
  container.appendChild(state);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function animateCountUp(el, target, suffix) {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || target === 0) {
    el.textContent = String(target) + (suffix || '');
    return;
  }
  const duration = 800;
  const start = performance.now();
  function tick(now) {
    const elapsed = Math.min(now - start, duration);
    const progress = 1 - Math.pow(1 - elapsed / duration, 3);
    el.textContent = String(Math.round(target * progress)) + (suffix || '');
    if (elapsed < duration) requestAnimationFrame(tick);
    else el.textContent = String(target) + (suffix || '');
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
    const val = raw.slice('completed:'.length).trim();
    if (val.toLowerCase() === 'true') return `completed a training${skill}`;
    return `completed ${escapeHtml(val)}`;
  }

  if (raw.includes('Moved from') || raw.includes('Added to plan')) {
    return escapeHtml(raw);
  }

  return `${escapeHtml(raw)}${skill}`;
}

function isStagnant(cell) {
  if (cell.status === 'not_in_plan' || cell.status === 'mastered') return false;
  const updated = cell.last_updated_at || cell.last_training_at;
  if (!updated) return false;
  const diff = Date.now() - new Date(updated).getTime();
  return diff > 90 * 24 * 60 * 60 * 1000;
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
