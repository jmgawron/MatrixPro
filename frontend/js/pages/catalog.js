import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';

// ─── Module-level page state ────────────────────────────────────────────────

let _container = null;
let _allSkills = [];
let _allTeams = [];
let _domainMap = {};   // domain_id -> { id, name }
let _teamMap = {};     // team_id  -> { id, name, domain_id }
let _selectedNode = { type: 'all', id: null, label: 'All Skills' };
let _searchQuery = '';
let _filterDomainId = null;
let _filterTeamId = null;
let _showFuture = false;
let _showArchived = false;
let _debounceTimer = null;
let _gridEl = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountCatalog(container, params) {
  _container = container;
  container.innerHTML = '';

  _selectedNode = { type: 'all', id: null, label: 'All Skills' };
  _searchQuery = '';
  _filterDomainId = null;
  _filterTeamId = null;
  _showFuture = false;
  _showArchived = false;

  const page = buildPageShell(container);
  _gridEl = page.gridEl;

  loadData(page);

  return () => {
    clearTimeout(_debounceTimer);
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadData(page) {
  showSkeleton(_gridEl, 'cards');

  try {
    const [skills, teams] = await Promise.all([
      api.get('/api/skills/'),
      api.get('/api/teams/'),
    ]);

    _allSkills = Array.isArray(skills) ? skills : [];
    _allTeams = Array.isArray(teams) ? teams : [];

    _domainMap = {};
    _teamMap = {};
    _allTeams.forEach(t => {
      _teamMap[t.id] = t;
      if (t.domain_id && !_domainMap[t.domain_id]) {
        _domainMap[t.domain_id] = { id: t.domain_id, name: t.domain_name || `Domain ${t.domain_id}` };
      }
    });

    _allSkills.forEach(s => {
      if (s.domain_id && !_domainMap[s.domain_id]) {
        _domainMap[s.domain_id] = { id: s.domain_id, name: `Domain ${s.domain_id}` };
      }
    });

    buildSidebarTree(page.treeEl);
    renderSkillGrid(_gridEl, getFilteredSkills());
    updateFilterDropdowns(page.filterBarEl);
  } catch (err) {
    showToast(err.message || 'Failed to load catalog', 'error');
    _gridEl.innerHTML = '';
    renderEmptyState(_gridEl, 'Failed to load skills', 'Please try refreshing the page.');
  }
}

// ─── Page shell construction ──────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', { style: 'display:flex;flex-direction:column;height:100%;min-height:calc(100vh - 60px);' });

  const topBar = buildTopBar();
  wrapper.appendChild(topBar.el);

  const body = createElement('div', { style: 'display:flex;flex:1;overflow:hidden;' });

  const treeEl = createElement('div', { className: 'sidebar-tree' });
  const treeHeader = createElement('div', { className: 'sidebar-tree-header', textContent: 'Browse Skills' });
  treeEl.appendChild(treeHeader);
  body.appendChild(treeEl);

  const main = createElement('div', { style: 'flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:24px;' });

  const gridEl = createElement('div');
  main.appendChild(gridEl);

  const futureSectionEl = createElement('div', { className: 'hidden', id: 'future-skills-section' });
  main.appendChild(futureSectionEl);

  body.appendChild(main);
  wrapper.appendChild(body);
  container.appendChild(wrapper);

  return {
    treeEl,
    gridEl,
    futureSectionEl,
    filterBarEl: topBar.filterBarEl,
  };
}

function buildTopBar() {
  const topBar = createElement('div', {
    style: 'background:var(--bg-panel);border-bottom:1px solid var(--border-soft);padding:16px 24px;display:flex;flex-direction:column;gap:12px;flex-shrink:0;',
  });

  const row1 = createElement('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;' });

  const titleGroup = createElement('div', { style: 'display:flex;align-items:center;gap:12px;' });
  const title = createElement('h1', { style: 'font-size:22px;font-weight:700;color:var(--text-primary);' });
  title.textContent = 'Skill Catalog';
  titleGroup.appendChild(title);

  const breadcrumb = createElement('span', { className: 'triage-chip triage-signal', id: 'catalog-breadcrumb' });
  breadcrumb.textContent = 'All Skills';
  titleGroup.appendChild(breadcrumb);

  row1.appendChild(titleGroup);

  const user = Store.get('user');
  if (user && (user.role === 'admin' || user.role === 'manager')) {
    const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    addBtn.textContent = 'Add Skill';
    addBtn.addEventListener('click', () => openSkillModal(null));
    row1.appendChild(addBtn);
  }

  topBar.appendChild(row1);

  const filterBarEl = createElement('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' });

  const searchWrap = createElement('div', { style: 'flex:1;min-width:200px;max-width:360px;position:relative;' });
  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search skills...',
    id: 'catalog-search',
    style: 'padding-left:14px;',
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _searchQuery = searchInput.value.trim();
      refreshGrid();
    }, 300);
  });
  searchWrap.appendChild(searchInput);
  filterBarEl.appendChild(searchWrap);

  const domainSelect = createElement('select', { id: 'filter-domain', style: 'width:auto;', className: 'form-select' });
  const domainAll = createElement('option', { value: '', textContent: 'All Domains' });
  domainSelect.appendChild(domainAll);
  domainSelect.addEventListener('change', () => {
    _filterDomainId = domainSelect.value || null;
    _filterTeamId = null;
    updateTeamFilterOptions();
    refreshGrid();
  });
  filterBarEl.appendChild(domainSelect);

  const teamSelect = createElement('select', { id: 'filter-team', style: 'width:auto;', className: 'form-select' });
  const teamAll = createElement('option', { value: '', textContent: 'All Teams' });
  teamSelect.appendChild(teamAll);
  teamSelect.addEventListener('change', () => {
    _filterTeamId = teamSelect.value || null;
    refreshGrid();
  });
  filterBarEl.appendChild(teamSelect);

  const futureLabel = createElement('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px;color:var(--text-secondary);cursor:pointer;white-space:nowrap;' });
  const futureCheck = createElement('input', { type: 'checkbox', id: 'filter-future' });
  futureCheck.addEventListener('change', () => {
    _showFuture = futureCheck.checked;
    refreshGrid();
  });
  futureLabel.appendChild(futureCheck);
  futureLabel.appendChild(document.createTextNode('Future Skills'));
  filterBarEl.appendChild(futureLabel);

  if (user && user.role === 'admin') {
    const archivedLabel = createElement('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px;color:var(--text-secondary);cursor:pointer;white-space:nowrap;' });
    const archivedCheck = createElement('input', { type: 'checkbox', id: 'filter-archived' });
    archivedCheck.addEventListener('change', () => {
      _showArchived = archivedCheck.checked;
      fetchAndRefreshWithArchived();
    });
    archivedLabel.appendChild(archivedCheck);
    archivedLabel.appendChild(document.createTextNode('Show Archived'));
    filterBarEl.appendChild(archivedLabel);
  }

  topBar.appendChild(filterBarEl);

  return { el: topBar, filterBarEl };
}

// ─── Sidebar tree ─────────────────────────────────────────────────────────────

function buildSidebarTree(treeEl) {
  const header = treeEl.querySelector('.sidebar-tree-header');
  treeEl.innerHTML = '';
  if (header) treeEl.appendChild(header);

  const allItem = buildTreeItem('All Skills', 'all', null, 0);
  if (_selectedNode.type === 'all') allItem.classList.add('active');
  allItem.addEventListener('click', () => selectNode({ type: 'all', id: null, label: 'All Skills' }, allItem));
  treeEl.appendChild(allItem);

  const domainIds = Object.keys(_domainMap);
  domainIds.forEach(domainId => {
    const domain = _domainMap[domainId];
    const domainItem = buildTreeItem(domain.name, 'domain', domain.id, 0);
    domainItem.classList.add('expanded');

    if (_selectedNode.type === 'domain' && String(_selectedNode.id) === String(domain.id)) {
      domainItem.classList.add('active');
    }

    domainItem.addEventListener('click', (e) => {
      e.stopPropagation();
      domainItem.classList.toggle('expanded');
      selectNode({ type: 'domain', id: domain.id, label: domain.name }, domainItem);
    });

    const toggle = domainItem.querySelector('.tree-item-toggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        domainItem.classList.toggle('expanded');
      });
    }

    const childrenEl = createElement('div', { className: 'tree-item-children' });
    const teamsInDomain = _allTeams.filter(t => String(t.domain_id) === String(domain.id));

    teamsInDomain.forEach(team => {
      const teamItem = buildTreeItem(team.name, 'team', team.id, 1);
      if (_selectedNode.type === 'team' && String(_selectedNode.id) === String(team.id)) {
        teamItem.classList.add('active');
      }
      teamItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode({ type: 'team', id: team.id, label: team.name }, teamItem);
      });
      childrenEl.appendChild(teamItem);
    });

    domainItem.appendChild(childrenEl);
    treeEl.appendChild(domainItem);
  });
}

function buildTreeItem(label, type, id, indent) {
  const item = createElement('div', { className: 'tree-item', style: indent ? `padding-left:${16 + indent * 16}px;` : '' });
  item.dataset.type = type;
  item.dataset.id = id ?? '';

  const iconEl = createElement('span', { className: 'tree-item-icon' });
  iconEl.textContent = type === 'all' ? '*' : type === 'domain' ? 'D' : 'T';
  iconEl.setAttribute('aria-hidden', 'true');

  const labelEl = createElement('span', { style: 'flex:1;' });
  labelEl.textContent = label;

  item.appendChild(iconEl);
  item.appendChild(labelEl);

  if (type === 'domain') {
    const toggleEl = createElement('span', { className: 'tree-item-toggle' });
    toggleEl.textContent = '>';
    item.appendChild(toggleEl);
  }

  return item;
}

function selectNode(node, itemEl) {
  _selectedNode = node;

  const allItems = _container.querySelectorAll('.tree-item');
  allItems.forEach(i => i.classList.remove('active'));
  if (itemEl) itemEl.classList.add('active');

  const breadcrumb = document.getElementById('catalog-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = node.label;

  refreshGrid();
}

// ─── Filter state helpers ────────────────────────────────────────────────────

function getFilteredSkills() {
  let skills = _allSkills;

  if (_selectedNode.type === 'domain' && _selectedNode.id) {
    skills = skills.filter(s => String(s.domain_id) === String(_selectedNode.id));
  } else if (_selectedNode.type === 'team' && _selectedNode.id) {
    skills = skills.filter(s => {
      const ids = Array.isArray(s.team_ids) ? s.team_ids : (Array.isArray(s.teams) ? s.teams.map(t => t.id) : []);
      return ids.map(String).includes(String(_selectedNode.id));
    });
  }

  if (_filterDomainId) {
    skills = skills.filter(s => String(s.domain_id) === String(_filterDomainId));
  }

  if (_filterTeamId) {
    skills = skills.filter(s => {
      const ids = Array.isArray(s.team_ids) ? s.team_ids : (Array.isArray(s.teams) ? s.teams.map(t => t.id) : []);
      return ids.map(String).includes(String(_filterTeamId));
    });
  }

  if (!_showFuture) {
    skills = skills.filter(s => !s.is_future);
  }

  if (!_showArchived) {
    skills = skills.filter(s => !s.is_archived);
  }

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    skills = skills.filter(s => {
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const descMatch = (s.description || '').toLowerCase().includes(q);
      const tagMatch = Array.isArray(s.tags) && s.tags.some(t => (t.name || t).toLowerCase().includes(q));
      return nameMatch || descMatch || tagMatch;
    });
  }

  return skills;
}

function updateFilterDropdowns(filterBarEl) {
  const domainSelect = document.getElementById('filter-domain');
  if (!domainSelect) return;

  while (domainSelect.options.length > 1) domainSelect.remove(1);

  Object.values(_domainMap).forEach(d => {
    const opt = createElement('option', { value: d.id });
    opt.textContent = d.name;
    domainSelect.appendChild(opt);
  });

  updateTeamFilterOptions();
}

function updateTeamFilterOptions() {
  const teamSelect = document.getElementById('filter-team');
  if (!teamSelect) return;

  while (teamSelect.options.length > 1) teamSelect.remove(1);

  const teamsToShow = _filterDomainId
    ? _allTeams.filter(t => String(t.domain_id) === String(_filterDomainId))
    : _allTeams;

  teamsToShow.forEach(t => {
    const opt = createElement('option', { value: t.id });
    opt.textContent = t.name;
    teamSelect.appendChild(opt);
  });
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function refreshGrid() {
  if (!_gridEl) return;
  renderSkillGrid(_gridEl, getFilteredSkills());
}

function renderSkillGrid(container, skills) {
  container.innerHTML = '';

  if (!skills.length) {
    renderEmptyState(container, 'No skills found', 'Try adjusting your search or filters.');
    return;
  }

  const regular = skills.filter(s => !s.is_future);
  const future = skills.filter(s => s.is_future);

  if (regular.length) {
    const grid = createElement('div', { className: 'grid-3' });
    regular.forEach(skill => grid.appendChild(buildSkillCard(skill)));
    container.appendChild(grid);
  }

  if (future.length && _showFuture) {
    const sep = createElement('div', { style: 'margin-top:32px;' });

    const sepHeader = createElement('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:16px;' });
    const sepTitle = createElement('h2', { style: 'font-size:18px;font-weight:700;color:var(--text-primary);' });
    sepTitle.textContent = 'Future Skills';
    const badge = createElement('span', { className: 'triage-chip triage-pipeline' });
    badge.textContent = `${future.length} upcoming`;
    sepHeader.appendChild(sepTitle);
    sepHeader.appendChild(badge);

    const futureGrid = createElement('div', { className: 'grid-3' });
    future.forEach(skill => futureGrid.appendChild(buildSkillCard(skill)));

    sep.appendChild(sepHeader);
    sep.appendChild(futureGrid);
    container.appendChild(sep);
  }
}

function buildSkillCard(skill) {
  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';

  const card = createElement('div', {
    className: 'tool-card',
    style: skill.is_archived ? 'opacity:0.6;' : '',
  });
  card.dataset.skillId = skill.id;

  const headerRow = createElement('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;' });

  const nameEl = createElement('div', { className: 'tool-card-name' });
  nameEl.textContent = skill.name;
  headerRow.appendChild(nameEl);

  if (isAdmin) {
    const actions = createElement('div', { className: 'card-admin-actions', style: 'display:flex;gap:4px;flex-shrink:0;opacity:0;transition:opacity 0.2s;' });

    const editBtn = createElement('button', { className: 'btn btn-sm btn-secondary', style: 'padding:4px 8px;font-size:12px;' });
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSkillModal(skill);
    });

    const archiveBtn = createElement('button', {
      className: skill.is_archived ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-danger',
      style: 'padding:4px 8px;font-size:12px;',
    });
    archiveBtn.textContent = skill.is_archived ? 'Restore' : 'Archive';
    archiveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleArchiveSkill(skill);
    });

    actions.appendChild(editBtn);
    actions.appendChild(archiveBtn);
    headerRow.appendChild(actions);

    card.addEventListener('mouseenter', () => { actions.style.opacity = '1'; });
    card.addEventListener('mouseleave', () => { actions.style.opacity = '0'; });
  }

  card.appendChild(headerRow);

  const domainName = _domainMap[skill.domain_id]?.name || 'General';
  const catClass = getDomainCatClass(skill.domain_id);
  const catBadge = createElement('span', { className: `tool-card-category ${catClass}` });
  catBadge.textContent = domainName;
  card.appendChild(catBadge);

  const badgesRow = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;' });

  if (skill.is_future) {
    const futureBadge = createElement('span', { className: 'triage-chip triage-pipeline' });
    futureBadge.textContent = 'Future';
    badgesRow.appendChild(futureBadge);
  }

  if (skill.is_archived) {
    const archivedBadge = createElement('span', { className: 'triage-chip triage-blocking' });
    archivedBadge.textContent = 'Archived';
    badgesRow.appendChild(archivedBadge);
  }

  if (badgesRow.children.length > 0) card.appendChild(badgesRow);

  const desc = createElement('div', { className: 'tool-card-desc' });
  desc.textContent = truncate(skill.description || 'No description available.', 120);
  card.appendChild(desc);

  const tags = Array.isArray(skill.tags) ? skill.tags : [];
  if (tags.length) {
    const tagsRow = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;' });
    tags.slice(0, 4).forEach(tag => {
      const chip = createElement('span', { className: 'triage-chip triage-feedback', style: 'font-size:11px;padding:2px 8px;' });
      chip.textContent = tag.name || tag;
      tagsRow.appendChild(chip);
    });
    if (tags.length > 4) {
      const more = createElement('span', { className: 'text-muted text-sm', style: 'align-self:center;' });
      more.textContent = `+${tags.length - 4} more`;
      tagsRow.appendChild(more);
    }
    card.appendChild(tagsRow);
  }

  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    showSkillDetailModal(skill);
  });

  return card;
}

// ─── Skill Detail Modal ───────────────────────────────────────────────────────

function showSkillDetailModal(skill) {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const overlay = createElement('div', { className: 'modal-overlay' });
  const modal = createElement('div', { className: 'modal skill-detail-modal' });

  const modalHeader = createElement('div', { className: 'modal-header' });
  const titleEl = createElement('h2', { className: 'modal-title' });
  titleEl.textContent = skill.name;
  const closeBtn = createElement('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  modalHeader.appendChild(titleEl);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const modalBody = createElement('div', { className: 'modal-body', style: 'display:flex;flex-direction:column;gap:0;padding:20px 24px;overflow:hidden;' });

  const detailHeader = createElement('div', { className: 'skill-detail-header' });

  const metaRow = createElement('div', { className: 'skill-detail-header-meta' });
  const domainName = _domainMap[skill.domain_id]?.name || 'General';
  const catClass = getDomainCatClass(skill.domain_id);
  const domainBadge = createElement('span', { className: `tool-card-category ${catClass}` });
  domainBadge.textContent = domainName;
  metaRow.appendChild(domainBadge);

  if (skill.is_future) {
    const b = createElement('span', { className: 'triage-chip triage-pipeline' });
    b.textContent = 'Future Skill';
    metaRow.appendChild(b);
  }
  if (skill.is_archived) {
    const b = createElement('span', { className: 'triage-chip triage-blocking' });
    b.textContent = 'Archived';
    metaRow.appendChild(b);
  }
  detailHeader.appendChild(metaRow);

  if (skill.description) {
    const descEl = createElement('p', { className: 'skill-detail-description' });
    descEl.textContent = skill.description;
    detailHeader.appendChild(descEl);
  }

  const tags = Array.isArray(skill.tags) ? skill.tags : [];
  if (tags.length) {
    const tagsRow = createElement('div', { className: 'skill-detail-header-row' });
    const tagsLabel = createElement('span', { className: 'skill-detail-header-label' });
    tagsLabel.textContent = 'Tags';
    tagsRow.appendChild(tagsLabel);
    tags.forEach(tag => {
      const chip = createElement('span', { className: 'triage-chip triage-feedback', style: 'font-size:11px;padding:2px 8px;' });
      chip.textContent = tag.name || tag;
      tagsRow.appendChild(chip);
    });
    detailHeader.appendChild(tagsRow);
  }

  const teamIds = Array.isArray(skill.team_ids) ? skill.team_ids : (Array.isArray(skill.teams) ? skill.teams.map(t => t.id) : []);
  const teamNames = teamIds.map(id => _teamMap[id]?.name).filter(Boolean);
  if (teamNames.length) {
    const teamsRow = createElement('div', { className: 'skill-detail-header-row' });
    const teamsLabel = createElement('span', { className: 'skill-detail-header-label' });
    teamsLabel.textContent = 'Teams';
    teamsRow.appendChild(teamsLabel);
    teamNames.forEach(name => {
      const chip = createElement('span', { className: 'triage-chip triage-signal', style: 'font-size:11px;padding:2px 8px;' });
      chip.textContent = name;
      teamsRow.appendChild(chip);
    });
    detailHeader.appendChild(teamsRow);
  }

  modalBody.appendChild(detailHeader);

  const LEVEL_CONFIG = [
    { key: 'education', label: 'Education', chipClass: 'chip-education' },
    { key: 'exposure', label: 'Exposure', chipClass: 'chip-exposure' },
    { key: 'experience', label: 'Experience', chipClass: 'chip-experience' },
  ];

  const tabBar = createElement('div', { className: 'skill-detail-tabs', role: 'tablist', 'aria-label': 'Skill level content' });
  const tabPanelsWrap = createElement('div', { style: 'flex:1;overflow:hidden;display:flex;flex-direction:column;' });

  const tabButtons = {};
  const tabPanels = {};

  LEVEL_CONFIG.forEach(({ key, label }) => {
    const tabBtn = createElement('button', { className: 'skill-detail-tab', 'data-tab': key, role: 'tab', 'aria-selected': 'false', 'aria-controls': `panel-${key}` });
    const tabLabel = createElement('span');
    tabLabel.textContent = label;
    const tabCount = createElement('span', { className: 'skill-detail-tab-count' });
    tabCount.textContent = '0';
    tabBtn.appendChild(tabLabel);
    tabBtn.appendChild(tabCount);
    tabBar.appendChild(tabBtn);
    tabButtons[key] = tabBtn;

    const panel = createElement('div', { className: 'skill-detail-tab-panel', 'data-panel': key, role: 'tabpanel', id: `panel-${key}` });
    tabPanelsWrap.appendChild(panel);
    tabPanels[key] = panel;
  });

  const skeletonEl = createElement('div', { className: 'skill-detail-skeleton' });
  for (let i = 0; i < 3; i++) {
    const skRow = createElement('div', { className: 'skeleton', style: 'height:56px;border-radius:var(--radius-md);' });
    skeletonEl.appendChild(skRow);
  }
  tabPanelsWrap.appendChild(skeletonEl);

  modalBody.appendChild(tabBar);
  modalBody.appendChild(tabPanelsWrap);
  modal.appendChild(modalBody);
  overlay.appendChild(modal);
  modalRoot.appendChild(overlay);

  function activateTab(key) {
    LEVEL_CONFIG.forEach(({ key: k }) => {
      const isActive = k === key;
      tabButtons[k].classList.toggle('active', isActive);
      tabButtons[k].setAttribute('aria-selected', String(isActive));
      tabPanels[k].classList.toggle('active', isActive);
    });
  }

  LEVEL_CONFIG.forEach(({ key }) => {
    tabButtons[key].addEventListener('click', () => activateTab(key));
  });

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeModal();

    // Focus trap: cycle Tab/Shift+Tab within modal
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

    // Arrow keys switch tabs when a tab button is focused
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const tabKeys = LEVEL_CONFIG.map(l => l.key);
      const focused = document.activeElement;
      const currentTab = focused?.dataset?.tab;
      if (currentTab && tabKeys.includes(currentTab)) {
        const idx = tabKeys.indexOf(currentTab);
        const next = e.key === 'ArrowRight' ? (idx + 1) % tabKeys.length : (idx - 1 + tabKeys.length) % tabKeys.length;
        activateTab(tabKeys[next]);
        tabButtons[tabKeys[next]].focus();
        e.preventDefault();
      }
    }
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', onKeyDown);

  // Set initial focus to close button for keyboard users
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    closeBtn.focus();
  });

  const LEVEL_MAP = { 1: 'education', 2: 'exposure', 3: 'experience' };
  const LEVEL_REVERSE = { education: 1, exposure: 2, experience: 3 };

  const user = Store.get('user');
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  function renderPanelContent(key, items) {
    const levelCfg = LEVEL_CONFIG.find(l => l.key === key);
    const panel = tabPanels[key];
    panel.innerHTML = '';

    const sorted = items.slice().sort((a, b) => {
      const pd = (a.position ?? 0) - (b.position ?? 0);
      return pd !== 0 ? pd : a.id - b.id;
    });

    tabButtons[key].querySelector('.skill-detail-tab-count').textContent = sorted.length;

    let openItem = null;

    let dragSrcEl = null;

    function handleDragStart(e) {
      dragSrcEl = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.dataset.itemId);
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = this;
      if (target === dragSrcEl || !target.classList.contains('skill-detail-accordion-item')) return;
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        target.classList.add('drag-over-top');
        target.classList.remove('drag-over-bottom');
      } else {
        target.classList.add('drag-over-bottom');
        target.classList.remove('drag-over-top');
      }
    }

    function handleDragLeave() {
      this.classList.remove('drag-over-top', 'drag-over-bottom');
    }

    function handleDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      const target = this;
      target.classList.remove('drag-over-top', 'drag-over-bottom');
      if (!dragSrcEl || dragSrcEl === target) return;

      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        target.parentNode.insertBefore(dragSrcEl, target);
      } else {
        target.parentNode.insertBefore(dragSrcEl, target.nextSibling);
      }

      persistReorder(panel, key);
    }

    function handleDragEnd() {
      this.classList.remove('dragging');
      panel.querySelectorAll('.skill-detail-accordion-item').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      dragSrcEl = null;
    }

    async function persistReorder(panelEl, levelKey) {
      const items = [...panelEl.querySelectorAll('.skill-detail-accordion-item')].map((el, idx) => ({
        id: parseInt(el.dataset.itemId, 10),
        position: idx
      }));
      try {
        await api.put(`/api/skills/${skill.id}/content/reorder`, { items });
        showToast('Order saved', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to save order', 'error');
        refreshModalContent();
      }
    }

    if (!sorted.length) {
      const empty = createElement('div', { className: 'skill-detail-tab-empty' });
      empty.textContent = 'No content added for this level yet.';
      panel.appendChild(empty);
    } else {
      sorted.forEach(item => {
        const accItem = createElement('div', { className: 'skill-detail-accordion-item' });
        accItem.dataset.itemId = item.id;

        if (canEdit) {
          accItem.draggable = true;
          accItem.addEventListener('dragstart', handleDragStart);
          accItem.addEventListener('dragover', handleDragOver);
          accItem.addEventListener('dragleave', handleDragLeave);
          accItem.addEventListener('drop', handleDrop);
          accItem.addEventListener('dragend', handleDragEnd);
        }

        const trigger = createElement('button', { className: 'skill-detail-accordion-trigger' });

        if (canEdit) {
          const dragHandle = createElement('span', { className: 'drag-handle', 'aria-hidden': 'true' });
          dragHandle.textContent = '\u2630';
          dragHandle.addEventListener('mousedown', () => { accItem.draggable = true; });
          trigger.appendChild(dragHandle);
        }

        const typeChip = createElement('span', { className: `triage-chip ${levelCfg.chipClass}`, style: 'font-size:11px;padding:2px 8px;flex-shrink:0;' });
        typeChip.textContent = item.type || 'resource';

        const titleSpan = createElement('span', { className: 'skill-detail-accordion-title' });
        titleSpan.textContent = item.title || 'Untitled';

        if (canEdit) {
          const adminActions = createElement('div', { className: 'accordion-admin-actions' });

          const editBtn = createElement('button', { className: 'btn btn-sm btn-secondary accordion-action-btn', 'aria-label': 'Edit item' });
          editBtn.textContent = '\u270F\uFE0F';
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showContentEditModal(skill.id, LEVEL_REVERSE[key], item, () => refreshModalContent());
          });

          const deleteBtn = createElement('button', { className: 'btn btn-sm btn-danger accordion-action-btn', 'aria-label': 'Delete item' });
          deleteBtn.textContent = '\uD83D\uDDD1\uFE0F';
          deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await showConfirm(`Delete "${item.title || 'this item'}"? This cannot be undone.`, true);
            if (!confirmed) return;
            try {
              await api.del(`/api/skills/${skill.id}/content/${item.id}`);
              showToast('Content item deleted', 'success');
              refreshModalContent();
            } catch (err) {
              showToast(err.message || 'Failed to delete item', 'error');
            }
          });

          adminActions.appendChild(editBtn);
          adminActions.appendChild(deleteBtn);
          trigger.appendChild(typeChip);
          trigger.appendChild(titleSpan);
          trigger.appendChild(adminActions);
        } else {
          trigger.appendChild(typeChip);
          trigger.appendChild(titleSpan);
        }

        const chevron = createElement('span', { className: 'skill-detail-accordion-chevron', 'aria-hidden': 'true' });
        trigger.appendChild(chevron);

        const body = createElement('div', { className: 'skill-detail-accordion-body' });
        const bodyInner = createElement('div', { className: 'skill-detail-accordion-body-inner' });

        if (item.description) {
          const descEl = createElement('div');
          descEl.innerHTML = item.description;
          bodyInner.appendChild(descEl);
        }

        if (item.url) {
          const link = createElement('a', { className: 'skill-detail-accordion-link', href: item.url, target: '_blank', rel: 'noopener noreferrer' });
          link.textContent = 'Open Resource';
          bodyInner.appendChild(link);
        }

        body.appendChild(bodyInner);
        accItem.appendChild(trigger);
        accItem.appendChild(body);
        panel.appendChild(accItem);

        trigger.addEventListener('click', (e) => {
          if (e.target.closest('.accordion-admin-actions')) return;
          if (e.target.closest('.drag-handle')) return;
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

    if (canEdit) {
      const addBtn = createElement('button', { className: 'btn btn-secondary btn-sm content-add-btn' });
      addBtn.textContent = '+ Add Item';
      addBtn.addEventListener('click', () => {
        showContentEditModal(skill.id, LEVEL_REVERSE[key], null, () => refreshModalContent());
      });
      panel.appendChild(addBtn);
    }
  }

  function refreshModalContent() {
    LEVEL_CONFIG.forEach(({ key }) => {
      tabPanels[key].innerHTML = '';
      const sk = createElement('div', { style: 'display:flex;flex-direction:column;gap:8px;padding:12px 0;' });
      for (let i = 0; i < 2; i++) {
        sk.appendChild(createElement('div', { className: 'skeleton', style: 'height:44px;border-radius:var(--radius-md);' }));
      }
      tabPanels[key].appendChild(sk);
    });

    api.get(`/api/skills/${skill.id}/content`).then(rawContent => {
      const fresh = Array.isArray(rawContent) ? rawContent : [];
      const freshGroups = { education: [], exposure: [], experience: [] };
      fresh.forEach(item => {
        const key = LEVEL_MAP[item.level] || 'education';
        freshGroups[key].push(item);
      });
      LEVEL_CONFIG.forEach(({ key }) => renderPanelContent(key, freshGroups[key]));
    }).catch(() => {
      LEVEL_CONFIG.forEach(({ key }) => {
        tabPanels[key].innerHTML = '';
        const errEl = createElement('div', { className: 'skill-detail-tab-empty' });
        errEl.textContent = 'Unable to reload content.';
        tabPanels[key].appendChild(errEl);
      });
    });
  }

  api.get(`/api/skills/${skill.id}/content`).then(rawContent => {
    skeletonEl.remove();

    const content = Array.isArray(rawContent) ? rawContent : [];
    const groups = { education: [], exposure: [], experience: [] };

    content.forEach(item => {
      const key = LEVEL_MAP[item.level] || 'education';
      groups[key].push(item);
    });

    LEVEL_CONFIG.forEach(({ key }) => renderPanelContent(key, groups[key]));

    const firstWithContent = LEVEL_CONFIG.find(({ key }) => groups[key].length > 0);
    activateTab(firstWithContent ? firstWithContent.key : 'education');

  }).catch(() => {
    skeletonEl.remove();
    const errEl = createElement('div', { className: 'skill-detail-tab-empty' });
    errEl.textContent = 'Unable to load learning content.';
    tabPanelsWrap.appendChild(errEl);
    activateTab('education');
  });
}

// ─── Content Edit Modal ───────────────────────────────────────────────────────

function showContentEditModal(skillId, levelInt, existingItem, onSaved) {
  const isEdit = !!existingItem;
  const CONTENT_TYPES = ['course', 'certification', 'reading', 'link', 'action'];

  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const overlay = createElement('div', { className: 'modal-overlay' });
  const modal = createElement('div', { className: 'modal content-edit-modal' });

  const modalHeader = createElement('div', { className: 'modal-header' });
  const titleEl = createElement('h2', { className: 'modal-title' });
  titleEl.textContent = isEdit ? 'Edit Content Item' : 'Add Content Item';
  const closeBtn = createElement('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  modalHeader.appendChild(titleEl);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const modalBody = createElement('div', { className: 'modal-body' });

  const titleGroup = createElement('div', { className: 'form-group' });
  const titleLabel = createElement('label', { className: 'form-label required', htmlFor: 'content-title' });
  titleLabel.textContent = 'Title';
  const titleInput = createElement('input', { type: 'text', id: 'content-title', placeholder: 'e.g. Cisco Learning Network Course' });
  if (existingItem?.title) titleInput.value = existingItem.title;
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  const typeGroup = createElement('div', { className: 'form-group' });
  const typeLabel = createElement('label', { className: 'form-label required', htmlFor: 'content-type' });
  typeLabel.textContent = 'Type';
  const typeSelect = createElement('select', { id: 'content-type', className: 'form-select' });
  CONTENT_TYPES.forEach(t => {
    const opt = createElement('option', { value: t });
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (existingItem?.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  const bodyGroup = createElement('div', { className: 'form-group' });
  const bodyLabel = createElement('label', { className: 'form-label', htmlFor: 'content-body-editor' });
  bodyLabel.textContent = 'Description';
  const editorWrap = createElement('div', { className: 'content-edit-quill-wrap' });
  const editorEl = createElement('div', { id: 'content-body-editor' });
  editorWrap.appendChild(editorEl);
  bodyGroup.appendChild(bodyLabel);
  bodyGroup.appendChild(editorWrap);
  modalBody.appendChild(bodyGroup);

  const urlGroup = createElement('div', { className: 'form-group' });
  const urlLabel = createElement('label', { className: 'form-label', htmlFor: 'content-url' });
  urlLabel.textContent = 'URL (optional)';
  const urlInput = createElement('input', { type: 'url', id: 'content-url', placeholder: 'https://...' });
  if (existingItem?.url) urlInput.value = existingItem.url;
  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlInput);
  modalBody.appendChild(urlGroup);

  const footer = createElement('div', { className: 'modal-footer' });
  const cancelBtn = createElement('button', { className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  const saveBtn = createElement('button', { className: 'btn btn-primary' });
  saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(modalBody);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  modalRoot.appendChild(overlay);

  let quillInstance = null;

  requestAnimationFrame(() => {
    overlay.classList.add('open');

    if (typeof Quill !== 'undefined') {
      quillInstance = new Quill(editorEl, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic'],
            [{ header: [1, 2, 3, false] }],
            [{ color: [] }],
            ['link'],
            ['clean'],
          ],
        },
      });
      if (existingItem?.description) {
        quillInstance.root.innerHTML = existingItem.description;
      }
    } else {
      editorEl.contentEditable = 'true';
      editorEl.style.cssText = 'min-height:120px;padding:10px;border:1px solid var(--border-soft);border-radius:var(--radius-md);background:var(--bg-input);color:var(--text-primary);';
      if (existingItem?.description) editorEl.innerHTML = existingItem.description;
    }
  });

  function getBodyHtml() {
    if (quillInstance) return quillInstance.root.innerHTML;
    return editorEl.innerHTML;
  }

  function hasUnsavedChanges() {
    const currentTitle = titleInput.value.trim();
    const currentType = typeSelect.value;
    const currentUrl = urlInput.value.trim();
    const currentBody = getBodyHtml();
    if (!isEdit) {
      return currentTitle !== '' || currentUrl !== '' || (currentBody !== '<p><br></p>' && currentBody !== '');
    }
    return currentTitle !== (existingItem.title || '') ||
      currentType !== (existingItem.type || '') ||
      currentUrl !== (existingItem.url || '') ||
      currentBody !== (existingItem.description || '');
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
  }

  async function handleCancel() {
    if (hasUnsavedChanges()) {
      const confirmed = await showConfirm('Discard unsaved changes?', false);
      if (!confirmed) return;
    }
    closeModal();
  }

  async function handleSave() {
    const title = titleInput.value.trim();
    if (!title) {
      showToast('Title is required', 'warning');
      titleInput.focus();
      return;
    }

    const payload = {
      title,
      type: typeSelect.value,
      description: getBodyHtml(),
      url: urlInput.value.trim() || null,
    };

    if (!isEdit) {
      payload.level = levelInt;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      if (isEdit) {
        await api.put(`/api/skills/${skillId}/content/${existingItem.id}`, payload);
        showToast('Content item updated', 'success');
      } else {
        await api.post(`/api/skills/${skillId}/content`, payload);
        showToast('Content item added', 'success');
      }
      closeModal();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(err.message || 'Failed to save content item', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') handleCancel();
  }

  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  saveBtn.addEventListener('click', handleSave);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancel();
  });
  document.addEventListener('keydown', onKeyDown);
}

function openSkillModal(existingSkill) {
  const isEdit = !!existingSkill;
  const formEl = buildSkillForm(existingSkill);

  showModal({
    title: isEdit ? 'Edit Skill' : 'Create Skill',
    body: formEl,
    confirmText: isEdit ? 'Save Changes' : 'Create Skill',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const formData = readSkillForm(formEl);
      const errors = validateSkillForm(formData);

      if (errors.length) {
        showToast(errors[0], 'warning');
        return;
      }

      try {
        if (isEdit) {
          const updated = await api.put(`/api/skills/${existingSkill.id}`, formData);
          const idx = _allSkills.findIndex(s => s.id === existingSkill.id);
          if (idx !== -1) _allSkills[idx] = { ..._allSkills[idx], ...updated };
          showToast('Skill updated successfully', 'success');
        } else {
          const created = await api.post('/api/skills/', formData);
          _allSkills.push(created);
          showToast('Skill created successfully', 'success');
        }
        refreshGrid();
      } catch (err) {
        showToast(err.message || 'Failed to save skill', 'error');
      }
    },
  });
}

function buildSkillForm(skill) {
  const form = createElement('div', { style: 'display:flex;flex-direction:column;gap:0;' });

  form.appendChild(buildFormGroup('Name', 'skill-name', 'input', {
    type: 'text',
    placeholder: 'e.g. Wi-Fi 6 Configuration',
    required: true,
    value: skill?.name || '',
  }, true));

  form.appendChild(buildFormGroup('Description', 'skill-desc', 'textarea', {
    placeholder: 'Describe what this skill covers...',
    value: skill?.description || '',
  }));

  const domainGroup = createElement('div', { className: 'form-group' });
  const domainLabel = createElement('label', { className: 'form-label required', htmlFor: 'skill-domain' });
  domainLabel.textContent = 'Domain';
  const domainSelect = createElement('select', { id: 'skill-domain', className: 'form-select' });
  const domainPlaceholder = createElement('option', { value: '' });
  domainPlaceholder.textContent = '-- Select Domain --';
  domainSelect.appendChild(domainPlaceholder);
  Object.values(_domainMap).forEach(d => {
    const opt = createElement('option', { value: d.id });
    opt.textContent = d.name;
    if (skill && String(skill.domain_id) === String(d.id)) opt.selected = true;
    domainSelect.appendChild(opt);
  });
  domainGroup.appendChild(domainLabel);
  domainGroup.appendChild(domainSelect);
  form.appendChild(domainGroup);

  const teamsGroup = createElement('div', { className: 'form-group' });
  const teamsLabel = createElement('div', { className: 'form-label' });
  teamsLabel.textContent = 'Associated Teams';
  const teamsGrid = createElement('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px;' });
  const skillTeamIds = Array.isArray(skill?.team_ids) ? skill.team_ids.map(String) : (Array.isArray(skill?.teams) ? skill.teams.map(t => String(t.id)) : []);
  _allTeams.forEach(t => {
    const checkLabel = createElement('label', { style: 'display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary);cursor:pointer;' });
    const check = createElement('input', { type: 'checkbox', value: t.id });
    if (skillTeamIds.includes(String(t.id))) check.checked = true;
    check.className = 'skill-team-check';
    checkLabel.appendChild(check);
    checkLabel.appendChild(document.createTextNode(t.name));
    teamsGrid.appendChild(checkLabel);
  });
  teamsGroup.appendChild(teamsLabel);
  teamsGroup.appendChild(teamsGrid);
  form.appendChild(teamsGroup);

  form.appendChild(buildFormGroup('Tags', 'skill-tags', 'input', {
    type: 'text',
    placeholder: 'e.g. routing, bgp, advanced (comma-separated)',
    value: Array.isArray(skill?.tags) ? skill.tags.map(t => t.name || t).join(', ') : '',
  }));
  const tagHint = createElement('div', { className: 'form-hint', style: 'margin-top:-10px;margin-bottom:16px;' });
  tagHint.textContent = 'Separate multiple tags with commas';
  form.appendChild(tagHint);

  const futureGroup = createElement('div', { className: 'form-group' });
  const futureLabel = createElement('label', { style: 'display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-secondary);cursor:pointer;' });
  const futureCheck = createElement('input', { type: 'checkbox', id: 'skill-future' });
  if (skill?.is_future) futureCheck.checked = true;
  futureLabel.appendChild(futureCheck);
  futureLabel.appendChild(document.createTextNode('Mark as Future Skill'));
  futureGroup.appendChild(futureLabel);
  form.appendChild(futureGroup);

  return form;
}

function buildFormGroup(labelText, inputId, inputTag, attrs, required) {
  const group = createElement('div', { className: 'form-group' });
  const label = createElement('label', { className: required ? 'form-label required' : 'form-label', htmlFor: inputId });
  label.textContent = labelText;

  const input = createElement(inputTag, { id: inputId });
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'value' && inputTag === 'textarea') {
      input.textContent = v;
    } else if (k === 'value') {
      input.value = v;
    } else {
      input[k] = v;
    }
  });

  group.appendChild(label);
  group.appendChild(input);
  return group;
}

function readSkillForm(formEl) {
  const name = formEl.querySelector('#skill-name')?.value.trim() || '';
  const description = formEl.querySelector('#skill-desc')?.value.trim() || '';
  const domain_id = formEl.querySelector('#skill-domain')?.value || null;
  const is_future = formEl.querySelector('#skill-future')?.checked || false;

  const teamCheckboxes = formEl.querySelectorAll('.skill-team-check:checked');
  const team_ids = Array.from(teamCheckboxes).map(c => Number(c.value));

  const tagsRaw = formEl.querySelector('#skill-tags')?.value.trim() || '';
  const tag_names = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { name, description, domain_id: domain_id ? Number(domain_id) : null, is_future, team_ids, tag_names };
}

function validateSkillForm(data) {
  const errors = [];
  if (!data.name) errors.push('Skill name is required.');
  if (!data.domain_id) errors.push('Please select a domain.');
  return errors;
}

async function handleArchiveSkill(skill) {
  const action = skill.is_archived ? 'restore' : 'archive';
  const confirmed = await showConfirm(
    `Are you sure you want to ${action} "${skill.name}"? ${action === 'archive' ? 'It will no longer appear in the active catalog.' : 'It will become visible in the active catalog again.'}`,
    action === 'archive'
  );

  if (!confirmed) return;

  try {
    await api.del(`/api/skills/${skill.id}`);
    const idx = _allSkills.findIndex(s => s.id === skill.id);
    if (idx !== -1) _allSkills[idx] = { ..._allSkills[idx], is_archived: !skill.is_archived };
    showToast(`Skill ${action === 'archive' ? 'archived' : 'restored'} successfully`, 'success');
    refreshGrid();
  } catch (err) {
    showToast(err.message || `Failed to ${action} skill`, 'error');
  }
}

async function fetchAndRefreshWithArchived() {
  try {
    const params = _showArchived ? '?include_archived=true' : '';
    const skills = await api.get(`/api/skills/${params}`);
    _allSkills = Array.isArray(skills) ? skills : [];
    refreshGrid();
  } catch (err) {
    showToast(err.message || 'Failed to reload skills', 'error');
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function renderEmptyState(container, title, desc) {
  const state = createElement('div', { className: 'empty-state' });

  const icon = createElement('span', { className: 'empty-state-icon' });
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = 'o';

  const titleEl = createElement('div', { className: 'empty-state-title' });
  titleEl.textContent = title;

  const descEl = createElement('div', { className: 'empty-state-desc' });
  descEl.textContent = desc;

  state.appendChild(icon);
  state.appendChild(titleEl);
  state.appendChild(descEl);
  container.appendChild(state);
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

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

const DOMAIN_CAT_CLASSES = ['cat-wireless', 'cat-research', 'cat-case', 'cat-config', 'cat-platform', 'cat-bdb', 'cat-cve', 'cat-bug'];

function getDomainCatClass(domainId) {
  if (!domainId) return 'cat-research';
  const keys = Object.keys(_domainMap);
  const idx = keys.indexOf(String(domainId));
  return DOMAIN_CAT_CLASSES[idx % DOMAIN_CAT_CLASSES.length] || 'cat-research';
}
