import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { createElement } from '../utils/dom.js';

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _debounceTimer = null;
let _gridEl = null;
let _treeEl = null;
let _shiftFiltersEl = null;

// Current active tab: 'org' | 'cert' | 'non-technical'
let _activeTab = 'org';

// Per-tab cached tree data
const _treeCache = {};

// Selected filter state
let _selectedFilter = { type: 'all', id: null, label: 'All Skills' };
let _searchQuery = '';
let _tagQuery = '';
let _showArchived = false;
let _activeShifts = new Set([1, 2, 3, 4]);

// Cached data for skill create/edit form
let _formDataCache = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountCatalog(container, params) {
  _container = container;
  container.innerHTML = '';

  // Reset state
  _activeTab = 'org';
  _selectedFilter = { type: 'all', id: null, label: 'All Skills' };
  _searchQuery = '';
  _tagQuery = '';
  _showArchived = false;
  _activeShifts = new Set([1, 2, 3, 4]);
  _formDataCache = null;

  const page = buildPageShell(container);
  _gridEl = page.gridEl;
  _treeEl = page.treeEl;
  _shiftFiltersEl = page.shiftFiltersEl;

  loadStats();
  // Must await tree before fetching skills — client filters depend on cached tree data
  loadTabTree('org', _treeEl).then(() => fetchAndRenderSkills());

  return () => {
    clearTimeout(_debounceTimer);
  };
}

// ─── Stats loading ────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const stats = await api.get('/api/stats');
    const certTree = await api.get('/api/catalog/cert-tree');
    let certCount = 0;
    (Array.isArray(certTree) ? certTree : []).forEach(cd => {
      certCount += Array.isArray(cd.certificates) ? cd.certificates.length : 0;
    });
    updateStats(stats.total_skills || 0, stats.total_teams || 0, certCount);
  } catch {
    // stats are non-critical, fail silently
  }
}

function updateStats(skills, teams, certs) {
  const sv = document.getElementById('cat-stat-skills');
  const tv = document.getElementById('cat-stat-teams');
  const cv = document.getElementById('cat-stat-certs');
  if (sv) sv.textContent = skills;
  if (tv) tv.textContent = teams;
  if (cv) cv.textContent = certs;
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', { className: 'cat-wrapper' });

  // Hero
  const hero = createElement('div', { className: 'cat-hero mp-header' });
  const heroText = createElement('div', { className: 'mp-header-text' });
  const title = createElement('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('Skill '));
  const gradientSpan = createElement('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Catalog';
  title.appendChild(gradientSpan);
  const subtitle = createElement('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Browse, search and manage the skill catalog';
  heroText.appendChild(title);
  heroText.appendChild(subtitle);
  hero.appendChild(heroText);

  const statsRow = createElement('div', { className: 'stats-row' });
  statsRow.appendChild(buildStatBlock('cat-stat-skills', '—', 'Skills'));
  statsRow.appendChild(buildStatBlock('cat-stat-teams', '—', 'Teams'));
  statsRow.appendChild(buildStatBlock('cat-stat-certs', '—', 'Certifications'));
  hero.appendChild(statsRow);
  wrapper.appendChild(hero);

  // Tabs
  const tabsEl = buildTabBar();
  wrapper.appendChild(tabsEl);

  // Toolbar
  const toolbar = buildToolbar();
  wrapper.appendChild(toolbar.el);
  const shiftFiltersEl = toolbar.shiftFiltersEl;

  // Two-panel content area
  const contentEl = createElement('div', { className: 'cat-content' });

  const treePanel = createElement('div', { className: 'cat-tree-panel' });
  contentEl.appendChild(treePanel);

  const skillsPanel = createElement('div', { className: 'cat-skills-panel' });
  const gridEl = createElement('div');
  skillsPanel.appendChild(gridEl);
  contentEl.appendChild(skillsPanel);

  wrapper.appendChild(contentEl);
  container.appendChild(wrapper);

  return { treeEl: treePanel, gridEl, shiftFiltersEl };
}

function buildStatBlock(id, value, label) {
  const block = createElement('div', { className: 'stat-block' });
  const val = createElement('div', { className: 'stat-block-value', id });
  val.textContent = value;
  const lbl = createElement('div', { className: 'stat-block-label' });
  lbl.textContent = label;
  block.appendChild(val);
  block.appendChild(lbl);
  return block;
}

function buildTabBar() {
  const tabBar = createElement('div', { className: 'cat-tabs catalog-tab-bar' });

  const TABS = [
    { id: 'org', label: 'Organization' },
    { id: 'cert', label: 'Certification' },
    { id: 'non-technical', label: 'Non-Technical' },
  ];

  TABS.forEach(tab => {
    const btn = createElement('button', { className: 'catalog-tab' + (tab.id === _activeTab ? ' active' : '') });
    btn.textContent = tab.label;
    btn.dataset.tabId = tab.id;
    btn.addEventListener('click', async () => {
      if (_activeTab === tab.id) return;
      _activeTab = tab.id;

      tabBar.querySelectorAll('.catalog-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      _selectedFilter = { type: 'all', id: null, label: 'All Skills' };

      if (_shiftFiltersEl) {
        _shiftFiltersEl.style.display = tab.id === 'org' ? 'flex' : 'none';
      }

      delete _treeCache[tab.id];
      await loadTabTree(tab.id, _treeEl);
      fetchAndRenderSkills();
    });
    tabBar.appendChild(btn);
  });

  return tabBar;
}

function buildToolbar() {
  const toolbar = createElement('div', { className: 'cat-toolbar' });

  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEdit = isAdmin || isManager;

  // Search input
  const searchWrap = createElement('div', { className: 'catalog-search-wrap' });
  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search skills...',
    className: 'search-input',
    id: 'cat-search-input',
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _searchQuery = searchInput.value.trim();
      fetchAndRenderSkills();
    }, 300);
  });
  searchWrap.appendChild(searchInput);
  toolbar.appendChild(searchWrap);

  // Tag search
  const tagWrap = createElement('div', { className: 'catalog-search-wrap' });
  const tagInput = createElement('input', {
    type: 'text',
    placeholder: 'Filter by tag...',
    className: 'search-input',
    id: 'cat-tag-input',
  });
  tagInput.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _tagQuery = tagInput.value.trim().toLowerCase();
      fetchAndRenderSkills();
    }, 300);
  });
  tagWrap.appendChild(tagInput);
  toolbar.appendChild(tagWrap);

  // Shift filter toggles (org tab only)
  const shiftFiltersEl = createElement('div', { className: 'cat-shift-filters' });
  for (let i = 1; i <= 4; i++) {
    const btn = createElement('button', { className: 'cat-shift-btn active' });
    btn.textContent = `Shift ${i}`;
    btn.dataset.shift = String(i);
    btn.addEventListener('click', () => {
      const shift = i;
      if (_activeShifts.has(shift)) {
        if (_activeShifts.size > 1) {
          _activeShifts.delete(shift);
          btn.classList.remove('active');
        }
      } else {
        _activeShifts.add(shift);
        btn.classList.add('active');
      }
      delete _treeCache['org'];
      loadTabTree('org', _treeEl);
      fetchAndRenderSkills();
    });
    shiftFiltersEl.appendChild(btn);
  }
  toolbar.appendChild(shiftFiltersEl);

  // Archived toggle (admin and manager only)
  if (canEdit) {
    const archivedLabel = createElement('label', { className: 'catalog-checkbox-label' });
    const archivedCheck = createElement('input', { type: 'checkbox', id: 'cat-archived-check' });
    archivedCheck.addEventListener('change', () => {
      _showArchived = archivedCheck.checked;
      fetchAndRenderSkills();
    });
    archivedLabel.appendChild(archivedCheck);
    archivedLabel.appendChild(document.createTextNode(' Show Archived'));
    toolbar.appendChild(archivedLabel);
  }

  // Add New Skill button (admin and manager only)
  if (canEdit) {
    const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    addBtn.textContent = 'Add New Skill';
    addBtn.addEventListener('click', () => openSkillModal(null));
    toolbar.appendChild(addBtn);
  }

  return { el: toolbar, shiftFiltersEl };
}

// ─── Sidebar tree loading ─────────────────────────────────────────────────────

async function loadTabTree(tabId, treeEl) {
  treeEl.innerHTML = '';
  showSkeleton(treeEl, 'list');

  try {
    let treeData;
    if (_treeCache[tabId]) {
      treeData = _treeCache[tabId];
    } else {
      if (tabId === 'org' || tabId === 'non-technical') {
        treeData = await api.get('/api/catalog/org-tree');
      } else if (tabId === 'cert') {
        treeData = await api.get('/api/catalog/cert-tree');
      }
      _treeCache[tabId] = treeData;
    }

    treeEl.innerHTML = '';
    renderTreeForTab(tabId, treeData, treeEl);
  } catch (err) {
    treeEl.innerHTML = '';
    showToast(err.message || 'Failed to load tree', 'error');
  }
}

function renderTreeForTab(tabId, treeData, treeEl) {
  const data = Array.isArray(treeData) ? treeData : [];

  // "All Skills" node
  const allItem = buildTreeItem('All Skills', 'all', 0, false);
  if (_selectedFilter.type === 'all') allItem.classList.add('active');
  allItem.addEventListener('click', () => {
    selectFilter({ type: 'all', id: null, label: 'All Skills' }, allItem, treeEl);
  });
  treeEl.appendChild(allItem);

  if (tabId === 'org') {
    renderOrgTree(data, treeEl);
  } else if (tabId === 'cert') {
    renderCertTree(data, treeEl);
  } else if (tabId === 'non-technical') {
    renderNonTechnicalTree(data, treeEl);
  }
}

function renderOrgTree(domains, treeEl) {
  // org-tree returns [{id, name, is_technical, teams: [{id, name, shift}]}]
  const techDomains = domains.filter(d => d.is_technical === true);
  techDomains.forEach(domain => {
    const teams = (Array.isArray(domain.teams) ? domain.teams : [])
      .filter(t => _activeShifts.has(t.shift));
    if (!teams.length) return;

    const domainItem = buildTreeItem(domain.name, 'domain', 0, true);
    domainItem.classList.add('expanded');
    if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
      domainItem.classList.add('active');
    }
    domainItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
    });
    addToggleListener(domainItem);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    teams.forEach(team => {
      const teamItem = buildTreeItem(team.name, 'team', 1, false);
      if (_selectedFilter.type === 'team_id' && String(_selectedFilter.id) === String(team.id)) {
        teamItem.classList.add('active');
      }
      teamItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFilter({ type: 'team_id', id: team.id, label: team.name }, teamItem, treeEl);
      });
      childrenEl.appendChild(teamItem);
    });

    domainItem.appendChild(childrenEl);
    treeEl.appendChild(domainItem);
  });
}

function renderCertTree(certDomains, treeEl) {
  certDomains.forEach(certDomain => {
    const cdItem = buildTreeItem(certDomain.name, 'cert-domain', 0, true);
    cdItem.classList.add('expanded');
    addToggleListener(cdItem);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    const certs = Array.isArray(certDomain.certificates) ? certDomain.certificates : [];
    certs.forEach(cert => {
      const certItem = buildTreeItem(cert.name, 'cert', 1, false, '🏆');
      if (_selectedFilter.type === 'cert_id' && String(_selectedFilter.id) === String(cert.id)) {
        certItem.classList.add('active');
      }
      certItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFilter({ type: 'cert_id', id: cert.id, label: cert.name }, certItem, treeEl);
      });
      childrenEl.appendChild(certItem);
    });

    cdItem.appendChild(childrenEl);
    treeEl.appendChild(cdItem);
  });
}

function renderNonTechnicalTree(domains, treeEl) {
  const nonTechDomains = domains.filter(d => d.is_technical === false);
  nonTechDomains.forEach(domain => {
    const teams = Array.isArray(domain.teams) ? domain.teams : [];

    const domainItem = buildTreeItem(domain.name, 'domain', 0, teams.length > 0);
    domainItem.classList.add('expanded');
    if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
      domainItem.classList.add('active');
    }
    domainItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
    });
    if (teams.length > 0) addToggleListener(domainItem);

    if (teams.length > 0) {
      const childrenEl = createElement('div', { className: 'tree-item-children' });
      teams.forEach(team => {
        const teamItem = buildTreeItem(team.name, 'team', 1, false);
        if (_selectedFilter.type === 'team_id' && String(_selectedFilter.id) === String(team.id)) {
          teamItem.classList.add('active');
        }
        teamItem.addEventListener('click', (e) => {
          e.stopPropagation();
          selectFilter({ type: 'team_id', id: team.id, label: team.name }, teamItem, treeEl);
        });
        childrenEl.appendChild(teamItem);
      });
      domainItem.appendChild(childrenEl);
    }

    treeEl.appendChild(domainItem);
  });
}

// ─── Tree item builder ────────────────────────────────────────────────────────

function buildTreeItem(label, type, indent, hasToggle, iconText) {
  const item = createElement('div', { className: 'tree-item' });
  if (indent) item.style.paddingLeft = `${16 + indent * 16}px`;
  if (type) item.dataset.type = type;

  const iconEl = createElement('span', { className: 'tree-item-icon' });
  iconEl.setAttribute('aria-hidden', 'true');
  if (iconText) {
    iconEl.textContent = iconText;
  } else if (type === 'all') {
    iconEl.textContent = '✦';
  } else if (type === 'domain') {
    iconEl.textContent = '📁';
  } else if (type === 'team') {
    iconEl.textContent = '👥';
  } else if (type === 'cert-domain') {
    iconEl.textContent = '🎓';
  } else if (type === 'cert') {
    iconEl.textContent = '🏆';
  } else {
    iconEl.textContent = '•';
  }

  const labelEl = createElement('span', { className: 'tree-item-label' });
  labelEl.textContent = label;

  item.appendChild(iconEl);
  item.appendChild(labelEl);

  if (hasToggle) {
    const toggleEl = createElement('span', { className: 'tree-item-toggle' });
    toggleEl.setAttribute('aria-hidden', 'true');
    item.appendChild(toggleEl);
  }

  return item;
}

function addToggleListener(item) {
  const toggle = item.querySelector('.tree-item-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    item.classList.toggle('expanded');
  });
}

function selectFilter(filter, itemEl, treeEl) {
  _selectedFilter = filter;

  const allItems = (treeEl || _treeEl).querySelectorAll('.tree-item');
  allItems.forEach(i => i.classList.remove('active'));
  if (itemEl) itemEl.classList.add('active');

  fetchAndRenderSkills();
}

// ─── API skill fetching ───────────────────────────────────────────────────────

async function fetchAndRenderSkills() {
  if (!_gridEl) return;
  showSkeleton(_gridEl, 'cards');

  try {
    const skills = await api.get('/api/skills/' + buildQueryString());
    const allSkills = Array.isArray(skills) ? skills : [];
    const filtered = applyClientFilters(allSkills);
    renderSkillGrid(_gridEl, filtered);
  } catch (err) {
    showToast(err.message || 'Failed to load skills', 'error');
    _gridEl.innerHTML = '';
    renderEmptyState(_gridEl, 'Failed to load skills', 'Please try refreshing the page.');
  }
}

function buildQueryString() {
  const params = new URLSearchParams();

  if (_selectedFilter.type === 'team_id' && _selectedFilter.id != null) {
    params.set('team_id', String(_selectedFilter.id));
  } else if (_selectedFilter.type === 'cert_id' && _selectedFilter.id != null) {
    params.set('cert_id', String(_selectedFilter.id));
  } else if (_selectedFilter.type === 'domain_id' && _selectedFilter.id != null) {
    params.set('domain_id', String(_selectedFilter.id));
  }

  if (_searchQuery) params.set('search', _searchQuery);
  if (_showArchived) params.set('include_archived', 'true');

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function applyClientFilters(skills) {
  let result = skills;

  // Tag filter (client-side substring match)
  if (_tagQuery) {
    result = result.filter(skill => {
      const tags = Array.isArray(skill.tags) ? skill.tags : [];
      return tags.some(t => (t.name || t).toLowerCase().includes(_tagQuery));
    });
  }

  // For org tab: filter by active shifts — skills must have at least one team with an active shift
  if (_activeTab === 'org' && _activeShifts.size < 4) {
    result = result.filter(skill => {
      const teams = Array.isArray(skill.teams) ? skill.teams : [];
      return teams.some(t => _activeShifts.has(t.shift));
    });
  }

  // For non-technical tab with "All Skills": scope to teams under non-technical domains only
  if (_activeTab === 'non-technical' && _selectedFilter.type === 'all') {
    const nonTechTeamIds = getNonTechnicalTeamIds();
    if (nonTechTeamIds) {
      result = result.filter(skill => {
        const teams = Array.isArray(skill.teams) ? skill.teams : [];
        // Show skills that have at least one non-technical team, or no teams at all (unassigned)
        return teams.length === 0 || teams.some(t => nonTechTeamIds.has(t.id));
      });
    }
  }

  // For org tab with "All Skills": scope to teams under technical domains only
  if (_activeTab === 'org' && _selectedFilter.type === 'all') {
    const techTeamIds = getTechnicalTeamIds();
    if (techTeamIds) {
      result = result.filter(skill => {
        const teams = Array.isArray(skill.teams) ? skill.teams : [];
        return teams.some(t => techTeamIds.has(t.id));
      });
    }
  }

  return result;
}

/** Get team IDs belonging to non-technical domains from cached org-tree */
function getNonTechnicalTeamIds() {
  const treeData = _treeCache['non-technical'] || _treeCache['org'];
  if (!Array.isArray(treeData)) return null;
  const ids = new Set();
  treeData.filter(d => d.is_technical === false).forEach(domain => {
    (Array.isArray(domain.teams) ? domain.teams : []).forEach(t => ids.add(t.id));
  });
  return ids;
}

/** Get team IDs belonging to technical domains from cached org-tree */
function getTechnicalTeamIds() {
  const treeData = _treeCache['org'] || _treeCache['non-technical'];
  if (!Array.isArray(treeData)) return null;
  const ids = new Set();
  treeData.filter(d => d.is_technical === true).forEach(domain => {
    (Array.isArray(domain.teams) ? domain.teams : []).forEach(t => ids.add(t.id));
  });
  return ids;
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderSkillGrid(container, skills) {
  container.innerHTML = '';

  if (!skills.length) {
    renderEmptyState(container, 'No skills found', 'Try adjusting your search or filters.');
    return;
  }

  const grid = createElement('div', { className: 'grid-3' });
  skills.forEach(skill => grid.appendChild(buildSkillCard(skill)));
  container.appendChild(grid);
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function buildSkillCard(skill) {
  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEdit = isAdmin || isManager;

  const card = createElement('div', {
    className: skill.is_archived ? 'tool-card tool-card--archived' : 'tool-card',
  });
  card.dataset.skillId = skill.id;

  // Header row with name and admin/manager actions
  const headerRow = createElement('div', { className: 'tool-card-header' });
  const nameEl = createElement('div', { className: 'tool-card-name' });
  nameEl.textContent = skill.name;
  headerRow.appendChild(nameEl);

  if (canEdit) {
    const actions = createElement('div', { className: 'card-admin-actions' });

    const editBtn = createElement('button', { className: 'btn btn-sm btn-secondary card-action-btn' });
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSkillModal(skill);
    });

    const archiveBtn = createElement('button', {
      className: skill.is_archived
        ? 'btn btn-sm btn-primary card-action-btn'
        : 'btn btn-sm btn-danger card-action-btn',
    });
    archiveBtn.textContent = skill.is_archived ? 'Restore' : 'Archive';
    archiveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleArchiveSkill(skill);
    });

    actions.appendChild(editBtn);
    actions.appendChild(archiveBtn);
    headerRow.appendChild(actions);
  }
  card.appendChild(headerRow);

  // Archived badge
  if (skill.is_archived) {
    const badgeRow = createElement('div', { className: 'tool-card-badges' });
    const b = createElement('span', { className: 'triage-chip triage-blocking chip-sm' });
    b.textContent = 'Archived';
    badgeRow.appendChild(b);
    card.appendChild(badgeRow);
  }

  // Team badges
  const teams = Array.isArray(skill.teams) ? skill.teams : [];
  if (teams.length) {
    const teamsRow = createElement('div', { className: 'tool-card-badges' });
    teams.forEach(team => {
      const chip = createElement('span', { className: 'triage-chip triage-signal chip-sm' });
      chip.textContent = team.name;
      teamsRow.appendChild(chip);
    });
    card.appendChild(teamsRow);
  }

  // Certificate badges
  const certs = Array.isArray(skill.certificates) ? skill.certificates : [];
  if (certs.length) {
    const certsRow = createElement('div', { className: 'tool-card-badges' });
    certs.forEach(cert => {
      const badge = createElement('span', { className: 'meta-badge meta-badge--cert meta-badge--clickable' });
      badge.textContent = cert.name;
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTabAndFilter('cert', 'cert_id', cert.id, cert.name);
      });
      certsRow.appendChild(badge);
    });
    card.appendChild(certsRow);
  }

  // Description
  const desc = createElement('div', { className: 'tool-card-desc' });
  desc.textContent = truncate(skill.description || 'No description available.', 120);
  card.appendChild(desc);

  // Tags
  const tags = Array.isArray(skill.tags) ? skill.tags : [];
  if (tags.length) {
    const tagsRow = createElement('div', { className: 'tool-card-tags' });
    tags.slice(0, 4).forEach(tag => {
      const chip = createElement('span', { className: 'triage-chip triage-feedback chip-sm' });
      chip.textContent = tag.name || tag;
      tagsRow.appendChild(chip);
    });
    if (tags.length > 4) {
      const more = createElement('span', { className: 'text-muted text-sm' });
      more.textContent = `+${tags.length - 4} more`;
      tagsRow.appendChild(more);
    }
    card.appendChild(tagsRow);
  }

  card.addEventListener('click', () => showSkillDetailModal(skill));

  return card;
}

// ─── Switch tab + filter (used by cert badge clicks) ─────────────────────────

function switchTabAndFilter(tabId, filterType, filterId, filterLabel) {
  _activeTab = tabId;
  _selectedFilter = { type: filterType, id: filterId, label: filterLabel };

  const tabBar = document.querySelector('.cat-tabs');
  if (tabBar) {
    tabBar.querySelectorAll('.catalog-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tabId === tabId);
    });
  }

  if (_shiftFiltersEl) {
    _shiftFiltersEl.style.display = tabId === 'org' ? 'flex' : 'none';
  }

  delete _treeCache[tabId];
  loadTabTree(tabId, _treeEl).then(() => {
    const allItems = _treeEl.querySelectorAll('.tree-item');
    allItems.forEach(item => {
      const lbl = item.querySelector('.tree-item-label');
      if (lbl && lbl.textContent === filterLabel) {
        item.classList.add('active');
      }
    });
  });
  fetchAndRenderSkills();
}

// ─── Skill Detail Modal ───────────────────────────────────────────────────────

function showSkillDetailModal(skill) {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const overlay = createElement('div', { className: 'modal-overlay' });
  const modal = createElement('div', { className: 'modal skill-detail-modal' });

  // Modal header
  const modalHeader = createElement('div', { className: 'modal-header' });
  const titleEl = createElement('h2', { className: 'modal-title' });
  titleEl.textContent = skill.name;
  const closeBtn = createElement('button', { className: 'modal-close' });
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '\u2715';
  modalHeader.appendChild(titleEl);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const modalBody = createElement('div', { className: 'modal-body skill-detail-body' });

  // Detail header with "Assigned To" section
  const detailHeader = createElement('div', { className: 'skill-detail-header' });

  const assignSection = createElement('div', { className: 'skill-detail-assignments' });

  const teams = Array.isArray(skill.teams) ? skill.teams : [];
  const certificates = Array.isArray(skill.certificates) ? skill.certificates : [];
  const tags = Array.isArray(skill.tags) ? skill.tags : [];

  function buildAssignRow(labelText, items, chipClassFn) {
    if (!items.length) return null;
    const row = createElement('div', { className: 'skill-detail-assign-row' });
    const label = createElement('span', { className: 'skill-detail-assign-label' });
    label.textContent = labelText;
    row.appendChild(label);
    items.forEach(item => {
      const chip = createElement('span', { className: chipClassFn(item) });
      chip.textContent = item.name || item;
      row.appendChild(chip);
    });
    return row;
  }

  const teamRow = buildAssignRow('Teams', teams, () => 'triage-chip triage-signal chip-sm');
  if (teamRow) assignSection.appendChild(teamRow);

  const certRow = buildAssignRow('Certs', certificates, () => 'meta-badge meta-badge--cert meta-badge--clickable');
  if (certRow) {
    const certChips = certRow.querySelectorAll('.meta-badge--cert');
    certificates.forEach((cert, i) => {
      if (certChips[i]) {
        certChips[i].addEventListener('click', () => {
          closeModal();
          switchTabAndFilter('cert', 'cert_id', cert.id, cert.name);
        });
      }
    });
    assignSection.appendChild(certRow);
  }

  const tagsAssignRow = buildAssignRow('Tags', tags, () => 'triage-chip triage-feedback chip-sm');
  if (tagsAssignRow) assignSection.appendChild(tagsAssignRow);

  // Archived badge
  if (skill.is_archived) {
    const statusRow = createElement('div', { className: 'skill-detail-assign-row' });
    const b = createElement('span', { className: 'triage-chip triage-blocking chip-sm' });
    b.textContent = 'Archived';
    statusRow.appendChild(b);
    assignSection.appendChild(statusRow);
  }

  if (assignSection.children.length) detailHeader.appendChild(assignSection);

  if (skill.description) {
    const descEl = createElement('p', { className: 'skill-detail-description' });
    descEl.textContent = skill.description;
    detailHeader.appendChild(descEl);
  }

  modalBody.appendChild(detailHeader);

  // ── Education/Exposure/Experience tabs ───────────────────────────────────

  const LEVEL_CONFIG = [
    { key: 'education', label: 'Education', chipClass: 'chip-education' },
    { key: 'exposure', label: 'Exposure', chipClass: 'chip-exposure' },
    { key: 'experience', label: 'Experience', chipClass: 'chip-experience' },
  ];

  const tabBar = createElement('div', { className: 'skill-detail-tabs', role: 'tablist' });
  tabBar.setAttribute('aria-label', 'Skill level content');
  const tabPanelsWrap = createElement('div', { className: 'skill-detail-panels' });

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
    skeletonEl.appendChild(createElement('div', { className: 'skeleton skeleton-row-lg' }));
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
    if (e.key === 'Escape') {
      closeModal();
      return;
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
      const tabKeys = LEVEL_CONFIG.map(l => l.key);
      const focused = document.activeElement;
      const currentTab = focused?.dataset?.tab;
      if (currentTab && tabKeys.includes(currentTab)) {
        const idx = tabKeys.indexOf(currentTab);
        const next = e.key === 'ArrowRight'
          ? (idx + 1) % tabKeys.length
          : (idx - 1 + tabKeys.length) % tabKeys.length;
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
      const reorderItems = [...panelEl.querySelectorAll('.skill-detail-accordion-item')].map((el, idx) => ({
        id: parseInt(el.dataset.itemId, 10),
        position: idx,
      }));
      try {
        await api.put(`/api/skills/${skill.id}/content/reorder`, { items: reorderItems });
        showToast('Order saved', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to save order', 'error');
        refreshModalContent();
      }
    }

    if (!sorted.length) {
      const empty = createElement('div', { className: 'empty-state empty-state--compact' });
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
          const dragHandle = createElement('span', { className: 'drag-handle' });
          dragHandle.setAttribute('aria-hidden', 'true');
          dragHandle.textContent = '\u2630';
          dragHandle.addEventListener('mousedown', () => { accItem.draggable = true; });
          trigger.appendChild(dragHandle);
        }

        const typeChip = createElement('span', { className: `triage-chip ${levelCfg.chipClass} chip-sm chip-shrink` });
        typeChip.textContent = item.type || 'resource';

        const titleSpan = createElement('span', { className: 'skill-detail-accordion-title' });
        titleSpan.textContent = item.title || 'Untitled';

        if (canEdit) {
          const adminActions = createElement('div', { className: 'accordion-admin-actions' });

          const editBtn = createElement('button', { className: 'btn btn-sm btn-secondary accordion-action-btn' });
          editBtn.setAttribute('aria-label', 'Edit item');
          editBtn.textContent = '\u270F\uFE0F';
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showContentEditModal(skill.id, LEVEL_REVERSE[key], item, () => refreshModalContent());
          });

          const deleteBtn = createElement('button', { className: 'btn btn-sm btn-danger accordion-action-btn' });
          deleteBtn.setAttribute('aria-label', 'Delete item');
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

        const chevron = createElement('span', { className: 'skill-detail-accordion-chevron' });
        chevron.setAttribute('aria-hidden', 'true');
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
      const sk = createElement('div', { className: 'skeleton-list' });
      for (let i = 0; i < 2; i++) {
        sk.appendChild(createElement('div', { className: 'skeleton skeleton-row-sm' }));
      }
      tabPanels[key].appendChild(sk);
    });

    api.get(`/api/skills/${skill.id}/content`).then(rawContent => {
      const fresh = (Array.isArray(rawContent) ? rawContent : [])
        .filter(item => item && item.title && String(item.title).trim() !== '' && [1, 2, 3].includes(item.level));
      const freshGroups = { education: [], exposure: [], experience: [] };
      fresh.forEach(item => {
        const k = LEVEL_MAP[item.level];
        if (k) freshGroups[k].push(item);
      });
      LEVEL_CONFIG.forEach(({ key }) => renderPanelContent(key, freshGroups[key]));
    }).catch(() => {
      LEVEL_CONFIG.forEach(({ key }) => {
        tabPanels[key].innerHTML = '';
        const errEl = createElement('div', { className: 'empty-state empty-state--compact' });
        errEl.textContent = 'Unable to reload content.';
        tabPanels[key].appendChild(errEl);
      });
    });
  }

  api.get(`/api/skills/${skill.id}/content`).then(rawContent => {
    skeletonEl.remove();

    const content = (Array.isArray(rawContent) ? rawContent : [])
      .filter(item => item && item.title && String(item.title).trim() !== '' && [1, 2, 3].includes(item.level));
    const groups = { education: [], exposure: [], experience: [] };

    content.forEach(item => {
      const k = LEVEL_MAP[item.level];
      if (k) groups[k].push(item);
    });

    LEVEL_CONFIG.forEach(({ key }) => renderPanelContent(key, groups[key]));

    const firstWithContent = LEVEL_CONFIG.find(({ key }) => groups[key].length > 0);
    activateTab(firstWithContent ? firstWithContent.key : 'education');
  }).catch(() => {
    skeletonEl.remove();
    const errEl = createElement('div', { className: 'empty-state empty-state--compact' });
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
  const closeBtn = createElement('button', { className: 'modal-close' });
  closeBtn.setAttribute('aria-label', 'Close');
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

  function closeContentModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onContentKeyDown);
  }

  async function handleCancel() {
    if (hasUnsavedChanges()) {
      const confirmed = await showConfirm('Discard unsaved changes?', false);
      if (!confirmed) return;
    }
    closeContentModal();
  }

  async function handleSave() {
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      showToast('Title is required', 'warning');
      titleInput.focus();
      return;
    }

    const payload = {
      title: titleVal,
      type: typeSelect.value,
      description: getBodyHtml(),
      url: urlInput.value.trim() || null,
    };

    if (!isEdit) {
      payload.level = levelInt;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving\u2026';

    try {
      if (isEdit) {
        await api.put(`/api/skills/${skillId}/content/${existingItem.id}`, payload);
        showToast('Content item updated', 'success');
      } else {
        await api.post(`/api/skills/${skillId}/content`, payload);
        showToast('Content item added', 'success');
      }
      closeContentModal();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(err.message || 'Failed to save content item', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
    }
  }

  function onContentKeyDown(e) {
    if (e.key === 'Escape') handleCancel();
  }

  cancelBtn.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  saveBtn.addEventListener('click', handleSave);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) handleCancel();
  });
  document.addEventListener('keydown', onContentKeyDown);
}

// ─── Skill Create/Edit Modal ──────────────────────────────────────────────────

async function openSkillModal(existingSkill) {
  const isEdit = !!existingSkill;
  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  if (!_formDataCache) {
    try {
      const [orgTree, certTree] = await Promise.all([
        api.get('/api/catalog/org-tree'),
        api.get('/api/catalog/cert-tree'),
      ]);

      const teams = [];
      (Array.isArray(orgTree) ? orgTree : []).forEach(domain => {
        (Array.isArray(domain.teams) ? domain.teams : []).forEach(t => {
          teams.push({ id: t.id, name: t.name, shift: t.shift });
        });
      });

      const certificates = [];
      (Array.isArray(certTree) ? certTree : []).forEach(cd => {
        (Array.isArray(cd.certificates) ? cd.certificates : []).forEach(c => {
          certificates.push({ id: c.id, name: c.name, domain: cd.name });
        });
      });

      _formDataCache = { teams, certificates };
    } catch (err) {
      showToast('Failed to load form data', 'error');
      return;
    }
  }

  const formEl = buildSkillForm(existingSkill, _formDataCache, isAdmin, isManager, user);

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
          await api.put(`/api/skills/${existingSkill.id}`, formData);
          showToast('Skill updated successfully', 'success');
        } else {
          await api.post('/api/skills/', formData);
          showToast('Skill created successfully', 'success');
        }
        _formDataCache = null;
        delete _treeCache[_activeTab];
        fetchAndRenderSkills();
      } catch (err) {
        showToast(err.message || 'Failed to save skill', 'error');
      }
    },
  });
}

function buildSkillForm(skill, formData, isAdmin, isManager, user) {
  const form = createElement('div', { className: 'catalog-form' });

  // Name
  const nameGroup = buildFormGroup('Name', 'skill-name', 'input', {
    type: 'text',
    placeholder: 'e.g. Wi-Fi 6 Configuration',
    required: true,
  }, true);
  const nameInput = nameGroup.querySelector('#skill-name');
  if (nameInput) nameInput.value = skill?.name || '';
  form.appendChild(nameGroup);

  // Description
  const descGroup = buildFormGroup('Description', 'skill-desc', 'textarea', {
    placeholder: 'Describe what this skill covers...',
  }, false);
  const descTextarea = descGroup.querySelector('#skill-desc');
  if (descTextarea) descTextarea.textContent = skill?.description || '';
  form.appendChild(descGroup);

  // Teams
  const existingTeamIds = Array.isArray(skill?.teams)
    ? skill.teams.map(t => String(t.id))
    : (Array.isArray(skill?.team_ids) ? skill.team_ids.map(String) : []);

  const teamsGroupEl = createElement('div', { className: 'form-group' });
  const teamsLabel = createElement('div', { className: 'form-label' });
  teamsLabel.textContent = 'Teams';
  const teamsGrid = createElement('div', { className: 'catalog-teams-grid' });

  formData.teams.forEach(team => {
    const checkLabel = createElement('label', { className: 'catalog-check-label' });
    const check = createElement('input', { type: 'checkbox', value: team.id });
    check.className = 'skill-team-check';
    check.checked = existingTeamIds.includes(String(team.id));

    // Manager: can only assign/unassign their own team
    if (isManager && !isAdmin) {
      if (String(team.id) === String(user?.team_id)) {
        check.checked = true;
        check.disabled = true;
      } else {
        check.disabled = true;
      }
    }

    checkLabel.appendChild(check);
    checkLabel.appendChild(document.createTextNode(team.name));
    teamsGrid.appendChild(checkLabel);
  });

  teamsGroupEl.appendChild(teamsLabel);
  teamsGroupEl.appendChild(teamsGrid);
  form.appendChild(teamsGroupEl);

  // Certificates
  const existingCertIds = Array.isArray(skill?.certificates)
    ? skill.certificates.map(c => String(c.id))
    : [];

  const certsGroupEl = createElement('div', { className: 'form-group' });
  const certsLabel = createElement('div', { className: 'form-label' });
  certsLabel.textContent = 'Certificates';
  const certsGrid = createElement('div', { className: 'catalog-teams-grid' });

  formData.certificates.forEach(cert => {
    const checkLabel = createElement('label', { className: 'catalog-check-label' });
    const check = createElement('input', { type: 'checkbox', value: cert.id });
    check.className = 'skill-cert-check';
    check.checked = existingCertIds.includes(String(cert.id));
    checkLabel.appendChild(check);
    const certName = cert.domain ? `${cert.name} (${cert.domain})` : cert.name;
    checkLabel.appendChild(document.createTextNode(certName));
    certsGrid.appendChild(checkLabel);
  });

  certsGroupEl.appendChild(certsLabel);
  certsGroupEl.appendChild(certsGrid);
  form.appendChild(certsGroupEl);

  // Tags
  const tagsGroup = buildFormGroup('Tags', 'skill-tags', 'input', {
    type: 'text',
    placeholder: 'e.g. routing, bgp, advanced (comma-separated)',
  }, false);
  const tagsInput = tagsGroup.querySelector('#skill-tags');
  if (tagsInput) tagsInput.value = Array.isArray(skill?.tags) ? skill.tags.map(t => t.name || t).join(', ') : '';
  form.appendChild(tagsGroup);

  const tagHint = createElement('div', { className: 'form-hint catalog-form-hint' });
  tagHint.textContent = 'Separate multiple tags with commas';
  form.appendChild(tagHint);

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

  const teamChecks = formEl.querySelectorAll('.skill-team-check:checked');
  const team_ids = Array.from(teamChecks).map(c => Number(c.value));

  const certChecks = formEl.querySelectorAll('.skill-cert-check:checked');
  const certificate_ids = Array.from(certChecks).map(c => Number(c.value));

  const tagsRaw = formEl.querySelector('#skill-tags')?.value.trim() || '';
  const tag_names = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { name, description, team_ids, certificate_ids, tag_names };
}

function validateSkillForm(data) {
  const errors = [];
  if (!data.name) errors.push('Skill name is required.');
  return errors;
}

// ─── Archive / Restore ────────────────────────────────────────────────────────

async function handleArchiveSkill(skill) {
  const action = skill.is_archived ? 'restore' : 'archive';
  const confirmed = await showConfirm(
    `Are you sure you want to ${action} "${skill.name}"? ${action === 'archive' ? 'It will no longer appear in the active catalog.' : 'It will become visible in the active catalog again.'}`,
    action === 'archive'
  );

  if (!confirmed) return;

  try {
    if (action === 'archive') {
      await api.del(`/api/skills/${skill.id}`);
    } else {
      await api.put(`/api/skills/${skill.id}`, { is_archived: false });
    }
    showToast(`Skill ${action === 'archive' ? 'archived' : 'restored'} successfully`, 'success');
    fetchAndRenderSkills();
  } catch (err) {
    showToast(err.message || `Failed to ${action} skill`, 'error');
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function renderEmptyState(container, title, desc) {
  const state = createElement('div', { className: 'empty-state' });

  const icon = createElement('span', { className: 'empty-state-icon' });
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '○';

  const titleEl = createElement('div', { className: 'empty-state-title' });
  titleEl.textContent = title;

  const descEl = createElement('div', { className: 'empty-state-desc' });
  descEl.textContent = desc;

  state.appendChild(icon);
  state.appendChild(titleEl);
  state.appendChild(descEl);
  container.appendChild(state);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
