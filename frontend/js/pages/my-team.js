import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _matrixData = null;      // full response from /api/teams/matrix
let _visibleSkillIds = null; // Set of skill IDs currently shown (null = all)
let _matrixBodyEl = null;    // scrollable matrix container
let _tooltipEl = null;       // shared floating tooltip div

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountMyTeam(container, params) {
  _container = container;
  container.innerHTML = '';

  _matrixData = null;
  _visibleSkillIds = null;
  _matrixBodyEl = null;

  buildTooltip();
  buildPageShell(container);

  const user = Store.get('user');
  if (user?.role === 'admin') {
    loadAdminTeamSelector();
  } else {
    loadMatrix();
  }

  return () => {
    if (_tooltipEl && _tooltipEl.parentNode) {
      _tooltipEl.parentNode.removeChild(_tooltipEl);
    }
    _tooltipEl = null;
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadMatrix(teamId) {
  if (_matrixBodyEl) showSkeleton(_matrixBodyEl, 'table');

  try {
    const url = teamId ? `/api/teams/matrix?team_id=${teamId}` : '/api/teams/matrix';
    _matrixData = await api.get(url);
    _visibleSkillIds = null;
    renderMatrix();
    populateSkillFilter();
  } catch (err) {
    const msg = err.message || 'Failed to load team matrix';
    showToast(msg, 'error');
    if (_matrixBodyEl) {
      _matrixBodyEl.innerHTML = '';
      renderErrorState(_matrixBodyEl, msg);
    }
  }
}

async function loadAdminTeamSelector() {
  try {
    const teams = await api.get('/api/teams/');
    if (!_matrixBodyEl) return;
    _matrixBodyEl.innerHTML = '';

    const prompt = createElement('div', {
      style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:48px 24px;',
    });

    const label = createElement('p', {
      style: 'font-size:15px;color:var(--text-secondary);',
    });
    label.textContent = 'Select a team to view its skills matrix:';

    const select = createElement('select', {
      className: 'form-select',
      style: 'width:auto;min-width:240px;font-size:14px;',
    });

    const placeholder = createElement('option', { value: '' });
    placeholder.textContent = '— Choose a team —';
    select.appendChild(placeholder);

    teams.forEach(t => {
      const opt = createElement('option', { value: t.id });
      opt.textContent = t.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      const tid = select.value;
      if (tid) loadMatrix(Number(tid));
    });

    prompt.appendChild(label);
    prompt.appendChild(select);
    _matrixBodyEl.appendChild(prompt);
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
  }
}

// ─── Page shell construction ──────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', {
    style: 'display:flex;flex-direction:column;height:100%;min-height:calc(100vh - 60px);',
  });

  // ── Top bar ──────────────────────────────────────────────────────────────
  const topBar = createElement('div', {
    style: 'background:var(--bg-panel);border-bottom:1px solid var(--border-soft);padding:16px 24px;flex-shrink:0;',
  });

  const row1 = createElement('div', {
    style: 'display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;',
  });

  const titleGroup = createElement('div', { style: 'display:flex;align-items:center;gap:12px;' });
  const titleEl = createElement('h1', {
    style: 'font-size:22px;font-weight:700;color:var(--text-primary);',
  });
  titleEl.textContent = 'My Team';

  const teamBadge = createElement('span', {
    className: 'triage-chip triage-signal',
    id: 'my-team-badge',
  });
  teamBadge.textContent = 'Loading…';

  titleGroup.appendChild(titleEl);
  titleGroup.appendChild(teamBadge);
  row1.appendChild(titleGroup);

  // Legend — always visible in top-right
  const legend = buildLegend();
  row1.appendChild(legend);

  topBar.appendChild(row1);

  // Skill filter row
  const filterRow = createElement('div', {
    style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;',
  });

  const filterLabel = createElement('span', {
    style: 'font-size:13px;color:var(--text-secondary);white-space:nowrap;',
  });
  filterLabel.textContent = 'Filter skills:';

  const filterSelect = createElement('select', {
    id: 'team-skill-filter',
    className: 'form-select',
    style: 'width:auto;max-width:360px;font-size:13px;',
  });
  const filterAll = createElement('option', { value: '' });
  filterAll.textContent = 'All skills visible';
  filterSelect.appendChild(filterAll);

  const clearBtn = createElement('button', {
    className: 'btn btn-secondary btn-sm',
    style: 'font-size:12px;padding:6px 14px;',
    id: 'team-filter-clear',
  });
  clearBtn.textContent = 'Show All';
  clearBtn.style.display = 'none';

  filterSelect.addEventListener('change', () => {
    const val = filterSelect.value;
    _visibleSkillIds = val ? new Set([Number(val)]) : null;
    clearBtn.style.display = val ? '' : 'none';
    renderMatrix();
  });

  clearBtn.addEventListener('click', () => {
    filterSelect.value = '';
    _visibleSkillIds = null;
    clearBtn.style.display = 'none';
    renderMatrix();
  });

  filterRow.appendChild(filterLabel);
  filterRow.appendChild(filterSelect);
  filterRow.appendChild(clearBtn);

  const csvBtn = createElement('button', {
    style: 'display:flex;align-items:center;gap:6px;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border-soft);border-radius:var(--radius-md);padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s,color 0.15s;margin-left:auto;',
  });
  csvBtn.textContent = '📊 Export CSV';
  csvBtn.addEventListener('click', () => {
    if (!_matrixData) return;
    downloadExport(`/api/export/teams/${_matrixData.team_id}/matrix/csv`, 'team_matrix.csv');
  });
  filterRow.appendChild(csvBtn);

  topBar.appendChild(filterRow);

  wrapper.appendChild(topBar);

  // ── Main scrollable area ──────────────────────────────────────────────────
  const main = createElement('div', {
    style: 'flex:1;overflow:auto;padding:24px;',
  });

  const matrixBodyEl = createElement('div', { id: 'team-matrix-body' });
  main.appendChild(matrixBodyEl);
  _matrixBodyEl = matrixBodyEl;

  wrapper.appendChild(main);
  container.appendChild(wrapper);
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function buildLegend() {
  const legend = createElement('div', {
    style: [
      'display:flex;align-items:center;gap:8px;flex-wrap:wrap;',
      'padding:8px 14px;',
      'background:var(--bg-elevated);',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'font-size:12px;',
    ].join(''),
  });

  const items = [
    { label: 'Not in Plan', bg: 'var(--bg-elevated)', border: 'var(--border-soft)', text: 'var(--text-muted)' },
    { label: 'In Pipeline', bg: 'rgba(245,158,11,.18)', border: 'rgba(245,158,11,.5)', text: 'var(--text-secondary)' },
    { label: 'Education',   bg: 'rgba(34,197,94,.18)', border: 'rgba(34,197,94,.4)',  text: 'var(--text-secondary)' },
    { label: 'Exposure',    bg: 'rgba(34,197,94,.42)', border: 'rgba(34,197,94,.6)',  text: 'var(--text-secondary)' },
    { label: 'Experience',  bg: 'rgba(34,197,94,.75)', border: 'rgba(34,197,94,.8)',  text: '#fff' },
  ];

  items.forEach(({ label, bg, border, text }) => {
    const chip = createElement('div', {
      style: [
        `background:${bg};`,
        `border:1px solid ${border};`,
        `color:${text};`,
        'border-radius:4px;',
        'padding:3px 10px;',
        'font-size:11px;',
        'font-weight:600;',
        'white-space:nowrap;',
        'letter-spacing:.02em;',
      ].join(''),
    });
    chip.textContent = label;
    legend.appendChild(chip);
  });

  return legend;
}

// ─── Skill filter populate ────────────────────────────────────────────────────

function populateSkillFilter() {
  const filterSelect = document.getElementById('team-skill-filter');
  if (!filterSelect || !_matrixData) return;

  // clear existing options except first
  while (filterSelect.options.length > 1) filterSelect.remove(1);

  const skills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];
  skills.forEach(skill => {
    const opt = createElement('option', { value: String(skill.id) });
    opt.textContent = skill.name;
    filterSelect.appendChild(opt);
  });
}

// ─── Matrix rendering ─────────────────────────────────────────────────────────

function renderMatrix() {
  if (!_matrixBodyEl || !_matrixData) return;
  _matrixBodyEl.innerHTML = '';

  const teamBadge = document.getElementById('my-team-badge');
  if (teamBadge) teamBadge.textContent = _matrixData.team_name || 'Team';

  const engineers = Array.isArray(_matrixData.engineers) ? _matrixData.engineers : [];
  const allSkills = Array.isArray(_matrixData.skills) ? _matrixData.skills : [];

  // Apply column filter
  const skills = _visibleSkillIds
    ? allSkills.filter(s => _visibleSkillIds.has(s.id))
    : allSkills;

  if (engineers.length === 0) {
    renderEmptyState(_matrixBodyEl);
    return;
  }

  if (skills.length === 0) {
    const noSkills = createElement('div', {
      style: 'padding:40px;text-align:center;color:var(--text-muted);font-size:14px;',
    });
    noSkills.textContent = 'No skills match the current filter.';
    _matrixBodyEl.appendChild(noSkills);
    return;
  }

  // Outer scrollable wrapper
  const scrollWrap = createElement('div', {
    style: [
      'overflow:auto;',
      'position:relative;',
      'border:1px solid var(--border-soft);',
      'border-radius:var(--radius-md);',
      'box-shadow:var(--shadow-sm);',
      'max-height:calc(100vh - 260px);',
    ].join(''),
  });

  const table = createElement('table', {
    style: [
      'border-collapse:separate;',
      'border-spacing:0;',
      'min-width:100%;',
      'font-size:13px;',
    ].join(''),
  });

  // ── THEAD ──────────────────────────────────────────────────────────────────
  const thead = createElement('thead');
  const headerRow = createElement('tr');

  // Corner cell
  const cornerTh = createElement('th', {
    style: [
      'position:sticky;top:0;left:0;z-index:3;',
      'background:var(--bg-elevated);',
      'border-bottom:2px solid var(--border-soft);',
      'border-right:2px solid var(--border-soft);',
      'padding:10px 16px;',
      'min-width:140px;',
      'text-align:left;',
      'font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);',
    ].join(''),
  });
  cornerTh.textContent = 'Engineer';
  headerRow.appendChild(cornerTh);

  skills.forEach(skill => {
    const th = createElement('th', {
      style: [
        'position:sticky;top:0;z-index:2;',
        'background:var(--bg-elevated);',
        'border-bottom:2px solid var(--border-soft);',
        'border-right:1px solid var(--border-soft);',
        'padding:10px 8px;',
        'min-width:60px;width:60px;max-width:80px;',
        'text-align:center;',
        'vertical-align:bottom;',
        'cursor:default;',
      ].join(''),
    });

    // Rotated skill name for compact headers
    const nameWrap = createElement('div', {
      style: [
        'writing-mode:vertical-lr;',
        'transform:rotate(180deg);',
        'white-space:nowrap;',
        'font-size:12px;font-weight:600;',
        'color:var(--text-secondary);',
        'letter-spacing:.02em;',
        'max-height:120px;overflow:hidden;text-overflow:ellipsis;',
        'padding-bottom:4px;',
      ].join(''),
    });
    nameWrap.textContent = skill.name;
    th.appendChild(nameWrap);
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // ── TBODY ──────────────────────────────────────────────────────────────────
  const tbody = createElement('tbody');

  engineers.forEach((engineer, rowIdx) => {
    const tr = createElement('tr', {
      style: 'transition:background-color var(--transition);',
    });

    // Row hover highlight (full row)
    tr.addEventListener('mouseenter', () => {
      tr.style.background = 'rgba(59,130,246,.06)';
    });
    tr.addEventListener('mouseleave', () => {
      tr.style.background = '';
    });

    // Engineer name cell (sticky left)
    const nameTd = createElement('td', {
      style: [
        'position:sticky;left:0;z-index:1;',
        'background:var(--bg-elevated);',
        `border-bottom:1px solid var(--border-soft);`,
        'border-right:2px solid var(--border-soft);',
        'padding:10px 16px;',
        'min-width:140px;',
        'white-space:nowrap;',
        'cursor:pointer;',
        'user-select:none;',
      ].join(''),
    });

    const nameSpan = createElement('span', {
      style: [
        'font-size:13px;font-weight:600;',
        'color:var(--text-primary);',
        'display:flex;align-items:center;gap:8px;',
        'transition:color var(--transition);',
      ].join(''),
    });
    nameSpan.textContent = engineer.name || `Engineer ${engineer.id}`;

    const drillIcon = createElement('span', {
      style: 'font-size:11px;color:var(--accent);opacity:0;transition:opacity var(--transition);',
    });
    drillIcon.textContent = '→';
    nameSpan.appendChild(drillIcon);

    nameTd.appendChild(nameSpan);

    // Double-click → navigate to engineer's plan
    nameTd.addEventListener('dblclick', () => {
      window.location.hash = `#/my-plan/${engineer.id}`;
    });

    nameTd.addEventListener('mouseenter', () => {
      nameSpan.style.color = 'var(--accent)';
      drillIcon.style.opacity = '1';
    });
    nameTd.addEventListener('mouseleave', () => {
      nameSpan.style.color = 'var(--text-primary)';
      drillIcon.style.opacity = '0';
    });

    // Tooltip hint on name cell
    nameTd.title = '';
    nameTd.addEventListener('mouseenter', () => {
      showTooltip(nameTd, `Double-click to view ${engineer.name || 'engineer'}'s plan`);
    });
    nameTd.addEventListener('mouseleave', hideTooltip);

    tr.appendChild(nameTd);

    // Skill cells
    const cells = engineer.cells || {};
    skills.forEach(skill => {
      const cell = cells[String(skill.id)] || { status: 'not_in_plan', proficiency_level: null };
      const td = buildMatrixCell(cell, engineer, skill);
      if (rowIdx === engineers.length - 1) {
        // no bottom border on last row
        td.style.borderBottom = 'none';
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scrollWrap.appendChild(table);
  _matrixBodyEl.appendChild(scrollWrap);

  // Summary row
  const summary = buildSummaryRow(engineers, skills);
  _matrixBodyEl.appendChild(summary);
}

// ─── Matrix cell ──────────────────────────────────────────────────────────────

function buildMatrixCell(cell, engineer, skill) {
  const { bg, border, icon } = getCellStyle(cell);

  const td = createElement('td', {
    style: [
      `background:${bg};`,
      `border:1px solid ${border};`,
      'padding:0;',
      'min-width:60px;width:60px;max-width:80px;',
      'height:44px;',
      'text-align:center;vertical-align:middle;',
      'cursor:default;',
      'transition:background-color var(--transition),border-color var(--transition),filter var(--transition);',
    ].join(''),
  });

  if (icon) {
    const iconEl = createElement('span', {
      style: 'font-size:14px;line-height:1;pointer-events:none;',
    });
    iconEl.textContent = icon;
    td.appendChild(iconEl);
  }

  // Hover: slightly brighten
  td.addEventListener('mouseenter', (e) => {
    td.style.filter = 'brightness(1.25)';
    const tooltipContent = buildTooltipContent(cell, engineer, skill);
    showTooltip(td, tooltipContent);
  });
  td.addEventListener('mouseleave', () => {
    td.style.filter = '';
    hideTooltip();
  });

  return td;
}

function getCellStyle(cell) {
  const { status, proficiency_level } = cell;

  if (status === 'not_in_plan') {
    return {
      bg: 'var(--bg-elevated)',
      border: 'var(--border-soft)',
      icon: null,
    };
  }

  if (status === 'in_pipeline') {
    return {
      bg: 'rgba(245,158,11,.18)',
      border: 'rgba(245,158,11,.4)',
      icon: '⏳',
    };
  }

  // in_development or proficiency — map by proficiency_level
  if (status === 'in_development' || status === 'proficiency') {
    const level = proficiency_level;
    if (level === 1) {
      return {
        bg: 'rgba(34,197,94,.18)',
        border: 'rgba(34,197,94,.35)',
        icon: status === 'proficiency' ? '✓' : null,
      };
    }
    if (level === 2) {
      return {
        bg: 'rgba(34,197,94,.42)',
        border: 'rgba(34,197,94,.55)',
        icon: status === 'proficiency' ? '✓' : null,
      };
    }
    if (level === 3) {
      return {
        bg: 'rgba(34,197,94,.75)',
        border: 'rgba(34,197,94,.85)',
        icon: status === 'proficiency' ? '✓' : null,
      };
    }
    // null level fallback → treat like in_pipeline
    return {
      bg: 'rgba(245,158,11,.18)',
      border: 'rgba(245,158,11,.4)',
      icon: '⏳',
    };
  }

  return {
    bg: 'var(--bg-elevated)',
    border: 'var(--border-soft)',
    icon: null,
  };
}

function buildTooltipContent(cell, engineer, skill) {
  const statusLabels = {
    not_in_plan: 'Not in Plan',
    in_pipeline: 'In Pipeline',
    in_development: 'In Development',
    proficiency: 'Proficiency',
  };
  const levelLabels = { 1: 'Education', 2: 'Exposure', 3: 'Experience' };

  const statusLabel = statusLabels[cell.status] || cell.status;
  let levelPart = '';

  if ((cell.status === 'in_development' || cell.status === 'proficiency') && cell.proficiency_level) {
    levelPart = ` · ${levelLabels[cell.proficiency_level] || `L${cell.proficiency_level}`}`;
  }

  return `${engineer.name} — ${skill.name}\n${statusLabel}${levelPart}`;
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function buildSummaryRow(engineers, skills) {
  const wrap = createElement('div', {
    style: 'margin-top:16px;display:flex;flex-wrap:wrap;gap:12px;',
  });

  const totalEngineers = engineers.length;
  const totalCells = engineers.length * skills.length;

  let covered = 0;
  let inDev = 0;
  let proficient = 0;
  engineers.forEach(eng => {
    const cells = eng.cells || {};
    skills.forEach(skill => {
      const cell = cells[String(skill.id)];
      if (!cell || cell.status === 'not_in_plan') return;
      covered++;
      if (cell.status === 'in_development') inDev++;
      if (cell.status === 'proficiency') proficient++;
    });
  });

  const coverage = totalCells > 0 ? Math.round((covered / totalCells) * 100) : 0;

  const stats = [
    { label: 'Engineers', value: String(totalEngineers) },
    { label: 'Skills', value: String(skills.length) },
    { label: 'Coverage', value: `${coverage}%` },
    { label: 'In Development', value: String(inDev) },
    { label: 'Proficient', value: String(proficient) },
  ];

  stats.forEach(({ label, value }) => {
    const pill = createElement('div', {
      className: 'stat-pill',
    });
    const strong = createElement('strong');
    strong.textContent = value;
    pill.appendChild(strong);
    pill.appendChild(document.createTextNode(label));
    wrap.appendChild(pill);
  });

  return wrap;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function buildTooltip() {
  if (_tooltipEl) return;
  const tip = document.createElement('div');
  tip.id = 'team-matrix-tooltip';
  tip.style.cssText = [
    'position:fixed;z-index:9999;',
    'background:var(--bg-elevated);',
    'border:1px solid var(--border-soft);',
    'border-radius:var(--radius-md);',
    'padding:8px 12px;',
    'font-size:12px;line-height:1.6;',
    'color:var(--text-primary);',
    'box-shadow:var(--shadow-md);',
    'pointer-events:none;',
    'white-space:pre-line;',
    'max-width:220px;',
    'opacity:0;',
    'transition:opacity .15s ease;',
  ].join('');
  document.body.appendChild(tip);
  _tooltipEl = tip;
}

let _mouseX = 0;
let _mouseY = 0;

document.addEventListener('mousemove', (e) => {
  _mouseX = e.clientX;
  _mouseY = e.clientY;
});

function positionTooltip() {
  if (!_tooltipEl || _tooltipEl.style.opacity === '0') return;
  const offset = 14;
  let x = _mouseX + offset;
  let y = _mouseY + offset;

  // Keep within viewport
  const tw = _tooltipEl.offsetWidth;
  const th = _tooltipEl.offsetHeight;
  if (x + tw > window.innerWidth - 8) x = _mouseX - tw - offset;
  if (y + th > window.innerHeight - 8) y = _mouseY - th - offset;

  _tooltipEl.style.left = `${x}px`;
  _tooltipEl.style.top = `${y}px`;
}

function showTooltip(el, content) {
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
  icon.textContent = '👥';

  const title = createElement('h3');
  title.textContent = 'No Direct Reports';

  const desc = createElement('p');
  desc.textContent = "You don't have any engineers reporting to you yet.";

  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(desc);
  container.appendChild(state);
}

function renderErrorState(container, msg) {
  const state = createElement('div', {
    style: 'text-align:center;padding:60px 24px;',
  });

  const icon = createElement('div', { style: 'font-size:36px;margin-bottom:16px;' });
  icon.textContent = '⚠️';

  const title = createElement('div', {
    style: 'font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;',
  });
  title.textContent = 'Failed to load team matrix';

  const desc = createElement('div', {
    style: 'font-size:13px;color:var(--text-secondary);margin-bottom:20px;',
  });
  desc.textContent = msg || 'Please try refreshing the page.';

  const retryBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => loadMatrix());

  state.appendChild(icon);
  state.appendChild(title);
  state.appendChild(desc);
  state.appendChild(retryBtn);
  container.appendChild(state);
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

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
