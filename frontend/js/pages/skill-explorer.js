import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { createElement } from '../utils/dom.js';

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
    className: 'page-shell',
  });

  const header = createElement('div', { className: 'mp-header' });
  const title = createElement('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('Skill '));
  const gradientSpan = createElement('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Explorer';
  title.appendChild(gradientSpan);
  const subtitle = createElement('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Search engineers by skill and compare teams';
  header.appendChild(title);
  header.appendChild(subtitle);
  wrapper.appendChild(header);

  // ── Main scroll area ──────────────────────────────────────────────────────
  const main = createElement('div', {
    className: 'page-body--col',
  });

  main.appendChild(buildSearchSection());
  main.appendChild(buildComparisonSection());

  wrapper.appendChild(main);
  container.appendChild(wrapper);
}

// ─── Section A: Engineer Search ───────────────────────────────────────────────

function buildSearchSection() {
  const section = createElement('div', {
    className: 'content-section',
  });

  // Section header
  const header = createElement('div', {
    className: 'content-section-header',
  });

  const headerTitle = createElement('h2', {
    className: 'content-section-title',
  });
  headerTitle.textContent = 'Engineer Search';

  const headerDesc = createElement('span', {
    className: 'content-section-desc',
  });
    headerDesc.textContent = 'Find engineers by skill across all teams';

  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  // Search controls
  const controls = createElement('div', {
    className: 'content-section-controls',
  });

  // Search input
  const searchWrap = createElement('div', {
    className: 'explorer-search-wrap',
  });
  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search by skill name...',
    id: 'explorer-search',
    className: 'search-input',
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
    className: 'explorer-status-select',
  });

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'planned', label: 'Planned' },
    { value: 'developing', label: 'Developing' },
    { value: 'mastered', label: 'Mastered' },
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
    className: 'content-section-body',
  });

  const placeholder = createElement('div', {
    className: 'empty-state empty-state--inline',
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
    const icon = createElement('div', { className: 'empty-state-icon' });
    icon.textContent = 'o';
    const msg = createElement('div', { className: 'empty-state-desc' });
    msg.textContent = 'No engineers found matching your criteria.';
    empty.appendChild(icon);
    empty.appendChild(msg);
    _searchResultsEl.appendChild(empty);
    return;
  }

  // Count badge
  const countBar = createElement('div', {
    className: 'explorer-count-bar',
  });
  const countBadge = createElement('span', { className: 'triage-chip triage-signal' });
  countBadge.textContent = `${data.total ?? results.length} result${(data.total ?? results.length) !== 1 ? 's' : ''}`;
  countBar.appendChild(countBadge);
  _searchResultsEl.appendChild(countBar);

  // Table
  const tableWrap = createElement('div', {
    className: 'explorer-table-wrap',
  });

  const table = createElement('table', {
    className: 'explorer-table',
  });

  // Header
  const thead = createElement('thead');
  const headerRow = createElement('tr');

  const cols = ['Engineer', 'Team', 'Skill', 'Status', 'Proficiency Level'];
  cols.forEach((col) => {
    const th = createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = createElement('tbody');
  results.forEach((row) => {
    const tr = createElement('tr');

    const cells = [
      { text: row.engineer_name || `Engineer ${row.engineer_id}`, bold: true },
      { text: row.team_name || '—' },
      { text: row.skill_name || '—' },
      { chip: buildStatusChip(row.status) },
      { text: formatProficiencyLevel(row.proficiency_level) },
    ];

    cells.forEach((cell) => {
      const td = createElement('td', {
        className: cell.bold ? 'bold-cell' : '',
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
  const labelMap = {
    planned:    'Planned',
    developing: 'Developing',
    mastered:   'Mastered',
  };
  const modifierMap = {
    planned:    'pipeline',
    developing: 'development',
    mastered:   'proficiency',
  };
  const label = labelMap[status] || status || '—';
  const modifier = modifierMap[status] || 'unknown';

  const chip = createElement('span', {
    className: `explorer-status-chip explorer-status-chip--${modifier}`,
  });
  chip.textContent = label;
  return chip;
}

function formatProficiencyLevel(level) {
  const labels = { 1: 'L1 — Education', 2: 'L2 — Exposure', 3: 'L3 — Experience' };
  return labels[level] || '—';
}

// ─── Section B: Cross-Team Comparison ────────────────────────────────────────

function buildComparisonSection() {
  const section = createElement('div', {
    className: 'content-section',
  });

  // Section header
  const header = createElement('div', {
    className: 'content-section-header',
  });

  const headerTitle = createElement('h2', {
    className: 'content-section-title',
  });
  headerTitle.textContent = 'Cross-Team Comparison';

  const headerDesc = createElement('span', {
    className: 'content-section-desc',
  });
  headerDesc.textContent = 'Compare skill coverage across two teams';

  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  // Team selectors row
  const selectorsRow = createElement('div', {
    className: 'explorer-compare-selectors',
  });

  const teamAWrap = buildTeamSelectorGroup('compare-team-a', 'Compare Team');
  const vsLabel = createElement('div', {
    className: 'explorer-compare-vs',
  });
  vsLabel.textContent = 'vs.';
  const teamBWrap = buildTeamSelectorGroup('compare-team-b', 'With Team');

  selectorsRow.appendChild(teamAWrap);
  selectorsRow.appendChild(vsLabel);
  selectorsRow.appendChild(teamBWrap);

  const compareBtn = createElement('button', {
    className: 'btn btn-primary btn-sm',
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
    className: 'content-section-body--lg',
  });

  const comparePlaceholder = createElement('div', {
    className: 'empty-state empty-state--inline',
  });
  comparePlaceholder.textContent = 'Select two teams above and click Compare to see skill overlap.';
  compareBody.appendChild(comparePlaceholder);

  _compareBodyEl = compareBody;
  section.appendChild(compareBody);

  return section;
}

function buildTeamSelectorGroup(inputId, label) {
  const wrap = createElement('div', {
    className: 'explorer-selector-group',
  });

  const labelEl = createElement('label', {
    className: 'explorer-selector-label',
  });
  labelEl.textContent = label;
  labelEl.setAttribute('for', inputId);

  const select = createElement('select', {
    id: inputId,
    className: 'explorer-selector-select',
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
    className: 'explorer-circle-row',
  });

  const circleWrap = buildOverlapCircle(overlapPercent);
  circleRow.appendChild(circleWrap);

  const overlapLabel = createElement('div', {
    className: 'explorer-overlap-label',
  });
  overlapLabel.textContent = `${data.overlap_count ?? 0} shared skill${(data.overlap_count ?? 0) !== 1 ? 's' : ''} between teams`;
  circleRow.appendChild(overlapLabel);

  _compareBodyEl.appendChild(circleRow);

  // Split panels
  const splitLayout = createElement('div', {
    className: 'explorer-split-layout',
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
    className: 'explorer-circle-row',
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
    className: 'explorer-team-panel',
  });

  const panelHeader = createElement('div', {
    className: 'explorer-team-panel-header',
  });

  const teamLabel = createElement('span', {
    className: 'explorer-team-side-label',
  });
  teamLabel.textContent = side === 'A' ? 'Team A' : 'Team B';

  const teamName = createElement('span', {
    className: 'explorer-team-name',
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
    className: 'explorer-skill-list',
  });

  if (skills.length === 0) {
    const empty = createElement('div', {
      className: 'empty-state empty-state--inline',
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
    className: isOverlap ? 'explorer-skill-card explorer-skill-card--overlap' : 'explorer-skill-card',
  });

  const left = createElement('div', {
    className: 'explorer-skill-card-info',
  });

  const nameEl = createElement('div', {
    className: 'explorer-skill-card-name',
  });
  nameEl.textContent = skill.name || `Skill ${skill.id}`;
  left.appendChild(nameEl);

  if (isOverlap) {
    const overlapBadge = createElement('span', {
      className: 'explorer-overlap-badge',
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
    className: 'explorer-add-btn',
  });
  btn.textContent = '+ Add to My Plan';

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
      btn.className = 'explorer-add-btn explorer-add-btn--added';
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
      btn.className = 'explorer-add-btn';
    }
  });

  return btn;
}

// ─── Error state ──────────────────────────────────────────────────────────────

function renderErrorState(container, msg) {
  const wrap = createElement('div', {
    className: 'explorer-error-state',
  });

  const icon = createElement('div', { className: 'explorer-error-icon' });
  icon.textContent = 'X';

  const title = createElement('div', {
    className: 'explorer-error-title',
  });
  title.textContent = 'Something went wrong';

  const desc = createElement('div', {
    className: 'explorer-error-desc',
  });
  desc.textContent = msg || 'Please try again.';

  wrap.appendChild(icon);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  container.appendChild(wrap);
}
