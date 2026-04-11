import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { el } from '../utils/dom.js';

let _container = null;
let _engineerId = null;
let _planData = null;
let _draggingPlanSkillId = null;
let _sectionGridEls = {};
let _allCatalogSkills = [];
let _searchQuery = '';

const SVG_ICONS = {
  wrench: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  layers: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  shield: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  search: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  fileText: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  table: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  bookOpen: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  checkCircle: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  pencil: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  calendar: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
};

function svgIcon(name, size) {
  const span = document.createElement('span');
  span.className = 'mp-icon';
  span.style.fontSize = size || '16px';
  span.innerHTML = SVG_ICONS[name] || '';
  return span;
}

const SECTIONS = [
  { status: 'in_development', title: 'In Development', subtitle: 'Actively building these skills', svgIcon: 'wrench', iconClass: 'mp-card-icon--dev' },
  { status: 'in_pipeline', title: 'In Pipeline', subtitle: 'Queued and waiting to start', svgIcon: 'layers', iconClass: 'mp-card-icon--pipe' },
  { status: 'proficiency', title: 'Proficiency', subtitle: 'Completed — skill fully acquired', svgIcon: 'shield', iconClass: 'mp-card-icon--prof' },
];

const STATUS_LABELS = {
  in_pipeline: 'In Pipeline',
  in_development: 'In Development',
  proficiency: 'Proficiency',
};

export function mountMyPlan(container, params) {
  _container = container;
  container.innerHTML = '';

  _planData = null;
  _draggingPlanSkillId = null;
  _sectionGridEls = {};
  _allCatalogSkills = [];
  _searchQuery = '';

  const user = Store.get('user');
  _engineerId = params?.id ? Number(params.id) : user?.id;

  buildPageShell(container, params);
  loadPlan();

  return () => {};
}

async function loadPlan() {
  Object.values(_sectionGridEls).forEach(grid => showSkeleton(grid, 'cards'));

  try {
    _planData = await api.get(`/api/plans/${_engineerId}`);
    renderSections();
  } catch (err) {
    const msg = err.message || 'Failed to load plan';
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission')) {
      showPermissionError();
    } else {
      showToast(msg, 'error');
      showPermissionError('Failed to load plan. Please try refreshing.');
    }
  }
}

async function reloadPlan() {
  try {
    _planData = await api.get(`/api/plans/${_engineerId}`);
    renderSections();
  } catch (err) {
    showToast(err.message || 'Failed to reload plan', 'error');
  }
}

function buildPageShell(container, params) {
  const wrapper = el('div', { className: 'mp-wrapper' });

  if (params?.id) {
    const banner = el('div', { className: 'mp-banner', id: 'manager-banner' });
    const chip = el('span', { className: 'triage-chip triage-signal' });
    chip.textContent = 'Manager View';
    const label = el('span', { id: 'manager-banner-label' });
    label.textContent = "Viewing engineer's plan";
    banner.appendChild(chip);
    banner.appendChild(label);
    wrapper.appendChild(banner);
  }

  const header = el('div', { className: 'mp-header' });
  const title = el('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('My Development '));
  const gradientSpan = el('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Plan';
  title.appendChild(gradientSpan);
  const subtitle = el('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Track and manage your skill development journey';
  header.appendChild(title);
  header.appendChild(subtitle);
  wrapper.appendChild(header);

  const searchWrap = el('div', { className: 'mp-search' });
  const searchBox = el('div', { className: 'mp-search-box' });
  const searchIcon = el('span', { className: 'mp-search-icon' });
  searchIcon.appendChild(svgIcon('search', '16px'));
  const searchInput = el('input', {
    className: 'search-input search-input--lg',
    type: 'text',
    placeholder: 'Search skills by name...',
  });
  let debounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      _searchQuery = searchInput.value.trim().toLowerCase();
      renderSections();
    }, 200);
  });
  searchBox.appendChild(searchIcon);
  searchBox.appendChild(searchInput);
  searchWrap.appendChild(searchBox);
  wrapper.appendChild(searchWrap);

  const infobar = el('div', { className: 'mp-infobar' });
  const statsRow = el('div', { className: 'stats-row', id: 'mp-stats-row' });
  const infoRight = el('div', { className: 'mp-infobar-right' });

  const addBtn = el('button', { className: 'btn btn-primary btn-sm' });
  addBtn.textContent = '+ Add Skill';
  addBtn.addEventListener('click', openAddSkillModal);

  infoRight.appendChild(addBtn);
  infobar.appendChild(statsRow);
  infobar.appendChild(infoRight);
  wrapper.appendChild(infobar);

  const sections = el('div', { className: 'mp-sections' });

  SECTIONS.forEach(({ status, title: sTitle, subtitle: sSub, svgIcon: sIcon }) => {
    const section = buildSection(status, sTitle, sSub, sIcon);
    sections.appendChild(section);
  });

  wrapper.appendChild(sections);

  const exportFooter = el('div', { className: 'mp-export-footer' });
  const pdfBtn = el('button', { className: 'mp-export-btn' });
  pdfBtn.appendChild(svgIcon('fileText', '14px'));
  pdfBtn.appendChild(document.createTextNode(' Export PDF'));
  pdfBtn.addEventListener('click', () => downloadExport(`/api/export/plans/${_engineerId}/pdf`, `plan_${_engineerId}.pdf`));
  const csvBtn = el('button', { className: 'mp-export-btn' });
  csvBtn.appendChild(svgIcon('table', '14px'));
  csvBtn.appendChild(document.createTextNode(' Export CSV'));
  csvBtn.addEventListener('click', () => downloadExport(`/api/export/plans/${_engineerId}/csv`, `plan_${_engineerId}.csv`));
  exportFooter.appendChild(pdfBtn);
  exportFooter.appendChild(csvBtn);
  wrapper.appendChild(exportFooter);

  container.appendChild(wrapper);
}

function buildSection(status, title, subtitle, iconName) {
  const wrapper = el('div', { className: 'mp-section-wrapper' });

  const header = el('div', { className: 'mp-section-header' });
  header.dataset.status = status;
  const iconEl = svgIcon(iconName, '28px');
  iconEl.classList.add('mp-section-icon');

  const titleGroup = el('div', { className: 'mp-section-title-group' });
  const titleEl = el('span', { className: 'mp-section-title' });
  titleEl.textContent = title;
  const subtitleEl = el('div', { className: 'mp-section-subtitle' });
  subtitleEl.textContent = subtitle;
  titleGroup.appendChild(titleEl);
  titleGroup.appendChild(subtitleEl);

  const countEl = el('span', { className: 'mp-section-count', id: `mp-count-${status}` });
  countEl.textContent = '0';
  header.appendChild(iconEl);
  header.appendChild(titleGroup);
  header.appendChild(countEl);
  wrapper.appendChild(header);

  const section = el('div', { className: 'mp-section' });
  section.dataset.status = status;

  const grid = el('div', { className: 'mp-section-grid', id: `mp-grid-${status}` });
  _sectionGridEls[status] = grid;

  section.addEventListener('dragover', (e) => {
    e.preventDefault();
    section.classList.add('drag-over');
  });

  section.addEventListener('dragleave', (e) => {
    if (!section.contains(e.relatedTarget)) {
      section.classList.remove('drag-over');
    }
  });

  section.addEventListener('drop', (e) => {
    e.preventDefault();
    section.classList.remove('drag-over');
    const planSkillId = Number(e.dataTransfer.getData('planSkillId'));
    const fromStatus = e.dataTransfer.getData('fromStatus');
    if (!planSkillId || fromStatus === status) return;
    handleMoveCard(planSkillId, status);
  });

  section.appendChild(grid);
  wrapper.appendChild(section);
  return wrapper;
}

function renderSections() {
  if (!_planData) return;

  const bannerLabel = document.getElementById('manager-banner-label');
  if (bannerLabel && _planData.engineer_name) {
    bannerLabel.textContent = `Viewing ${_planData.engineer_name}'s plan`;
  }

  const skills = Array.isArray(_planData.skills) ? _planData.skills : [];

  const filtered = _searchQuery
    ? skills.filter(s => (s.skill_name || '').toLowerCase().includes(_searchQuery))
    : skills;

  const groups = {
    in_development: filtered.filter(s => s.status === 'in_development'),
    in_pipeline: filtered.filter(s => s.status === 'in_pipeline'),
    proficiency: filtered.filter(s => s.status === 'proficiency'),
  };

  const totalCount = filtered.length;
  updateStatsRow(skills, groups);

  Object.entries(groups).forEach(([status, statusSkills]) => {
    const grid = _sectionGridEls[status];
    const countEl = document.getElementById(`mp-count-${status}`);
    if (!grid) return;

    grid.innerHTML = '';
    if (countEl) countEl.textContent = String(statusSkills.length);

    if (statusSkills.length === 0) {
      const empty = el('div', { className: 'empty-state empty-state--inline' });
      empty.textContent = _searchQuery
        ? 'No matching skills in this section.'
        : 'No skills yet — browse the catalog to get started!';
      grid.appendChild(empty);
      return;
    }

    const sectionDef = SECTIONS.find(s => s.status === status);

    statusSkills.forEach(planSkill => {
      const card = buildCard(planSkill, status, sectionDef?.iconClass || 'mp-card-icon--dev');
      grid.appendChild(card);
    });
  });
}

function updateStatsRow(allSkills, groups) {
  const row = document.getElementById('mp-stats-row');
  if (!row) return;
  row.innerHTML = '';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQ = Math.floor(now.getMonth() / 3);
  const qStart = new Date(currentYear, currentQ * 3, 1);

  let logsThisQ = 0;
  let logsThisYear = 0;

  allSkills.forEach(s => {
    const logs = Array.isArray(s.training_logs) ? s.training_logs : [];
    logs.forEach(log => {
      const d = log.completed_at ? new Date(log.completed_at) : null;
      if (!d || isNaN(d.getTime())) return;
      if (d.getFullYear() === currentYear) logsThisYear++;
      if (d >= qStart) logsThisQ++;
    });
  });

  const stats = [
    { value: allSkills.length, label: 'Total Skills', icon: 'bookOpen' },
    { value: groups.in_development.length, label: 'In Development', icon: 'wrench' },
    { value: groups.proficiency.length, label: 'Proficient', icon: 'checkCircle' },
    { value: logsThisQ, label: 'Logs This Quarter', icon: 'pencil' },
    { value: logsThisYear, label: 'Logs This Year', icon: 'calendar' },
  ];

  stats.forEach(({ value, label, icon }) => {
    const block = el('div', { className: 'stat-block' });
    const valEl = el('div', { className: 'stat-block-value' });
    valEl.textContent = value;
    const labelEl = el('div', { className: 'stat-block-label' });
    labelEl.textContent = label;
    block.appendChild(valEl);
    block.appendChild(labelEl);
    row.appendChild(block);
  });
}

function buildCard(planSkill, status, iconClass) {
  const card = el('div', { className: 'mp-card' });
  card.dataset.planSkillId = planSkill.id;
  card.dataset.status = status;
  card.setAttribute('draggable', 'true');

  const top = el('div', { className: 'mp-card-top' });

  const icon = el('div', { className: `mp-card-icon ${iconClass}` });
  const skillName = planSkill.skill_name || 'Unknown Skill';
  icon.textContent = skillName.charAt(0);
  top.appendChild(icon);

  const info = el('div', { className: 'mp-card-info' });
  const nameEl = el('div', { className: 'mp-card-name' });
  nameEl.textContent = skillName;
  info.appendChild(nameEl);

  const badgeWrap = el('div', { className: 'mp-card-badge' });
  badgeWrap.appendChild(buildProficiencyBadge(planSkill.proficiency_level));
  info.appendChild(badgeWrap);
  top.appendChild(info);

  const actionsBtn = el('button', { className: 'mp-card-actions', title: 'Actions' });
  actionsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
  actionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showCardActionsMenu(e, planSkill, status);
  });
  top.appendChild(actionsBtn);
  card.appendChild(top);

  const body = el('div', { className: 'mp-card-body' });
  body.textContent = planSkill.notes || 'No notes added';
  card.appendChild(body);

  const footer = el('div', { className: 'mp-card-footer' });
  const dateStr = formatDate(planSkill.updated_at || planSkill.added_at);
  if (dateStr) {
    const dateItem = el('span', { className: 'mp-card-footer-item' });
    dateItem.appendChild(svgIcon('calendar', '12px'));
    dateItem.appendChild(document.createTextNode(` ${dateStr}`));
    footer.appendChild(dateItem);
  }
  const logCount = Array.isArray(planSkill.training_logs) ? planSkill.training_logs.length : 0;
  const logItem = el('span', { className: 'mp-card-footer-item' });
  logItem.appendChild(svgIcon('pencil', '12px'));
  logItem.appendChild(document.createTextNode(` ${logCount} log${logCount !== 1 ? 's' : ''}`));
  footer.appendChild(logItem);
  card.appendChild(footer);

  card.addEventListener('dragstart', (e) => {
    _draggingPlanSkillId = planSkill.id;
    card.classList.add('dragging');
    e.dataTransfer.setData('planSkillId', String(planSkill.id));
    e.dataTransfer.setData('fromStatus', status);
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    _draggingPlanSkillId = null;
  });

  card.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    openEditSkillModal(planSkill);
  });

  return card;
}

function buildProficiencyBadge(level) {
  const config = {
    1: { cls: 'chip-education', label: 'L1 · Education' },
    2: { cls: 'chip-exposure', label: 'L2 · Exposure' },
    3: { cls: 'chip-experience', label: 'L3 · Experience' },
  };
  const c = config[level];
  const badge = el('span', { className: c ? `triage-chip ${c.cls}` : 'triage-chip chip-pipeline' });
  badge.textContent = c ? c.label : '—';
  badge.style.fontSize = '11px';
  badge.style.padding = '2px 8px';
  return badge;
}

function showCardActionsMenu(e, planSkill, currentStatus) {
  document.querySelectorAll('.card-actions-menu').forEach(m => m.remove());

  const menu = el('div', {
    className: 'card-actions-menu mp-context-menu',
  });

  const statusFlow = ['in_pipeline', 'in_development', 'proficiency'];
  const nextStatuses = statusFlow.filter(s => s !== currentStatus);

  nextStatuses.forEach(targetStatus => {
    const item = el('button', {
      className: 'mp-context-menu-item',
    });
    item.textContent = `Move to ${STATUS_LABELS[targetStatus]}`;
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menu.remove();
      handleMoveCard(planSkill.id, targetStatus);
    });
    menu.appendChild(item);
  });

  const sep = el('div', { className: 'mp-context-menu-sep' });
  menu.appendChild(sep);

  const removeItem = el('button', {
    className: 'mp-context-menu-item mp-context-menu-item--danger',
  });
  removeItem.textContent = 'Remove from plan';
  removeItem.addEventListener('mouseenter', () => { removeItem.style.background = 'var(--bg-hover)'; });
  removeItem.addEventListener('mouseleave', () => { removeItem.style.background = 'none'; });
  removeItem.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    handleRemoveSkill(planSkill);
  });
  menu.appendChild(removeItem);

  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left - 120}px`;

  document.body.appendChild(menu);

  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) {
      menu.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);
}

function openEditSkillModal(planSkill) {
  const root = document.getElementById('modalRoot');

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal skill-detail-modal mp-plan-modal' });
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${planSkill.skill_name || 'Skill'} — Details`);

  const header = el('div', { className: 'modal-header' });
  const titleEl = el('h3', { className: 'modal-title' });
  titleEl.textContent = planSkill.skill_name || 'Skill Details';
  const closeBtn = el('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', { className: 'modal-body' });

  const topRow = el('div', { className: 'mp-modal-top-row' });

  const formCol = el('div', { className: 'mp-modal-form-col' });

  const statusGroup = el('div', { className: 'form-group' });
  const statusLabel = el('label', { className: 'form-label' });
  statusLabel.textContent = 'Status';
  const statusSelect = el('select', { className: 'form-select' });
  [
    { value: 'in_pipeline', label: 'In Pipeline' },
    { value: 'in_development', label: 'In Development' },
    { value: 'proficiency', label: 'Proficiency' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    if (planSkill.status === value) opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  formCol.appendChild(statusGroup);

  const levelGroup = el('div', { className: 'form-group' });
  const levelLabel = el('label', { className: 'form-label' });
  levelLabel.textContent = 'Proficiency Level';
  const levelSelect = el('select', { className: 'form-select' });
  [
    { value: '', label: '— Not set —' },
    { value: '1', label: '1 · Education' },
    { value: '2', label: '2 · Exposure' },
    { value: '3', label: '3 · Experience' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    if (String(planSkill.proficiency_level ?? '') === value) opt.selected = true;
    levelSelect.appendChild(opt);
  });
  levelGroup.appendChild(levelLabel);
  levelGroup.appendChild(levelSelect);
  formCol.appendChild(levelGroup);

  const notesGroup = el('div', { className: 'form-group' });
  const notesLabel = el('label', { className: 'form-label' });
  notesLabel.textContent = 'Notes';
  const notesTextarea = el('textarea', {
    placeholder: 'Add notes, resources, or progress comments...',
    rows: '3',
  });
  notesTextarea.value = planSkill.notes || '';
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesTextarea);
  formCol.appendChild(notesGroup);

  topRow.appendChild(formCol);

  const overallProgressEl = el('div', { className: 'mp-modal-overall-progress' });
  const overallLabel = el('div', { className: 'mp-modal-progress-label' });
  overallLabel.textContent = 'Overall Progress';
  const overallBarWrap = el('div', { className: 'mp-modal-progress-bar-wrap' });
  const overallBar = el('div', { className: 'mp-modal-progress-bar' });
  const overallText = el('span', { className: 'mp-modal-progress-text' });
  overallText.textContent = '—';
  overallBarWrap.appendChild(overallBar);
  overallProgressEl.appendChild(overallLabel);
  overallProgressEl.appendChild(overallBarWrap);
  overallProgressEl.appendChild(overallText);
  formCol.appendChild(overallProgressEl);

  const contentCol = el('div', { className: 'mp-modal-content-col' });

  const LEVEL_CONFIG = [
    { key: 'education', level: 1, label: 'Education', chipClass: 'chip-education' },
    { key: 'exposure', level: 2, label: 'Exposure', chipClass: 'chip-exposure' },
    { key: 'experience', level: 3, label: 'Experience', chipClass: 'chip-experience' },
  ];

  const LEVEL_MAP = { 1: 'education', 2: 'exposure', 3: 'experience' };

  const contentTitle = el('div', { className: 'mp-modal-content-title' });
  contentTitle.textContent = 'Learning Content';
  contentCol.appendChild(contentTitle);

  const tabBar = el('div', { className: 'skill-detail-tabs', role: 'tablist', 'aria-label': 'Content level tabs' });
  const tabButtons = {};
  const tabPanels = {};
  const tabPanelsWrap = el('div', { className: 'mp-modal-tab-panels-wrap' });

  LEVEL_CONFIG.forEach(({ key, label }) => {
    const tabBtn = el('button', { className: 'skill-detail-tab', 'data-tab': key, role: 'tab', 'aria-selected': 'false', 'aria-controls': `mp-panel-${key}` });
    const tabLabel = el('span');
    tabLabel.textContent = label;
    const tabCount = el('span', { className: 'skill-detail-tab-count' });
    tabCount.textContent = '0';
    const tabProgress = el('span', { className: 'mp-tab-progress-indicator' });
    tabBtn.appendChild(tabLabel);
    tabBtn.appendChild(tabCount);
    tabBtn.appendChild(tabProgress);
    tabBar.appendChild(tabBtn);
    tabButtons[key] = tabBtn;

    const panel = el('div', { className: 'skill-detail-tab-panel', 'data-panel': key, role: 'tabpanel', id: `mp-panel-${key}` });
    tabPanelsWrap.appendChild(panel);
    tabPanels[key] = panel;
  });

  contentCol.appendChild(tabBar);
  contentCol.appendChild(tabPanelsWrap);
  topRow.appendChild(contentCol);
  body.appendChild(topRow);

  const logSection = el('div', { className: 'mp-modal-log-section' });
  const logToggle = el('button', { className: 'mp-modal-log-toggle' });
  const logToggleIcon = el('span', { className: 'mp-modal-log-toggle-icon' });
  const logToggleText = el('span');
  logToggleText.textContent = 'Training Log';
  const logToggleCount = el('span', { className: 'mp-modal-log-count' });
  const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
  logToggleCount.textContent = String(logs.length);
  logToggle.appendChild(logToggleIcon);
  logToggle.appendChild(logToggleText);
  logToggle.appendChild(logToggleCount);
  logSection.appendChild(logToggle);

  const logBody = el('div', { className: 'mp-modal-log-body' });
  const logListEl = el('div', { className: 'mp-edit-log-list' });

  function renderLogList() {
    logListEl.innerHTML = '';
    const currentLogs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    logToggleCount.textContent = String(currentLogs.length);
    if (currentLogs.length === 0) {
      const emptyLog = el('div', { className: 'empty-state empty-state--compact' });
      emptyLog.textContent = 'No training log entries yet.';
      logListEl.appendChild(emptyLog);
    } else {
      currentLogs.slice().reverse().slice(0, 10).forEach(log => {
        logListEl.appendChild(buildTrainingLogEntry(log));
      });
      if (currentLogs.length > 10) {
        const moreEl = el('div', { className: 'mp-log-more' });
        moreEl.textContent = `… and ${currentLogs.length - 10} more`;
        logListEl.appendChild(moreEl);
      }
    }
  }
  renderLogList();

  logBody.appendChild(logListEl);
  logSection.appendChild(logBody);
  body.appendChild(logSection);

  let logExpanded = false;
  logToggle.addEventListener('click', () => {
    logExpanded = !logExpanded;
    logSection.classList.toggle('expanded', logExpanded);
  });

  modal.appendChild(body);

  const footer = el('div', { className: 'modal-footer' });
  const cancelFooterBtn = el('button', { className: 'btn btn-secondary' });
  cancelFooterBtn.textContent = 'Close';
  const saveBtn = el('button', { className: 'btn btn-primary' });
  saveBtn.textContent = 'Save Changes';
  footer.appendChild(cancelFooterBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  root.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    closeBtn.focus();
  });

  function activateTab(key) {
    LEVEL_CONFIG.forEach(({ key: k }) => {
      tabButtons[k].classList.toggle('active', k === key);
      tabButtons[k].setAttribute('aria-selected', String(k === key));
      tabPanels[k].classList.toggle('active', k === key);
    });
  }

  LEVEL_CONFIG.forEach(({ key }) => {
    tabButtons[key].addEventListener('click', () => activateTab(key));
  });

  let allContentItems = [];

  function updateProgressDisplay() {
    let totalAll = 0;
    let completedAll = 0;
    LEVEL_CONFIG.forEach(({ key }) => {
      const items = allContentItems.filter(i => LEVEL_MAP[i.level] === key);
      const done = items.filter(i => i.completed).length;
      const total = items.length;
      totalAll += total;
      completedAll += done;

      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const indicator = tabButtons[key].querySelector('.mp-tab-progress-indicator');
      if (indicator) {
        indicator.textContent = total > 0 ? `${done}/${total}` : '';
        indicator.style.opacity = total > 0 ? '1' : '0';
      }
    });

    const overallPct = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
    overallBar.style.width = `${overallPct}%`;
    overallText.textContent = totalAll > 0 ? `${completedAll} / ${totalAll} (${overallPct}%)` : 'No content items';
  }

  function renderPanelContent(key, items) {
    const panel = tabPanels[key];
    panel.innerHTML = '';

    const sorted = items.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
    tabButtons[key].querySelector('.skill-detail-tab-count').textContent = String(sorted.length);

    if (!sorted.length) {
      const empty = el('div', { className: 'empty-state empty-state--compact' });
      empty.textContent = 'No content items for this level.';
      panel.appendChild(empty);
      return;
    }

    let openItem = null;

    sorted.forEach(item => {
      const accItem = el('div', { className: `skill-detail-accordion-item${item.completed ? ' completed' : ''}` });
      accItem.dataset.itemId = item.id;

      const trigger = el('button', { className: 'skill-detail-accordion-trigger' });

      const checkbox = el('input', { type: 'checkbox', className: 'mp-content-checkbox', 'aria-label': `Mark "${item.title}" as completed` });
      checkbox.checked = item.completed;
      checkbox.addEventListener('click', (e) => e.stopPropagation());
      checkbox.addEventListener('change', async (e) => {
        e.stopPropagation();
        checkbox.disabled = true;
        try {
          const resp = await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/content/${item.id}/complete`, {});
          item.completed = resp.completed;
          item.completed_at = resp.completed_at;
          checkbox.checked = item.completed;
          accItem.classList.toggle('completed', item.completed);
          updateProgressDisplay();

          const freshPlan = await api.get(`/api/plans/${_engineerId}`);
          _planData = freshPlan;
          const freshSkill = (freshPlan.skills || []).find(s => s.id === planSkill.id);
          if (freshSkill) planSkill.training_logs = freshSkill.training_logs;
          renderLogList();
        } catch (err) {
          checkbox.checked = item.completed;
          showToast(err.message || 'Failed to toggle completion', 'error');
        } finally {
          checkbox.disabled = false;
        }
      });
      trigger.appendChild(checkbox);

      const levelCfg = LEVEL_CONFIG.find(l => l.key === key);
      const typeChip = el('span', { className: `triage-chip ${levelCfg.chipClass} chip-sm` });
      typeChip.textContent = item.type || 'resource';
      trigger.appendChild(typeChip);

      const titleSpan = el('span', { className: 'skill-detail-accordion-title' });
      titleSpan.textContent = item.title || 'Untitled';
      trigger.appendChild(titleSpan);

      if (item.has_override) {
        const badge = el('span', { className: 'mp-override-badge' });
        badge.textContent = 'Modified';
        trigger.appendChild(badge);
      }

      if (item.completed && item.completed_at) {
        const doneDate = el('span', { className: 'mp-completed-date' });
        doneDate.textContent = formatDate(item.completed_at);
        trigger.appendChild(doneDate);
      }

      const chevron = el('span', { className: 'skill-detail-accordion-chevron', 'aria-hidden': 'true' });
      trigger.appendChild(chevron);

      const accBody = el('div', { className: 'skill-detail-accordion-body' });
      const bodyInner = el('div', { className: 'skill-detail-accordion-body-inner' });

      if (item.description) {
        const descEl = el('div');
        descEl.innerHTML = item.description;
        bodyInner.appendChild(descEl);
      }

      if (item.url) {
        const link = el('a', { className: 'skill-detail-accordion-link', href: item.url, target: '_blank', rel: 'noopener noreferrer' });
        link.textContent = 'Open Resource';
        bodyInner.appendChild(link);
      }

      const editOverrideBtn = el('button', { className: 'btn btn-secondary btn-sm mp-override-btn' });
      editOverrideBtn.textContent = item.has_override ? 'Edit My Notes' : 'Add My Notes';
      editOverrideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openOverrideEditor(item, planSkill, () => {
          refreshContent();
        });
      });
      bodyInner.appendChild(editOverrideBtn);

      accBody.appendChild(bodyInner);
      accItem.appendChild(trigger);
      accItem.appendChild(accBody);
      panel.appendChild(accItem);

      trigger.addEventListener('click', (e) => {
        if (e.target.closest('.mp-content-checkbox')) return;
        if (accItem === openItem) {
          accItem.classList.remove('open');
          openItem = null;
        } else {
          if (openItem) openItem.classList.remove('open');
          accItem.classList.add('open');
          openItem = accItem;
        }
      });
    });
  }

  function refreshContent() {
    LEVEL_CONFIG.forEach(({ key }) => {
      tabPanels[key].innerHTML = '';
      const sk = el('div', { className: 'skeleton-list' });
      for (let i = 0; i < 2; i++) {
        sk.appendChild(el('div', { className: 'skeleton skeleton-row' }));
      }
      tabPanels[key].appendChild(sk);
    });

    api.get(`/api/plans/${_engineerId}/skills/${planSkill.id}/content`).then(data => {
      allContentItems = Array.isArray(data.items) ? data.items : [];
      const profLevel = parseInt(levelSelect.value, 10) || null;

      const groups = { education: [], exposure: [], experience: [] };
      allContentItems.forEach(item => {
        const key = LEVEL_MAP[item.level] || 'education';
        groups[key].push(item);
      });

      LEVEL_CONFIG.forEach(({ key, level }) => {
        const isVisible = !profLevel || level <= profLevel;
        tabButtons[key].style.display = isVisible ? '' : 'none';
        tabPanels[key].style.display = isVisible ? '' : 'none';
        if (isVisible) {
          renderPanelContent(key, groups[key]);
        }
      });

      const visibleTabs = LEVEL_CONFIG.filter(({ level }) => !profLevel || level <= profLevel);
      const firstWithContent = visibleTabs.find(({ key }) => groups[key].length > 0);
      activateTab(firstWithContent ? firstWithContent.key : (visibleTabs[0]?.key || 'education'));

      updateProgressDisplay();
    }).catch(() => {
      LEVEL_CONFIG.forEach(({ key }) => {
        tabPanels[key].innerHTML = '';
        const errEl = el('div', { className: 'empty-state empty-state--compact' });
        errEl.textContent = 'Unable to load content.';
        tabPanels[key].appendChild(errEl);
      });
    });
  }

  const skeletonEl = el('div', { className: 'skill-detail-skeleton' });
  for (let i = 0; i < 3; i++) {
    skeletonEl.appendChild(el('div', { className: 'skeleton skeleton-row' }));
  }
  tabPanelsWrap.appendChild(skeletonEl);

  refreshContent();

  levelSelect.addEventListener('change', () => {
    refreshContent();
  });

  const initialStatus = planSkill.status;
  const initialLevel = String(planSkill.proficiency_level ?? '');
  const initialNotes = planSkill.notes || '';

  function isDirty() {
    return statusSelect.value !== initialStatus || levelSelect.value !== initialLevel || notesTextarea.value !== initialNotes;
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
    renderSections();
  }

  async function doSave() {
    const newStatus = statusSelect.value;
    const newLevel = levelSelect.value ? Number(levelSelect.value) : null;
    const newNotes = notesTextarea.value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await api.put(`/api/plans/${_engineerId}/skills/${planSkill.id}`, {
        status: newStatus,
        proficiency_level: newLevel,
        notes: newNotes || null,
      });
      showToast('Skill updated', 'success');
      await reloadPlan();
      closeModal();
    } catch (err) {
      showToast(err.message || 'Failed to save changes', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (isDirty()) return;
      closeModal();
    }
    if (e.key === 'Tab') {
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const focused = document.activeElement;
      const currentTab = focused?.dataset?.tab;
      const visibleKeys = LEVEL_CONFIG.filter(({ level }) => {
        const pl = parseInt(levelSelect.value, 10) || null;
        return !pl || level <= pl;
      }).map(l => l.key);
      if (currentTab && visibleKeys.includes(currentTab)) {
        const idx = visibleKeys.indexOf(currentTab);
        const next = e.key === 'ArrowRight' ? (idx + 1) % visibleKeys.length : (idx - 1 + visibleKeys.length) % visibleKeys.length;
        activateTab(visibleKeys[next]);
        tabButtons[visibleKeys[next]].focus();
        e.preventDefault();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);

  saveBtn.addEventListener('click', doSave);

  closeBtn.addEventListener('click', async () => {
    if (isDirty()) {
      const save = await showConfirm('You have unsaved changes. Save before closing?');
      if (save) { await doSave(); return; }
    }
    closeModal();
  });

  cancelFooterBtn.addEventListener('click', async () => {
    if (isDirty()) {
      const save = await showConfirm('You have unsaved changes. Save before closing?');
      if (save) { await doSave(); return; }
    }
    closeModal();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (!isDirty()) closeModal();
    }
  });
}

function openOverrideEditor(item, planSkill, onSaved) {
  const root = document.getElementById('modalRoot');
  if (!root) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal content-edit-modal' });

  const header = el('div', { className: 'modal-header' });
  const titleEl = el('h2', { className: 'modal-title' });
  titleEl.textContent = `My Notes — ${item.title}`;
  const closeBtn = el('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', { className: 'modal-body' });
  const hint = el('p', { className: 'mp-form-hint' });
  hint.textContent = 'Your notes are personal and do not modify the global catalog.';
  body.appendChild(hint);

  const editorWrap = el('div', { className: 'content-edit-quill-wrap' });
  const editorEl = el('div', { id: 'override-body-editor' });
  editorWrap.appendChild(editorEl);
  body.appendChild(editorWrap);

  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  const saveBtn = el('button', { className: 'btn btn-primary' });
  saveBtn.textContent = 'Save Notes';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  root.appendChild(overlay);

  let quillInstance = null;

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    if (typeof Quill !== 'undefined') {
      quillInstance = new Quill(editorEl, {
        theme: 'snow',
        modules: {
          toolbar: [['bold', 'italic'], [{ header: [1, 2, 3, false] }], [{ color: [] }], ['link'], ['clean']],
        },
      });
      if (item.override_description || item.description) {
        quillInstance.root.innerHTML = item.override_description || item.description || '';
      }
    } else {
      editorEl.contentEditable = 'true';
      editorEl.style.cssText = 'min-height:120px;padding:10px;border:1px solid var(--border-soft);border-radius:var(--radius-md);background:var(--bg-input);color:var(--text-primary);';
      editorEl.innerHTML = item.override_description || item.description || '';
    }
  });

  function getBodyHtml() {
    return quillInstance ? quillInstance.root.innerHTML : editorEl.innerHTML;
  }

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  saveBtn.addEventListener('click', async () => {
    const html = getBodyHtml();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/content/${item.id}/override`, {
        override_description: html,
      });
      showToast('Notes saved', 'success');
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(err.message || 'Failed to save notes', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Notes';
    }
  });
}

function buildTrainingLogEntry(log) {
  const entry = el('div', {
    className: 'mp-log-entry',
  });

  const topRow = el('div', { className: 'mp-log-entry-header' });

  const typeChip = el('span', { className: 'triage-chip triage-signal chip-sm' });
  typeChip.textContent = log.type || 'entry';

  const titleEl = el('span', { className: 'mp-log-entry-title' });
  titleEl.textContent = log.title || 'Untitled';

  topRow.appendChild(typeChip);
  topRow.appendChild(titleEl);

  if (log.completed_at) {
    const dateEl = el('span', { className: 'mp-log-entry-date' });
    dateEl.textContent = formatDate(log.completed_at);
    topRow.appendChild(dateEl);
  }

  entry.appendChild(topRow);

  if (log.notes) {
    const notesEl = el('div', { className: 'mp-log-entry-notes' });
    notesEl.textContent = log.notes;
    entry.appendChild(notesEl);
  }

  return entry;
}

async function handleMoveCard(planSkillId, newStatus) {
  const skill = (_planData?.skills || []).find(s => s.id === planSkillId);
  const oldStatus = skill?.status;
  const skillName = skill?.skill_name || 'Skill';

  try {
    await api.put(`/api/plans/${_engineerId}/skills/${planSkillId}`, { status: newStatus });

    try {
      await api.post(`/api/plans/${_engineerId}/skills/${planSkillId}/log`, {
        title: `Moved from ${STATUS_LABELS[oldStatus] || oldStatus} to ${STATUS_LABELS[newStatus] || newStatus}`,
        type: 'action',
        completed_at: new Date().toISOString(),
        notes: null,
      });
    } catch (_) { /* log failure is non-critical */ }

    await reloadPlan();
    showToast(`"${skillName}" moved to ${STATUS_LABELS[newStatus] || newStatus}`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to move skill', 'error');
  }
}

async function handleRemoveSkill(planSkill) {
  const confirmed = await showConfirm(
    `Remove "${planSkill.skill_name}" from your plan? This cannot be undone.`,
    true
  );
  if (!confirmed) return;

  try {
    await api.del(`/api/plans/${_engineerId}/skills/${planSkill.id}`);
    showToast(`"${planSkill.skill_name}" removed from plan`, 'success');
    await reloadPlan();
  } catch (err) {
    showToast(err.message || 'Failed to remove skill', 'error');
  }
}

async function openAddSkillModal() {
  if (!_allCatalogSkills.length) {
    try {
      const skills = await api.get('/api/skills/');
      _allCatalogSkills = Array.isArray(skills) ? skills.filter(s => !s.is_archived) : [];
    } catch (err) {
      showToast(err.message || 'Failed to load skill catalog', 'error');
      return;
    }
  }

  const planSkillIds = new Set(
    (Array.isArray(_planData?.skills) ? _planData.skills : []).map(s => s.skill_id)
  );

  const available = _allCatalogSkills.filter(s => !planSkillIds.has(s.id));

  let searchQuery = '';

  const bodyEl = el('div', { className: 'mp-add-skill-body' });

  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search skills...',
    className: 'search-input',
  });
  bodyEl.appendChild(searchInput);

  const listEl = el('div', {
    className: 'mp-add-skill-results',
  });

  function renderSkillList(query) {
    listEl.innerHTML = '';
    const filtered = query
      ? available.filter(s =>
          (s.name || '').toLowerCase().includes(query.toLowerCase()) ||
          (s.description || '').toLowerCase().includes(query.toLowerCase()) ||
          (Array.isArray(s.tags) && s.tags.some(t => (t.name || t).toLowerCase().includes(query.toLowerCase())))
        )
      : available;

    if (filtered.length === 0) {
      const empty = el('div', { className: 'empty-state empty-state--compact' });
      empty.textContent = query ? 'No skills match your search.' : 'All available skills are already in your plan.';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(skill => {
      const row = el('div', {
        className: 'mp-add-skill-item',
      });
      row.dataset.skillId = skill.id;

      const info = el('div', { className: 'mp-add-skill-item-info' });
      const nameEl = el('div', { className: 'mp-add-skill-item-name' });
      nameEl.textContent = skill.name;
      info.appendChild(nameEl);

      const meta = el('div', { className: 'mp-add-skill-item-meta' });

      if (skill.domain_name) {
        const domBadge = el('span', { className: 'triage-chip triage-signal chip-sm' });
        domBadge.textContent = skill.domain_name;
        meta.appendChild(domBadge);
      }

      if (Array.isArray(skill.tags)) {
        skill.tags.slice(0, 3).forEach(tag => {
          const tagChip = el('span', { className: 'triage-chip triage-feedback chip-sm' });
          tagChip.textContent = tag.name || tag;
          meta.appendChild(tagChip);
        });
      }

      info.appendChild(meta);
      row.appendChild(info);

      const addBtn = el('button', { className: 'btn btn-primary btn-sm mp-add-skill-btn' });
      addBtn.textContent = 'Add';

      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        addBtn.disabled = true;
        addBtn.textContent = '...';
        try {
          const plan = await api.post(`/api/plans/${_engineerId}/skills`, { skill_id: skill.id });
          const newPlanSkill = (plan.skills || []).find(s => s.skill_id === skill.id);
          if (newPlanSkill) {
            try {
              await api.post(`/api/plans/${_engineerId}/skills/${newPlanSkill.id}/log`, {
                title: `Added to plan (${STATUS_LABELS[newPlanSkill.status] || newPlanSkill.status})`,
                type: 'action',
                completed_at: new Date().toISOString(),
                notes: null,
              });
            } catch (_) { /* log failure is non-critical */ }
          }
          showToast(`"${skill.name}" added to plan`, 'success');
          const idx = _allCatalogSkills.findIndex(s => s.id === skill.id);
          if (idx !== -1) _allCatalogSkills.splice(idx, 1);
          await reloadPlan();
          planSkillIds.add(skill.id);
          row.remove();
          renderSkillList(searchQuery);
        } catch (err) {
          showToast(err.message || 'Failed to add skill', 'error');
          addBtn.disabled = false;
          addBtn.textContent = 'Add';
        }
      });

      row.appendChild(addBtn);
      listEl.appendChild(row);
    });
  }

  renderSkillList('');
  bodyEl.appendChild(listEl);

  let debounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      renderSkillList(searchQuery);
    }, 250);
  });

  showModal({
    title: '+ Add Skill to Plan',
    body: bodyEl,
    confirmText: 'Done',
    cancelText: 'Close',
    onConfirm: () => {},
  });
}

function showPermissionError(msg) {
  const sections = _container.querySelector('.mp-sections');
  if (!sections) return;
  sections.innerHTML = '';
  const errDiv = el('div', {
    className: 'empty-state empty-state--error',
  });
  const title = el('div', { className: 'empty-state-title' });
  title.textContent = "You don't have permission to view this plan";
  const desc = el('div', { className: 'empty-state-desc' });
  desc.textContent = msg || 'Contact your manager or administrator for access.';
  errDiv.appendChild(title);
  errDiv.appendChild(desc);
  sections.appendChild(errDiv);
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

function formatDate(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}
