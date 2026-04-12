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

// Current active tab: 'org' | 'cert' | 'non-technical' | 'campaign'
let _activeTab = 'org';

// Per-tab cached tree data
const _treeCache = {};

// Selected filter state
let _selectedFilter = { type: 'all', id: null, label: 'All Skills' };
let _searchQuery = '';
let _showFuture = false;
let _showArchived = false;

// Cached data for skill create/edit form
let _formDataCache = null; // { orgs, domains, teams }

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountCatalog(container, params) {
  _container = container;
  container.innerHTML = '';

  // Reset state
  _activeTab = 'org';
  _selectedFilter = { type: 'all', id: null, label: 'All Skills' };
  _searchQuery = '';
  _showFuture = false;
  _showArchived = false;
  _formDataCache = null;

  const page = buildPageShell(container);
  _gridEl = page.gridEl;
  _treeEl = page.treeEl;

  // Initial load: org tab
  loadTabTree('org', page.treeEl);
  fetchAndRenderSkills();

  return () => {
    clearTimeout(_debounceTimer);
  };
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', { className: 'page-shell' });

  // Header
  const header = createElement('div', { className: 'mp-header' });
  const title = createElement('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('Skill '));
  const gradientSpan = createElement('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Catalog';
  title.appendChild(gradientSpan);
  const subtitle = createElement('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Browse, search and manage the skill catalog';
  header.appendChild(title);
  header.appendChild(subtitle);
  wrapper.appendChild(header);

  // Top controls
  const topBar = buildTopBar();
  wrapper.appendChild(topBar.el);

  // Tab bar + body wrapper
  const catalogWrapper = createElement('div', { className: 'catalog-tab-wrapper' });

  const tabBar = buildTabBar(catalogWrapper);
  catalogWrapper.appendChild(tabBar);

  const body = createElement('div', { className: 'catalog-body' });

  const treeEl = createElement('div', { className: 'sidebar-tree' });
  const treeHeader = createElement('div', { className: 'sidebar-tree-header', textContent: 'Browse Skills' });
  treeEl.appendChild(treeHeader);
  body.appendChild(treeEl);

  const main = createElement('div', { className: 'page-body--col catalog-main' });
  const gridEl = createElement('div');
  main.appendChild(gridEl);
  body.appendChild(main);

  catalogWrapper.appendChild(body);
  wrapper.appendChild(catalogWrapper);
  container.appendChild(wrapper);

  return { treeEl, gridEl, filterBarEl: topBar.filterBarEl };
}

function buildTabBar(catalogWrapper) {
  const tabBar = createElement('div', { className: 'catalog-tab-bar' });

  const TABS = [
    { id: 'org', label: 'Organization' },
    { id: 'cert', label: 'Certification' },
    { id: 'non-technical', label: 'Non-Technical' },
    { id: 'campaign', label: 'Campaigns' },
  ];

  TABS.forEach(tab => {
    const btn = createElement('button', { className: 'catalog-tab' + (tab.id === _activeTab ? ' active' : '') });
    btn.textContent = tab.label;
    btn.dataset.tabId = tab.id;
    btn.addEventListener('click', () => {
      if (_activeTab === tab.id) return;
      _activeTab = tab.id;

      tabBar.querySelectorAll('.catalog-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      _selectedFilter = { type: 'all', id: null, label: 'All Skills' };
      updateBreadcrumb('All Skills');

      loadTabTree(tab.id, _treeEl);
      fetchAndRenderSkills();
    });
    tabBar.appendChild(btn);
  });

  return tabBar;
}

function buildTopBar() {
  const topBar = createElement('div', { className: 'page-controls' });

  const row1 = createElement('div', { className: 'page-controls-row' });

  const titleGroup = createElement('div', { className: 'page-controls-group' });
  const breadcrumb = createElement('span', { className: 'triage-chip triage-signal', id: 'catalog-breadcrumb' });
  breadcrumb.textContent = 'All Skills';
  titleGroup.appendChild(breadcrumb);
  row1.appendChild(titleGroup);

  const user = Store.get('user');
  if (user && user.role === 'admin') {
    const addBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
    addBtn.textContent = 'Add Skill';
    addBtn.addEventListener('click', () => openSkillModal(null));
    row1.appendChild(addBtn);
  }

  topBar.appendChild(row1);

  const filterBarEl = createElement('div', { className: 'page-controls-filters' });

  const searchWrap = createElement('div', { className: 'catalog-search-wrap' });
  const searchInput = createElement('input', {
    type: 'text',
    placeholder: 'Search skills...',
    id: 'catalog-search',
    className: 'search-input',
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _searchQuery = searchInput.value.trim();
      fetchAndRenderSkills();
    }, 300);
  });
  searchWrap.appendChild(searchInput);
  filterBarEl.appendChild(searchWrap);

  const futureLabel = createElement('label', { className: 'catalog-checkbox-label' });
  const futureCheck = createElement('input', { type: 'checkbox', id: 'filter-future' });
  futureCheck.addEventListener('change', () => {
    _showFuture = futureCheck.checked;
    fetchAndRenderSkills();
  });
  futureLabel.appendChild(futureCheck);
  futureLabel.appendChild(document.createTextNode('Future Skills'));
  filterBarEl.appendChild(futureLabel);

  if (user && user.role === 'admin') {
    const archivedLabel = createElement('label', { className: 'catalog-checkbox-label' });
    const archivedCheck = createElement('input', { type: 'checkbox', id: 'filter-archived' });
    archivedCheck.addEventListener('change', () => {
      _showArchived = archivedCheck.checked;
      fetchAndRenderSkills();
    });
    archivedLabel.appendChild(archivedCheck);
    archivedLabel.appendChild(document.createTextNode('Show Archived'));
    filterBarEl.appendChild(archivedLabel);
  }

  topBar.appendChild(filterBarEl);

  return { el: topBar, filterBarEl };
}

// ─── Sidebar tree loading ─────────────────────────────────────────────────────

async function loadTabTree(tabId, treeEl) {
  // Preserve header
  const header = treeEl.querySelector('.sidebar-tree-header');
  treeEl.innerHTML = '';
  if (header) treeEl.appendChild(header);

  // Show skeleton
  showSkeleton(treeEl, 'list');

  try {
    let treeData;
    if (_treeCache[tabId]) {
      treeData = _treeCache[tabId];
    } else {
      if (tabId === 'org') {
        treeData = await api.get('/api/catalog/org-tree');
      } else if (tabId === 'cert') {
        treeData = await api.get('/api/catalog/cert-tree');
      } else if (tabId === 'non-technical') {
        treeData = await api.get('/api/catalog/org-tree');
      } else if (tabId === 'campaign') {
        treeData = await api.get('/api/catalog/campaign-tree');
      }
      _treeCache[tabId] = treeData;
    }

    // Remove skeleton
    const skelEl = treeEl.querySelector('.skeleton-list');
    if (skelEl) skelEl.remove();
    treeEl.querySelectorAll('.skeleton').forEach(el => el.remove());

    renderTreeForTab(tabId, treeData, treeEl);
  } catch (err) {
    treeEl.querySelectorAll('.skeleton-list, .skeleton').forEach(el => el.remove());
    showToast(err.message || 'Failed to load tree', 'error');
  }
}

function renderTreeForTab(tabId, treeData, treeEl) {
  const data = Array.isArray(treeData) ? treeData : [];

  // "All Skills" node
  const allItem = buildTreeItem('All Skills', null, 0, false);
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
  } else if (tabId === 'campaign') {
    renderCampaignTree(data, treeEl);
  }
}

function renderOrgTree(orgs, treeEl) {
  orgs.forEach(org => {
    const orgItem = buildTreeItem(org.name, 'org', 0, false);
    orgItem.classList.add('expanded');
    if (_selectedFilter.type === 'org_id' && String(_selectedFilter.id) === String(org.id)) {
      orgItem.classList.add('active');
    }

    orgItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectFilter({ type: 'org_id', id: org.id, label: org.name }, orgItem, treeEl);
    });

    addToggleListener(orgItem, treeEl);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    const domains = Array.isArray(org.domains) ? org.domains : [];
    domains.forEach(domain => {
      const domainItem = buildTreeItem(domain.name, 'domain', 1, true);
      domainItem.classList.add('expanded');
      if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
        domainItem.classList.add('active');
      }

      domainItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
      });

      addToggleListener(domainItem, treeEl);

      const domainChildrenEl = createElement('div', { className: 'tree-item-children' });

      const teams = Array.isArray(domain.teams) ? domain.teams : [];
      teams.forEach(team => {
        const teamItem = buildTreeItem(team.name, 'team', 2, false);
        if (_selectedFilter.type === 'team_id' && String(_selectedFilter.id) === String(team.id)) {
          teamItem.classList.add('active');
        }
        teamItem.addEventListener('click', (e) => {
          e.stopPropagation();
          selectFilter({ type: 'team_id', id: team.id, label: team.name }, teamItem, treeEl);
        });
        domainChildrenEl.appendChild(teamItem);
      });

      const shifts = Array.isArray(domain.shifts) ? domain.shifts : [];
      shifts.forEach(shift => {
        const shiftItem = buildTreeItem(shift.name, 'shift', 2, false, '⏱');
        if (_selectedFilter.type === 'shift_id' && String(_selectedFilter.id) === String(shift.id)) {
          shiftItem.classList.add('active');
        }
        shiftItem.addEventListener('click', (e) => {
          e.stopPropagation();
          selectFilter({ type: 'shift_id', id: shift.id, label: shift.name }, shiftItem, treeEl);
        });
        domainChildrenEl.appendChild(shiftItem);
      });

      domainItem.appendChild(domainChildrenEl);
      childrenEl.appendChild(domainItem);
    });

    orgItem.appendChild(childrenEl);
    treeEl.appendChild(orgItem);
  });
}

function renderCertTree(certDomains, treeEl) {
  certDomains.forEach(certDomain => {
    const cdItem = buildTreeItem(certDomain.name, 'cert-domain', 0, true);
    cdItem.classList.add('expanded');

    addToggleListener(cdItem, treeEl);

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

function renderNonTechnicalTree(orgs, treeEl) {
  orgs.forEach(org => {
    const domains = Array.isArray(org.domains) ? org.domains : [];
    const nonTechDomains = domains.filter(d => d.is_technical === false);
    if (!nonTechDomains.length) return;

    const orgItem = buildTreeItem(org.name, 'org', 0, false);
    orgItem.classList.add('expanded');

    addToggleListener(orgItem, treeEl);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    nonTechDomains.forEach(domain => {
      const domainItem = buildTreeItem(domain.name, 'domain', 1, false);
      if (_selectedFilter.type === 'domain_id' && String(_selectedFilter.id) === String(domain.id)) {
        domainItem.classList.add('active');
      }
      domainItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFilter({ type: 'domain_id', id: domain.id, label: domain.name }, domainItem, treeEl);
      });
      childrenEl.appendChild(domainItem);
    });

    orgItem.appendChild(childrenEl);
    treeEl.appendChild(orgItem);
  });
}

function renderCampaignTree(orgs, treeEl) {
  orgs.forEach(org => {
    const orgItem = buildTreeItem(org.name, 'org', 0, false);
    orgItem.classList.add('expanded');

    addToggleListener(orgItem, treeEl);

    const childrenEl = createElement('div', { className: 'tree-item-children' });

    const domains = Array.isArray(org.domains) ? org.domains : [];
    domains.forEach(domain => {
      const domainItem = buildTreeItem(domain.name, 'domain', 1, true);
      domainItem.classList.add('expanded');

      addToggleListener(domainItem, treeEl);

      const domainChildrenEl = createElement('div', { className: 'tree-item-children' });

      const campaigns = Array.isArray(domain.campaigns) ? domain.campaigns : [];
      campaigns.forEach(campaign => {
        const icon = campaign.is_mandatory ? '🔴' : '📋';
        const label = campaign.is_mandatory ? `${campaign.name} (Required)` : campaign.name;
        const campaignItem = buildTreeItem(label, 'campaign', 2, false, icon);

        if (campaign.is_mandatory) {
          const dot = createElement('span', { className: 'tree-mandatory-dot' });
          campaignItem.insertBefore(dot, campaignItem.querySelector('.tree-item-label'));
        }

        if (_selectedFilter.type === 'campaign_id' && String(_selectedFilter.id) === String(campaign.id)) {
          campaignItem.classList.add('active');
        }
        campaignItem.addEventListener('click', (e) => {
          e.stopPropagation();
          selectFilter({ type: 'campaign_id', id: campaign.id, label: campaign.name }, campaignItem, treeEl);
        });
        domainChildrenEl.appendChild(campaignItem);
      });

      domainItem.appendChild(domainChildrenEl);
      childrenEl.appendChild(domainItem);
    });

    orgItem.appendChild(childrenEl);
    treeEl.appendChild(orgItem);
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
  } else if (type === 'org') {
    iconEl.textContent = '🏢';
  } else if (type === 'domain') {
    iconEl.textContent = '📁';
  } else if (type === 'team') {
    iconEl.textContent = '👥';
  } else if (type === 'cert-domain') {
    iconEl.textContent = '🎓';
  } else if (type === 'cert') {
    iconEl.textContent = '🏆';
  } else if (type === 'campaign') {
    iconEl.textContent = '📋';
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

function addToggleListener(item, treeEl) {
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

  updateBreadcrumb(filter.label);
  fetchAndRenderSkills();
}

function updateBreadcrumb(label) {
  const breadcrumb = document.getElementById('catalog-breadcrumb');
  if (breadcrumb) breadcrumb.textContent = label;
}

// ─── API skill fetching ───────────────────────────────────────────────────────

async function fetchAndRenderSkills() {
  if (!_gridEl) return;
  showSkeleton(_gridEl, 'cards');

  try {
    const skills = await api.get('/api/skills/' + buildQueryString());
    renderSkillGrid(_gridEl, Array.isArray(skills) ? skills : []);
  } catch (err) {
    showToast(err.message || 'Failed to load skills', 'error');
    _gridEl.innerHTML = '';
    renderEmptyState(_gridEl, 'Failed to load skills', 'Please try refreshing the page.');
  }
}

function buildQueryString() {
  const params = new URLSearchParams();

  if (_selectedFilter.type !== 'all' && _selectedFilter.id != null) {
    params.set(_selectedFilter.type, String(_selectedFilter.id));
  }

  if (_searchQuery) params.set('search', _searchQuery);
  if (_showArchived) params.set('include_archived', 'true');

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function fetchAndRefreshWithArchived() {
  fetchAndRenderSkills();
}

// ─── Grid rendering ───────────────────────────────────────────────────────────

function renderSkillGrid(container, skills) {
  container.innerHTML = '';

  // Client-side: filter future if not showing
  let regular = skills.filter(s => !s.is_future);
  let future = skills.filter(s => s.is_future);

  if (!_showFuture) {
    future = [];
  }

  const all = regular;

  if (!all.length && !future.length) {
    renderEmptyState(container, 'No skills found', 'Try adjusting your search or filters.');
    return;
  }

  if (all.length) {
    const grid = createElement('div', { className: 'grid-3' });
    all.forEach(skill => grid.appendChild(buildSkillCard(skill)));
    container.appendChild(grid);
  }

  if (future.length) {
    const sep = createElement('div', { className: 'catalog-future-section' });
    const sepHeader = createElement('div', { className: 'catalog-future-header' });
    const sepTitle = createElement('h2', { className: 'catalog-future-title' });
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

// ─── Skill card ───────────────────────────────────────────────────────────────

function buildSkillCard(skill) {
  const user = Store.get('user');
  const isAdmin = user?.role === 'admin';

  const card = createElement('div', {
    className: skill.is_archived ? 'tool-card tool-card--archived' : 'tool-card',
  });
  card.dataset.skillId = skill.id;

  // Header row with name and admin actions
  const headerRow = createElement('div', { className: 'tool-card-header' });
  const nameEl = createElement('div', { className: 'tool-card-name' });
  nameEl.textContent = skill.name;
  headerRow.appendChild(nameEl);

  if (isAdmin) {
    const actions = createElement('div', { className: 'card-admin-actions' });

    const editBtn = createElement('button', { className: 'btn btn-sm btn-secondary card-action-btn' });
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSkillModal(skill);
    });

    const archiveBtn = createElement('button', {
      className: skill.is_archived ? 'btn btn-sm btn-primary card-action-btn' : 'btn btn-sm btn-danger card-action-btn',
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

  // M2M domain badges (primary)
  const domains = Array.isArray(skill.domains) ? skill.domains : [];
  if (domains.length) {
    const domainsRow = createElement('div', { className: 'tool-card-meta-row' });
    domains.forEach(d => {
      const catClass = getDomainBadgeClass(d.name);
      const badge = createElement('span', { className: `tool-card-category ${catClass}` });
      badge.textContent = d.name;
      domainsRow.appendChild(badge);
    });
    card.appendChild(domainsRow);
  } else {
    // Fallback: no domains
    const catBadge = createElement('span', { className: 'tool-card-category cat-research' });
    catBadge.textContent = 'General';
    card.appendChild(catBadge);
  }

  // Org badges (small, muted)
  const orgs = Array.isArray(skill.organisations) ? skill.organisations : [];
  if (orgs.length) {
    const orgsRow = createElement('div', { className: 'tool-card-meta-row' });
    orgs.forEach(org => {
      const badge = createElement('span', { className: 'meta-badge meta-badge--org' });
      badge.textContent = org.name;
      orgsRow.appendChild(badge);
    });
    card.appendChild(orgsRow);
  }

  // Status badges row
  const badgesRow = createElement('div', { className: 'tool-card-badges' });

  if (skill.is_future) {
    const b = createElement('span', { className: 'triage-chip triage-pipeline' });
    b.textContent = 'Future';
    badgesRow.appendChild(b);
  }
  if (skill.is_archived) {
    const b = createElement('span', { className: 'triage-chip triage-blocking' });
    b.textContent = 'Archived';
    badgesRow.appendChild(b);
  }

  // Cert badges
  const certs = Array.isArray(skill.certificates) ? skill.certificates : [];
  certs.forEach(cert => {
    const badge = createElement('span', { className: 'meta-badge meta-badge--cert' });
    badge.textContent = cert.name;
    badgesRow.appendChild(badge);
  });

  // Campaign badges (mandatory highlighted)
  const campaigns = Array.isArray(skill.campaigns) ? skill.campaigns : [];
  campaigns.forEach(camp => {
    const badge = createElement('span', {
      className: camp.is_mandatory ? 'meta-badge meta-badge--campaign-required' : 'meta-badge meta-badge--campaign',
    });
    badge.textContent = camp.is_mandatory ? `${camp.name} ★` : camp.name;
    badgesRow.appendChild(badge);
  });

  if (badgesRow.children.length > 0) card.appendChild(badgesRow);

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
  const closeBtn = createElement('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  modalHeader.appendChild(titleEl);
  modalHeader.appendChild(closeBtn);
  modal.appendChild(modalHeader);

  const modalBody = createElement('div', { className: 'modal-body skill-detail-body' });

  // Detail header with "Assigned To" section
  const detailHeader = createElement('div', { className: 'skill-detail-header' });

  // ── UPDATED: Assigned To section (M2M metadata) ──────────────────────────
  const assignSection = createElement('div', { className: 'skill-detail-assignments' });

  const organisations = Array.isArray(skill.organisations) ? skill.organisations : [];
  const domains = Array.isArray(skill.domains) ? skill.domains : [];
  const teams = Array.isArray(skill.teams) ? skill.teams : [];
  const shifts = Array.isArray(skill.shifts) ? skill.shifts : [];
  const certificates = Array.isArray(skill.certificates) ? skill.certificates : [];
  const campaigns = Array.isArray(skill.campaigns) ? skill.campaigns : [];

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

  const orgRow = buildAssignRow('Orgs', organisations, () => 'meta-badge meta-badge--org');
  if (orgRow) assignSection.appendChild(orgRow);

  const domainRow = buildAssignRow('Domains', domains, (d) => `tool-card-category ${getDomainBadgeClass(d.name)}`);
  if (domainRow) assignSection.appendChild(domainRow);

  const teamRow = buildAssignRow('Teams', teams, () => 'triage-chip triage-signal chip-sm');
  if (teamRow) assignSection.appendChild(teamRow);

  const shiftRow = buildAssignRow('Shifts', shifts, () => 'triage-chip triage-feedback chip-sm');
  if (shiftRow) assignSection.appendChild(shiftRow);

  const certRow = buildAssignRow('Certs', certificates, () => 'meta-badge meta-badge--cert');
  if (certRow) assignSection.appendChild(certRow);

  if (campaigns.length) {
    const campRowEl = createElement('div', { className: 'skill-detail-assign-row' });
    const campLabel = createElement('span', { className: 'skill-detail-assign-label' });
    campLabel.textContent = 'Campaigns';
    campRowEl.appendChild(campLabel);
    campaigns.forEach(camp => {
      const chip = createElement('span', {
        className: camp.is_mandatory ? 'meta-badge meta-badge--campaign-required' : 'meta-badge meta-badge--campaign',
      });
      chip.textContent = camp.is_mandatory ? `${camp.name} (Required)` : camp.name;
      campRowEl.appendChild(chip);
    });
    assignSection.appendChild(campRowEl);
  }

  // Status badges
  const statusRow = createElement('div', { className: 'skill-detail-assign-row' });
  if (skill.is_future) {
    const b = createElement('span', { className: 'triage-chip triage-pipeline' });
    b.textContent = 'Future Skill';
    statusRow.appendChild(b);
  }
  if (skill.is_archived) {
    const b = createElement('span', { className: 'triage-chip triage-blocking' });
    b.textContent = 'Archived';
    statusRow.appendChild(b);
  }
  if (statusRow.children.length) assignSection.appendChild(statusRow);

  if (assignSection.children.length) detailHeader.appendChild(assignSection);
  // ── END Assigned To section ───────────────────────────────────────────────

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
      const chip = createElement('span', { className: 'triage-chip triage-feedback chip-sm' });
      chip.textContent = tag.name || tag;
      tagsRow.appendChild(chip);
    });
    detailHeader.appendChild(tagsRow);
  }

  modalBody.appendChild(detailHeader);

  // ── Education/Exposure/Experience tabs (PRESERVED EXACTLY) ───────────────

  const LEVEL_CONFIG = [
    { key: 'education', label: 'Education', chipClass: 'chip-education' },
    { key: 'exposure', label: 'Exposure', chipClass: 'chip-exposure' },
    { key: 'experience', label: 'Experience', chipClass: 'chip-experience' },
  ];

  const tabBar = createElement('div', { className: 'skill-detail-tabs', role: 'tablist', 'aria-label': 'Skill level content' });
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
    if (e.key === 'Escape') closeModal();

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
          const dragHandle = createElement('span', { className: 'drag-handle', 'aria-hidden': 'true' });
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
        const key = LEVEL_MAP[item.level];
        if (key) freshGroups[key].push(item);
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
      const key = LEVEL_MAP[item.level];
      if (key) groups[key].push(item);
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

// ─── Content Edit Modal (PRESERVED EXACTLY) ──────────────────────────────────

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

// ─── Skill Create/Edit Modal (M2M) ────────────────────────────────────────────

async function openSkillModal(existingSkill) {
  const isEdit = !!existingSkill;

  // Load org/domain/team data for form (cached after first load)
  if (!_formDataCache) {
    try {
      const orgTree = await api.get('/api/catalog/org-tree');
      const orgs = [];
      const domains = [];
      const teams = [];

      (Array.isArray(orgTree) ? orgTree : []).forEach(org => {
        orgs.push({ id: org.id, name: org.name });
        (Array.isArray(org.domains) ? org.domains : []).forEach(d => {
          domains.push({ id: d.id, name: d.name });
          (Array.isArray(d.teams) ? d.teams : []).forEach(t => {
            teams.push({ id: t.id, name: t.name });
          });
        });
      });

      _formDataCache = { orgs, domains, teams };
    } catch (err) {
      showToast('Failed to load form data', 'error');
      return;
    }
  }

  const formEl = buildSkillForm(existingSkill, _formDataCache);

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
        // Invalidate tree cache to pick up any new assignments
        delete _treeCache[_activeTab];
        fetchAndRenderSkills();
      } catch (err) {
        showToast(err.message || 'Failed to save skill', 'error');
      }
    },
  });
}

function buildSkillForm(skill, formData) {
  const form = createElement('div', { className: 'catalog-form' });

  // Name
  form.appendChild(buildFormGroup('Name', 'skill-name', 'input', {
    type: 'text',
    placeholder: 'e.g. Wi-Fi 6 Configuration',
    required: true,
    value: skill?.name || '',
  }, true));

  // Description
  form.appendChild(buildFormGroup('Description', 'skill-desc', 'textarea', {
    placeholder: 'Describe what this skill covers...',
    value: skill?.description || '',
  }));

  // Organisations multi-select
  const existingOrgIds = Array.isArray(skill?.organisations) ? skill.organisations.map(o => String(o.id)) : [];
  const orgsGroup = buildCheckboxGroup('Organisations', 'skill-org-check', formData.orgs, existingOrgIds);
  form.appendChild(orgsGroup);

  // Domains multi-select
  const existingDomainIds = Array.isArray(skill?.domains) ? skill.domains.map(d => String(d.id)) : [];
  const domainsGroup = buildCheckboxGroup('Domains', 'skill-domain-check', formData.domains, existingDomainIds);
  form.appendChild(domainsGroup);

  // Teams multi-select
  const existingTeamIds = Array.isArray(skill?.teams)
    ? skill.teams.map(t => String(t.id))
    : (Array.isArray(skill?.team_ids) ? skill.team_ids.map(String) : []);
  const teamsGroup = buildCheckboxGroup('Teams', 'skill-team-check', formData.teams, existingTeamIds);
  form.appendChild(teamsGroup);

  // Tags
  form.appendChild(buildFormGroup('Tags', 'skill-tags', 'input', {
    type: 'text',
    placeholder: 'e.g. routing, bgp, advanced (comma-separated)',
    value: Array.isArray(skill?.tags) ? skill.tags.map(t => t.name || t).join(', ') : '',
  }));
  const tagHint = createElement('div', { className: 'form-hint catalog-form-hint' });
  tagHint.textContent = 'Separate multiple tags with commas';
  form.appendChild(tagHint);

  // Future checkbox
  const futureGroup = createElement('div', { className: 'form-group' });
  const futureLabel = createElement('label', { className: 'catalog-checkbox-label' });
  const futureCheck = createElement('input', { type: 'checkbox', id: 'skill-future' });
  futureCheck.checked = skill?.is_future || false;
  futureLabel.appendChild(futureCheck);
  futureLabel.appendChild(document.createTextNode('Mark as Future Skill'));
  futureGroup.appendChild(futureLabel);
  form.appendChild(futureGroup);

  return form;
}

function buildCheckboxGroup(labelText, checkClass, items, selectedIds) {
  const group = createElement('div', { className: 'form-group' });
  const label = createElement('div', { className: 'form-label' });
  label.textContent = labelText;
  const grid = createElement('div', { className: 'catalog-teams-grid' });

  items.forEach(item => {
    const checkLabel = createElement('label', { className: 'catalog-check-label' });
    const check = createElement('input', { type: 'checkbox', value: item.id });
    check.className = checkClass;
    check.checked = selectedIds.includes(String(item.id));
    checkLabel.appendChild(check);
    checkLabel.appendChild(document.createTextNode(item.name));
    grid.appendChild(checkLabel);
  });

  group.appendChild(label);
  group.appendChild(grid);
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
  const is_future = formEl.querySelector('#skill-future')?.checked || false;

  const orgChecks = formEl.querySelectorAll('.skill-org-check:checked');
  const organisation_ids = Array.from(orgChecks).map(c => Number(c.value));

  const domainChecks = formEl.querySelectorAll('.skill-domain-check:checked');
  const domain_ids = Array.from(domainChecks).map(c => Number(c.value));

  const teamChecks = formEl.querySelectorAll('.skill-team-check:checked');
  const team_ids = Array.from(teamChecks).map(c => Number(c.value));

  const tagsRaw = formEl.querySelector('#skill-tags')?.value.trim() || '';
  const tag_names = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  return { name, description, is_future, organisation_ids, domain_ids, team_ids, tag_names };
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

// ─── Utility helpers ──────────────────────────────────────────────────────────

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

const DOMAIN_CAT_CLASSES = ['cat-wireless', 'cat-research', 'cat-case', 'cat-config', 'cat-platform', 'cat-bdb', 'cat-cve', 'cat-bug'];

function getDomainBadgeClass(domainName) {
  if (!domainName) return 'cat-research';
  // Simple hash of the name string for deterministic color assignment
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = (hash * 31 + domainName.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % DOMAIN_CAT_CLASSES.length;
  return DOMAIN_CAT_CLASSES[idx];
}
