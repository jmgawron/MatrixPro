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
let _detailPanelEl = null;
let _activeCardSkillId = null;

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
  _activeCardSkillId = null;

  const page = buildPageShell(container);
  _gridEl = page.gridEl;
  _detailPanelEl = page.detailPanelEl;

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

  const detailPanelEl = createElement('div', { className: 'hidden' });
  main.appendChild(detailPanelEl);

  const futureSectionEl = createElement('div', { className: 'hidden', id: 'future-skills-section' });
  main.appendChild(futureSectionEl);

  body.appendChild(main);
  wrapper.appendChild(body);
  container.appendChild(wrapper);

  return {
    treeEl,
    gridEl,
    detailPanelEl,
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
  _activeCardSkillId = null;

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
    if (_activeCardSkillId === skill.id) {
      collapseDetail();
    } else {
      expandSkillDetail(skill);
    }
  });

  return card;
}

// ─── Skill Detail Panel ───────────────────────────────────────────────────────

function expandSkillDetail(skill) {
  _activeCardSkillId = skill.id;

  const panel = _detailPanelEl;
  panel.innerHTML = '';
  panel.classList.remove('hidden');

  const header = createElement('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;' });
  const titleEl = createElement('h2', { style: 'font-size:22px;font-weight:700;color:var(--text-primary);' });
  titleEl.textContent = skill.name;

  const closeBtn = createElement('button', { className: 'btn btn-sm btn-secondary' });
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', collapseDetail);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const meta = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;' });

  const domainName = _domainMap[skill.domain_id]?.name || 'General';
  const catClass = getDomainCatClass(skill.domain_id);
  const domainBadge = createElement('span', { className: `tool-card-category ${catClass}` });
  domainBadge.textContent = domainName;
  meta.appendChild(domainBadge);

  if (skill.is_future) {
    const b = createElement('span', { className: 'triage-chip triage-pipeline' });
    b.textContent = 'Future Skill';
    meta.appendChild(b);
  }

  if (skill.is_archived) {
    const b = createElement('span', { className: 'triage-chip triage-blocking' });
    b.textContent = 'Archived';
    meta.appendChild(b);
  }

  panel.appendChild(meta);

  if (skill.description) {
    const descEl = createElement('p', { style: 'font-size:15px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;' });
    descEl.textContent = skill.description;
    panel.appendChild(descEl);
  }

  const tags = Array.isArray(skill.tags) ? skill.tags : [];
  if (tags.length) {
    const tagsSection = createElement('div', { style: 'margin-bottom:20px;' });
    const tagsLabel = createElement('div', { className: 'label-text', style: 'margin-bottom:8px;' });
    tagsLabel.textContent = 'Tags';
    const tagsRow = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;' });
    tags.forEach(tag => {
      const chip = createElement('span', { className: 'triage-chip triage-feedback' });
      chip.textContent = tag.name || tag;
      tagsRow.appendChild(chip);
    });
    tagsSection.appendChild(tagsLabel);
    tagsSection.appendChild(tagsRow);
    panel.appendChild(tagsSection);
  }

  const teamIds = Array.isArray(skill.team_ids) ? skill.team_ids : (Array.isArray(skill.teams) ? skill.teams.map(t => t.id) : []);
  const teamNames = teamIds.map(id => _teamMap[id]?.name).filter(Boolean);
  if (teamNames.length) {
    const teamsSection = createElement('div', { style: 'margin-bottom:20px;' });
    const teamsLabel = createElement('div', { className: 'label-text', style: 'margin-bottom:8px;' });
    teamsLabel.textContent = 'Associated Teams';
    const teamsRow = createElement('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;' });
    teamNames.forEach(name => {
      const chip = createElement('span', { className: 'triage-chip triage-signal' });
      chip.textContent = name;
      teamsRow.appendChild(chip);
    });
    teamsSection.appendChild(teamsLabel);
    teamsSection.appendChild(teamsRow);
    panel.appendChild(teamsSection);
  }

  const contentSection = createElement('div');
  const contentHeader = createElement('div', { className: 'label-text', style: 'margin-bottom:12px;' });
  contentHeader.textContent = '3E Learning Content';
  contentSection.appendChild(contentHeader);

  const contentLoading = createElement('div', { className: 'text-muted text-sm' });
  contentLoading.textContent = 'Loading content...';
  contentSection.appendChild(contentLoading);
  panel.appendChild(contentSection);

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  api.get(`/api/skills/${skill.id}/content`).then(content => {
    contentLoading.remove();
    if (!Array.isArray(content) || content.length === 0) {
      const empty = createElement('div', { className: 'text-muted text-sm', style: 'padding:16px;' });
      empty.textContent = 'No learning content has been added for this skill yet.';
      contentSection.appendChild(empty);
      return;
    }
    renderLevelContent(contentSection, content);
  }).catch(() => {
    contentLoading.textContent = 'Unable to load learning content.';
  });
}

function collapseDetail() {
  _activeCardSkillId = null;
  if (_detailPanelEl) {
    _detailPanelEl.classList.add('hidden');
    _detailPanelEl.innerHTML = '';
  }
}

function renderLevelContent(container, items) {
  const groups = { education: [], exposure: [], experience: [] };

  items.forEach(item => {
    const level = item.level || item.content_level || '';
    if (groups[level] !== undefined) {
      groups[level].push(item);
    } else {
      groups.education.push(item);
    }
  });

  const levelConfig = [
    { key: 'education', label: 'Education', chipClass: 'chip-education' },
    { key: 'exposure', label: 'Exposure', chipClass: 'chip-exposure' },
    { key: 'experience', label: 'Experience', chipClass: 'chip-experience' },
  ];

  levelConfig.forEach(({ key, label, chipClass }) => {
    const levelItems = groups[key];
    if (!levelItems.length) return;

    const collapsible = createElement('div', { className: 'collapsible open' });

    const trigger = createElement('button', { className: 'collapsible-trigger', style: 'font-size:15px;padding:12px 16px;' });
    const triggerLabel = createElement('span');
    triggerLabel.textContent = label;
    const badge = createElement('span', { className: `triage-chip ${chipClass}`, style: 'font-size:11px;padding:2px 8px;margin-left:8px;' });
    badge.textContent = `${levelItems.length} ${levelItems.length === 1 ? 'item' : 'items'}`;
    const chevron = createElement('span', { className: 'chevron', style: 'margin-left:auto;' });
    trigger.appendChild(triggerLabel);
    trigger.appendChild(badge);
    trigger.appendChild(chevron);

    trigger.addEventListener('click', () => {
      collapsible.classList.toggle('open');
    });

    const body = createElement('div', { className: 'collapsible-body', style: 'padding:16px;' });

    levelItems.forEach(item => {
      const itemEl = createElement('div', {
        className: 'gate-card',
        style: `border-left-color:var(--${key === 'education' ? 'success' : key === 'exposure' ? 'info' : 'purple'});margin-bottom:10px;`,
      });

      const typeChip = createElement('span', { className: `triage-chip ${chipClass}`, style: 'font-size:11px;padding:2px 8px;margin-bottom:8px;display:inline-block;' });
      typeChip.textContent = item.content_type || item.type || 'Resource';

      const itemTitle = createElement('div', { style: 'font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px;' });
      itemTitle.textContent = item.title || 'Untitled';

      itemEl.appendChild(typeChip);
      itemEl.appendChild(itemTitle);

      if (item.description) {
        const itemDesc = createElement('div', { style: 'font-size:13px;color:var(--text-secondary);line-height:1.5;margin-bottom:6px;' });
        itemDesc.textContent = item.description;
        itemEl.appendChild(itemDesc);
      }

      if (item.url) {
        const link = createElement('a', {
          className: 'link-pill',
          style: 'font-size:12px;margin-top:6px;display:inline-flex;',
        });
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open Resource';
        itemEl.appendChild(link);
      }

      body.appendChild(itemEl);
    });

    collapsible.appendChild(trigger);
    collapsible.appendChild(body);
    container.appendChild(collapsible);
  });
}

// ─── Admin CRUD ───────────────────────────────────────────────────────────────

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
