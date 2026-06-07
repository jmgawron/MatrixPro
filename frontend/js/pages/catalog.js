import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { createElement } from '../utils/dom.js';
import { getSkillIconSVG, SKILL_ICONS, ICON_CATEGORIES } from '../components/icons.js';
import { createComboboxMulti } from '../components/combobox-multi.js';
import { openCatalogSkillEditor } from '../components/catalog-skill-editor.js?v=11';

// ─── Category icon catalog (mirrors my-plan.js SVG_ICONS for chip parity) ───
const CATEGORY_SVG_ICONS = {
  seedling: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4 3-7 8-7-1 5-4 7-8 7z"/><path d="M12 14c0-3-2-5-6-5 1 4 3 5 6 5z"/></svg>',
  diamond: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M9 3 6 9l6 12"/><path d="m15 3 3 6-6 12"/></svg>',
  atom: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>',
  sparkles: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"/><path d="M19 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/><path d="M5 4l.7 1.5L7 6l-1.3.5L5 8l-.7-1.5L3 6l1.3-.5L5 4z"/></svg>',
  layers: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
};

const CATEGORY_ICON_MAP = {
  foundational: 'seedling',
  core: 'diamond',
  advanced: 'atom',
  ai_future: 'sparkles',
  'ai-future': 'sparkles',
};

function categoryIconSpan(slug, size) {
  const span = createElement('span', { className: 'mp-icon catalog-category-icon-svg' });
  span.setAttribute('aria-hidden', 'true');
  const iconName = CATEGORY_ICON_MAP[slug] || 'layers';
  span.innerHTML = CATEGORY_SVG_ICONS[iconName] || CATEGORY_SVG_ICONS.layers;
  if (size) {
    span.style.width = typeof size === 'number' ? `${size}px` : size;
    span.style.height = typeof size === 'number' ? `${size}px` : size;
  }
  return span;
}

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _debounceTimer = null;
let _gridEl = null;
let _addMode = null;
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

let _sortMode = 'name-asc';

// Cached data for skill create/edit form
let _formDataCache = null;

let _categoriesCache = null;
const _collapsedCategorySlugs = new Set(['foundational', 'advanced', 'ai_future']);

async function getCategories() {
  if (_categoriesCache) return _categoriesCache;
  try {
    _categoriesCache = await api.get('/api/skills/categories');
  } catch {
    _categoriesCache = [];
  }
  return _categoriesCache;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountCatalog(container, params) {
  _container = container;
  container.innerHTML = '';

  const hashParts = window.location.hash.split('?');
  const urlParams = new URLSearchParams(hashParts[1] || '');
  _addMode = urlParams.get('addMode') || null;

  _searchQuery = '';
  _tagQuery = '';
  _showArchived = false;
  _activeShifts = new Set([1, 2, 3, 4]);
  _sortMode = 'name-asc';
  _formDataCache = null;
  bootstrapAddModeState();

  const page = buildPageShell(container);
  _gridEl = page.gridEl;
  _treeEl = page.treeEl;
  _shiftFiltersEl = page.shiftFiltersEl;

  if (_addMode) {
    container.insertBefore(buildAddModeBanner(), container.firstChild);
  }

  loadStats();
  loadTabTree(_activeTab, _treeEl).then(() => {
    if (_addMode === 'team') {
      resolveTeamFilterFromTree();
      updateAddModeTeamLabels();
    }
    focusTreeSelection();
    fetchAndRenderSkills();
  });

  return () => {
    clearTimeout(_debounceTimer);
  };
}

function bootstrapAddModeState() {
  _activeTab = 'org';
  _selectedFilter = { type: 'all', id: null, label: 'All Skills' };

  if (_addMode === 'team') {
    const user = Store.get('user');
    if (user?.team_id) {
      _selectedFilter = {
        type: 'team_id',
        id: user.team_id,
        label: user.team_name || 'My Team',
      };
    }
  }
}

function buildAddModeBanner() {
  const user = Store.get('user');
  const teamName = user?.team_name || 'your team';
  const banner = createElement('div', { className: 'cat-addmode-banner' });
  const textWrap = createElement('div', { className: 'cat-addmode-banner__text' });
  const title = createElement('div', { className: 'cat-addmode-banner__title' });
  const desc = createElement('div', { className: 'cat-addmode-banner__desc' });

  if (_addMode === 'team') {
    title.textContent = `My Team's Skills — ${teamName}`;
    desc.textContent = 'Browse technical skills curated for your team. Select a skill card and click Add to My Plan.';
  } else {
    title.textContent = 'From Catalog — Full Skills Library';
    desc.textContent = 'Explore skills across all teams, domains, certifications, and non-technical areas.';
  }

  textWrap.appendChild(title);
  textWrap.appendChild(desc);

  const actions = createElement('div', { className: 'cat-addmode-banner__actions' });
  const backLink = createElement('a', { href: '#/my-plan', className: 'btn btn-secondary btn-sm' });
  backLink.textContent = '← Back to My Plan';
  actions.appendChild(backLink);

  banner.appendChild(textWrap);
  banner.appendChild(actions);
  return banner;
}

function resolveTeamFilterFromTree() {
  if (_selectedFilter.type !== 'team_id' || _selectedFilter.id == null) return;
  const treeData = _treeCache.org;
  if (!Array.isArray(treeData)) return;
  for (const domain of treeData) {
    for (const team of Array.isArray(domain.teams) ? domain.teams : []) {
      if (String(team.id) === String(_selectedFilter.id)) {
        _selectedFilter.label = team.name;
        return;
      }
    }
  }
}

function updateAddModeTeamLabels() {
  if (_addMode !== 'team' || !_container) return;
  const teamLabel = _selectedFilter.label || 'My Team';
  const title = _container.querySelector('.cat-addmode-banner__title');
  const subtitle = _container.querySelector('.mp-subtitle');
  if (title) title.textContent = `My Team's Skills — ${teamLabel}`;
  if (subtitle) subtitle.textContent = `Discover skills for ${teamLabel}`;
}

function focusTreeSelection() {
  if (!_treeEl) return;
  const { type, id } = _selectedFilter;

  if (type === 'team_id' && id != null) {
    const teamEl = _treeEl.querySelector(
      `.tree-item[data-filter-type="team_id"][data-filter-id="${id}"]`,
    );
    if (!teamEl) return;
    _treeEl.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
    teamEl.classList.add('active');
    const domainEl = teamEl.closest('.tree-item-children')?.parentElement;
    if (domainEl?.classList.contains('tree-item')) {
      domainEl.classList.add('expanded');
    }
    teamEl.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (type === 'all') {
    const allEl = _treeEl.querySelector('.tree-item[data-type="all"]');
    if (allEl) allEl.classList.add('active');
  }
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

async function recomputeFilteredStats() {
  try {
    const shiftsParam = [..._activeShifts].sort().join(',');
    const stats = await api.get(`/api/stats?shifts=${shiftsParam}`);
    const certTree = await api.get('/api/catalog/cert-tree');
    let certCount = 0;
    (Array.isArray(certTree) ? certTree : []).forEach(cd => {
      certCount += Array.isArray(cd.certificates) ? cd.certificates.length : 0;
    });
    updateStats(stats.total_skills || 0, stats.total_teams || 0, certCount);
  } catch {
    // non-critical
  }
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
  if (_addMode === 'team') {
    subtitle.textContent = `Discover skills for ${Store.get('user')?.team_name || 'your team'}`;
  } else if (_addMode === 'all') {
    subtitle.textContent = 'Select skills to add to your development plan';
  } else {
    subtitle.textContent = 'Browse, search and manage the skill catalog';
  }
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
    if (_addMode === 'team' && tab.id !== 'org') return;

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
      focusTreeSelection();
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
  const canEditCatalog = isAdmin || isManager;

  const leftGroup = createElement('div', { className: 'cat-toolbar-left' });

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
  leftGroup.appendChild(searchWrap);

  // Sort button + dropdown menu
  const sortWrap = createElement('div', { style: 'position:relative;' });
  const sortBtn = createElement('button', { className: 'cat-sort-btn' });
  sortBtn.innerHTML = '&#x21C5; Sort';
  let menuOpen = false;
  let menuEl = null;

  function closeSortMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    menuOpen = false;
    document.removeEventListener('click', closeSortMenuOnOutside);
  }
  function closeSortMenuOnOutside(e) {
    if (!sortWrap.contains(e.target)) closeSortMenu();
  }
  function openSortMenu() {
    menuEl = createElement('div', { className: 'cat-sort-menu' });
    const options = [
      { value: 'name-asc', label: 'Name A → Z' },
      { value: 'name-desc', label: 'Name Z → A' },
      { value: 'date-desc', label: 'Newest first' },
      { value: 'date-asc', label: 'Oldest first' },
    ];
    options.forEach(opt => {
      const optBtn = createElement('button', { className: 'cat-sort-option' + (opt.value === _sortMode ? ' active' : '') });
      optBtn.textContent = opt.label;
      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        _sortMode = opt.value;
        closeSortMenu();
        fetchAndRenderSkills();
      });
      menuEl.appendChild(optBtn);
    });
    sortWrap.appendChild(menuEl);
    menuOpen = true;
    setTimeout(() => document.addEventListener('click', closeSortMenuOnOutside), 0);
  }

  sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuOpen) closeSortMenu(); else openSortMenu();
  });
  sortWrap.appendChild(sortBtn);

  // Shift filter toggles (org tab only)
  const shiftFiltersEl = createElement('div', {
    className: 'cat-shift-filters',
    role: 'group',
    'aria-label': 'Filter by shift',
  });
  const shiftLabel = createElement('span', { className: 'cat-shift-filters__label' });
  shiftLabel.textContent = 'Shifts';
  shiftFiltersEl.appendChild(shiftLabel);

  const shiftChips = createElement('div', { className: 'cat-shift-filters__chips' });
  for (let i = 1; i <= 4; i++) {
    const btn = createElement('button', { type: 'button', className: 'cat-shift-btn active' });
    btn.textContent = `Shift ${i}`;
    btn.dataset.shift = String(i);
    btn.setAttribute('aria-pressed', 'true');
    btn.addEventListener('click', () => {
      const shift = i;
      if (_activeShifts.has(shift)) {
        if (_activeShifts.size > 1) {
          _activeShifts.delete(shift);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        _activeShifts.add(shift);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      delete _treeCache['org'];
      loadTabTree('org', _treeEl);
      fetchAndRenderSkills();
      recomputeFilteredStats();
    });
    shiftChips.appendChild(btn);
  }
  shiftFiltersEl.appendChild(shiftChips);
  leftGroup.appendChild(shiftFiltersEl);

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
  leftGroup.appendChild(tagWrap);
  leftGroup.appendChild(sortWrap);

  // Archived toggle (admin and manager only)
  if (canEditCatalog) {
    const archivedLabel = createElement('label', { className: 'catalog-checkbox-label' });
    const archivedCheck = createElement('input', { type: 'checkbox', id: 'cat-archived-check' });
    archivedCheck.addEventListener('change', () => {
      _showArchived = archivedCheck.checked;
      fetchAndRenderSkills();
    });
    archivedLabel.appendChild(archivedCheck);
    archivedLabel.appendChild(document.createTextNode(' Show Archived'));
    leftGroup.appendChild(archivedLabel);
  }

  toolbar.appendChild(leftGroup);

  const rightGroup = createElement('div', { className: 'cat-toolbar-right' });

  // Add New Skill button (admin and manager only, not in plan-add mode)
  if (canEditCatalog && !_addMode) {
    const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    addBtn.textContent = 'Add New Skill';
    addBtn.addEventListener('click', () => openSkillModal(null));
    rightGroup.appendChild(addBtn);
  }

  toolbar.appendChild(rightGroup);

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

    const domainItem = buildTreeItem(domain.name, 'domain', 0, true, domain.icon ? getSkillIconSVG(domain.icon, 16) : null, {
      filterType: 'domain_id',
      filterId: domain.id,
    });
    if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
      domainItem.classList.add('active');
    }
    domainItem.addEventListener('click', (e) => {
      e.stopPropagation();
      domainItem.classList.toggle('expanded');
      selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
    });
    addToggleListener(domainItem);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    teams.forEach(team => {
      const teamItem = buildTreeItem(team.name, 'team', 1, false, team.icon ? getSkillIconSVG(team.icon, 16) : null, {
        filterType: 'team_id',
        filterId: team.id,
      });
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
    const cdItem = buildTreeItem(certDomain.name, 'cert-domain', 0, true, certDomain.icon ? getSkillIconSVG(certDomain.icon, 16) : null);
    if (_selectedFilter.type === 'cert_domain_id' && String(_selectedFilter.id) === String(certDomain.id)) {
      cdItem.classList.add('active');
    }
    cdItem.addEventListener('click', (e) => {
      e.stopPropagation();
      cdItem.classList.toggle('expanded');
      selectFilter({ type: 'cert_domain_id', id: certDomain.id, label: certDomain.name }, cdItem, treeEl);
    });
    addToggleListener(cdItem);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    const certs = Array.isArray(certDomain.certificates) ? certDomain.certificates : [];
    certs.forEach(cert => {
      const certItem = buildTreeItem(cert.name, 'cert', 1, false, cert.icon ? getSkillIconSVG(cert.icon, 16) : null);
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

    const domainItem = buildTreeItem(domain.name, 'domain', 0, teams.length > 0, domain.icon ? getSkillIconSVG(domain.icon, 16) : null);
    if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
      domainItem.classList.add('active');
    }
    domainItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (teams.length > 0) domainItem.classList.toggle('expanded');
      selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
    });
    if (teams.length > 0) addToggleListener(domainItem);

    if (teams.length > 0) {
      const childrenEl = createElement('div', { className: 'tree-item-children' });
      teams.forEach(team => {
        const teamItem = buildTreeItem(team.name, 'team', 1, false, team.icon ? getSkillIconSVG(team.icon, 16) : null, {
        filterType: 'team_id',
        filterId: team.id,
      });
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

function buildTreeItem(label, type, indent, hasToggle, iconText, filterMeta = null) {
  const item = createElement('div', { className: 'tree-item' });
  if (indent) item.style.paddingLeft = `${16 + indent * 16}px`;
  if (type) item.dataset.type = type;
  if (filterMeta?.filterType) item.dataset.filterType = filterMeta.filterType;
  if (filterMeta?.filterId != null) item.dataset.filterId = String(filterMeta.filterId);

  const iconEl = createElement('span', { className: 'tree-item-icon' });
  iconEl.setAttribute('aria-hidden', 'true');
  if (iconText) {
    iconEl.innerHTML = iconText;
  } else if (type === 'all') {
    iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
  } else if (type === 'domain') {
    iconEl.innerHTML = getSkillIconSVG('fabric', 16) || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  } else if (type === 'team') {
    iconEl.innerHTML = getSkillIconSVG('users', 16) || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  } else if (type === 'cert-domain') {
    iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
  } else if (type === 'cert') {
    iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`;
  } else {
    iconEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/></svg>`;
  }

  const labelEl = createElement('span', { className: 'tree-item-label' });
  labelEl.textContent = label;

  item.appendChild(iconEl);
  item.appendChild(labelEl);

  if (hasToggle) {
    const toggleEl = createElement('span', { className: 'tree-item-toggle' });
    toggleEl.setAttribute('aria-hidden', 'true');
    toggleEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
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
  if (_addMode === 'team') {
    const user = Store.get('user');
    const userTeamId = user?.team_id;
    if (filter.type !== 'team_id' || Number(filter.id) !== Number(userTeamId)) {
      showToast(
        `This view is scoped to ${user?.team_name || 'your team'}. Choose From Catalog to browse all skills.`,
        'info',
      );
      return;
    }
  }

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
    const [skills] = await Promise.all([
      api.get('/api/skills/' + buildQueryString()),
      getCategories(),
    ]);
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

  // For non-technical tab: scope to non-technical skills only
  if (_activeTab === 'non-technical') {
    const nonTechTeamIds = getNonTechnicalTeamIds();
    if (nonTechTeamIds) {
      result = result.filter(skill => {
        const teams = Array.isArray(skill.teams) ? skill.teams : [];
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

  if (_activeTab === 'cert' && _selectedFilter.type === 'all') {
    result = result.filter(skill => {
      const certs = Array.isArray(skill.certificates) ? skill.certificates : [];
      return certs.length > 0;
    });
  }

  if (_activeTab === 'cert' && _selectedFilter.type === 'cert_domain_id') {
    const certIds = getCertIdsForDomain(_selectedFilter.id);
    if (certIds) {
      result = result.filter(skill => {
        const certs = Array.isArray(skill.certificates) ? skill.certificates : [];
        return certs.some(c => certIds.has(c.id));
      });
    }
  }

  if (_sortMode === 'name-asc') result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (_sortMode === 'name-desc') result.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  else if (_sortMode === 'date-desc') result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  else if (_sortMode === 'date-asc') result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

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

/** Get team IDs belonging to technical domains from cached org-tree, filtered by active shifts */
function getTechnicalTeamIds() {
  const treeData = _treeCache['org'] || _treeCache['non-technical'];
  if (!Array.isArray(treeData)) return null;
  const ids = new Set();
  treeData.filter(d => d.is_technical === true).forEach(domain => {
    (Array.isArray(domain.teams) ? domain.teams : []).forEach(t => {
      if (_activeShifts.has(t.shift)) ids.add(t.id);
    });
  });
  return ids;
}

function getCertIdsForDomain(certDomainId) {
  const treeData = _treeCache['cert'];
  if (!Array.isArray(treeData)) return null;
  const ids = new Set();
  const domain = treeData.find(cd => String(cd.id) === String(certDomainId));
  if (domain) {
    (Array.isArray(domain.certificates) ? domain.certificates : []).forEach(c => ids.add(c.id));
  }
  return ids;
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderSkillGrid(container, skills) {
  container.innerHTML = '';

  if (_addMode) {
    const scope = createElement('div', { className: 'cat-addmode-scope' });
    const countLabel = `${skills.length} skill${skills.length === 1 ? '' : 's'}`;
    if (_addMode === 'team') {
      scope.textContent = `${_selectedFilter.label} · ${countLabel} available`;
    } else {
      scope.textContent = `${_selectedFilter.label || 'Catalog'} · ${countLabel} shown`;
    }
    container.appendChild(scope);
  }

  if (!skills.length) {
    const emptyHost = createElement('div');
    renderEmptyState(
      emptyHost,
      'No skills found',
      _addMode === 'team'
        ? 'Your team has no matching skills for the current filters.'
        : 'Try adjusting your search or filters.',
    );
    container.appendChild(emptyHost);
    return;
  }

  if (_activeTab !== 'org') {
    const grid = createElement('div', { className: 'grid-3' });
    skills.forEach(skill => grid.appendChild(buildSkillCard(skill)));
    container.appendChild(grid);
    return;
  }

  renderGroupedSkillGrid(container, skills);
}

function renderGroupedSkillGrid(container, skills) {
  const categories = _categoriesCache || [];
  if (!categories.length) {
    const grid = createElement('div', { className: 'grid-3' });
    skills.forEach(skill => grid.appendChild(buildSkillCard(skill)));
    container.appendChild(grid);
    return;
  }

  const wrap = createElement('div', { className: 'catalog-category-sections' });
  let renderedAny = false;

  categories.forEach(cat => {
    const matching = skills.filter(s =>
      Array.isArray(s.categories) && s.categories.some(c => c.slug === cat.slug)
    );
    if (!matching.length) return;
    renderedAny = true;
    wrap.appendChild(buildCategorySection(cat, matching));
  });

  const uncategorised = skills.filter(s => !Array.isArray(s.categories) || s.categories.length === 0);
  if (uncategorised.length) {
    renderedAny = true;
    wrap.appendChild(
      buildCategorySection(
        { slug: '__uncategorised', name: 'Uncategorised' },
        uncategorised
      )
    );
  }

  if (!renderedAny) {
    renderEmptyState(container, 'No skills found', 'Try adjusting your search or filters.');
    return;
  }

  container.appendChild(wrap);
}

function buildCategorySection(category, skills) {
  const collapsed = _collapsedCategorySlugs.has(category.slug);
  const section = createElement('section', {
    className: 'catalog-category-section' + (collapsed ? ' collapsed' : ''),
    'data-category-slug': category.slug,
  });

  const header = createElement('button', {
    className: 'catalog-category-header',
    type: 'button',
    'aria-expanded': collapsed ? 'false' : 'true',
  });
  const chevron = createElement('span', { className: 'catalog-category-chevron' });
  chevron.setAttribute('aria-hidden', 'true');
  header.appendChild(chevron);

  if (category.slug !== '__uncategorised') {
    header.appendChild(categoryIconSpan(category.slug, '16px'));
  }

  const title = createElement('h3', { className: 'catalog-category-title' });
  title.textContent = category.name;
  header.appendChild(title);

  const count = createElement('span', { className: 'catalog-category-count' });
  count.textContent = String(skills.length);
  header.appendChild(count);

  const body = createElement('div', { className: 'catalog-category-body' });
  const grid = createElement('div', { className: 'grid-3' });
  skills.forEach(skill => grid.appendChild(buildSkillCard(skill)));
  body.appendChild(grid);

  header.addEventListener('click', () => {
    const isCollapsed = section.classList.toggle('collapsed');
    header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    if (isCollapsed) {
      _collapsedCategorySlugs.add(category.slug);
    } else {
      _collapsedCategorySlugs.delete(category.slug);
    }
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function buildSkillCard(skill) {
  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEdit = canEditCatalogSkill(skill, user);

  const card = createElement('div', {
    className: skill.is_archived ? 'tool-card tool-card--archived' : 'tool-card',
  });
  card.dataset.skillId = skill.id;
  const primaryCategory = skill.categories?.[0];
  if (primaryCategory?.slug) {
    card.dataset.categorySlug = primaryCategory.slug;
  }

  // Header row with name and admin/manager actions
  const headerRow = createElement('div', { className: 'tool-card-header' });

  const headerLeft = createElement('div', { className: 'tool-card-header-left' });

  if (skill.icon && SKILL_ICONS[skill.icon]) {
    const iconWrap = createElement('div', { className: 'tool-card-icon' });
    iconWrap.innerHTML = getSkillIconSVG(skill.icon, 22);
    headerLeft.appendChild(iconWrap);
  }

  const nameEl = createElement('div', { className: 'tool-card-name' });
  nameEl.textContent = skill.name;
  headerLeft.appendChild(nameEl);
  headerRow.appendChild(headerLeft);

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
        : 'btn btn-sm btn-secondary card-action-btn',
    });
    archiveBtn.textContent = skill.is_archived ? 'Restore' : 'Archive';
    archiveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleArchiveSkill(skill);
    });

    const deleteBtn = createElement('button', {
      className: 'btn btn-sm btn-danger card-action-btn'
    });
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCascadeDeleteSkill(skill.id, skill.name);
    });

    actions.appendChild(editBtn);
    actions.appendChild(archiveBtn);
    actions.appendChild(deleteBtn);
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

  const teams = Array.isArray(skill.teams) ? skill.teams : [];
  if (teams.length) {
    const teamsRow = createElement('div', { className: 'tool-card-badges' });
    const VISIBLE_LIMIT = 2;
    const visibleTeams = teams.slice(0, VISIBLE_LIMIT);
    const hiddenTeams = teams.slice(VISIBLE_LIMIT);

    visibleTeams.forEach(team => {
      const chip = createElement('span', { className: 'triage-chip triage-signal chip-sm' });
      chip.textContent = team.name;
      teamsRow.appendChild(chip);
    });

    if (hiddenTeams.length) {
      const overflow = createElement('span', {
        className: 'triage-chip triage-signal chip-sm team-chip-overflow',
        tabindex: '0',
        'aria-label': `${hiddenTeams.length} more team${hiddenTeams.length === 1 ? '' : 's'}: ${hiddenTeams.map(t => t.name).join(', ')}`,
      });
      overflow.textContent = `+${hiddenTeams.length} …`;

      const popover = createElement('span', { className: 'team-chip-overflow__popover', role: 'tooltip' });
      hiddenTeams.forEach(team => {
        const line = createElement('span', { className: 'team-chip-overflow__item' });
        line.textContent = team.name;
        popover.appendChild(line);
      });
      overflow.appendChild(popover);
      teamsRow.appendChild(overflow);
    }

    card.appendChild(teamsRow);
  }

  // Certificate badges
  const certs = Array.isArray(skill.certificates) ? skill.certificates : [];
  if (certs.length) {
    const certsRow = createElement('div', { className: 'tool-card-badges' });
    const VISIBLE_CERT_LIMIT = 2;
    const visibleCerts = certs.slice(0, VISIBLE_CERT_LIMIT);
    const hiddenCerts = certs.slice(VISIBLE_CERT_LIMIT);

    visibleCerts.forEach(cert => {
      const badge = createElement('span', { className: 'meta-badge meta-badge--cert meta-badge--clickable' });
      badge.textContent = cert.name;
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        switchTabAndFilter('cert', 'cert_id', cert.id, cert.name);
      });
      certsRow.appendChild(badge);
    });

    if (hiddenCerts.length) {
      const overflow = createElement('span', {
        className: 'meta-badge meta-badge--cert team-chip-overflow',
        tabindex: '0',
        'aria-label': `${hiddenCerts.length} more certification${hiddenCerts.length === 1 ? '' : 's'}: ${hiddenCerts.map(c => c.name).join(', ')}`,
      });
      overflow.textContent = `+${hiddenCerts.length} …`;

      const popover = createElement('span', { className: 'team-chip-overflow__popover', role: 'tooltip' });
      hiddenCerts.forEach(cert => {
        const line = createElement('button', {
          className: 'team-chip-overflow__item team-chip-overflow__item--clickable',
          type: 'button',
        });
        line.textContent = cert.name;
        line.addEventListener('click', (e) => {
          e.stopPropagation();
          switchTabAndFilter('cert', 'cert_id', cert.id, cert.name);
        });
        popover.appendChild(line);
      });
      overflow.appendChild(popover);
      certsRow.appendChild(overflow);
    }

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

  if (_addMode && !skill.is_archived) {
    const addRow = createElement('div', { className: 'tool-card-add-row' });
    addRow.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid var(--border-soft);';
    const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    addBtn.style.width = '100%';
    addBtn.textContent = 'Add to My Plan';
    addBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const engineerId = Store.get('user')?.id;
      if (!engineerId) return;
      addBtn.disabled = true;
      addBtn.textContent = '...';
      try {
        await api.post(`/api/plans/${engineerId}/skills`, { skill_id: skill.id });
        showToast(`"${skill.name}" added to plan`, 'success');
        addBtn.textContent = 'Added ✓';
        addBtn.style.opacity = '0.6';
        addBtn.style.cursor = 'default';
      } catch (err) {
        showToast(err.message || 'Failed to add skill', 'error');
        addBtn.disabled = false;
        addBtn.textContent = 'Add to My Plan';
      }
    });
    addRow.appendChild(addBtn);
    card.appendChild(addRow);
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

// ─── Editor helpers (unified skill editor) ───────────────────────────────────

/** Managers may edit only skills assigned to their own team (admins: all). */
function canEditCatalogSkill(skill, user = Store.get('user')) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'manager') return false;
  if (!skill?.id) return true; // create flow
  const allowed = new Set();
  if (user.team_id != null) allowed.add(Number(user.team_id));
  const skillTeamIds = Array.isArray(skill.teams)
    ? skill.teams.map(t => Number(t.id)).filter(Number.isFinite)
    : (Array.isArray(skill.team_ids) ? skill.team_ids.map(Number).filter(Number.isFinite) : []);
  return skillTeamIds.some(id => allowed.has(id));
}

function getEditorHelpers() {
  return {
    buildSkillForm,
    readSkillForm,
    validateSkillForm,
    loadFormData,
    canEditCatalogSkill,
    refreshCatalog: () => {
      _formDataCache = null;
      delete _treeCache[_activeTab];
      fetchAndRenderSkills();
    },
    switchTabAndFilter,
  };
}

async function loadFormData() {
  if (_formDataCache) return _formDataCache;
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

  _formDataCache = {
    teams,
    certificates,
    orgTree: Array.isArray(orgTree) ? orgTree : [],
    certTree: Array.isArray(certTree) ? certTree : [],
  };
  return _formDataCache;
}

// ─── Skill Detail Modal (delegates to unified editor) ─────────────────────────
function showSkillDetailModal(skill) {
  openCatalogSkillEditor(skill, { initialTab: 'content' }, getEditorHelpers());
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

  requestAnimationFrame(async () => {
    overlay.classList.add('open');

    try {
      const { ensureMarkdownDeps } = await import('../utils/cdn-loader.js');
      await ensureMarkdownDeps();
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
    } catch {
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

// ─── Skill Create/Edit Modal (delegates to unified editor) ───────────────────

async function openSkillModal(existingSkill) {
  try {
    await loadFormData();
  } catch {
    showToast('Failed to load form data', 'error');
    return;
  }
  openCatalogSkillEditor(existingSkill, { initialTab: 'details' }, getEditorHelpers());
}

function buildSkillForm(skill, formData, isAdmin, isManager, user, initialIsNonTechnical = false, formHooks = {}) {
  const notifyChange = () => formHooks.notifyChange?.();
  const beginAsync = () => formHooks.beginAsync?.();
  const endAsync = () => formHooks.endAsync?.();
  const trackAsync = (promise) => {
    beginAsync();
    Promise.resolve(promise).finally(endAsync);
  };

  const form = createElement('div', { className: 'catalog-form skill-edit-form' });
  const isCreateMode = !skill;

  // -- Section 1: Identity
  const identitySection = createElement('div', { className: 'skill-edit-section' });
  const identityHeader = createElement('div', { className: 'skill-edit-section__header' });
  const identityTitle = createElement('div', { className: 'skill-edit-section__title' });
  identityTitle.textContent = 'Identity';
  identityHeader.appendChild(identityTitle);
  identitySection.appendChild(identityHeader);

  const identityBody = createElement('div', { className: 'skill-edit-section__body' });
  const nameGroup = buildFormGroup('Name', 'skill-name', 'input', {
    type: 'text',
    placeholder: 'e.g. Wi-Fi 6 Configuration',
    required: true,
  }, true);
  const nameInput = nameGroup.querySelector('#skill-name');
  if (nameInput) nameInput.value = skill?.name || '';
  
  const descGroup = buildFormGroup('Description', 'skill-desc', 'textarea', {
    placeholder: 'Describe what this skill covers...',
  }, false);
  const descTextarea = descGroup.querySelector('#skill-desc');
  if (descTextarea) descTextarea.value = skill?.description || '';
  
  const tagsGroup = buildFormGroup('Tags', 'skill-tags', 'input', {
    type: 'text',
    placeholder: 'e.g. routing, bgp, advanced',
  }, false);
  const tagsInput = tagsGroup.querySelector('#skill-tags');
  if (tagsInput) tagsInput.value = Array.isArray(skill?.tags) ? skill.tags.map(t => t.name || t).join(', ') : '';
  const tagHint = createElement('div', { className: 'form-hint catalog-form-hint' });
  tagHint.textContent = 'Comma-separated';
  tagsGroup.appendChild(tagHint);

  identityBody.appendChild(nameGroup);
  identityBody.appendChild(descGroup);
  identityBody.appendChild(tagsGroup);
  identitySection.appendChild(identityBody);
  form.appendChild(identitySection);

  // -- Section 2: Classification
  const classSection = createElement('div', { className: 'skill-edit-section' });
  const classHeader = createElement('div', { className: 'skill-edit-section__header' });
  const classTitle = createElement('div', { className: 'skill-edit-section__title' });
  classTitle.textContent = 'Classification';
  classHeader.appendChild(classTitle);
  classSection.appendChild(classHeader);

  const classBody = createElement('div', { className: 'skill-edit-section__body' });
  
  const toggleRow = createElement('div', { className: 'skill-edit-classification-row' });
  const toggleGroup = createElement('div', { className: 'form-group skill-ntech-toggle-group' });
  const toggleLabel = createElement('label', { className: 'toggle-switch' });
  const toggleInput = createElement('input', { 
    type: 'checkbox', 
    id: 'skill-non-technical',
    className: 'toggle-switch__input' 
  });
  toggleInput.checked = initialIsNonTechnical;
  form._ntechCheckbox = toggleInput; // for readSkillForm compatibility

  const toggleTrack = createElement('span', { className: 'toggle-switch__track' });
  const toggleThumb = createElement('span', { className: 'toggle-switch__thumb' });
  toggleTrack.appendChild(toggleThumb);
  toggleLabel.appendChild(toggleInput);
  toggleLabel.appendChild(toggleTrack);
  toggleLabel.appendChild(document.createTextNode(' Non-Technical Skill'));
  
  const ntechHint = createElement('div', { className: 'form-hint catalog-form-hint' });
  ntechHint.textContent = 'Non-technical skills are assigned to NTECH-GEN shift teams instead of organization teams.';
  
  toggleGroup.appendChild(toggleLabel);
  toggleGroup.appendChild(ntechHint);
  toggleRow.appendChild(toggleGroup);

  const categoryGroupTechnical = buildSkillCategoryPicker(skill, { trackAsync, notifyChange });
  categoryGroupTechnical.classList.add('skill-category-picker--technical');
  toggleRow.appendChild(categoryGroupTechnical);

  classBody.appendChild(toggleRow);
  classSection.appendChild(classBody);
  form.appendChild(classSection);

  // -- Section 3: Associations
  const assocSection = createElement('div', { className: 'skill-edit-section' });
  const assocHeader = createElement('div', { className: 'skill-edit-section__header' });
  const assocTitle = createElement('div', { className: 'skill-edit-section__title' });
  assocTitle.textContent = 'Associations';
  assocHeader.appendChild(assocTitle);
  assocSection.appendChild(assocHeader);
  
  const assocBody = createElement('div', { className: 'skill-edit-row skill-edit-row--assoc' });

  // Teams (Technical) Panel
  const existingTeamIds = new Set(
    Array.isArray(skill?.teams)
      ? skill.teams.map(t => Number(t.id))
      : (Array.isArray(skill?.team_ids) ? skill.team_ids.map(Number) : [])
  );
  
  const teamsPanel = createElement('div', { className: 'skill-assoc-section' });
  const teamsPanelHeader = createElement('div', { className: 'skill-assoc-section__header' });
  const teamsLabel = createElement('div', { className: 'skill-assoc-section__label' });
  teamsLabel.textContent = 'Teams';
  const teamsBadge = createElement('span', { className: 'skill-assoc-section__badge' });
  teamsPanelHeader.appendChild(teamsLabel);
  teamsPanelHeader.appendChild(teamsBadge);
  teamsPanel.appendChild(teamsPanelHeader);

  const teamOptionsAll = buildTeamOptions(formData.orgTree || []);
  const shiftToggleGroup = createElement('div', { className: 'skill-shift-filter', role: 'group', 'aria-label': 'Filter by shift' });
  const activeShifts = new Set([1, 2, 3, 4]);
  [1, 2, 3, 4].forEach(s => {
    const btn = createElement('button', { type: 'button', className: 'skill-shift-filter__btn is-active cat-shift-btn active' });
    btn.textContent = `Shift ${s}`;
    btn.setAttribute('aria-pressed', 'true');
    btn.addEventListener('click', () => {
      if (activeShifts.has(s)) {
        if (activeShifts.size > 1) {
          activeShifts.delete(s);
          btn.classList.remove('is-active', 'active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        activeShifts.add(s);
        btn.classList.add('is-active', 'active');
        btn.setAttribute('aria-pressed', 'true');
      }
      rebuildTeamCombo();
    });
    shiftToggleGroup.appendChild(btn);
  });
  teamsPanel.appendChild(shiftToggleGroup);

  function rebuildTeamCombo() {
    const currentSelected = form._teamCombo ? form._teamCombo.getSelected() : Array.from(existingTeamIds);
    const selectedSet = new Set(currentSelected);
    const filteredOptions = teamOptionsAll.filter(o => 
      o._shift === 0 || activeShifts.has(o._shift) || selectedSet.has(o.id)
    );
    const newCombo = createComboboxMulti({
      options: filteredOptions,
      selectedValues: currentSelected,
      placeholder: 'Search and add teams…',
      emptyText: 'No teams match',
      onChange: (vals) => {
        teamsBadge.textContent = String(vals.length);
        notifyChange();
      },
      onOpen: () => scrollAssocIntoView(teamsPanel),
    });
    if (form._teamCombo) {
      teamsPanel.replaceChild(newCombo.element, form._teamCombo.element);
      form._teamCombo.destroy();
    } else {
      teamsPanel.appendChild(newCombo.element);
    }
    form._teamCombo = newCombo;
    teamsBadge.textContent = String(newCombo.getSelected().length);
  }
  rebuildTeamCombo();

  // NTECH-GEN (Non-Technical) Panel
  const ntechTeamsPanel = createElement('div', { className: 'skill-assoc-section skill-form__ntech-teams' });
  const ntechTeamsHeader = createElement('div', { className: 'skill-assoc-section__header' });
  const ntechTeamsLabel = createElement('div', { className: 'skill-assoc-section__label' });
  ntechTeamsLabel.textContent = 'Shift Teams';
  const ntechTeamsBadge = createElement('span', { className: 'skill-assoc-section__badge' });
  ntechTeamsHeader.appendChild(ntechTeamsLabel);
  ntechTeamsHeader.appendChild(ntechTeamsBadge);
  ntechTeamsPanel.appendChild(ntechTeamsHeader);

  const ntechInfo = createElement('div', { className: 'skill-form__ntech-info' });
  ntechInfo.innerHTML = '<span class="ntech-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span> Assigned to the NTECH-GEN domain across selected shifts';
  ntechTeamsPanel.appendChild(ntechInfo);

  const ntechChecksContainer = createElement('div', { className: 'skill-ntech-select-grid' });
  ntechTeamsPanel.appendChild(ntechChecksContainer);

  function updateNtechTeamsBadge() {
    const count = ntechChecksContainer.querySelectorAll('.ntech-team-cb:checked').length;
    ntechTeamsBadge.textContent = String(count);
  }

  let fetchedNTech = false;
  async function loadNTechTeams() {
    if (fetchedNTech) return;
    fetchedNTech = true;
    beginAsync();
    ntechChecksContainer.innerHTML = '';
    const loading = createElement('div', { className: 'form-hint catalog-form-hint' });
    loading.textContent = 'Loading shift teams…';
    ntechChecksContainer.appendChild(loading);
    try {
      const ntechTeams = await api.get('/api/skills/ntech-teams');
      ntechChecksContainer.innerHTML = '';
      ntechTeams.forEach(t => {
        const isChecked = isCreateMode ? true : (initialIsNonTechnical ? existingTeamIds.has(Number(t.id)) : true);
        const card = buildNtechSelectCard({
          value: t.id,
          label: t.name,
          description: t.shift ? `Follow-the-sun · Shift ${t.shift}` : 'General non-technical team',
          checked: isChecked,
          inputClass: 'ntech-team-cb',
        });
        const iconWrap = card.querySelector('.skill-ntech-select-card__icon');
        if (iconWrap) iconWrap.innerHTML = getSkillIconSVG('users', 18);
        card.querySelector('.ntech-team-cb')?.addEventListener('change', () => {
          updateNtechTeamsBadge();
          notifyChange();
        });
        ntechChecksContainer.appendChild(card);
      });
      updateNtechTeamsBadge();
    } catch {
      ntechChecksContainer.innerHTML = '';
      const err = createElement('div', { className: 'form-hint' });
      err.textContent = 'Failed to load NTECH teams.';
      ntechChecksContainer.appendChild(err);
    } finally {
      endAsync();
    }
  }

  // Toggle Logic — must run after all panels (incl. certsPanel) are created
  function setPanelVisible(el, visible) {
    el.hidden = !visible;
    el.classList.toggle('hidden', !visible);
  }

  function updateClassificationMode() {
    const isNtech = toggleInput.checked;
    setPanelVisible(categoryGroupTechnical, !isNtech);
    setPanelVisible(teamsPanel, !isNtech);
    setPanelVisible(ntechTeamsPanel, isNtech);
    setPanelVisible(certsPanel, !isNtech);
    assocBody.classList.toggle('skill-edit-row--assoc--ntech', isNtech);
    if (isNtech) {
      loadNTechTeams();
    }
  }

  assocBody.appendChild(teamsPanel);
  assocBody.appendChild(ntechTeamsPanel);

  // Certificates Panel
  const certsPanel = createElement('div', { className: 'skill-assoc-section' });
  const certsHeader = createElement('div', { className: 'skill-assoc-section__header' });
  const certsLabel = createElement('div', { className: 'skill-assoc-section__label' });
  certsLabel.textContent = 'Certificates';
  const certsBadge = createElement('span', { className: 'skill-assoc-section__badge' });
  certsHeader.appendChild(certsLabel);
  certsHeader.appendChild(certsBadge);
  certsPanel.appendChild(certsHeader);

  const existingCertIds = new Set(
    Array.isArray(skill?.certificates) ? skill.certificates.map(c => Number(c.id)) : []
  );
  const certOptions = (formData.certTree || []).flatMap(cd =>
    (Array.isArray(cd.certificates) ? cd.certificates : []).map(c => ({
      id: Number(c.id),
      label: c.name,
      group: cd.name,
    }))
  );
  const certCombo = createComboboxMulti({
    options: certOptions,
    selectedValues: Array.from(existingCertIds),
    placeholder: 'Search and add certificates…',
    emptyText: 'No certificates match',
    onChange: (vals) => {
      certsBadge.textContent = String(vals.length);
      notifyChange();
    },
    onOpen: () => scrollAssocIntoView(certsPanel),
  });
  certsPanel.appendChild(certCombo.element);
  certsBadge.textContent = String(certCombo.getSelected().length);
  form._certCombo = certCombo;

  assocBody.appendChild(certsPanel);
  toggleInput.addEventListener('change', () => {
    updateClassificationMode();
    notifyChange();
  });
  updateClassificationMode();
  assocSection.appendChild(assocBody);
  form.appendChild(assocSection);

  // -- Section 4: Visual
  const visualSection = createElement('div', { className: 'skill-edit-section' });
  const visualHeader = createElement('div', { className: 'skill-edit-section__header' });
  const visualTitle = createElement('div', { className: 'skill-edit-section__title' });
  visualTitle.textContent = 'Visual';
  visualHeader.appendChild(visualTitle);
  visualSection.appendChild(visualHeader);

  const visualBody = createElement('div', { className: 'skill-edit-section__body' });
  visualBody.appendChild(buildIconPicker(skill?.icon || null, { notifyChange }));
  visualSection.appendChild(visualBody);
  form.appendChild(visualSection);

  return form;
}

function scrollAssocIntoView(panel) {
  if (!panel) return;
  let scroller = panel.parentElement;
  while (scroller && scroller !== document.body) {
    const cs = getComputedStyle(scroller);
    if (/(auto|scroll)/.test(cs.overflowY) && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === document.body) return;
  requestAnimationFrame(() => {
    const panelRect = panel.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const delta = panelRect.bottom - scrollerRect.bottom + 16;
    if (delta > 0) {
      scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' });
    }
  });
}

function buildTeamOptions(orgTree) {
  const rows = [];
  (Array.isArray(orgTree) ? orgTree : []).forEach(domain => {
    if (!Array.isArray(domain.teams)) return;
    domain.teams.forEach(team => {
      const shift = Number.isFinite(team.shift) ? team.shift : 0;
      const shiftLabel = shift === 0 ? 'No Shift' : `Shift ${shift}`;
      rows.push({
        id: Number(team.id),
        label: team.name,
        group: `${shiftLabel} · ${domain.name}`,
        _shift: shift,
        _domain: domain.name,
      });
    });
  });
  rows.sort((a, b) => {
    if (a._shift !== b._shift) return a._shift - b._shift;
    if (a._domain !== b._domain) return a._domain.localeCompare(b._domain);
    return a.label.localeCompare(b.label);
  });
  return rows.map(r => ({ id: r.id, label: r.label, group: r.group, _shift: r._shift }));
}


function buildSkillCategoryPicker(skill, hooks = {}) {
  const { trackAsync, notifyChange } = hooks;
  const group = createElement('div', { className: 'form-group skill-category-picker' });
  const label = createElement('div', { className: 'form-label' });
  label.textContent = 'Categories';
  group.appendChild(label);

  const hint = createElement('div', { className: 'form-hint catalog-form-hint' });
  hint.textContent = 'Select one or more. Skills appear in every matching group on the Catalog.';
  group.appendChild(hint);

  const chips = createElement('div', { className: 'skill-category-chips' });
  group.appendChild(chips);
  group._categoryGrid = chips;

  const existingIds = new Set(
    Array.isArray(skill?.categories) ? skill.categories.map(c => Number(c.id)) : []
  );

  trackAsync?.(getCategories().then(categories => {
    chips.innerHTML = '';
    if (!Array.isArray(categories) || categories.length === 0) {
      const empty = createElement('div', { className: 'form-hint' });
      empty.textContent = 'No categories available.';
      chips.appendChild(empty);
      return;
    }
    categories.forEach(cat => {
      const chip = createElement('button', { className: 'mp-filter-chip skill-category-chip', type: 'button' });
      chip.dataset.category = cat.slug || '';
      chip.dataset.categoryId = String(cat.id);
      const isChecked = existingIds.has(Number(cat.id));
      if (isChecked) chip.classList.add('active');
      chip.setAttribute('aria-pressed', isChecked ? 'true' : 'false');

      chip.appendChild(categoryIconSpan(cat.slug, '14px'));

      const labelSpan = createElement('span', { className: 'mp-filter-chip__label' });
      labelSpan.textContent = cat.name;
      chip.appendChild(labelSpan);

      const cb = createElement('input', { className: 'skill-category-item__cb' });
      cb.type = 'checkbox';
      cb.value = String(cat.id);
      cb.dataset.categoryId = String(cat.id);
      cb.checked = isChecked;
      chip.appendChild(cb);

      chip.addEventListener('click', () => {
        const next = !chip.classList.contains('active');
        chip.classList.toggle('active', next);
        chip.setAttribute('aria-pressed', next ? 'true' : 'false');
        cb.checked = next;
        notifyChange?.();
      });

      chips.appendChild(chip);
    });
  }).catch(() => {
    chips.innerHTML = '';
    const err = createElement('div', { className: 'form-hint' });
    err.textContent = 'Failed to load categories.';
    chips.appendChild(err);
  }));

  return group;
}

function buildNtechSelectCard({ value, label, description, checked, inputClass, dataset = {} }) {
  const card = createElement('label', { className: 'skill-ntech-select-card' });
  const cb = createElement('input', {
    type: 'checkbox',
    className: inputClass,
    value: String(value),
  });
  if (checked) cb.checked = true;
  Object.entries(dataset).forEach(([key, val]) => {
    cb.dataset[key] = String(val);
  });

  const iconWrap = createElement('span', { className: 'skill-ntech-select-card__icon', 'aria-hidden': 'true' });
  const body = createElement('div', { className: 'skill-ntech-select-card__body' });
  const title = createElement('div', { className: 'skill-ntech-select-card__title' });
  title.textContent = label;
  body.appendChild(title);
  if (description) {
    const desc = createElement('div', { className: 'skill-ntech-select-card__desc' });
    desc.textContent = description;
    body.appendChild(desc);
  }
  const check = createElement('span', { className: 'skill-ntech-select-card__check', 'aria-hidden': 'true' });

  card.appendChild(cb);
  card.appendChild(iconWrap);
  card.appendChild(body);
  card.appendChild(check);
  return card;
}

function buildIconPicker(selectedIcon, hooks = {}) {
  const notifyChange = () => hooks.notifyChange?.();
  const group = createElement('div', { className: 'form-group skill-icon-picker-group' });
  const label = createElement('div', { className: 'form-label' });
  label.textContent = 'Icon';
  group.appendChild(label);

  const picker = createElement('div', { className: 'skill-icon-picker skill-icon-picker--collapsed' });

  const hiddenInput = createElement('input', { className: 'skill-icon-value' });
  hiddenInput.type = 'hidden';
  hiddenInput.value = selectedIcon || '';
  picker.appendChild(hiddenInput);

  const preview = createElement('div', { className: 'icon-picker-preview' });
  const previewSwatch = createElement('div', { className: 'icon-picker-preview__swatch' });
  previewSwatch.innerHTML = selectedIcon ? getSkillIconSVG(selectedIcon, 22) : '';
  const previewName = createElement('div', { className: 'icon-picker-preview__name' });
  previewName.textContent = selectedIcon || 'No icon selected';
  const toggleBtn = createElement('button', { className: 'icon-picker-preview__toggle', type: 'button' });
  toggleBtn.textContent = 'Change…';
  preview.appendChild(previewSwatch);
  preview.appendChild(previewName);
  preview.appendChild(toggleBtn);
  picker.appendChild(preview);

  const expandable = createElement('div', { className: 'icon-picker-expandable' });

  const searchInput = createElement('input', { className: 'icon-picker-search' });
  searchInput.type = 'text';
  searchInput.placeholder = 'Search icons...';
  expandable.appendChild(searchInput);

  const categoriesContainer = createElement('div', { className: 'icon-picker-categories' });

  function renderIcons(filter) {
    categoriesContainer.innerHTML = '';
    const lowerFilter = (filter || '').toLowerCase();

    Object.entries(ICON_CATEGORIES).forEach(([catName, iconKeys]) => {
      const filtered = lowerFilter
        ? iconKeys.filter(k => k.toLowerCase().includes(lowerFilter))
        : iconKeys;
      if (!filtered.length) return;

      const catLabel = createElement('div', { className: 'icon-picker-category-label' });
      catLabel.textContent = catName;
      categoriesContainer.appendChild(catLabel);

      const grid = createElement('div', { className: 'icon-picker-grid' });
      filtered.forEach(key => {
        const opt = createElement('div', { className: 'skill-icon-option' });
        if (key === selectedIcon) opt.classList.add('selected');
        opt.dataset.icon = key;
        opt.title = key;
        opt.innerHTML = getSkillIconSVG(key, 22);
        opt.addEventListener('click', () => {
          picker.querySelectorAll('.skill-icon-option.selected').forEach(el => el.classList.remove('selected'));
          opt.classList.add('selected');
          selectedIcon = key;
          hiddenInput.value = key;
          previewSwatch.innerHTML = getSkillIconSVG(key, 22);
          previewName.textContent = key;
          notifyChange();
        });
        grid.appendChild(opt);
      });
      categoriesContainer.appendChild(grid);
    });
  }

  searchInput.addEventListener('input', () => renderIcons(searchInput.value));
  expandable.appendChild(categoriesContainer);
  picker.appendChild(expandable);

  toggleBtn.addEventListener('click', () => {
    const collapsed = picker.classList.toggle('skill-icon-picker--collapsed');
    toggleBtn.textContent = collapsed ? 'Change…' : 'Close';
    if (!collapsed && !categoriesContainer.hasChildNodes()) {
      renderIcons('');
    }
  });

  group.appendChild(picker);
  return group;
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
  const iconInput = formEl.querySelector('.skill-icon-value');
  const icon = iconInput && iconInput.value ? iconInput.value : null;

  let team_ids = [];
  let is_non_technical = false;
  let category_ids = [];
  let certificate_ids = [];

  if (formEl._ntechCheckbox && formEl._ntechCheckbox.checked) {
    is_non_technical = true;
    team_ids = Array.from(formEl.querySelectorAll('.ntech-team-cb:checked'))
      .map(cb => Number(cb.value))
      .filter(Number.isFinite);
    category_ids = [];
    certificate_ids = [];
  } else {
    team_ids = formEl._teamCombo
      ? formEl._teamCombo.getSelected().map(Number).filter(Number.isFinite)
      : [];
    category_ids = Array.from(formEl.querySelectorAll('.skill-category-item__cb:checked'))
      .map(cb => Number(cb.dataset.categoryId))
      .filter(Number.isFinite);
    certificate_ids = formEl._certCombo
      ? formEl._certCombo.getSelected().map(Number).filter(Number.isFinite)
      : [];
  }

  const tagsRaw = formEl.querySelector('#skill-tags')?.value.trim() || '';
  const tag_names = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { name, description, icon, team_ids, certificate_ids, tag_names, category_ids, is_non_technical };
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

async function handleCascadeDeleteSkill(skillId, skillName) {
  try {
    const preview = await api.get(`/api/skills/${skillId}/cascade-preview`);
    
    const body = createElement('div', { className: 'cascade-delete-modal__body' });
    
    const warningHeader = createElement('div', { className: 'cascade-delete-modal__warning' });
    const warningIcon = createElement('span');
    warningIcon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    const warningText = createElement('span');
    warningText.textContent = 'This will permanently remove the skill from the catalog.';
    warningHeader.appendChild(warningIcon);
    warningHeader.appendChild(warningText);
    body.appendChild(warningHeader);

    const impactCard = createElement('div', { className: 'cascade-delete-modal__impact' });
    impactCard.innerHTML = `<p><strong>${preview.engineers_affected}</strong> engineers currently have this skill in their plan.</p>
                            <p>Their training logs (<strong>${preview.training_logs_preserved}</strong>) and content completions will be preserved as personal skill.</p>`;
    body.appendChild(impactCard);

    const confirmRow = createElement('div', { className: 'cascade-delete-modal__confirm-row' });
    const confirmLabel = createElement('label', { htmlFor: 'cascade-confirm-input' });
    confirmLabel.textContent = `Type "${skillName}" to confirm`;
    const confirmInput = createElement('input', { type: 'text', id: 'cascade-confirm-input', className: 'form-control', autocomplete: 'off' });
    confirmRow.appendChild(confirmLabel);
    confirmRow.appendChild(confirmInput);
    body.appendChild(confirmRow);

    const resultPromise = showModal({
      title: `Delete skill: "${skillName}"`,
      body: body,
      modalClass: 'cascade-delete-modal',
      actions: [
        { label: 'Cancel', className: 'btn btn-secondary', value: false },
        { label: 'Delete permanently', className: 'btn cascade-delete-modal__danger-btn', value: true }
      ]
    });

    // Wire up input validation after modal is rendered
    requestAnimationFrame(() => {
      const deleteBtn = document.querySelector('.cascade-delete-modal__danger-btn');
      if (deleteBtn) {
        deleteBtn.disabled = true;
        confirmInput.addEventListener('input', () => {
          deleteBtn.disabled = confirmInput.value !== skillName;
        });
      }
      confirmInput.focus();
    });

    const result = await resultPromise;

    if (result) {
      try {
        const res = await api.del(`/api/skills/${skillId}/cascade`);
        if (res.tombstone) {
          showToast(`Skill deleted from catalog. Kept as personal skill for ${res.plan_skills_affected} engineers.`, 'success');
        } else {
          showToast('Skill permanently deleted.', 'success');
        }
        fetchAndRenderSkills();
      } catch (err) {
        showToast(err.message || 'Failed to delete skill', 'error');
      }
    }

  } catch (err) {
    showToast(err.message || 'Failed to load skill impact', 'error');
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
