import { api, API_BASE } from '../api.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { el } from '../utils/dom.js';

let _root = null;
let _overlay = null;
let _engineerId = null;
let _engineerName = '';
let _activeReport = 'landscape';
let _previewData = null;
let _aiMarkdown = null;

const MPR_ICONS = {
  landscape: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  stagnation: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>',
  ai: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"/><path d="M19 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/></svg>',
  fileText: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
};

const REPORTS = [
  { id: 'landscape', label: 'Skills Landscape', desc: 'Status × category snapshot', icon: 'landscape' },
  { id: 'activity', label: 'Activity History', desc: 'Audit trail by date range', icon: 'activity' },
  { id: 'stagnation', label: 'Stagnation / Focus', desc: 'Skills needing attention', icon: 'stagnation' },
  { id: 'ai', label: 'AI Development Summary', desc: 'Personal growth review', icon: 'ai' },
];

const CATEGORY_CHIPS = ['foundational', 'core', 'advanced', 'ai-future'];
const STATUS_CHIPS = ['developing', 'planned', 'mastered'];

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function defaultFromDate() {
  return new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function iconSpan(name) {
  const span = el('span', { className: 'mpr-catalog-item__icon-svg' });
  span.innerHTML = MPR_ICONS[name] || '';
  return span;
}

function generateLabel() {
  return _activeReport === 'ai' ? 'Generate Summary' : 'Generate Preview';
}

/** Open the Reporting modal (matches Skill Detail modal shell). */
export function openReportingModal(engineerId, engineerName = '') {
  closeReportingModal();
  _engineerId = engineerId;
  _engineerName = engineerName;
  _activeReport = 'landscape';
  _previewData = null;
  _aiMarkdown = null;

  _root = document.getElementById('modalRoot');
  _overlay = el('div', { className: 'modal-overlay', id: 'mpr-overlay' });
  const modal = el('div', {
    className: 'modal mpr-plan-modal sdm-plan-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Development Reports',
  });

  const body = el('div', { className: 'modal-body mpr-modal-body sdm-modal-body' });
  body.appendChild(buildShell());
  modal.appendChild(body);

  const footer = el('div', { className: 'modal-footer sdm-footer mpr-modal-footer' });
  const footerStatus = el('span', { className: 'sdm-footer__status', id: 'mpr-footer-meta' });
  footerStatus.textContent = 'Generate a preview to load report data.';
  const exportBtn = el('button', { type: 'button', className: 'btn btn-primary btn-sm', id: 'mpr-pdf-btn' });
  exportBtn.textContent = 'Export PDF';
  exportBtn.addEventListener('click', () => exportPdf());
  footer.appendChild(footerStatus);
  footer.appendChild(exportBtn);
  modal.appendChild(footer);

  _overlay.appendChild(modal);
  _root.appendChild(_overlay);

  _overlay.addEventListener('click', e => {
    if (e.target === _overlay) closeReportingModal();
  });
  document.addEventListener('keydown', onKeyDown);

  requestAnimationFrame(() => {
    _overlay.classList.add('open');
    _overlay.querySelector('.sdm-close')?.focus();
  });

  loadPreview();
}

function onKeyDown(e) {
  if (e.key === 'Escape') closeReportingModal();
}

export function closeReportingModal() {
  document.removeEventListener('keydown', onKeyDown);
  if (_overlay) {
    _overlay.classList.remove('open');
    setTimeout(() => {
      _overlay?.remove();
      _overlay = null;
      _root = null;
    }, 150);
  }
}

function buildShell() {
  const shell = el('div', { className: 'mpr-shell', id: 'mpr-shell' });

  const sidebar = el('aside', { className: 'mpr-sidebar' });
  const catTitle = el('div', { className: 'mpr-sidebar__title' });
  catTitle.textContent = 'Report catalog';
  sidebar.appendChild(catTitle);

  REPORTS.forEach(r => {
    const btn = el('button', {
      type: 'button',
      className: `mpr-catalog-item${r.id === _activeReport ? ' active' : ''}`,
      'data-report': r.id,
    });
    const labelWrap = el('span');
    labelWrap.innerHTML =
      `<div class="mpr-catalog-item__label">${escHtml(r.label)}</div>` +
      `<div class="mpr-catalog-item__desc">${escHtml(r.desc)}</div>`;
    btn.appendChild(iconSpan(r.icon));
    btn.appendChild(labelWrap);
    btn.addEventListener('click', () => {
      _activeReport = r.id;
      _previewData = null;
      _aiMarkdown = null;
      refreshShell();
      if (_activeReport !== 'ai') loadPreview();
      else renderPreviewEmpty();
    });
    sidebar.appendChild(btn);
  });

  const main = el('div', { className: 'mpr-main' });

  const header = el('header', { className: 'mpr-main-header' });
  const headerTop = el('div', { className: 'mpr-main-header__top' });
  const titleBlock = el('div');
  const meta = REPORTS.find(r => r.id === _activeReport);
  titleBlock.innerHTML =
    `<h2 class="mpr-main-header__title">${escHtml(meta?.label || 'Report')}</h2>` +
    `<p class="mpr-main-header__sub" id="mpr-header-sub">${escHtml(meta?.desc || '')}</p>`;
  const closeBtn = el('button', { type: 'button', className: 'sdm-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  closeBtn.addEventListener('click', () => closeReportingModal());
  headerTop.appendChild(titleBlock);
  headerTop.appendChild(closeBtn);
  header.appendChild(headerTop);

  const toolbar = el('div', { className: 'mpr-toolbar' });
  toolbar.appendChild(buildFilters());
  const toolbarActions = el('div', { className: 'mpr-toolbar__actions' });
  const previewBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    id: 'mpr-preview-btn',
  });
  previewBtn.textContent = generateLabel();
  previewBtn.addEventListener('click', () => loadPreview());
  toolbarActions.appendChild(previewBtn);
  toolbar.appendChild(toolbarActions);
  header.appendChild(toolbar);

  main.appendChild(header);
  main.appendChild(el('div', { className: 'mpr-preview', id: 'mpr-preview' }));

  shell.appendChild(sidebar);
  shell.appendChild(main);
  return shell;
}

function refreshShell() {
  const body = _overlay?.querySelector('.mpr-modal-body');
  if (!body) return;
  body.innerHTML = '';
  body.appendChild(buildShell());
  updateFooterMeta();
}

function buildFilters() {
  const filters = el('div', { className: 'mpr-filters', id: 'mpr-filters' });

  if (_activeReport === 'activity' || _activeReport === 'ai') {
    filters.appendChild(filterDateGroup('From', 'mpr-from', defaultFromDate()));
    filters.appendChild(filterDateGroup('To', 'mpr-to', todayStr()));
  }

  if (_activeReport === 'landscape' || _activeReport === 'stagnation') {
    filters.appendChild(buildChipGroup('Categories', 'mpr-cat-chips', 'cat', ['all', ...CATEGORY_CHIPS], c =>
      c === 'all' ? 'All' : c.replace('-', ' ').replace(/\b\w/g, x => x.toUpperCase())
    ));
  }

  if (_activeReport === 'landscape') {
    filters.appendChild(buildChipGroup('Status', 'mpr-status-chips', 'status', ['all', ...STATUS_CHIPS], s =>
      s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
    ));
  }

  if (_activeReport === 'stagnation') {
    const stWrap = el('div', { className: 'mpr-filter-group' });
    stWrap.innerHTML = '<label>No updates for</label>';
    const chips = el('div', { className: 'mpr-filter-chips', id: 'mpr-days-chips' });
    [30, 60, 90].forEach(d => {
      const chip = el('button', {
        type: 'button',
        className: `mpr-filter-chip${d === 60 ? ' active' : ''}`,
        'data-days': String(d),
      });
      chip.textContent = `${d} days`;
      chip.addEventListener('click', () => {
        chips.querySelectorAll('.mpr-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
      chips.appendChild(chip);
    });
    stWrap.appendChild(chips);
    filters.appendChild(stWrap);
  }

  if (_activeReport === 'activity') {
    const sortWrap = el('div', { className: 'mpr-filter-group' });
    sortWrap.innerHTML = '<label>Sort</label>';
    const sel = el('select', { id: 'mpr-activity-sort' });
    sel.innerHTML = '<option value="desc">Newest first</option><option value="asc">Oldest first</option>';
    sortWrap.appendChild(sel);
    filters.appendChild(sortWrap);
  }

  return filters;
}

function buildChipGroup(label, id, dataKey, values, fmt) {
  const wrap = el('div', { className: 'mpr-filter-group' });
  wrap.innerHTML = `<label>${label}</label>`;
  const chips = el('div', { className: 'mpr-filter-chips', id });
  values.forEach(v => {
    const chip = el('button', {
      type: 'button',
      className: 'mpr-filter-chip active',
      [`data-${dataKey}`]: v,
    });
    chip.textContent = fmt(v);
    chip.addEventListener('click', () => toggleChip(chip, `#${id}`, dataKey));
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  return wrap;
}

function filterDateGroup(label, id, value) {
  const g = el('div', { className: 'mpr-filter-group' });
  g.innerHTML = `<label>${label}</label>`;
  g.appendChild(el('input', { type: 'date', id, value }));
  return g;
}

function q(sel) {
  return _overlay?.querySelector(sel) ?? null;
}

function toggleChip(chip, containerSel, allKey) {
  const container = q(containerSel);
  if (!container) return;
  const allVal = chip.dataset[allKey];
  if (allVal === 'all') {
    container.querySelectorAll('.mpr-filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    return;
  }
  container.querySelector(`[data-${allKey}="all"]`)?.classList.remove('active');
  chip.classList.toggle('active');
  const any = container.querySelectorAll(
    `.mpr-filter-chip.active:not([data-${allKey}="all"])`
  );
  if (!any.length) {
    container.querySelector(`[data-${allKey}="all"]`)?.classList.add('active');
  }
}

function activeCategories() {
  const all = q('#mpr-cat-chips [data-cat="all"]')?.classList.contains('active');
  if (all) return null;
  return [...(q('#mpr-cat-chips')?.querySelectorAll('.mpr-filter-chip.active') || [])]
    .map(c => c.dataset.cat).filter(Boolean);
}

function activeStatuses() {
  const all = q('#mpr-status-chips [data-status="all"]')?.classList.contains('active');
  if (all) return null;
  return [...(q('#mpr-status-chips')?.querySelectorAll('.mpr-filter-chip.active') || [])]
    .map(c => c.dataset.status).filter(s => s && s !== 'all');
}

function activeDays() {
  const active = q('#mpr-days-chips .mpr-filter-chip.active');
  return active ? Number(active.dataset.days) : 60;
}

async function loadPreview() {
  const preview = q('#mpr-preview');
  if (!preview) return;

  const btn = q('#mpr-preview-btn');
  const pdfBtn = q('#mpr-pdf-btn');
  let statusTimer = null;

  const restoreBtn = () => {
    if (btn?.dataset.originalLabel) {
      btn.textContent = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
      btn.disabled = false;
    }
    if (pdfBtn) pdfBtn.disabled = false;
  };

  const setAnalyzingBtn = () => {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.originalLabel = btn.textContent;
    btn.innerHTML = '<span class="mt-analyze-spinner" aria-hidden="true"></span>Analyzing…';
  };

  if (_activeReport === 'ai') {
    renderAiLoading();
    setAnalyzingBtn();
    if (pdfBtn) pdfBtn.disabled = true;
    const statusEl = preview.querySelector('.mt-analyze-loading-status');
    const statusMessages = [
      'Collecting your plan data and activity history…',
      'Summarizing skill progress and 3E coverage…',
      'Asking the AI to draft your development review…',
      'Polishing the summary output…',
    ];
    let statusIdx = 0;
    statusTimer = setInterval(() => {
      statusIdx = (statusIdx + 1) % statusMessages.length;
      if (statusEl) statusEl.textContent = statusMessages[statusIdx];
    }, 4000);
  } else {
    showSkeleton(preview, 'list');
    if (btn) btn.disabled = true;
  }

  try {
    if (_activeReport === 'landscape') {
      const query = buildQuery({ categories: activeCategories(), statuses: activeStatuses() });
      _previewData = await api.get(`/api/reports/plans/${_engineerId}/landscape${query}`);
      _engineerName = _previewData.engineer_name || _engineerName;
      renderLandscape(_previewData);
    } else if (_activeReport === 'activity') {
      const from = q('#mpr-from')?.value || defaultFromDate();
      const to = q('#mpr-to')?.value || todayStr();
      const sort = q('#mpr-activity-sort')?.value || 'desc';
      _previewData = await api.get(
        `/api/reports/plans/${_engineerId}/activity?from_date=${from}&to_date=${to}&sort=${sort}`
      );
      renderActivity(_previewData);
    } else if (_activeReport === 'stagnation') {
      const days = activeDays();
      const query = buildQuery({ categories: activeCategories(), days });
      _previewData = await api.get(`/api/reports/plans/${_engineerId}/stagnation${query}`);
      renderStagnation(_previewData);
    } else if (_activeReport === 'ai') {
      const from = q('#mpr-from')?.value || defaultFromDate();
      const to = q('#mpr-to')?.value || todayStr();
      _previewData = await api.post(`/api/reports/plans/${_engineerId}/ai-summary`, {
        from_date: from,
        to_date: to,
      });
      _aiMarkdown = _previewData.markdown;
      renderAiSummary(_previewData);
    }
    updateFooterMeta();
  } catch (err) {
    preview.innerHTML = '';
    if (_activeReport === 'ai') {
      preview.appendChild(renderAiError(err.message || 'Failed to generate report.'));
    } else {
      preview.appendChild(el('div', {
        className: 'empty-state empty-state--compact',
        textContent: err.message || 'Failed to load report.',
      }));
    }
    showToast({ message: err.message || 'Report failed', type: 'error' });
  } finally {
    if (statusTimer) clearInterval(statusTimer);
    if (_activeReport === 'ai') {
      restoreBtn();
    } else if (btn) {
      btn.disabled = false;
    }
  }
}

function renderAiLoading() {
  const preview = q('#mpr-preview');
  if (!preview) return;
  preview.innerHTML =
    '<div class="mt-analyze-loading mpr-ai-generating" role="status" aria-live="polite">' +
    '<div class="mt-analyze-loading-spinner" aria-hidden="true"></div>' +
    '<h4>Generating development summary…</h4>' +
    '<p class="mt-analyze-loading-status">Collecting your plan data and activity history.</p>' +
    '<p class="mt-analyze-loading-hint">This usually takes 10–40 seconds.</p>' +
    '</div>';
  const meta = q('#mpr-footer-meta');
  if (meta) meta.textContent = 'Waiting for AI response…';
}

function renderAiError(message) {
  const wrap = el('div', { className: 'mt-analyze-error' });
  wrap.innerHTML =
    '<div class="mt-analyze-error-icon" aria-hidden="true">⚠</div>' +
    `<h4>Unable to generate summary</h4><p>${escHtml(message)}</p>`;
  return wrap;
}

function renderPreviewEmpty() {
  const preview = q('#mpr-preview');
  if (!preview) return;
  preview.innerHTML = '';
  const empty = el('div', { className: 'mpr-ai-loading' });
  empty.innerHTML =
    '<p>Select a date range and click <strong>Generate Summary</strong> to create your personal development review.</p>';
  preview.appendChild(empty);
}

function buildQuery(opts) {
  const parts = [];
  if (opts.categories?.length) parts.push(`categories=${opts.categories.join(',')}`);
  if (opts.statuses?.length) parts.push(`statuses=${opts.statuses.join(',')}`);
  if (opts.days) parts.push(`days=${opts.days}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function updateFooterMeta() {
  const meta = q('#mpr-footer-meta');
  const sub = q('#mpr-header-sub');
  if (!meta) return;
  const gen = _previewData?.generated_at
    ? new Date(_previewData.generated_at).toLocaleString()
    : null;
  meta.textContent = gen ? `Last generated: ${gen}` : 'Generate a preview to load report data.';
  if (sub && _engineerName) {
    const desc = REPORTS.find(r => r.id === _activeReport)?.desc || '';
    sub.textContent = `${_engineerName} · ${desc}`;
  }
}

function renderLandscape(data) {
  const preview = q('#mpr-preview');
  preview.innerHTML = '';

  const s = data.summary || {};
  const by = s.by_status || {};
  const kpis = el('div', { className: 'mpr-kpi-row mpr-kpi-row--landscape' });
  [
    ['Total skills', s.total_skills ?? 0, ''],
    ['Developing', by.developing ?? 0, 'developing'],
    ['Planned', by.planned ?? 0, 'planned'],
    ['Mastered', by.mastered ?? 0, 'mastered'],
    ['Avg completion', `${s.avg_completion_pct ?? 0}%`, ''],
  ].forEach(([label, val, tone]) => {
    const k = el('div', { className: `mpr-kpi${tone ? ` mpr-kpi--${tone}` : ''}` });
    k.innerHTML = `<div class="mpr-kpi__label">${label}</div><div class="mpr-kpi__value">${val}</div>`;
    kpis.appendChild(k);
  });
  preview.appendChild(kpis);

  const statusLabels = { developing: 'Developing', planned: 'Planned', mastered: 'Mastered' };
  Object.entries(data.groups || {}).forEach(([status, catGroups]) => {
    const total = Object.values(catGroups).reduce((n, arr) => n + arr.length, 0);
    if (!total) return;

    const group = el('div', { className: 'mpr-status-group' });
    group.innerHTML =
      `<div class="mpr-status-group__header">` +
      `<span class="mpr-status-dot mpr-status-dot--${status}"></span>` +
      `<span class="mpr-status-group__title">${statusLabels[status] || status}</span>` +
      `<span class="mpr-status-group__count">${total} skills</span></div>`;

    Object.entries(catGroups).forEach(([cat, skills]) => {
      if (!skills.length) return;
      const sec = el('div', { className: 'mpr-category-section' });
      sec.innerHTML = `<div class="mpr-category-section__header">${escHtml(cat.replace(/-/g, ' '))} · ${skills.length}</div>`;
      const table = el('table', { className: 'mpr-skill-table' });
      table.innerHTML =
        '<thead><tr><th>Skill</th><th>Completion</th><th>Focus</th><th>Actions</th><th>Last activity</th></tr></thead>';
      const tbody = el('tbody');
      skills.forEach(sk => {
        const tr = el('tr');
        const la = sk.last_activity_at ? sk.last_activity_at.slice(0, 10) : '—';
        tr.innerHTML =
          `<td><strong>${escHtml(sk.skill_name)}</strong></td>` +
          `<td><div class="mpr-progress-bar"><div class="mpr-progress-bar__fill" style="width:${sk.completion_pct}%"></div></div> ${sk.completion_pct}%</td>` +
          `<td>${escHtml(sk.focus_label)}</td>` +
          `<td>${sk.logged_actions}</td>` +
          `<td>${la}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      sec.appendChild(table);
      group.appendChild(sec);
    });
    preview.appendChild(group);
  });
}

function renderActivity(data) {
  const preview = q('#mpr-preview');
  preview.innerHTML = '';

  const intro = el('p', { className: 'mpr-preview-intro' });
  intro.textContent = `${data.total_events || 0} events across ${data.skills?.length || 0} skills · ${data.from_date || ''} to ${data.to_date || ''}`;
  preview.appendChild(intro);

  if (!data.skills?.length) {
    preview.appendChild(el('div', {
      className: 'empty-state empty-state--compact',
      textContent: 'No activity found for this period.',
    }));
    return;
  }

  data.skills.forEach(skill => {
    const block = el('div', { className: 'mpr-activity-skill' });
    block.innerHTML =
      `<div class="mpr-activity-skill__header">` +
      `<div><div class="mpr-activity-skill__name">${escHtml(skill.skill_name)}</div>` +
      `<div class="mpr-activity-skill__meta">${escHtml((skill.categories || []).join(', '))} · ${escHtml(skill.status)} · ${skill.event_count} events</div></div></div>`;

    const timeline = el('div', { className: 'mpr-timeline' });
    (skill.events || []).forEach(ev => {
      const row = el('div', { className: 'mpr-timeline-item' });
      const ts = (ev.timestamp || '').slice(0, 16).replace('T', ' ');
      let detail = ev.new || ev.previous || '—';
      if (ev.previous && ev.new) detail = `${ev.previous} → ${ev.new}`;
      const typeClass = ev.activity_type?.includes('complete') ? 'complete'
        : ev.activity_type?.includes('status') ? 'status'
        : ev.activity_type?.includes('focus') ? 'focus' : 'added';
      row.innerHTML =
        `<span class="mpr-timeline-item__time">${ts}</span>` +
        `<span><span class="mpr-event-badge mpr-event-badge--${typeClass}">${escHtml(ev.activity_label)}</span></span>` +
        `<span>${escHtml(detail)}${ev.comment ? ` <em>(${escHtml(ev.comment)})</em>` : ''}</span>`;
      timeline.appendChild(row);
    });
    block.appendChild(timeline);
    preview.appendChild(block);
  });
}

function renderStagnation(data) {
  const preview = q('#mpr-preview');
  preview.innerHTML = '';

  const alert = el('div', { className: 'mpr-stale-alert' });
  alert.innerHTML =
    `<span class="mpr-stale-alert__icon">${MPR_ICONS.stagnation}</span>` +
    `<div><strong>${data.stale_count || 0} skill(s)</strong> in Developing status ` +
    `with no activity in the last <strong>${data.threshold_days}</strong> days.</div>`;
  preview.appendChild(alert);

  if (!data.skills?.length) {
    preview.appendChild(el('div', {
      className: 'empty-state empty-state--compact',
      textContent: 'No stale developing skills — great momentum!',
    }));
    return;
  }

  const table = el('table', { className: 'mpr-skill-table' });
  table.innerHTML =
    '<thead><tr><th>Skill</th><th>Completion</th><th>Focus</th><th>Last activity</th><th>Open</th><th>Days stale</th></tr></thead>';
  const tbody = el('tbody');
  data.skills.forEach(sk => {
    const tr = el('tr');
    tr.innerHTML =
      `<td><strong>${escHtml(sk.skill_name)}</strong></td>` +
      `<td>${sk.completion_pct}%</td>` +
      `<td>${escHtml(sk.focus_label)}</td>` +
      `<td>${(sk.last_activity_at || '—').slice(0, 10)}</td>` +
      `<td>${sk.open_actions}</td>` +
      `<td class="mpr-stale-days">${sk.days_since_last_activity ?? '—'}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  preview.appendChild(table);

  if (data.recommendations?.length) {
    const reco = el('div', { className: 'mpr-reco-card' });
    reco.innerHTML = '<h3>Suggested next steps</h3>';
    const ul = el('ul', { className: 'mpr-reco-list' });
    data.recommendations.forEach(r => {
      const li = el('li');
      li.textContent = r;
      ul.appendChild(li);
    });
    reco.appendChild(ul);
    preview.appendChild(reco);
  }
}

function renderAiSummary(data) {
  const preview = q('#mpr-preview');
  preview.innerHTML = '';
  const content = el('div', { className: 'mpr-ai-content markdown-body mt-analyze-result-content' });
  if (typeof marked !== 'undefined') {
    content.innerHTML = DOMPurify.sanitize(marked.parse(data.markdown || ''));
  } else {
    content.textContent = data.markdown || '';
  }
  preview.appendChild(content);
}

async function exportPdf() {
  if (_activeReport !== 'ai' && !_previewData) {
    showToast({ message: 'Generate a preview first', type: 'warning' });
    return;
  }
  if (_activeReport === 'ai' && !_aiMarkdown) {
    showToast({ message: 'Generate the AI summary first', type: 'warning' });
    return;
  }

  const typeMap = { landscape: 'landscape', activity: 'activity', stagnation: 'stagnation', ai: 'ai_summary' };
  const body = {
    report_type: typeMap[_activeReport],
    from_date: q('#mpr-from')?.value || null,
    to_date: q('#mpr-to')?.value || null,
    threshold_days: activeDays(),
    categories: activeCategories(),
    statuses: activeStatuses(),
  };
  if (_activeReport === 'ai') {
    body.markdown = _aiMarkdown;
    body.title = 'AI Development Summary';
  }

  try {
    const token = localStorage.getItem('matrixpro_token');
    const res = await fetch(`${API_BASE}/api/reports/plans/${_engineerId}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${_activeReport}_report.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'PDF downloaded', type: 'success' });
  } catch (err) {
    showToast({ message: err.message || 'PDF export failed', type: 'error' });
  }
}
