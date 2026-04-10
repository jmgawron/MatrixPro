import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _teamsData = [];
let _debounceTimer = null;
let _searchResultsEl = null;
let _compareBodyEl = null;
let _circleEl = null;
let _overlapTextEl = null;
let _teamASkillsEl = null;
let _teamBSkillsEl = null;
let _teamANameEl = null;
let _teamBNameEl = null;
let _searchQuery = '';
let _filterStatus = '';

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountSkillExplorer(container, params) {
  _container = container;
  container.innerHTML = '';

  _teamsData = [];
  _searchQuery = '';
  _filterStatus = '';
  _searchResultsEl = null;
  _compareBodyEl = null;
  _circleEl = null;
  _overlapTextEl = null;
  _teamASkillsEl = null;
  _teamBSkillsEl = null;
  _teamANameEl = null;
  _teamBNameEl = null;

  buildPageShell(container);
  loadTeams();

  return () => {
    clearTimeout(_debounceTimer);
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadTeams() {
  try {
    _teamsData = await api.get('/api/teams/');
    if (!Array.isArray(_teamsData)) _teamsData = [];
    populateTeamSelectors();
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
  }
}

async function runSearch() {
  if (!_searchResultsEl) return;
  showSkeleton(_searchResultsEl, 'table');

  const params = [];
  if (_searchQuery) params.push(`q=${encodeURIComponent(_searchQuery)}`);
  if (_filterStatus) params.push(`status=${encodeURIComponent(_filterStatus)}`);
  const qs = params.length ? `?${params.join('&')}` : '';

  try {
    const data = await api.get(`/api/skills/explorer${qs}`);
    renderSearchResults(data);
  } catch (err) {
    _searchResultsEl.innerHTML = '';
    renderErrorState(_searchResultsEl, err.message || 'Search failed');
  }
}

async function runComparison(teamAId, teamBId) {
  if (!_compareBodyEl) return;
  showSkeleton(_compareBodyEl, 'table');

  try {
    const data = await api.get(`/api/skills/compare?team_a=${teamAId}&team_b=${teamBId}`);
    renderComparison(data);
  } catch (err) {
    _compareBodyEl.innerHTML = '';
    renderErrorState(_compareBodyEl, err.message || 'Comparison failed');
  }
}

// ─── Page shell construction ──────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', {
    style: 'display:flex;flex-direction:column;min-height:calc(100vh - 60px);',
  });

  // ── Top bar ──────────────────────────────────────────────────────────────
  const topBar = createElement('div', {
    style: 'background:var(--bg-panel);border-bottom:1px solid var(--border-soft);padding:16px 24px;flex-shrink:0;',
  });

  const titleRow = createElement('div', {
    style: 'display:flex;align-items:center;gap:12px;',
  });

  const titleEl = createElement('h1', {
    style: 'font-size:22px;font-weight:700;color:var(--text-primary);',
  });
  titleEl.textContent = 'Skill Explorer';

  titleRow.appendChild(titleEl);
  topBar.appendChild(titleRow);
  wrapper.appendChild(topBar);

  // ── Main scroll area ──────────────────────────────────────────────────────
  const main = createElement('div', {
    style: 'flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:32px;',
  });

  main.appendChild(buildSearchSection());
  main.appendChild(buildComparisonSection());

  wrapper.appendChild(main);
  container.appendChild(wrapper);
}

// ─── Section A: Engineer Search ───────────────────────────────────────────────

function buildSearchSection() {
  const section = createElement('div', {
    style: [
      'background:var(--bg-card);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-lg);',
      'overflow:hidden;',
    ].join(''),
  });

  // Section header
  const header = createElement('div', {
    style: [
      'background:var(--bg-elevated);',
      'border-bottom:1px solid var(--border-soft);',
      'padding:16px 20px;',
      'display:flex;align-items:center;gap:12px;',
    ].join(''),
  });

  const headerTitle = createElement('h2', {
    style: 'font-size:16px;font-weight:700;color:var(--text-primary);',
  });
  headerTitle.textContent = 'Engineer Search';

  const headerDesc = createElement('span', {
    style: 'font-size:13px;color:var(--text-muted);',
  });
  headerDesc.textContent = 'Find engineers by skill across the organisation';

  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  // Search controls
  const controls = createElement('div', {
    style: 'padding:16px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--border-soft);',
  });

  // Search input
  const searchWrap = createElement('div', {
    style: 'flex:1;min-width:200px;max-width:400px;',
  });
  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search by skill name...',
    id: 'explorer-search',
    style: 'width:100%;background:var(--bg-input);border:1px solid var(--border-soft);border-radius:var(--radius-md);padding:8px 12px;color:var(--text-primary);font-size:14px;outline:none;transition:border-color var(--transition);',
  });
  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = 'var(--accent)';
  });
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = 'var(--border-soft)';
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _searchQuery = searchInput.value.trim();
      runSearch();
    }, 300);
  });
  searchWrap.appendChild(searchInput);
  controls.appendChild(searchWrap);

  // Status filter
  const statusSelect = createElement('select', {
    id: 'explorer-status-filter',
    style: [
      'background:var(--bg-input);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'padding:8px 12px;',
      'color:var(--text-secondary);',
      'font-size:14px;',
      'cursor:pointer;',
      'outline:none;',
      'min-width:160px;',
    ].join(''),
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'in_pipeline', label: 'In Pipeline' },
    { value: 'in_development', label: 'In Development' },
    { value: 'proficiency', label: 'Proficiency' },
  ];
  statusOptions.forEach(({ value, label }) => {
    const opt = createElement('option', { value });
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusSelect.addEventListener('change', () => {
    _filterStatus = statusSelect.value;
    runSearch();
  });
  controls.appendChild(statusSelect);

  // Search button
  const searchBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    style: 'padding:8px 16px;',
  });
  searchBtn.textContent = 'Search';
  searchBtn.addEventListener('click', () => {
    _searchQuery = searchInput.value.trim();
    runSearch();
  });
  controls.appendChild(searchBtn);

  section.appendChild(controls);

  // Results container
  const resultsContainer = createElement('div', {
    id: 'explorer-results',
    style: 'padding:16px 20px;min-height:120px;',
  });

  const placeholder = createElement('div', {
    style: 'text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;',
  });
  placeholder.textContent = 'Enter a skill name or filter to search for engineers.';
  resultsContainer.appendChild(placeholder);

  _searchResultsEl = resultsContainer;
  section.appendChild(resultsContainer);

  return section;
}

// ─── Search results rendering ─────────────────────────────────────────────────

function renderSearchResults(data) {
  if (!_searchResultsEl) return;
  _searchResultsEl.innerHTML = '';

  const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);

  if (results.length === 0) {
    const empty = createElement('div', { className: 'empty-state' });
    const icon = createElement('div', { style: 'font-size:32px;margin-bottom:12px;' });
    icon.textContent = 'o';
    const msg = createElement('div', { style: 'font-size:14px;color:var(--text-muted);' });
    msg.textContent = 'No engineers found matching your criteria.';
    empty.appendChild(icon);
    empty.appendChild(msg);
    _searchResultsEl.appendChild(empty);
    return;
  }

  // Count badge
  const countBar = createElement('div', {
    style: 'display:flex;align-items:center;gap:8px;margin-bottom:12px;',
  });
  const countBadge = createElement('span', { className: 'triage-chip triage-signal' });
  countBadge.textContent = `${data.total ?? results.length} result${(data.total ?? results.length) !== 1 ? 's' : ''}`;
  countBar.appendChild(countBadge);
  _searchResultsEl.appendChild(countBar);

  // Table
  const tableWrap = createElement('div', {
    style: 'overflow-x:auto;border:1px solid var(--border-soft);border-radius:var(--radius-md);',
  });

  const table = createElement('table', {
    style: 'width:100%;border-collapse:collapse;font-size:13px;',
  });

  // Header
  const thead = createElement('thead');
  const headerRow = createElement('tr', {
    style: 'background:var(--bg-elevated);',
  });

  const cols = ['Engineer', 'Team', 'Skill', 'Status', 'Proficiency Level'];
  cols.forEach((col, i) => {
    const th = createElement('th', {
      style: [
        'padding:10px 14px;',
        'text-align:left;',
        'font-size:11px;font-weight:700;',
        'text-transform:uppercase;letter-spacing:.06em;',
        'color:var(--text-muted);',
        i > 0 ? 'border-left:1px solid var(--border-soft);' : '',
        i === cols.length - 1 ? '' : 'white-space:nowrap;',
      ].join(''),
    });
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = createElement('tbody');
  results.forEach((row, idx) => {
    const tr = createElement('tr', {
      style: [
        idx % 2 === 0 ? 'background:var(--bg-card);' : 'background:var(--bg-card-soft);',
        'transition:background var(--transition);',
      ].join(''),
    });

    tr.addEventListener('mouseenter', () => {
      tr.style.background = 'rgba(59,130,246,.07)';
    });
    tr.addEventListener('mouseleave', () => {
      tr.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-soft)';
    });

    const cells = [
      { text: row.engineer_name || `Engineer ${row.engineer_id}`, bold: true },
      { text: row.team_name || '—' },
      { text: row.skill_name || '—' },
      { chip: buildStatusChip(row.status) },
      { text: formatProficiencyLevel(row.proficiency_level) },
    ];

    cells.forEach((cell, ci) => {
      const td = createElement('td', {
        style: [
          'padding:10px 14px;',
          'color:var(--text-secondary);',
          ci > 0 ? 'border-left:1px solid var(--border-soft);' : '',
          cell.bold ? 'font-weight:600;color:var(--text-primary);' : '',
        ].join(''),
      });

      if (cell.chip) {
        td.appendChild(cell.chip);
      } else {
        td.textContent = cell.text;
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  _searchResultsEl.appendChild(tableWrap);
}

function buildStatusChip(status) {
  const map = {
    in_pipeline:    { label: 'In Pipeline',    color: 'var(--info)',    bg: 'rgba(6,182,212,.15)' },
    in_development: { label: 'In Development', color: 'var(--warning)', bg: 'rgba(245,158,11,.15)' },
    proficiency:    { label: 'Proficiency',    color: 'var(--success)', bg: 'rgba(34,197,94,.15)' },
  };
  const cfg = map[status] || { label: status || '—', color: 'var(--text-muted)', bg: 'var(--bg-elevated)' };

  const chip = createElement('span', {
    style: [
      `background:${cfg.bg};`,
      `color:${cfg.color};`,
      'border-radius:20px;',
      'padding:3px 10px;',
      'font-size:12px;font-weight:600;',
      'white-space:nowrap;',
      'display:inline-block;',
    ].join(''),
  });
  chip.textContent = cfg.label;
  return chip;
}

function formatProficiencyLevel(level) {
  const labels = { 1: 'L1 — Education', 2: 'L2 — Exposure', 3: 'L3 — Experience' };
  return labels[level] || '—';
}

// ─── Section B: Cross-Team Comparison ────────────────────────────────────────

function buildComparisonSection() {
  const section = createElement('div', {
    style: [
      'background:var(--bg-card);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-lg);',
      'overflow:hidden;',
    ].join(''),
  });

  // Section header
  const header = createElement('div', {
    style: [
      'background:var(--bg-elevated);',
      'border-bottom:1px solid var(--border-soft);',
      'padding:16px 20px;',
      'display:flex;align-items:center;gap:12px;',
    ].join(''),
  });

  const headerTitle = createElement('h2', {
    style: 'font-size:16px;font-weight:700;color:var(--text-primary);',
  });
  headerTitle.textContent = 'Cross-Team Comparison';

  const headerDesc = createElement('span', {
    style: 'font-size:13px;color:var(--text-muted);',
  });
  headerDesc.textContent = 'Compare skill coverage across two teams';

  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  // Team selectors row
  const selectorsRow = createElement('div', {
    style: 'padding:16px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--border-soft);',
  });

  const teamAWrap = buildTeamSelectorGroup('compare-team-a', 'Compare Team');
  const vsLabel = createElement('div', {
    style: 'font-size:14px;font-weight:700;color:var(--text-muted);padding-top:20px;flex-shrink:0;',
  });
  vsLabel.textContent = 'vs.';
  const teamBWrap = buildTeamSelectorGroup('compare-team-b', 'With Team');

  selectorsRow.appendChild(teamAWrap);
  selectorsRow.appendChild(vsLabel);
  selectorsRow.appendChild(teamBWrap);

  const compareBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
    style: 'margin-top:20px;padding:8px 18px;flex-shrink:0;',
  });
  compareBtn.textContent = 'Compare';
  compareBtn.addEventListener('click', () => {
    const selA = document.getElementById('compare-team-a');
    const selB = document.getElementById('compare-team-b');
    if (!selA?.value || !selB?.value) {
      showToast('Please select both teams to compare', 'warning');
      return;
    }
    runComparison(selA.value, selB.value);
  });
  selectorsRow.appendChild(compareBtn);

  section.appendChild(selectorsRow);

  // Comparison body (skeleton / results)
  const compareBody = createElement('div', {
    id: 'compare-body',
    style: 'padding:20px;',
  });

  const comparePlaceholder = createElement('div', {
    style: 'text-align:center;padding:40px 20px;color:var(--text-muted);font-size:14px;',
  });
  comparePlaceholder.textContent = 'Select two teams above and click Compare to see skill overlap.';
  compareBody.appendChild(comparePlaceholder);

  _compareBodyEl = compareBody;
  section.appendChild(compareBody);

  return section;
}

function buildTeamSelectorGroup(inputId, label) {
  const wrap = createElement('div', {
    style: 'display:flex;flex-direction:column;gap:6px;min-width:180px;',
  });

  const labelEl = createElement('label', {
    style: 'font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;',
  });
  labelEl.textContent = label;
  labelEl.setAttribute('for', inputId);

  const select = createElement('select', {
    id: inputId,
    style: [
      'background:var(--bg-input);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'padding:8px 12px;',
      'color:var(--text-secondary);',
      'font-size:14px;',
      'cursor:pointer;',
      'outline:none;',
      'min-width:180px;',
    ].join(''),
  });

  const placeholder = createElement('option', { value: '' });
  placeholder.textContent = '— Select team —';
  select.appendChild(placeholder);

  wrap.appendChild(labelEl);
  wrap.appendChild(select);
  return wrap;
}

function populateTeamSelectors() {
  const selA = document.getElementById('compare-team-a');
  const selB = document.getElementById('compare-team-b');
  if (!selA || !selB) return;

  const user = Store.get('user');

  _teamsData.forEach(team => {
    const optA = createElement('option', { value: String(team.id) });
    optA.textContent = team.name;
    selA.appendChild(optA);

    const optB = createElement('option', { value: String(team.id) });
    optB.textContent = team.name;
    selB.appendChild(optB);
  });

  // Default "with team" to current user's team if available
  if (user?.team_id) {
    selB.value = String(user.team_id);
  }
}

// ─── Comparison rendering ─────────────────────────────────────────────────────

function renderComparison(data) {
  if (!_compareBodyEl) return;
  _compareBodyEl.innerHTML = '';

  const teamA = data?.team_a || {};
  const teamB = data?.team_b || {};
  const overlapPercent = typeof data?.overlap_percent === 'number'
    ? Math.round(data.overlap_percent * 10) / 10
    : 0;

  // Overlap circle row (centered)
  const circleRow = createElement('div', {
    style: 'display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:24px;',
  });

  const circleWrap = buildOverlapCircle(overlapPercent);
  circleRow.appendChild(circleWrap);

  const overlapLabel = createElement('div', {
    style: 'font-size:13px;color:var(--text-muted);text-align:center;',
  });
  overlapLabel.textContent = `${data.overlap_count ?? 0} shared skill${(data.overlap_count ?? 0) !== 1 ? 's' : ''} between teams`;
  circleRow.appendChild(overlapLabel);

  _compareBodyEl.appendChild(circleRow);

  // Split panels
  const splitLayout = createElement('div', {
    style: 'display:grid;grid-template-columns:1fr 1fr;gap:20px;',
  });

  const teamAPanel = buildTeamSkillPanel(teamA, 'A', data);
  const teamBPanel = buildTeamSkillPanel(teamB, 'B', data);

  splitLayout.appendChild(teamAPanel);
  splitLayout.appendChild(teamBPanel);
  _compareBodyEl.appendChild(splitLayout);
}

// ─── Overlap circle SVG ───────────────────────────────────────────────────────

function buildOverlapCircle(percent) {
  const size = 120;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  const wrap = createElement('div', {
    style: 'display:flex;flex-direction:column;align-items:center;',
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-label', `${percent}% skill overlap`);

  // Background track
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--border-soft)');
  track.setAttribute('stroke-width', '8');
  svg.appendChild(track);

  // Filled arc
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('cx', String(size / 2));
  arc.setAttribute('cy', String(size / 2));
  arc.setAttribute('r', String(radius));
  arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', 'var(--accent)');
  arc.setAttribute('stroke-width', '8');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('stroke-dasharray', String(circumference));
  arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);

  if (prefersReducedMotion) {
    arc.setAttribute('stroke-dashoffset', String(circumference - filled));
  } else {
    arc.setAttribute('stroke-dashoffset', String(circumference));
    arc.style.transition = 'stroke-dashoffset 1s ease';
    // Trigger animation in next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.setAttribute('stroke-dashoffset', String(circumference - filled));
      });
    });
  }

  svg.appendChild(arc);

  // Centered text
  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('x', String(size / 2));
  textEl.setAttribute('y', String(size / 2 + 5));
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('font-size', '18');
  textEl.setAttribute('font-weight', '700');
  textEl.setAttribute('fill', 'var(--text-primary)');
  textEl.textContent = `${percent}%`;
  svg.appendChild(textEl);

  const subTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  subTextEl.setAttribute('x', String(size / 2));
  subTextEl.setAttribute('y', String(size / 2 + 20));
  subTextEl.setAttribute('text-anchor', 'middle');
  subTextEl.setAttribute('font-size', '10');
  subTextEl.setAttribute('fill', 'var(--text-muted)');
  subTextEl.textContent = 'overlap';
  svg.appendChild(subTextEl);

  wrap.appendChild(svg);
  return wrap;
}

// ─── Team skill panel ─────────────────────────────────────────────────────────

function buildTeamSkillPanel(team, side, compareData) {
  const panel = createElement('div', {
    style: [
      'background:var(--bg-card-soft);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'overflow:hidden;',
    ].join(''),
  });

  const panelHeader = createElement('div', {
    style: [
      'background:var(--bg-elevated);',
      'border-bottom:1px solid var(--border-soft);',
      'padding:12px 16px;',
      'display:flex;align-items:center;gap:8px;',
    ].join(''),
  });

  const teamLabel = createElement('span', {
    style: 'font-size:13px;color:var(--text-muted);',
  });
  teamLabel.textContent = side === 'A' ? 'Team A' : 'Team B';

  const teamName = createElement('span', {
    style: 'font-size:14px;font-weight:700;color:var(--text-primary);',
  });
  teamName.textContent = team.team_name || '—';

  const skillCount = createElement('span', { className: 'triage-chip triage-signal' });
  const skills = Array.isArray(team.skills) ? team.skills : [];
  skillCount.textContent = `${skills.length} skill${skills.length !== 1 ? 's' : ''}`;

  panelHeader.appendChild(teamLabel);
  panelHeader.appendChild(teamName);
  panelHeader.appendChild(skillCount);
  panel.appendChild(panelHeader);

  const skillsList = createElement('div', {
    style: 'padding:12px;display:flex;flex-direction:column;gap:8px;max-height:480px;overflow-y:auto;',
  });

  if (skills.length === 0) {
    const empty = createElement('div', {
      style: 'padding:20px;text-align:center;color:var(--text-muted);font-size:13px;',
    });
    empty.textContent = 'No skills found for this team.';
    skillsList.appendChild(empty);
  } else {
    skills.forEach(skill => {
      skillsList.appendChild(buildSkillCard(skill, side, compareData));
    });
  }

  panel.appendChild(skillsList);
  return panel;
}

function buildSkillCard(skill, side, compareData) {
  const isOverlap = skill.is_overlap === true;

  const card = createElement('div', {
    style: [
      isOverlap ? 'background:var(--accent-soft);border-left:3px solid var(--accent);' : 'background:var(--bg-card);border-left:3px solid transparent;',
      'border-radius:var(--radius-md);',
      'padding:10px 14px;',
      'display:flex;align-items:center;justify-content:space-between;gap:10px;',
      'transition:background var(--transition);',
    ].join(''),
  });

  const left = createElement('div', {
    style: 'display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;',
  });

  const nameEl = createElement('div', {
    style: 'font-size:13px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
  });
  nameEl.textContent = skill.name || `Skill ${skill.id}`;
  left.appendChild(nameEl);

  if (isOverlap) {
    const overlapBadge = createElement('span', {
      style: [
        'display:inline-block;',
        'font-size:11px;font-weight:600;',
        'color:var(--accent);',
        'background:rgba(59,130,246,.12);',
        'border-radius:20px;',
        'padding:2px 8px;',
        'width:fit-content;',
      ].join(''),
    });
    overlapBadge.textContent = 'Shared';
    left.appendChild(overlapBadge);
  }

  card.appendChild(left);

  // "+ Add to My Plan" button — show on Team A panel for non-overlapping skills
  if (side === 'A' && !isOverlap) {
    const user = Store.get('user');
    if (user) {
      const addBtn = buildAddToPlanButton(skill, user);
      card.appendChild(addBtn);
    }
  }

  return card;
}

function buildAddToPlanButton(skill, user) {
  const btn = createElement('button', {
    style: [
      'background:var(--bg-elevated);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'padding:5px 10px;',
      'font-size:12px;font-weight:600;',
      'color:var(--text-secondary);',
      'cursor:pointer;',
      'white-space:nowrap;',
      'flex-shrink:0;',
      'transition:background var(--transition),color var(--transition),border-color var(--transition);',
    ].join(''),
  });
  btn.textContent = '+ Add to My Plan';

  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--accent)';
    }
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.disabled) {
      btn.style.background = 'var(--bg-elevated)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border-soft)';
    }
  });

  btn.addEventListener('click', async () => {
    if (user.role === 'manager' || user.role === 'admin') {
      showToast('Use the My Plan page to import skills for your team members', 'info');
      return;
    }

    // Engineer path
    btn.disabled = true;
    btn.textContent = 'Adding…';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    try {
      await api.post(`/api/plans/${user.id}/skills`, { skill_id: skill.id });
      btn.textContent = 'Added';
      btn.style.background = 'rgba(34,197,94,.15)';
      btn.style.color = 'var(--success)';
      btn.style.borderColor = 'rgba(34,197,94,.4)';
      btn.style.opacity = '1';
      showToast(`"${skill.name}" added to your plan`, 'success');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('409') || msg.toLowerCase().includes('already')) {
        showToast('Skill already in your plan', 'info');
      } else {
        showToast(err.message || 'Failed to add skill to plan', 'error');
      }
      btn.disabled = false;
      btn.textContent = '+ Add to My Plan';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.background = 'var(--bg-elevated)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.borderColor = 'var(--border-soft)';
    }
  });

  return btn;
}

// ─── Error state ──────────────────────────────────────────────────────────────

function renderErrorState(container, msg) {
  const wrap = createElement('div', {
    style: 'text-align:center;padding:40px 24px;',
  });

  const icon = createElement('div', { style: 'font-size:32px;margin-bottom:12px;' });
  icon.textContent = 'X';

  const title = createElement('div', {
    style: 'font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:6px;',
  });
  title.textContent = 'Something went wrong';

  const desc = createElement('div', {
    style: 'font-size:13px;color:var(--text-secondary);',
  });
  desc.textContent = msg || 'Please try again.';

  wrap.appendChild(icon);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  container.appendChild(wrap);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

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
