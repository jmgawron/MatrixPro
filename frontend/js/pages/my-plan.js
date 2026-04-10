import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _engineerId = null;
let _planData = null;           // full PlanResponse
let _expandedCardId = null;     // plan_skill_id of the expanded card
let _draggingPlanSkillId = null;
let _kanbanBodyEls = {};        // status -> column body element
let _allCatalogSkills = [];     // for Add Skill modal

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountMyPlan(container, params) {
  _container = container;
  container.innerHTML = '';

  _planData = null;
  _expandedCardId = null;
  _draggingPlanSkillId = null;
  _kanbanBodyEls = {};
  _allCatalogSkills = [];

  const user = Store.get('user');
  _engineerId = params?.id ? Number(params.id) : user?.id;

  buildPageShell(container, params);
  loadPlan();

  return () => {};
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadPlan() {
  const kanbanEl = _container.querySelector('.kanban');
  if (kanbanEl) {
    Object.values(_kanbanBodyEls).forEach(body => showSkeleton(body, 'cards'));
  }

  try {
    _planData = await api.get(`/api/plans/${_engineerId}`);
    renderKanban();
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
    renderKanban();
  } catch (err) {
    showToast(err.message || 'Failed to reload plan', 'error');
  }
}

// ─── Page shell construction ─────────────────────────────────────────────────

function buildPageShell(container, params) {
  const wrapper = createElement('div', { style: 'display:flex;flex-direction:column;gap:0;height:100%;min-height:calc(100vh - 60px);' });

  if (params?.id) {
    const banner = createElement('div', {
      id: 'manager-banner',
      style: 'background:var(--bg-panel);border-left:3px solid var(--accent);padding:10px 24px;font-size:14px;color:var(--text-secondary);display:flex;align-items:center;gap:8px;',
    });
    const chip = createElement('span', { className: 'triage-chip triage-signal' });
    chip.textContent = 'Manager View';
    const label = createElement('span', { id: 'manager-banner-label' });
    label.textContent = `Viewing engineer's plan`;
    banner.appendChild(chip);
    banner.appendChild(label);
    wrapper.appendChild(banner);
  }

  const topBar = createElement('div', {
    style: 'background:var(--bg-panel);border-bottom:1px solid var(--border-soft);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;',
  });

  const titleEl = createElement('h1', { style: 'font-size:22px;font-weight:700;color:var(--text-primary);' });
  titleEl.textContent = 'My Plan';
  topBar.appendChild(titleEl);

  const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
  addBtn.textContent = '+ Add Skill';
  addBtn.addEventListener('click', openAddSkillModal);
  topBar.appendChild(addBtn);

  wrapper.appendChild(topBar);

  const main = createElement('div', { style: 'flex:1;overflow-y:auto;padding:24px;' });

  const kanbanEl = createElement('div', { className: 'kanban' });

  const columns = [
    { status: 'in_development', title: 'In Development' },
    { status: 'in_pipeline', title: 'In Pipeline' },
    { status: 'proficiency', title: 'Proficiency' },
  ];

  columns.forEach(({ status, title }) => {
    const col = buildKanbanColumn(status, title);
    kanbanEl.appendChild(col);
  });

  main.appendChild(kanbanEl);
  wrapper.appendChild(main);
  container.appendChild(wrapper);
}

function buildKanbanColumn(status, title) {
  const col = createElement('div', { className: 'kanban-column' });
  col.dataset.status = status;

  const header = createElement('div', { className: 'kanban-column-header' });
  const titleEl = createElement('span', { className: 'kanban-column-title' });
  titleEl.textContent = title;
  const countEl = createElement('span', { className: 'kanban-count', id: `kanban-count-${status}` });
  countEl.textContent = '0';
  header.appendChild(titleEl);
  header.appendChild(countEl);
  col.appendChild(header);

  const body = createElement('div', { className: 'kanban-column-body' });
  body.id = `kanban-body-${status}`;
  _kanbanBodyEls[status] = body;

  body.addEventListener('dragover', (e) => {
    e.preventDefault();
    col.classList.add('drag-over');
  });

  body.addEventListener('dragleave', (e) => {
    // Only remove if leaving the column entirely
    if (!col.contains(e.relatedTarget)) {
      col.classList.remove('drag-over');
    }
  });

  body.addEventListener('drop', (e) => {
    e.preventDefault();
    col.classList.remove('drag-over');
    const planSkillId = Number(e.dataTransfer.getData('planSkillId'));
    const fromStatus = e.dataTransfer.getData('fromStatus');
    if (!planSkillId || fromStatus === status) return;
    handleMoveCard(planSkillId, status);
  });

  col.appendChild(body);
  return col;
}

// ─── Kanban rendering ─────────────────────────────────────────────────────────

function renderKanban() {
  if (!_planData) return;

  const bannerLabel = document.getElementById('manager-banner-label');
  if (bannerLabel && _planData.engineer_name) {
    bannerLabel.textContent = `Viewing ${_planData.engineer_name}'s plan`;
  }

  const skills = Array.isArray(_planData.skills) ? _planData.skills : [];

  const groups = {
    in_development: skills.filter(s => s.status === 'in_development'),
    in_pipeline: skills.filter(s => s.status === 'in_pipeline'),
    proficiency: skills.filter(s => s.status === 'proficiency'),
  };

  Object.entries(groups).forEach(([status, statusSkills]) => {
    const body = _kanbanBodyEls[status];
    const countEl = document.getElementById(`kanban-count-${status}`);
    if (!body) return;

    body.innerHTML = '';
    if (countEl) countEl.textContent = String(statusSkills.length);

    if (statusSkills.length === 0) {
      renderColumnEmptyState(body);
      return;
    }

    statusSkills.forEach(planSkill => {
      const card = buildKanbanCard(planSkill, status);
      body.appendChild(card);

      if (_expandedCardId === planSkill.id) {
        renderExpandedSection(card, planSkill);
      }
    });
  });
}

function renderColumnEmptyState(body) {
  const empty = createElement('div', {
    style: 'text-align:center;padding:24px 12px;color:var(--text-muted);font-size:13px;line-height:1.6;',
  });
  empty.textContent = 'No skills yet — browse the catalog to get started!';
  body.appendChild(empty);
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function buildKanbanCard(planSkill, status) {
  const card = createElement('div', { className: 'kanban-card' });
  card.dataset.planSkillId = planSkill.id;
  card.dataset.status = status;
  card.setAttribute('draggable', 'true');

  const headerRow = createElement('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;' });

  const nameEl = createElement('div', { style: 'font-size:14px;font-weight:700;color:var(--text-primary);flex:1;' });
  nameEl.textContent = planSkill.skill_name || 'Unknown Skill';
  headerRow.appendChild(nameEl);

  const actionsBtn = createElement('button', {
    style: 'background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px 4px;font-size:16px;line-height:1;flex-shrink:0;border-radius:4px;',
    title: 'Actions',
  });
  actionsBtn.textContent = '⋯';
  actionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showCardActionsMenu(e, planSkill, status);
  });
  headerRow.appendChild(actionsBtn);

  card.appendChild(headerRow);

  const badge = buildProficiencyBadge(planSkill.proficiency_level);
  card.appendChild(badge);

  const dateRow = createElement('div', { style: 'font-size:12px;color:var(--text-muted);margin-top:8px;' });
  const dateStr = formatDate(planSkill.updated_at || planSkill.added_at);
  dateRow.textContent = dateStr ? `Updated ${dateStr}` : '';
  card.appendChild(dateRow);

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
    if (_expandedCardId === planSkill.id) {
      collapseCard(card);
    } else {
      collapseAllCards();
      _expandedCardId = planSkill.id;
      renderExpandedSection(card, planSkill);
    }
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
  const badge = createElement('span', { className: c ? `triage-chip ${c.cls}` : 'triage-chip chip-pipeline' });
  badge.textContent = c ? c.label : '—';
  return badge;
}

function showCardActionsMenu(e, planSkill, currentStatus) {
  document.querySelectorAll('.card-actions-menu').forEach(m => m.remove());

  const menu = createElement('div', {
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
    const item = createElement('button', {
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

  const sep = createElement('div', { style: 'border-top:1px solid var(--border-soft);margin:4px 0;' });
  menu.appendChild(sep);

  const removeItem = createElement('button', {
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

// ─── Card expansion ────────────────────────────────────────────────────────────

function collapseCard(card) {
  _expandedCardId = null;
  const expanded = card.querySelector('.card-expanded');
  if (expanded) expanded.remove();
  card.classList.remove('card-active');
}

function collapseAllCards() {
  _container.querySelectorAll('.kanban-card').forEach(c => {
    const exp = c.querySelector('.card-expanded');
    if (exp) exp.remove();
    c.classList.remove('card-active');
  });
  _expandedCardId = null;
}

function renderExpandedSection(card, planSkill) {
  const existing = card.querySelector('.card-expanded');
  if (existing) existing.remove();

  card.classList.add('card-active');

  const expanded = createElement('div', {
    className: 'card-expanded',
    style: 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border-soft);display:flex;flex-direction:column;gap:12px;',
  });

  const formSection = createElement('div', { style: 'display:flex;flex-direction:column;gap:10px;' });

  const statusGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const statusLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  statusLabel.textContent = 'Status';
  const statusSelect = createElement('select', { className: 'form-select', id: `edit-status-${planSkill.id}`, style: 'font-size:13px;padding:6px 10px;' });
  [
    { value: 'in_pipeline', label: 'In Pipeline' },
    { value: 'in_development', label: 'In Development' },
    { value: 'proficiency', label: 'Proficiency' },
  ].forEach(({ value, label }) => {
    const opt = createElement('option', { value });
    opt.textContent = label;
    if (planSkill.status === value) opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  formSection.appendChild(statusGroup);

  const levelGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const levelLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  levelLabel.textContent = 'Proficiency Level';
  const levelSelect = createElement('select', { className: 'form-select', id: `edit-level-${planSkill.id}`, style: 'font-size:13px;padding:6px 10px;' });
  [
    { value: '', label: '— Not set —' },
    { value: '1', label: '1 · Education' },
    { value: '2', label: '2 · Exposure' },
    { value: '3', label: '3 · Experience' },
  ].forEach(({ value, label }) => {
    const opt = createElement('option', { value });
    opt.textContent = label;
    if (String(planSkill.proficiency_level ?? '') === value) opt.selected = true;
    levelSelect.appendChild(opt);
  });
  levelGroup.appendChild(levelLabel);
  levelGroup.appendChild(levelSelect);
  formSection.appendChild(levelGroup);

  const notesGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const notesLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  notesLabel.textContent = 'Notes';
  const notesTextarea = createElement('textarea', {
    id: `edit-notes-${planSkill.id}`,
    placeholder: 'Add notes, resources, or progress comments...',
    rows: '3',
    style: 'font-size:13px;resize:vertical;',
  });
  notesTextarea.textContent = planSkill.notes || '';
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesTextarea);
  formSection.appendChild(notesGroup);

  const saveBtn = createElement('button', { className: 'btn btn-primary btn-sm', style: 'align-self:flex-start;' });
  saveBtn.textContent = 'Save Changes';
  saveBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
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
      showToast('Plan skill updated', 'success');
      await reloadPlan();
    } catch (err) {
      showToast(err.message || 'Failed to save changes', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
  formSection.appendChild(saveBtn);

  expanded.appendChild(formSection);

  const logSection = createElement('div', { style: 'border-top:1px solid var(--border-soft);padding-top:12px;' });
  const logHeader = createElement('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;' });
  const logTitle = createElement('div', { style: 'font-size:13px;font-weight:700;color:var(--text-primary);' });
  logTitle.textContent = 'Training Log';
  const addLogBtn = createElement('button', { className: 'btn btn-secondary btn-sm' });
  addLogBtn.textContent = '+ Add Entry';
  logHeader.appendChild(logTitle);
  logHeader.appendChild(addLogBtn);
  logSection.appendChild(logHeader);

  const logListEl = createElement('div', { style: 'display:flex;flex-direction:column;gap:8px;' });
  const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];

  if (logs.length === 0) {
    const emptyLog = createElement('div', { style: 'font-size:12px;color:var(--text-muted);padding:8px 0;' });
    emptyLog.textContent = 'No training log entries yet.';
    logListEl.appendChild(emptyLog);
  } else {
    logs.forEach(log => {
      logListEl.appendChild(buildTrainingLogEntry(log));
    });
  }
  logSection.appendChild(logListEl);

  const logFormEl = createElement('div', {
    style: 'display:none;flex-direction:column;gap:8px;margin-top:10px;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-soft);',
  });

  const logTitleGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const logTitleLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  logTitleLabel.textContent = 'Title';
  const logTitleInput = createElement('input', { type: 'text', placeholder: 'e.g. Completed CCNP course', style: 'font-size:13px;padding:6px 10px;' });
  logTitleGroup.appendChild(logTitleLabel);
  logTitleGroup.appendChild(logTitleInput);
  logFormEl.appendChild(logTitleGroup);

  const logTypeGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const logTypeLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  logTypeLabel.textContent = 'Type';
  const logTypeSelect = createElement('select', { className: 'form-select', style: 'font-size:13px;padding:6px 10px;' });
  ['course', 'certification', 'reading', 'link', 'action'].forEach(t => {
    const opt = createElement('option', { value: t });
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    logTypeSelect.appendChild(opt);
  });
  logTypeGroup.appendChild(logTypeLabel);
  logTypeGroup.appendChild(logTypeSelect);
  logFormEl.appendChild(logTypeGroup);

  const logDateGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const logDateLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  logDateLabel.textContent = 'Completed At';
  const logDateInput = createElement('input', { type: 'date', style: 'font-size:13px;padding:6px 10px;' });
  logDateGroup.appendChild(logDateLabel);
  logDateGroup.appendChild(logDateInput);
  logFormEl.appendChild(logDateGroup);

  const logNotesGroup = createElement('div', { className: 'form-group', style: 'margin-bottom:0;' });
  const logNotesLabel = createElement('label', { className: 'form-label', style: 'font-size:12px;' });
  logNotesLabel.textContent = 'Notes';
  const logNotesInput = createElement('textarea', { placeholder: 'Optional notes...', rows: '2', style: 'font-size:13px;resize:vertical;' });
  logNotesGroup.appendChild(logNotesLabel);
  logNotesGroup.appendChild(logNotesInput);
  logFormEl.appendChild(logNotesGroup);

  const logFormActions = createElement('div', { style: 'display:flex;gap:8px;' });
  const logSubmitBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
  logSubmitBtn.textContent = 'Add Entry';
  const logCancelBtn = createElement('button', { className: 'btn btn-secondary btn-sm' });
  logCancelBtn.textContent = 'Cancel';

  logSubmitBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
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
      await reloadPlan();
    } catch (err) {
      showToast(err.message || 'Failed to add log entry', 'error');
      logSubmitBtn.disabled = false;
      logSubmitBtn.textContent = 'Add Entry';
    }
  });

  logCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    logFormEl.style.display = 'none';
    addLogBtn.style.display = '';
  });

  logFormActions.appendChild(logSubmitBtn);
  logFormActions.appendChild(logCancelBtn);
  logFormEl.appendChild(logFormActions);
  logSection.appendChild(logFormEl);

  addLogBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    logFormEl.style.display = 'flex';
    addLogBtn.style.display = 'none';
    logTitleInput.value = '';
    logTypeSelect.selectedIndex = 0;
    logDateInput.value = '';
    logNotesInput.value = '';
  });

  expanded.appendChild(logSection);
  card.appendChild(expanded);
}

function buildTrainingLogEntry(log) {
  const entry = createElement('div', {
    style: 'padding:8px 10px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border-soft);',
  });

  const topRow = createElement('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;' });

  const typeChip = createElement('span', { className: 'triage-chip triage-signal', style: 'font-size:11px;padding:2px 7px;' });
  typeChip.textContent = log.type || 'entry';

  const titleEl = createElement('span', { style: 'font-size:13px;font-weight:600;color:var(--text-primary);flex:1;' });
  titleEl.textContent = log.title || 'Untitled';

  topRow.appendChild(typeChip);
  topRow.appendChild(titleEl);

  if (log.completed_at) {
    const dateEl = createElement('span', { style: 'font-size:11px;color:var(--text-muted);white-space:nowrap;' });
    dateEl.textContent = formatDate(log.completed_at);
    topRow.appendChild(dateEl);
  }

  entry.appendChild(topRow);

  if (log.notes) {
    const notesEl = createElement('div', { style: 'font-size:12px;color:var(--text-secondary);line-height:1.5;margin-top:4px;' });
    notesEl.textContent = log.notes;
    entry.appendChild(notesEl);
  }

  return entry;
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

async function handleMoveCard(planSkillId, newStatus) {
  try {
    await api.put(`/api/plans/${_engineerId}/skills/${planSkillId}`, { status: newStatus });
    if (_expandedCardId === planSkillId) _expandedCardId = null;
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
    if (_expandedCardId === planSkill.id) _expandedCardId = null;
    showToast(`"${planSkill.skill_name}" removed from plan`, 'success');
    await reloadPlan();
  } catch (err) {
    showToast(err.message || 'Failed to remove skill', 'error');
  }
}

// ─── Add Skill Modal ──────────────────────────────────────────────────────────

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

  const bodyEl = createElement('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search skills...',
    style: 'width:100%;padding:8px 12px;font-size:14px;',
  });
  bodyEl.appendChild(searchInput);

  const listEl = createElement('div', {
    style: 'display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;',
  });

  function renderSkillList(query) {
    listEl.innerHTML = '';
    const filtered = query
      ? available.filter(s =>
          (s.name || '').toLowerCase().includes(query.toLowerCase()) ||
          (s.description || '').toLowerCase().includes(query.toLowerCase()) ||
          (Array.isArray(s.tags) && s.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
        )
      : available;

    if (filtered.length === 0) {
      const empty = createElement('div', { style: 'text-align:center;padding:24px;color:var(--text-muted);font-size:13px;' });
      empty.textContent = query ? 'No skills match your search.' : 'All available skills are already in your plan.';
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach(skill => {
      const row = createElement('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:var(--radius-md);cursor:pointer;transition:border-color 0.15s;',
      });
      row.dataset.skillId = skill.id;

      const info = createElement('div', { style: 'flex:1;min-width:0;' });
      const nameEl = createElement('div', { style: 'font-size:14px;font-weight:600;color:var(--text-primary);' });
      nameEl.textContent = skill.name;
      info.appendChild(nameEl);

      const meta = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;' });

      if (skill.domain_name) {
        const domBadge = createElement('span', { className: 'triage-chip triage-signal', style: 'font-size:11px;padding:2px 7px;' });
        domBadge.textContent = skill.domain_name;
        meta.appendChild(domBadge);
      }

      if (Array.isArray(skill.tags)) {
        skill.tags.slice(0, 3).forEach(tag => {
          const tagChip = createElement('span', { className: 'triage-chip triage-feedback', style: 'font-size:11px;padding:2px 7px;' });
          tagChip.textContent = tag;
          meta.appendChild(tagChip);
        });
      }

      info.appendChild(meta);
      row.appendChild(info);

      const addBtn = createElement('button', { className: 'btn btn-primary btn-sm', style: 'flex-shrink:0;' });
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

// ─── Permission error ─────────────────────────────────────────────────────────

function showPermissionError(msg) {
  const main = _container.querySelector('.kanban');
  if (!main) return;
  main.innerHTML = '';
  const err = createElement('div', {
    style: 'text-align:center;padding:60px 24px;color:var(--text-muted);',
  });
  const title = createElement('div', { style: 'font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px;' });
  title.textContent = "You don't have permission to view this plan";
  const desc = createElement('div', { style: 'font-size:14px;' });
  desc.textContent = msg || 'Contact your manager or administrator for access.';
  err.appendChild(title);
  err.appendChild(desc);
  main.appendChild(err);
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
