import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';

let _container = null;
let _engineerId = null;
let _planData = null;
let _draggingPlanSkillId = null;
let _sectionGridEls = {};
let _allCatalogSkills = [];
let _searchQuery = '';

const SECTIONS = [
  { status: 'in_development', title: 'In Development', icon: '🔨', iconClass: 'mp-card-icon--dev' },
  { status: 'in_pipeline', title: 'In Pipeline', icon: '📋', iconClass: 'mp-card-icon--pipe' },
  { status: 'proficiency', title: 'Proficiency', icon: '✅', iconClass: 'mp-card-icon--prof' },
];

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
  title.textContent = 'My Development Plan';
  const subtitle = el('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Track and manage your skill development journey';
  header.appendChild(title);
  header.appendChild(subtitle);
  wrapper.appendChild(header);

  const searchWrap = el('div', { className: 'mp-search' });
  const searchBox = el('div', { className: 'mp-search-box' });
  const searchIcon = el('span', { className: 'mp-search-icon' });
  searchIcon.textContent = '🔍';
  const searchInput = el('input', {
    className: 'mp-search-input',
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
  const infoLeft = el('span', { className: 'mp-infobar-left', id: 'mp-skill-count' });
  infoLeft.textContent = '0 Skills';
  const infoRight = el('div', { className: 'mp-infobar-right' });

  const pdfBtn = el('button', { className: 'mp-export-btn' });
  pdfBtn.textContent = '📄 Export PDF';
  pdfBtn.addEventListener('click', () => downloadExport(`/api/export/plans/${_engineerId}/pdf`, `plan_${_engineerId}.pdf`));

  const csvBtn = el('button', { className: 'mp-export-btn' });
  csvBtn.textContent = '📊 Export CSV';
  csvBtn.addEventListener('click', () => downloadExport(`/api/export/plans/${_engineerId}/csv`, `plan_${_engineerId}.csv`));

  const addBtn = el('button', { className: 'btn btn-primary btn-sm' });
  addBtn.textContent = '+ Add Skill';
  addBtn.addEventListener('click', openAddSkillModal);

  infoRight.appendChild(pdfBtn);
  infoRight.appendChild(csvBtn);
  infoRight.appendChild(addBtn);
  infobar.appendChild(infoLeft);
  infobar.appendChild(infoRight);
  wrapper.appendChild(infobar);

  const sections = el('div', { className: 'mp-sections' });

  SECTIONS.forEach(({ status, title: sTitle, icon }) => {
    const section = buildSection(status, sTitle, icon);
    sections.appendChild(section);
  });

  wrapper.appendChild(sections);
  container.appendChild(wrapper);
}

function buildSection(status, title, icon) {
  const section = el('div', { className: 'mp-section' });
  section.dataset.status = status;

  const header = el('div', { className: 'mp-section-header' });
  const iconEl = el('span', { className: 'mp-section-icon' });
  iconEl.textContent = icon;
  const titleEl = el('span', { className: 'mp-section-title' });
  titleEl.textContent = title;
  const countEl = el('span', { className: 'mp-section-count', id: `mp-count-${status}` });
  countEl.textContent = '0';
  header.appendChild(iconEl);
  header.appendChild(titleEl);
  header.appendChild(countEl);
  section.appendChild(header);

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
  return section;
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
  const countLabel = document.getElementById('mp-skill-count');
  if (countLabel) countLabel.textContent = `${totalCount} Skill${totalCount !== 1 ? 's' : ''}`;

  Object.entries(groups).forEach(([status, statusSkills]) => {
    const grid = _sectionGridEls[status];
    const countEl = document.getElementById(`mp-count-${status}`);
    if (!grid) return;

    grid.innerHTML = '';
    if (countEl) countEl.textContent = String(statusSkills.length);

    if (statusSkills.length === 0) {
      const empty = el('div', { className: 'mp-empty' });
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
  actionsBtn.textContent = '⋯';
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
    dateItem.textContent = `📅 ${dateStr}`;
    footer.appendChild(dateItem);
  }
  const logCount = Array.isArray(planSkill.training_logs) ? planSkill.training_logs.length : 0;
  const logItem = el('span', { className: 'mp-card-footer-item' });
  logItem.textContent = `📝 ${logCount} log${logCount !== 1 ? 's' : ''}`;
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
    className: 'card-actions-menu',
    style: 'position:fixed;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:var(--radius-md);box-shadow:var(--shadow-md);z-index:999;min-width:160px;padding:4px 0;',
  });

  const statusFlow = ['in_pipeline', 'in_development', 'proficiency'];
  const nextStatuses = statusFlow.filter(s => s !== currentStatus);
  const statusLabels = {
    in_pipeline: 'In Pipeline',
    in_development: 'In Development',
    proficiency: 'Proficiency',
  };

  nextStatuses.forEach(targetStatus => {
    const item = el('button', {
      style: 'display:block;width:100%;text-align:left;background:none;border:none;padding:8px 14px;font-size:13px;color:var(--text-secondary);cursor:pointer;',
    });
    item.textContent = `Move to ${statusLabels[targetStatus]}`;
    item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
    item.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menu.remove();
      handleMoveCard(planSkill.id, targetStatus);
    });
    menu.appendChild(item);
  });

  const sep = el('div', { style: 'border-top:1px solid var(--border-soft);margin:4px 0;' });
  menu.appendChild(sep);

  const removeItem = el('button', {
    style: 'display:block;width:100%;text-align:left;background:none;border:none;padding:8px 14px;font-size:13px;color:var(--error, #ef4444);cursor:pointer;',
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
  const modal = el('div', { className: 'modal modal-wide' });
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `Edit ${planSkill.skill_name || 'Skill'}`);

  /* ── Header ── */
  const header = el('div', { className: 'modal-header' });
  const titleEl = el('h3', { className: 'modal-title' });
  titleEl.textContent = planSkill.skill_name || 'Edit Skill';
  header.appendChild(titleEl);
  modal.appendChild(header);

  /* ── Body ── */
  const body = el('div', { className: 'modal-body' });
  const bodyInner = el('div', { className: 'mp-edit-layout' });

  /* -- Left: form fields -- */
  const formCol = el('div', { className: 'mp-edit-form' });

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
    rows: '4',
  });
  notesTextarea.value = planSkill.notes || '';
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesTextarea);
  formCol.appendChild(notesGroup);

  bodyInner.appendChild(formCol);

  /* -- Right: training log -- */
  const logCol = el('div', { className: 'mp-edit-log' });

  const logHeader = el('div', { className: 'mp-edit-log-header' });
  const logTitle = el('span', {});
  logTitle.textContent = 'Training Log';
  const addLogBtn = el('button', { className: 'btn btn-secondary btn-sm' });
  addLogBtn.textContent = '+ Add Entry';
  logHeader.appendChild(logTitle);
  logHeader.appendChild(addLogBtn);
  logCol.appendChild(logHeader);

  const logListEl = el('div', { className: 'mp-edit-log-list' });
  const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];

  function renderLogList() {
    logListEl.innerHTML = '';
    const currentLogs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    if (currentLogs.length === 0) {
      const emptyLog = el('div', { style: 'font-size:12px;color:var(--text-muted);padding:12px 0;text-align:center;' });
      emptyLog.textContent = 'No training log entries yet.';
      logListEl.appendChild(emptyLog);
    } else {
      currentLogs.forEach(log => {
        logListEl.appendChild(buildTrainingLogEntry(log));
      });
    }
  }
  renderLogList();
  logCol.appendChild(logListEl);

  const logFormEl = el('div', { className: 'mp-edit-log-form' });
  logFormEl.style.display = 'none';

  const logTitleGroup = el('div', { className: 'form-group' });
  const logTitleLabel = el('label', { className: 'form-label' });
  logTitleLabel.textContent = 'Title';
  const logTitleInput = el('input', { type: 'text', placeholder: 'e.g. Completed CCNP course' });
  logTitleGroup.appendChild(logTitleLabel);
  logTitleGroup.appendChild(logTitleInput);
  logFormEl.appendChild(logTitleGroup);

  const logTypeGroup = el('div', { className: 'form-group' });
  const logTypeLabel = el('label', { className: 'form-label' });
  logTypeLabel.textContent = 'Type';
  const logTypeSelect = el('select', { className: 'form-select' });
  ['course', 'certification', 'reading', 'link', 'action'].forEach(t => {
    const opt = el('option', { value: t });
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    logTypeSelect.appendChild(opt);
  });
  logTypeGroup.appendChild(logTypeLabel);
  logTypeGroup.appendChild(logTypeSelect);
  logFormEl.appendChild(logTypeGroup);

  const logDateGroup = el('div', { className: 'form-group' });
  const logDateLabel = el('label', { className: 'form-label' });
  logDateLabel.textContent = 'Completed At';
  const logDateInput = el('input', { type: 'date' });
  logDateGroup.appendChild(logDateLabel);
  logDateGroup.appendChild(logDateInput);
  logFormEl.appendChild(logDateGroup);

  const logNotesGroup = el('div', { className: 'form-group' });
  const logNotesLabel = el('label', { className: 'form-label' });
  logNotesLabel.textContent = 'Notes';
  const logNotesInput = el('textarea', { placeholder: 'Optional notes...', rows: '2' });
  logNotesGroup.appendChild(logNotesLabel);
  logNotesGroup.appendChild(logNotesInput);
  logFormEl.appendChild(logNotesGroup);

  const logFormActions = el('div', { style: 'display:flex;gap:8px;' });
  const logSubmitBtn = el('button', { className: 'btn btn-primary btn-sm' });
  logSubmitBtn.textContent = 'Add Entry';
  const logCancelBtn = el('button', { className: 'btn btn-secondary btn-sm' });
  logCancelBtn.textContent = 'Cancel';

  logSubmitBtn.addEventListener('click', async () => {
    const title = logTitleInput.value.trim();
    if (!title) { showToast('Title is required', 'warning'); return; }

    logSubmitBtn.disabled = true;
    logSubmitBtn.textContent = 'Saving...';

    try {
      await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/log`, {
        title,
        type: logTypeSelect.value,
        completed_at: logDateInput.value || null,
        notes: logNotesInput.value.trim() || null,
      });
      showToast('Training entry added', 'success');

      const freshPlan = await api.get(`/api/plans/${_engineerId}`);
      _planData = freshPlan;
      const freshSkill = (freshPlan.skills || []).find(s => s.id === planSkill.id);
      if (freshSkill) planSkill.training_logs = freshSkill.training_logs;
      renderLogList();

      logFormEl.style.display = 'none';
      addLogBtn.style.display = '';
      logTitleInput.value = '';
      logTypeSelect.selectedIndex = 0;
      logDateInput.value = '';
      logNotesInput.value = '';
    } catch (err) {
      showToast(err.message || 'Failed to add log entry', 'error');
    } finally {
      logSubmitBtn.disabled = false;
      logSubmitBtn.textContent = 'Add Entry';
    }
  });

  logCancelBtn.addEventListener('click', () => {
    logFormEl.style.display = 'none';
    addLogBtn.style.display = '';
  });

  logFormActions.appendChild(logSubmitBtn);
  logFormActions.appendChild(logCancelBtn);
  logFormEl.appendChild(logFormActions);
  logCol.appendChild(logFormEl);

  addLogBtn.addEventListener('click', () => {
    logFormEl.style.display = 'flex';
    addLogBtn.style.display = 'none';
    logTitleInput.value = '';
    logTypeSelect.selectedIndex = 0;
    logDateInput.value = '';
    logNotesInput.value = '';
  });

  bodyInner.appendChild(logCol);
  body.appendChild(bodyInner);
  modal.appendChild(body);

  /* ── Footer ── */
  const footer = el('div', { className: 'modal-footer' });

  const closeBtn = el('button', { className: 'btn btn-secondary' });
  closeBtn.textContent = 'Close';

  const saveBtn = el('button', { className: 'btn btn-primary' });
  saveBtn.textContent = 'Save Changes';

  footer.appendChild(closeBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  root.appendChild(overlay);

  /* Animate in */
  requestAnimationFrame(() => overlay.classList.add('open'));

  /* ── Dirty-state tracking ── */
  const initialStatus = planSkill.status;
  const initialLevel = String(planSkill.proficiency_level ?? '');
  const initialNotes = planSkill.notes || '';

  function isDirty() {
    return (
      statusSelect.value !== initialStatus ||
      levelSelect.value !== initialLevel ||
      notesTextarea.value !== initialNotes
    );
  }

  /* ── Close helper ── */
  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    renderSections();
  }

  /* ── Save ── */
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

  saveBtn.addEventListener('click', doSave);

  closeBtn.addEventListener('click', async () => {
    if (isDirty()) {
      const save = await showConfirm('You have unsaved changes. Save before closing?');
      if (save) {
        await doSave();
        return;
      }
    }
    closeModal();
  });

  /* NO overlay click dismiss. NO Escape key dismiss. Closable ONLY via Save/Close. */
}

function buildTrainingLogEntry(log) {
  const entry = el('div', {
    style: 'padding:8px 10px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-soft);',
  });

  const topRow = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;' });

  const typeChip = el('span', { className: 'triage-chip triage-signal', style: 'font-size:11px;padding:2px 7px;' });
  typeChip.textContent = log.type || 'entry';

  const titleEl = el('span', { style: 'font-size:13px;font-weight:600;color:var(--text-primary);flex:1;' });
  titleEl.textContent = log.title || 'Untitled';

  topRow.appendChild(typeChip);
  topRow.appendChild(titleEl);

  if (log.completed_at) {
    const dateEl = el('span', { style: 'font-size:11px;color:var(--text-muted);white-space:nowrap;' });
    dateEl.textContent = formatDate(log.completed_at);
    topRow.appendChild(dateEl);
  }

  entry.appendChild(topRow);

  if (log.notes) {
    const notesEl = el('div', { style: 'font-size:12px;color:var(--text-secondary);line-height:1.5;margin-top:4px;' });
    notesEl.textContent = log.notes;
    entry.appendChild(notesEl);
  }

  return entry;
}

async function handleMoveCard(planSkillId, newStatus) {
  try {
    await api.put(`/api/plans/${_engineerId}/skills/${planSkillId}`, { status: newStatus });
    await reloadPlan();
    showToast('Skill moved', 'success');
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

  const bodyEl = el('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

  const searchInput = el('input', {
    type: 'text',
    placeholder: 'Search skills...',
    style: 'width:100%;padding:8px 12px;font-size:14px;',
  });
  bodyEl.appendChild(searchInput);

  const listEl = el('div', {
    style: 'display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;',
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
      const empty = el('div', { style: 'text-align:center;padding:24px;color:var(--text-muted);font-size:13px;' });
      empty.textContent = query ? 'No skills match your search.' : 'All available skills are already in your plan.';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(skill => {
      const row = el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:var(--radius-md);cursor:pointer;transition:border-color 0.15s;',
      });
      row.dataset.skillId = skill.id;

      const info = el('div', { style: 'flex:1;min-width:0;' });
      const nameEl = el('div', { style: 'font-size:14px;font-weight:600;color:var(--text-primary);' });
      nameEl.textContent = skill.name;
      info.appendChild(nameEl);

      const meta = el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;' });

      if (skill.domain_name) {
        const domBadge = el('span', { className: 'triage-chip triage-signal', style: 'font-size:11px;padding:2px 7px;' });
        domBadge.textContent = skill.domain_name;
        meta.appendChild(domBadge);
      }

      if (Array.isArray(skill.tags)) {
        skill.tags.slice(0, 3).forEach(tag => {
          const tagChip = el('span', { className: 'triage-chip triage-feedback', style: 'font-size:11px;padding:2px 7px;' });
          tagChip.textContent = tag.name || tag;
          meta.appendChild(tagChip);
        });
      }

      info.appendChild(meta);
      row.appendChild(info);

      const addBtn = el('button', { className: 'btn btn-primary btn-sm', style: 'flex-shrink:0;' });
      addBtn.textContent = 'Add';

      addBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        addBtn.disabled = true;
        addBtn.textContent = '...';
        try {
          await api.post(`/api/plans/${_engineerId}/skills`, { skill_id: skill.id });
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
    style: 'text-align:center;padding:60px 24px;color:var(--text-muted);',
  });
  const title = el('div', { style: 'font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;' });
  title.textContent = "You don't have permission to view this plan";
  const desc = el('div', { style: 'font-size:14px;' });
  desc.textContent = msg || 'Contact your manager or administrator for access.';
  errDiv.appendChild(title);
  errDiv.appendChild(desc);
  sections.appendChild(errDiv);
}

function el(tag, props) {
  const node = document.createElement(tag);
  if (!props) return node;
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'htmlFor') node.htmlFor = v;
    else node.setAttribute(k, v);
  });
  return node;
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
