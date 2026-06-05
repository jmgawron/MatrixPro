import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { el } from '../utils/dom.js';
import { getSkillIconSVG } from '../components/icons.js';
import { openLibraryModal } from '../components/library-modal.js';
import { openReportingModal } from './my-plan-reports.js?v=3';
import { renderDescription } from '../components/markdown-editor.js';

let _container = null;
let _engineerId = null;
let _planData = null;
let _draggingPlanSkillId = null;
let _sectionGridEls = {};
let _allCatalogSkills = [];
let _searchQuery = '';
let _currentSection = 'developing';
let _activeDomainFilters = new Set();
let _active3EFilters = new Set();
let _activeProficiencyFilters = new Set();
let _categoriesCache = null;
let _categoriesInitialized = false;
let _activeCategoryFilters = new Set();

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
  refresh: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  circle: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  circleCheck: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  blocks: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  gear: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  zap: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sparkles: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z"/><path d="M19 17l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"/><path d="M5 4l.7 1.5L7 6l-1.3.5L5 8l-.7-1.5L3 6l1.3-.5L5 4z"/></svg>',
  target: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  diamond: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/><path d="M9 3 6 9l6 12"/><path d="m15 3 3 6-6 12"/></svg>',
  trophy: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  atom: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>',
  pillars: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M3 20V8l9-5 9 5v12"/><path d="M7 20V10"/><path d="M12 20V10"/><path d="M17 20V10"/><path d="M3 8h18"/></svg>',
  seedling: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12c0-4 3-7 8-7-1 5-4 7-8 7z"/><path d="M12 14c0-3-2-5-6-5 1 4 3 5 6 5z"/></svg>',
};

function svgIcon(name, size) {
  const span = document.createElement('span');
  span.className = 'mp-icon';
  span.style.fontSize = size || '16px';
  span.innerHTML = SVG_ICONS[name] || '';
  return span;
}

const SECTIONS = [
  { status: 'developing', title: 'Developing', subtitle: 'Actively building these skills', svgIcon: 'wrench', iconClass: 'mp-card-icon--dev' },
  { status: 'planned', title: 'Planned', subtitle: 'Queued and waiting to start', svgIcon: 'layers', iconClass: 'mp-card-icon--pipe' },
  { status: 'mastered', title: 'Mastered', subtitle: 'Completed — skill fully acquired', svgIcon: 'shield', iconClass: 'mp-card-icon--prof' },
];

const STATUS_LABELS = {
  planned: 'Planned',
  developing: 'Developing',
  mastered: 'Mastered',
};

export function mountMyPlan(container, params) {
  _container = container;
  container.innerHTML = '';

  _planData = null;
  _draggingPlanSkillId = null;
  _sectionGridEls = {};
  _allCatalogSkills = [];
  _searchQuery = '';
  _currentSection = 'developing';
  _activeDomainFilters.clear();
  _active3EFilters.clear();
  _activeProficiencyFilters.clear();
  _categoriesCache = null;
  _categoriesInitialized = false;
  _activeCategoryFilters.clear();

  const user = Store.get('user');
  _engineerId = params?.id ? Number(params.id) : user?.id;

  buildPageShell(container, params);
  loadPlan();

  return () => {};
}

async function getCategories() {
  if (_categoriesCache) return _categoriesCache;
  try {
    _categoriesCache = await api.get('/api/skills/categories');
  } catch {
    _categoriesCache = [];
  }
  return _categoriesCache;
}

async function loadPlan() {
  Object.values(_sectionGridEls).forEach(grid => showSkeleton(grid, 'cards'));

  try {
    const [planRes, cats] = await Promise.all([
      api.get(`/api/plans/${_engineerId}`),
      getCategories()
    ]);
    _planData = planRes;
    if (!_categoriesInitialized && cats.length > 0) {
      cats.forEach(c => _activeCategoryFilters.add(c.id));
      _categoriesInitialized = true;
    }
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
    const [planRes, cats] = await Promise.all([
      api.get(`/api/plans/${_engineerId}`),
      getCategories()
    ]);
    _planData = planRes;
    if (!_categoriesInitialized && cats.length > 0) {
      cats.forEach(c => _activeCategoryFilters.add(c.id));
      _categoriesInitialized = true;
    }
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
  const headerText = el('div', { className: 'mp-header-text' });
  const title = el('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('My Development '));
  const gradientSpan = el('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Plan';
  title.appendChild(gradientSpan);
  const subtitle = el('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Track and manage your skill development journey';
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);

  const statsRow = el('div', { className: 'stats-row', id: 'mp-stats-row' });
  header.appendChild(statsRow);
  wrapper.appendChild(header);

  const planLayout = el('div', { className: 'mp-plan-layout' });
  const sidebar = el('aside', { className: 'mp-plan-sidebar' });

  SECTIONS.forEach(({ status, title: sTitle, svgIcon: sIcon }) => {
    const btn = el('button', { className: 'mp-plan-nav-btn' + (status === _currentSection ? ' active' : '') });
    btn.dataset.status = status;
    btn.appendChild(svgIcon(sIcon, '16px'));
    const btnText = el('span', { className: 'mp-plan-nav-label' });
    btnText.textContent = sTitle;
    btn.appendChild(btnText);
    const countBadge = el('span', { className: 'mp-nav-count', id: `mp-nav-count-${status}` });
    countBadge.textContent = '0';
    btn.appendChild(countBadge);

    btn.addEventListener('click', () => {
      _currentSection = status;
      sidebar.querySelectorAll('.mp-plan-nav-btn[data-status]').forEach(b => {
        b.classList.toggle('active', b.dataset.status === status);
      });
      renderActiveSection();
    });

    btn.addEventListener('dragover', (e) => {
      if (_draggingPlanSkillId) {
        e.preventDefault();
        btn.classList.add('drag-over');
      }
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('drag-over');
      const planSkillId = Number(e.dataTransfer.getData('planSkillId'));
      const fromStatus = e.dataTransfer.getData('fromStatus');
      if (!planSkillId || fromStatus === status) return;
      handleMoveCard(planSkillId, status);
    });

    sidebar.appendChild(btn);
  });

  const sep = el('hr', { className: 'mp-plan-sidebar-sep' });
  sidebar.appendChild(sep);

  const actionContainer = el('div', { className: 'mp-sidebar-actions' });

  const addBtn = el('button', { className: 'btn btn-primary btn--sidebar' });
  addBtn.innerHTML = SVG_ICONS.search + '<span>Add Skill</span>';
  addBtn.addEventListener('click', showAddSkillMenu);
  actionContainer.appendChild(addBtn);

  const reportBtn = el('button', { className: 'btn btn-secondary btn--sidebar' });
  reportBtn.innerHTML = SVG_ICONS.fileText + '<span>Reporting</span>';
  reportBtn.addEventListener('click', () => {
    const user = Store.get('user');
    const name = _planData?.engineer_name || user?.name || '';
    openReportingModal(_engineerId, name);
  });
  actionContainer.appendChild(reportBtn);

  sidebar.appendChild(actionContainer);

  const sep2 = el('hr', { className: 'mp-plan-sidebar-sep' });
  sidebar.appendChild(sep2);

  const quickFiltersHeader = el('div', { className: 'mp-filters-header' });
  const quickFiltersTitle = el('span', { className: 'mp-filters-title' });
  quickFiltersTitle.textContent = 'Quick Filters';
  const quickFiltersClear = el('a', { className: 'mp-filters-clear', id: 'mp-filters-clear' });
  quickFiltersClear.textContent = 'Clear';
  quickFiltersClear.style.display = 'none';
  quickFiltersClear.addEventListener('click', (e) => {
    e.preventDefault();
    _activeDomainFilters.clear();
    _active3EFilters.clear();
    _activeProficiencyFilters.clear();
    renderSections();
  });
  quickFiltersHeader.appendChild(quickFiltersTitle);
  quickFiltersHeader.appendChild(quickFiltersClear);
  sidebar.appendChild(quickFiltersHeader);

  const filtersContainer = el('div', { className: 'mp-quick-filters', id: 'mp-quick-filters' });
  sidebar.appendChild(filtersContainer);

  planLayout.appendChild(sidebar);

  const content = el('main', { className: 'mp-plan-content' });

  const contentHeader = el('div', { className: 'mp-plan-content-header' });
  const contentTitleWrap = el('div', { className: 'mp-plan-content-title-wrap' });
  const contentTitle = el('h2', { className: 'mp-plan-content-title', id: 'mp-content-title' });
  const activeSectionDef = SECTIONS.find(s => s.status === _currentSection);
  contentTitle.textContent = activeSectionDef?.title || 'Developing';
  const contentCount = el('span', { className: 'mp-nav-count mp-nav-count--header', id: 'mp-content-count' });
  contentCount.textContent = '0';
  contentTitleWrap.appendChild(contentTitle);
  contentTitleWrap.appendChild(contentCount);
  contentHeader.appendChild(contentTitleWrap);

  const categoryToolbarSlot = el('div', { className: 'mp-filter-chips mp-filter-chips--inline', id: 'mp-category-toolbar' });
  contentHeader.appendChild(categoryToolbarSlot);

  const searchWrap = el('div', { className: 'mp-plan-search-wrap' });
  const searchIcon = el('span', { className: 'mp-search-icon' });
  searchIcon.appendChild(svgIcon('search', '14px'));
  const searchInput = el('input', {
    className: 'search-input',
    type: 'text',
    placeholder: 'Search skills...',
    id: 'mp-search-input',
  });
  let debounce = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      _searchQuery = searchInput.value.trim().toLowerCase();
      renderSections();
    }, 200);
  });
  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(searchInput);
  contentHeader.appendChild(searchWrap);
  content.appendChild(contentHeader);

  const section = el('div', { className: 'mp-section', id: 'mp-active-section' });
  section.dataset.status = _currentSection;

  const grid = el('div', { className: 'mp-section-grid', id: `mp-grid-${_currentSection}` });
  _sectionGridEls[_currentSection] = grid;

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
    if (!planSkillId || fromStatus === _currentSection) return;
    handleMoveCard(planSkillId, _currentSection);
  });

  section.appendChild(grid);
  content.appendChild(section);
  planLayout.appendChild(content);
  wrapper.appendChild(planLayout);

  container.appendChild(wrapper);
}

function _applyFilters(skills) {
  let filtered = _searchQuery
    ? skills.filter(s => (s.skill_name || '').toLowerCase().includes(_searchQuery))
    : skills;

  if (_activeDomainFilters.size > 0) {
    filtered = filtered.filter(s => {
      if (!s.domains || !Array.isArray(s.domains)) return false;
      return s.domains.some(d => _activeDomainFilters.has(d.id));
    });
  }

  if (_active3EFilters.size > 0) {
    filtered = filtered.filter(s => {
      if (!s.focus_area) return true;
      return _active3EFilters.has(s.focus_area);
    });
  }

  if (_activeProficiencyFilters.size > 0) {
    filtered = filtered.filter(s => _activeProficiencyFilters.has(s.proficiency_level));
  }

  return filtered;
}

function renderActiveSection() {
  if (!_planData) return;

  const skills = Array.isArray(_planData.skills) ? _planData.skills : [];
  const filtered = _applyFilters(skills);

  const contentTitle = document.getElementById('mp-content-title');
  const contentCount = document.getElementById('mp-content-count');
  const activeDef = SECTIONS.find(s => s.status === _currentSection);
  if (contentTitle) contentTitle.textContent = activeDef?.title || _currentSection;

  const activeSkills = filtered.filter(s => s.status === _currentSection);
  if (contentCount) contentCount.textContent = String(activeSkills.length);

  const sectionEl = document.getElementById('mp-active-section');
  if (sectionEl) {
    sectionEl.innerHTML = '';
    sectionEl.dataset.status = _currentSection;

    const container = el('div', { className: 'mp-category-groups-container', id: `mp-grid-${_currentSection}` });
    sectionEl.appendChild(container);
    _sectionGridEls[_currentSection] = container;
  }

  const toolbar = document.getElementById('mp-category-toolbar');
  if (toolbar) {
    toolbar.innerHTML = '';
    if (_categoriesCache && _categoriesCache.length > 0) {
      const iconMap = {
        foundational: 'seedling',
        core: 'diamond',
        advanced: 'atom',
        ai_future: 'sparkles',
        'ai-future': 'sparkles',
      };
      _categoriesCache.forEach(cat => {
        const isActive = _activeCategoryFilters.has(cat.id);
        const chip = el('button', { className: 'mp-filter-chip' });
        chip.dataset.category = cat.slug || '';
        if (isActive) chip.classList.add('active');
        const iconName = iconMap[cat.slug] || 'layers';
        chip.appendChild(svgIcon(iconName, '14px'));
        const label = el('span', { className: 'mp-filter-chip__label' });
        label.textContent = cat.name;
        chip.appendChild(label);
        chip.addEventListener('click', () => {
          if (isActive) _activeCategoryFilters.delete(cat.id);
          else _activeCategoryFilters.add(cat.id);
          renderActiveSection();
        });
        toolbar.appendChild(chip);
      });
    }
  }

  const container = document.getElementById(`mp-grid-${_currentSection}`);
  if (!container) return;

  container.innerHTML = '';

  if (activeSkills.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--inline' });
    empty.textContent = _searchQuery || _activeDomainFilters.size > 0 || _active3EFilters.size > 0 || _activeProficiencyFilters.size > 0
      ? 'No matching skills in this section.'
      : 'No skills yet — browse the catalog to get started!';
    container.appendChild(empty);
    return;
  }

  const sectionDef = SECTIONS.find(s => s.status === _currentSection);

  const groups = new Map();
  const uncategorized = [];

  activeSkills.forEach(planSkill => {
    const cats = planSkill.categories || planSkill.skill?.categories || [];
    if (cats.length === 0) {
      uncategorized.push(planSkill);
    } else {
      cats.forEach(cat => {
        if (_activeCategoryFilters.has(cat.id)) {
          if (!groups.has(cat.id)) groups.set(cat.id, { cat, skills: [] });
          groups.get(cat.id).skills.push(planSkill);
        }
      });
    }
  });

  const sortedGroups = Array.from(groups.values()).sort((a, b) => a.cat.sort_order - b.cat.sort_order);
  const allGroups = [];
  sortedGroups.forEach(g => allGroups.push({ id: g.cat.id, slug: g.cat.slug, name: g.cat.name, skills: g.skills }));
  if (uncategorized.length > 0) {
    allGroups.push({ id: 'uncategorized', slug: 'uncategorized', name: 'Uncategorized', skills: uncategorized });
  }

  if (allGroups.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--inline' });
    empty.textContent = 'No skills matching selected categories.';
    container.appendChild(empty);
    return;
  }

  const groupIconMap = {
    foundational: 'seedling',
    core: 'diamond',
    advanced: 'atom',
    ai_future: 'sparkles',
    'ai-future': 'sparkles',
  };

  allGroups.forEach(g => {
    const groupEl = el('div', { className: 'mp-category-group' });

    const header = el('div', { className: 'mp-category-group__header' });
    const iconName = groupIconMap[g.slug] || 'layers';
    const iconEl = svgIcon(iconName, '14px');
    iconEl.classList.add('mp-category-group__icon');
    header.appendChild(iconEl);
    const nameSpan = el('span', { className: 'mp-category-group__name' });
    nameSpan.textContent = g.name;
    const countSpan = el('span', { className: 'mp-category-group__count' });
    countSpan.textContent = String(g.skills.length);
    header.appendChild(nameSpan);
    header.appendChild(countSpan);
    groupEl.appendChild(header);

    const cardsEl = el('div', { className: 'mp-category-group__cards mp-section-grid' });
    g.skills.forEach(planSkill => {
      const card = buildCard(planSkill, _currentSection, sectionDef?.iconClass || 'mp-card-icon--dev');
      cardsEl.appendChild(card);
    });
    groupEl.appendChild(cardsEl);
    
    container.appendChild(groupEl);
  });

  // Fetch progress for all skill cards
  document.querySelectorAll('.mp-card[data-plan-skill-id]').forEach(card => {
    const psId = card.dataset.planSkillId;
    api.get(`/api/plans/${_engineerId}/skills/${psId}/content`).then(data => {
      const total = data.total_items || 0;
      const completed = data.completed_items || 0;
      const pct = total > 0 ? Math.round((completed / total) * 100) : null;
      updateCardGauge(card, pct, completed, total);
    }).catch(() => {});
  });
}

function renderQuickFilters() {
  const container = document.getElementById('mp-quick-filters');
  const clearBtn = document.getElementById('mp-filters-clear');
  if (!container) return;

  if (_activeDomainFilters.size > 0 || _active3EFilters.size > 0 || _activeProficiencyFilters.size > 0) {
    if (clearBtn) clearBtn.style.display = '';
  } else {
    if (clearBtn) clearBtn.style.display = 'none';
  }

  container.innerHTML = '';

  const skills = Array.isArray(_planData?.skills) ? _planData.skills : [];
  const domainsMap = new Map();
  skills.forEach(s => {
    if (s.domains && Array.isArray(s.domains)) {
      s.domains.forEach(d => domainsMap.set(d.id, d.name));
    }
  });

  if (domainsMap.size > 0) {
    const domainWrap = el('div', { className: 'mp-filter-group' });
    const domainTitle = el('div', { className: 'mp-filter-label' });
    domainTitle.textContent = 'Domains';
    domainWrap.appendChild(domainTitle);
    
    const chipContainer = el('div', { className: 'mp-filter-chips' });
    const sortedDomains = Array.from(domainsMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    
    sortedDomains.forEach(([id, name]) => {
      const chip = el('button', { className: 'mp-filter-chip' });
      if (_activeDomainFilters.has(id)) chip.classList.add('active');
      chip.textContent = name;
      chip.addEventListener('click', () => {
        if (_activeDomainFilters.has(id)) {
          _activeDomainFilters.delete(id);
        } else {
          _activeDomainFilters.add(id);
        }
        renderSections();
      });
      chipContainer.appendChild(chip);
    });
    
    domainWrap.appendChild(chipContainer);
    container.appendChild(domainWrap);
  }

  const eWrap = el('div', { className: 'mp-filter-group' });
  const eTitle = el('div', { className: 'mp-filter-label' });
  eTitle.textContent = '3E Framework';
  eWrap.appendChild(eTitle);
  
  const eContainer = el('div', { className: 'mp-3e-filters' });
  
  const eTypes = [
    {
      id: 'education', label: 'Education', class: 'filter-education',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
    },
    {
      id: 'exposure', label: 'Exposure', class: 'filter-exposure',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>'
    },
    {
      id: 'experience', label: 'Experience', class: 'filter-experience',
      svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    }
  ];
  
  eTypes.forEach(t => {
    const btn = el('button', { className: `mp-3e-btn ${t.class}` });
    if (_active3EFilters.has(t.id)) btn.classList.add('active');
    
    const iconWrap = el('div', { className: 'mp-3e-icon' });
    iconWrap.innerHTML = t.svg;
    
    const label = el('span', { className: 'mp-3e-label' });
    label.textContent = t.label;
    
    btn.appendChild(iconWrap);
    btn.appendChild(label);
    
    btn.addEventListener('click', () => {
      if (_active3EFilters.has(t.id)) {
        _active3EFilters.delete(t.id);
      } else {
        _active3EFilters.add(t.id);
      }
      renderSections();
    });
    
    eContainer.appendChild(btn);
  });
  
  eWrap.appendChild(eContainer);
  container.appendChild(eWrap);

  const profWrap = el('div', { className: 'mp-filter-group' });
  const profTitle = el('div', { className: 'mp-filter-label' });
  profTitle.textContent = 'Proficiency';
  profWrap.appendChild(profTitle);
  
  const profChips = el('div', { className: 'mp-filter-chips' });
  [1, 2, 3, 4, 5].forEach(lvl => {
    const chip = el('button', { className: 'mp-filter-chip mp-prof-filter-chip' });
    if (_activeProficiencyFilters.has(lvl)) chip.classList.add('active');
    chip.textContent = `${lvl}`;
    chip.addEventListener('click', () => {
      if (_activeProficiencyFilters.has(lvl)) {
        _activeProficiencyFilters.delete(lvl);
      } else {
        _activeProficiencyFilters.add(lvl);
      }
      renderSections();
    });
    profChips.appendChild(chip);
  });
  
  profWrap.appendChild(profChips);
  container.appendChild(profWrap);
}

function renderSections() {
  if (!_planData) return;

  const bannerLabel = document.getElementById('manager-banner-label');
  if (bannerLabel && _planData.engineer_name) {
    bannerLabel.textContent = `Viewing ${_planData.engineer_name}'s plan`;
  }

  renderQuickFilters();

  const skills = Array.isArray(_planData.skills) ? _planData.skills : [];
  const filtered = _applyFilters(skills);

  const groups = {
    developing: filtered.filter(s => s.status === 'developing'),
    planned: filtered.filter(s => s.status === 'planned'),
    mastered: filtered.filter(s => s.status === 'mastered'),
  };

  updateStatsRow(skills, groups);

  SECTIONS.forEach(({ status }) => {
    const navCount = document.getElementById(`mp-nav-count-${status}`);
    if (navCount) navCount.textContent = String(groups[status].length);
  });

  renderActiveSection();
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
    { value: groups.developing.length, label: 'Developing', icon: 'wrench' },
    { value: groups.mastered.length, label: 'Mastered', icon: 'checkCircle' },
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
  if (planSkill.is_custom) {
    icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>';
    icon.style.color = 'var(--text-muted)';
    icon.style.background = 'var(--bg-tertiary)';
  } else if (planSkill.skill_icon) {
    const svg = getSkillIconSVG(planSkill.skill_icon, 20);
    if (svg) {
      icon.innerHTML = svg;
    } else {
      icon.textContent = skillName.charAt(0);
    }
  } else {
    icon.textContent = skillName.charAt(0);
  }
  top.appendChild(icon);

  const info = el('div', { className: 'mp-card-info' });
  const nameEl = el('div', { className: 'mp-card-name' });
  nameEl.textContent = skillName;
  info.appendChild(nameEl);

  if (planSkill.is_orphaned) {
    const orphanBadge = el('div', { className: 'mp-card__orphan-badge', title: 'This skill was removed from the catalog. Your progress and training logs are preserved.' });
    orphanBadge.textContent = 'Personal — removed from catalog';
    info.appendChild(orphanBadge);
  }

  const badgeWrap = el('div', { className: 'mp-card-badge' });
  const profLabel = el('span', { className: 'mp-card-prof-label' });
  profLabel.textContent = 'Proficiency';
  badgeWrap.appendChild(profLabel);
  badgeWrap.appendChild(buildProficiencyBadge(planSkill.proficiency_level));
  info.appendChild(badgeWrap);
  top.appendChild(info);

  const gaugeWrap = buildProgressGauge(null);
  top.appendChild(gaugeWrap);

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

  card._gaugeEl = gaugeWrap;

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

  const focusArea = planSkill.focus_area || '';

  if (focusArea) {
    const indicators = el('span', { className: 'mp-card-3e-indicators' });
    if (focusArea === 'education') {
      const dot = el('span', { className: 'mp-card-3e-dot mp-card-3e-dot--edu', title: 'Education' });
      dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';
      indicators.appendChild(dot);
    } else if (focusArea === 'exposure') {
      const dot = el('span', { className: 'mp-card-3e-dot mp-card-3e-dot--exp', title: 'Exposure' });
      dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
      indicators.appendChild(dot);
    } else if (focusArea === 'experience') {
      const dot = el('span', { className: 'mp-card-3e-dot mp-card-3e-dot--xp', title: 'Experience' });
      dot.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      indicators.appendChild(dot);
    }
    footer.appendChild(indicators);
  }

  card.appendChild(footer);

  const barWrap = el('div', { className: 'mp-card-progress-bar-wrap' });
  const bar = el('div', { className: 'mp-card-progress-bar' });
  barWrap.appendChild(bar);
  card.appendChild(barWrap);
  
  card._barEl = bar;

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
  if (!level || level < 1 || level > 5) {
    const badge = el('span', { className: 'triage-chip chip-pipeline' });
    badge.textContent = '—';
    badge.style.fontSize = '11px';
    badge.style.padding = '2px 8px';
    return badge;
  }

  const mapping = {
    1: { label: 'Beginner', bg: 'rgba(148,163,184,.15)', text: '#94a3b8', border: 'rgba(148,163,184,.3)' },
    2: { label: 'Working', bg: 'rgba(34,197,94,.15)', text: '#4ade80', border: 'rgba(34,197,94,.3)' },
    3: { label: 'Intermediate', bg: 'rgba(6,182,212,.15)', text: '#22d3ee', border: 'rgba(6,182,212,.3)' },
    4: { label: 'Advanced', bg: 'rgba(168,85,247,.15)', text: '#c084fc', border: 'rgba(168,85,247,.3)' },
    5: { label: 'Expert', bg: 'rgba(234,179,8,.15)', text: '#eab308', border: 'rgba(234,179,8,.3)' }
  };
  const m = mapping[level];
  const badge = el('span', { className: 'triage-chip mp-prof-badge' });
  badge.textContent = `${level}`;
  badge.title = m.label;
  badge.style.background = m.bg;
  badge.style.color = m.text;
  badge.style.border = `1px solid ${m.border}`;
  badge.style.fontSize = '11px';
  badge.style.padding = '2px 8px';
  return badge;
}

function buildProgressGauge(percent) {
  const wrap = el('div', { className: 'mp-card-progress-gauge' });
  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', '100');
  
  const size = 34;
  const radius = 14;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 32 32');
  
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', '16');
  bgCircle.setAttribute('cy', '16');
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.08)');
  bgCircle.setAttribute('stroke-width', '2.5');
  
  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', '16');
  progressCircle.setAttribute('cy', '16');
  progressCircle.setAttribute('r', radius);
  progressCircle.setAttribute('fill', 'none');
  progressCircle.setAttribute('stroke-width', '2.5');
  progressCircle.setAttribute('stroke-linecap', 'round');
  progressCircle.style.transform = 'rotate(-90deg)';
  progressCircle.style.transformOrigin = '50% 50%';
  progressCircle.style.transition = 'stroke-dasharray 0.5s ease, stroke 0.5s ease';
  
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '16');
  text.setAttribute('y', '16');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', '9px');
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', 'currentColor');
  
  svg.appendChild(bgCircle);
  svg.appendChild(progressCircle);
  svg.appendChild(text);
  wrap.appendChild(svg);
  
  updateGaugeElements(wrap, percent, progressCircle, text);
  return wrap;
}

function updateGaugeElements(wrap, percent, progressCircle, text) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  
  if (percent === null || percent === undefined) {
    progressCircle.setAttribute('stroke-dasharray', `0 ${circumference}`);
    progressCircle.setAttribute('stroke', 'transparent');
    text.textContent = '—';
    wrap.removeAttribute('aria-valuenow');
  } else {
    const dash = (percent / 100) * circumference;
    progressCircle.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
    
    let color = '#94a3b8';
    if (percent >= 100) color = '#4ade80';
    else if (percent >= 67) color = '#22d3ee';
    else if (percent >= 34) color = '#3b82f6';
    
    progressCircle.setAttribute('stroke', color);
    text.textContent = `${Math.round(percent)}%`;
    wrap.setAttribute('aria-valuenow', Math.round(percent));
  }
}

function updateCardGauge(card, percent, completed, total) {
  if (!card._gaugeEl || !card._barEl) return;
  const svg = card._gaugeEl.querySelector('svg');
  if (!svg) return;
  const progressCircle = svg.querySelector('circle:nth-child(2)');
  const text = svg.querySelector('text');
  
  updateGaugeElements(card._gaugeEl, percent, progressCircle, text);
  
  if (percent === null || percent === undefined) {
    card._barEl.style.width = '0%';
  } else {
    card._barEl.style.width = `${Math.round(percent)}%`;
  }
}

function showCardActionsMenu(e, planSkill, currentStatus) {
  document.querySelectorAll('.card-actions-menu').forEach(m => m.remove());

  const menu = el('div', {
    className: 'card-actions-menu mp-context-menu',
  });

  const statusFlow = ['planned', 'developing', 'mastered'];
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

  const LEVEL_CONFIG = [
    { key: 'education', level: 1, label: 'Education' },
    { key: 'exposure', level: 2, label: 'Exposure' },
    { key: 'experience', level: 3, label: 'Experience' },
  ];
  const LEVEL_MAP = { 1: 'education', 2: 'exposure', 3: 'experience' };
  const FOCUS_ORDER = ['education', 'exposure', 'experience'];
  const FOCUS_TO_LEVEL = { education: 1, exposure: 2, experience: 3 };
  const FOCUS_TREE_DEFAULTS = {
    education: {
      education: { visible: true, expanded: true, canToggle: false, isFocus: true },
      exposure: { visible: false },
      experience: { visible: false },
    },
    exposure: {
      education: { visible: true, expanded: false, canToggle: true, isFocus: false },
      exposure: { visible: true, expanded: true, canToggle: false, isFocus: true },
      experience: { visible: false },
    },
    experience: {
      education: { visible: true, expanded: false, canToggle: true, isFocus: false },
      exposure: { visible: true, expanded: false, canToggle: true, isFocus: false },
      experience: { visible: true, expanded: true, canToggle: false, isFocus: true },
    },
  };

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal skill-detail-modal mp-plan-modal sdm-plan-modal' });
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${planSkill.skill_name || 'Skill'} — Details`);

  const body = el('div', { className: 'modal-body sdm-modal-body' });

  /* ── Header ─────────────────────────────────────────────────────────── */
  const headerBlock = el('header', { className: 'sdm-header' });
  const headerTop = el('div', { className: 'sdm-header__top' });
  const titleEl = el('h1', { className: 'sdm-header__title' });
  titleEl.textContent = planSkill.skill_name || 'Skill Details';

  const headerActions = el('div', { className: 'sdm-header__actions' });

  const resyncBtn = el('button', {
    className: 'btn btn-secondary btn-sm sdm-resync-btn',
    'aria-label': 'Re-sync from catalog',
    title: 'Re-sync hidden items from catalog',
  });
  resyncBtn.innerHTML = SVG_ICONS.refresh;

  const closeBtn = el('button', { className: 'sdm-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';

  headerActions.appendChild(resyncBtn);
  headerActions.appendChild(closeBtn);
  headerTop.appendChild(titleEl);
  headerTop.appendChild(headerActions);
  headerBlock.appendChild(headerTop);

  if (planSkill.is_orphaned) {
    const orphanBadge = el('div', {
      className: 'mp-card__orphan-badge sdm-orphan-badge',
      title: 'This skill was removed from the catalog. Your progress and training logs are preserved.',
    });
    orphanBadge.textContent = 'Personal — removed from catalog';
    headerBlock.appendChild(orphanBadge);
  }

  const notesText = (planSkill.notes || '').trim();
  const notesEl = el('p', { className: 'sdm-notes' });
  if (notesText) {
    notesEl.textContent = notesText;
  } else {
    notesEl.classList.add('sdm-notes--empty');
  }

  const notesToggle = el('button', { type: 'button', className: 'sdm-notes-toggle' });
  notesToggle.textContent = 'Show more';
  notesToggle.hidden = true;

  let notesExpanded = false;
  function updateNotesDisplay() {
    if (!notesText) {
      notesToggle.hidden = true;
      return;
    }
    notesEl.textContent = notesText;
    const lineOverflow = notesText.length > 140;
    notesToggle.hidden = !lineOverflow;
    notesToggle.classList.toggle('visible', lineOverflow);
    notesToggle.textContent = notesExpanded ? 'Show less' : 'Show more';
    notesEl.classList.toggle('sdm-notes--long', notesExpanded);
  }
  updateNotesDisplay();

  notesToggle.addEventListener('click', () => {
    notesExpanded = !notesExpanded;
    updateNotesDisplay();
  });

  headerBlock.appendChild(notesEl);
  headerBlock.appendChild(notesToggle);

  const categories = Array.isArray(planSkill.categories) ? planSkill.categories : [];
  if (categories.length) {
    const catRow = el('div', { className: 'sdm-header-categories' });
    const editIconMap = {
      foundational: 'seedling',
      core: 'diamond',
      advanced: 'atom',
      ai_future: 'sparkles',
      'ai-future': 'sparkles',
    };
    categories.forEach(cat => {
      const chip = el('span', { className: 'mp-modal-category-chip' });
      const ic = svgIcon(editIconMap[cat.slug] || 'layers', '14px');
      ic.classList.add('mp-modal-category-chip__icon');
      chip.appendChild(ic);
      const name = el('span', { className: 'mp-modal-category-chip__name' });
      name.textContent = cat.name;
      chip.appendChild(name);
      catRow.appendChild(chip);
    });
    headerBlock.appendChild(catRow);
  }

  /* ── Compact controls row ───────────────────────────────────────────── */
  const controlsRow = el('div', { className: 'sdm-controls' });

  const statusWrap = el('div', { className: 'sdm-control' });
  const statusLabel = el('label', { for: 'sdm-status-select' });
  statusLabel.textContent = 'Status';
  const statusSelect = el('select', { id: 'sdm-status-select' });
  [
    { value: 'planned', label: 'Planned' },
    { value: 'developing', label: 'Developing' },
    { value: 'mastered', label: 'Mastered' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    statusSelect.appendChild(opt);
  });
  statusWrap.appendChild(statusLabel);
  statusWrap.appendChild(statusSelect);

  const focusWrap = el('div', { className: 'sdm-control' });
  const focusLabel = el('label', { for: 'sdm-focus-select' });
  focusLabel.textContent = 'Focus area';
  const focusSelect = el('select', { id: 'sdm-focus-select' });
  LEVEL_CONFIG.forEach(({ key, label }) => {
    const opt = el('option', { value: key });
    opt.textContent = label;
    focusSelect.appendChild(opt);
  });
  focusWrap.appendChild(focusLabel);
  focusWrap.appendChild(focusSelect);

  const profWrap = el('div', { className: 'sdm-control' });
  const profLabel = el('label', { for: 'sdm-prof-select' });
  profLabel.textContent = 'Skill proficiency';
  const profSelect = el('select', { id: 'sdm-prof-select' });
  const profEmpty = el('option', { value: '' });
  profEmpty.textContent = 'Not set';
  profSelect.appendChild(profEmpty);
  [
    { value: '1', label: '1 — Beginner' },
    { value: '2', label: '2 — Working knowledge' },
    { value: '3', label: '3 — Intermediate' },
    { value: '4', label: '4 — Advanced' },
    { value: '5', label: '5 — Expert' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    profSelect.appendChild(opt);
  });
  profWrap.appendChild(profLabel);
  profWrap.appendChild(profSelect);

  const progressWrap = el('div', { className: 'sdm-control sdm-controls__progress' });
  const progressLabel = el('label');
  progressLabel.textContent = 'Overall progress';
  const progressRow = el('div', { className: 'sdm-progress-row' });
  const progressBarWrap = el('div', { className: 'sdm-progress-bar-wrap' });
  const progressBar = el('div', { className: 'sdm-progress-bar' });
  const progressText = el('span', { className: 'sdm-progress-text' });
  progressText.textContent = '—';
  progressBarWrap.appendChild(progressBar);
  progressRow.appendChild(progressBarWrap);
  progressRow.appendChild(progressText);
  progressWrap.appendChild(progressLabel);
  progressWrap.appendChild(progressRow);

  controlsRow.appendChild(statusWrap);
  controlsRow.appendChild(focusWrap);
  controlsRow.appendChild(profWrap);
  controlsRow.appendChild(progressWrap);
  headerBlock.appendChild(controlsRow);
  body.appendChild(headerBlock);

  /* ── Master–detail main area ────────────────────────────────────────── */
  const mainArea = el('div', { className: 'sdm-main' });

  const listCol = el('div', { className: 'sdm-list-col' });
  const listScroll = el('div', { className: 'sdm-list-scroll' });
  const listFooter = el('div', { className: 'sdm-list-footer' });
  const addMyItemBtn = el('button', { type: 'button', className: 'btn btn-secondary sdm-add-btn' });
  addMyItemBtn.textContent = '+ Add My Item';
  listFooter.appendChild(addMyItemBtn);
  listCol.appendChild(listScroll);
  listCol.appendChild(listFooter);

  const readerCol = el('div', { className: 'sdm-reader-col' });
  const readerToolbar = el('div', { className: 'sdm-reader-toolbar' });
  const readerToolbarLeft = el('div', { className: 'sdm-reader-toolbar__left' });

  const completeBtn = el('button', { type: 'button', className: 'sdm-complete-btn' });
  const completeIcon = el('span', { className: 'sdm-complete-btn__icon' });
  completeIcon.innerHTML = SVG_ICONS.circle;
  const completeLabel = el('span');
  completeLabel.textContent = 'Mark complete';
  completeBtn.appendChild(completeIcon);
  completeBtn.appendChild(completeLabel);
  readerToolbarLeft.appendChild(completeBtn);

  const readerActions = el('div', { className: 'sdm-reader-actions' });
  readerToolbarLeft.appendChild(readerActions);

  const readerMeta = el('div', { className: 'sdm-reader-meta' });
  readerToolbar.appendChild(readerToolbarLeft);
  readerToolbar.appendChild(readerMeta);

  const readerScroll = el('div', { className: 'sdm-reader-scroll' });
  const readerContent = el('div', { className: 'sdm-reader-content' });
  readerScroll.appendChild(readerContent);
  readerCol.appendChild(readerToolbar);
  readerCol.appendChild(readerScroll);

  mainArea.appendChild(listCol);
  mainArea.appendChild(readerCol);
  body.appendChild(mainArea);

  /* ── Training log strip ─────────────────────────────────────────────── */
  const logPanel = el('div', { className: 'sdm-log' });
  const logToggle = el('button', { type: 'button', className: 'sdm-log__toggle', 'aria-expanded': 'false' });
  const logTitle = el('span', { className: 'sdm-log__title' });
  logTitle.textContent = 'Training log';
  const logCountBadge = el('span', { className: 'sdm-log__count' });
  const logChevron = el('span', { className: 'sdm-log__chevron', 'aria-hidden': 'true' });
  logChevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  logToggle.appendChild(logTitle);
  logToggle.appendChild(logCountBadge);
  logToggle.appendChild(logChevron);

  const logBody = el('div', { className: 'sdm-log__body' });
  const logListEl = el('div', { className: 'sdm-log__list' });
  logBody.appendChild(logListEl);
  logPanel.appendChild(logToggle);
  logPanel.appendChild(logBody);
  body.appendChild(logPanel);

  modal.appendChild(body);

  const footer = el('div', { className: 'modal-footer sdm-footer' });
  const footerStatus = el('span', { className: 'sdm-footer__status' });
  footerStatus.textContent = 'No pending changes';
  const discardBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
  discardBtn.textContent = 'Discard';
  const saveBtn = el('button', { type: 'button', className: 'btn btn-primary' });
  saveBtn.textContent = 'Save skill details';
  saveBtn.disabled = true;
  footer.appendChild(footerStatus);
  footer.appendChild(discardBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  root.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    closeBtn.focus();
  });

  /* ── State ──────────────────────────────────────────────────────────── */
  let allContentItems = [];
  let selectedItemKey = null;
  let visibleLogCount = 5;
  let contentLoading = true;
  let manualExpanded = {};

  const saved = {
    status: planSkill.status,
    focus: planSkill.focus_area || 'education',
    prof: String(planSkill.proficiency_level ?? ''),
    completions: {},
  };

  const pending = {
    status: saved.status,
    focus: saved.focus,
    prof: saved.prof,
    completions: {},
  };

  statusSelect.value = pending.status;
  focusSelect.value = pending.focus;
  profSelect.value = pending.prof;

  function itemKey(item) {
    return `${item.is_user_content ? 'u' : 'c'}-${item.id}`;
  }

  function resetTreeForFocus() {
    manualExpanded = {};
  }

  function getSectionTreeState(sectionKey) {
    const def = FOCUS_TREE_DEFAULTS[pending.focus]?.[sectionKey];
    if (!def?.visible) return null;
    const expanded = def.canToggle
      ? (manualExpanded[sectionKey] ?? def.expanded)
      : def.expanded;
    return { ...def, expanded };
  }

  function visibleSectionKeys() {
    return FOCUS_ORDER.filter(key => getSectionTreeState(key));
  }

  function visibleItems() {
    return allContentItems
      .filter(item => visibleSectionKeys().includes(LEVEL_MAP[item.level]))
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  }

  function selectableItems() {
    return allContentItems
      .filter(item => {
        const state = getSectionTreeState(LEVEL_MAP[item.level]);
        return state && state.expanded;
      })
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  }

  function ensureSelectedItemVisible() {
    if (selectedItemKey && selectableItems().some(i => itemKey(i) === selectedItemKey)) {
      return;
    }
    const first = selectableItems()[0];
    selectedItemKey = first ? itemKey(first) : null;
  }

  function isCompletionDirty(key) {
    return pending.completions[key] !== saved.completions[key];
  }

  function isDirty() {
    if (pending.status !== saved.status) return true;
    if (pending.focus !== saved.focus) return true;
    if (pending.prof !== saved.prof) return true;
    return allContentItems.some(item => isCompletionDirty(itemKey(item)));
  }

  function updateDirtyUI() {
    const dirty = isDirty();
    modal.classList.toggle('dirty', dirty);
    saveBtn.disabled = !dirty;
    footerStatus.textContent = dirty
      ? 'Pending changes — click Save skill details to apply'
      : 'No pending changes';

    statusSelect.classList.toggle('pending', pending.status !== saved.status);
    focusSelect.classList.toggle('pending', pending.focus !== saved.focus);
    profSelect.classList.toggle('pending', pending.prof !== saved.prof);
  }

  function updateProgress() {
    const items = visibleItems();
    const done = items.filter(item => pending.completions[itemKey(item)]).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = `${pct}%`;
    progressText.textContent = total > 0 ? `${done} / ${total}` : '—';
  }

  function getSelectedItem() {
    if (!selectedItemKey) return null;
    return allContentItems.find(item => itemKey(item) === selectedItemKey) || null;
  }

  function renderList() {
    listScroll.innerHTML = '';

    if (contentLoading) {
      const sk = el('div', { className: 'skeleton-list' });
      for (let i = 0; i < 4; i++) sk.appendChild(el('div', { className: 'skeleton skeleton-row' }));
      listScroll.appendChild(sk);
      return;
    }

    const itemsBySection = {};
    visibleSectionKeys().forEach(key => { itemsBySection[key] = []; });
    visibleItems().forEach(item => {
      const key = LEVEL_MAP[item.level];
      if (itemsBySection[key]) itemsBySection[key].push(item);
    });

    let hasAny = false;
    visibleSectionKeys().forEach(secKey => {
      const items = itemsBySection[secKey];
      if (!items.length) return;
      hasAny = true;

      const state = getSectionTreeState(secKey);
      const cfg = LEVEL_CONFIG.find(l => l.key === secKey);
      const sectionClasses = ['sdm-tree-section'];
      if (!state.expanded) sectionClasses.push('sdm-tree-section--collapsed');
      if (!state.canToggle) sectionClasses.push('sdm-tree-section--locked');
      if (state.isFocus) sectionClasses.push('sdm-tree-section--focus');

      const section = el('div', { className: sectionClasses.join(' ') });

      const hdr = el('button', {
        type: 'button',
        className: 'sdm-tree-section__header',
        'aria-expanded': String(state.expanded),
      });
      const toggleGlyph = el('span', { className: 'sdm-tree-section__toggle', 'aria-hidden': 'true' });
      toggleGlyph.textContent = state.expanded ? '\u2212' : '+';
      const hdrLabel = el('span', { className: 'sdm-tree-section__label' });
      hdrLabel.textContent = cfg.label;
      const done = items.filter(i => pending.completions[itemKey(i)]).length;
      const hdrCount = el('span', { className: 'sdm-tree-section__count' });
      hdrCount.textContent = `${done}/${items.length}`;
      hdr.appendChild(toggleGlyph);
      hdr.appendChild(hdrLabel);
      hdr.appendChild(hdrCount);

      hdr.addEventListener('click', () => {
        const current = getSectionTreeState(secKey);
        if (!current?.canToggle) return;
        manualExpanded[secKey] = !current.expanded;
        ensureSelectedItemVisible();
        renderList();
        renderReader();
      });

      section.appendChild(hdr);

      const body = el('div', { className: 'sdm-tree-section__body' });

      items.forEach(item => {
        const key = itemKey(item);
        const row = el('div', {
          className: 'sdm-list-item'
            + (key === selectedItemKey ? ' active' : '')
            + (isCompletionDirty(key) ? ' pending-complete' : '')
            + (pending.completions[key] ? ' completed' : ''),
        });

        const check = el('button', {
          type: 'button',
          className: 'sdm-list-check' + (pending.completions[key] ? ' done' : ''),
          'aria-label': 'Toggle completion (pending until save)',
        });
        check.innerHTML = pending.completions[key] ? SVG_ICONS.circleCheck : SVG_ICONS.circle;
        check.addEventListener('click', (e) => {
          e.stopPropagation();
          pending.completions[key] = !pending.completions[key];
          updateProgress();
          renderList();
          if (selectedItemKey === key) renderReader();
          updateDirtyUI();
        });

        const textWrap = el('button', { type: 'button', className: 'sdm-list-item__body' });
        const titleSpan = el('span', { className: 'sdm-list-item__title' });
        titleSpan.textContent = item.title || 'Untitled';
        const metaSpan = el('span', { className: 'sdm-list-item__meta' });
        const metaParts = [item.type || 'resource'];
        if (item.is_user_content) metaParts.push('My item');
        metaSpan.textContent = metaParts.join(' · ');
        textWrap.appendChild(titleSpan);
        textWrap.appendChild(metaSpan);
        textWrap.addEventListener('click', () => {
          selectedItemKey = key;
          renderList();
          renderReader();
        });

        row.appendChild(check);
        row.appendChild(textWrap);
        body.appendChild(row);
      });

      section.appendChild(body);
      listScroll.appendChild(section);
    });

    if (!hasAny) {
      const empty = el('div', { className: 'empty-state empty-state--compact' });
      empty.textContent = 'No content items for the selected focus area.';
      listScroll.appendChild(empty);
    }

    ensureSelectedItemVisible();
  }

  function renderReaderActions(item) {
    readerActions.innerHTML = '';
    if (!item) return;

    const isUserItem = !!item.is_user_content;

    if (isUserItem) {
      const editBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        'aria-label': 'Edit item',
        title: 'Edit',
      });
      editBtn.innerHTML = SVG_ICONS.pencil;
      editBtn.addEventListener('click', () => {
        const levelKey = LEVEL_MAP[item.level] || 'education';
        openLibraryModal({ mode: 'edit', item, planSkill, engineerId: _engineerId, levelKey }, () => refreshContent());
      });

      const delBtn = el('button', {
        type: 'button',
        className: 'btn btn-danger btn-sm',
        'aria-label': 'Delete item',
        title: 'Delete',
      });
      delBtn.textContent = '\u2715';
      delBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(`Delete "${item.title}"? This cannot be undone.`, true);
        if (!confirmed) return;
        try {
          await api.del(`/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${item.id}`);
          showToast('Item deleted', 'success');
          refreshContent();
        } catch (err) {
          showToast(err.message || 'Failed to delete item', 'error');
        }
      });

      readerActions.appendChild(editBtn);
      readerActions.appendChild(delBtn);
    } else {
      const notesBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
      notesBtn.textContent = item.has_override ? 'Edit My Notes' : 'Add My Notes';
      notesBtn.addEventListener('click', () => {
        openOverrideEditor(item, planSkill, () => refreshContent());
      });

      const hideBtn = el('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        'aria-label': 'Hide item',
        title: 'Hide from my view',
      });
      hideBtn.textContent = '\u2715';
      hideBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          `Hide "${item.title}" from your view? You can restore it later with the re-sync button.`,
          true,
        );
        if (!confirmed) return;
        hideBtn.disabled = true;
        try {
          await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/content/${item.id}/hide`, {});
          showToast('Item hidden', 'success');
          refreshContent();
        } catch (err) {
          showToast(err.message || 'Failed to hide item', 'error');
        } finally {
          hideBtn.disabled = false;
        }
      });

      readerActions.appendChild(notesBtn);
      readerActions.appendChild(hideBtn);
    }
  }

  function renderReader() {
    readerContent.innerHTML = '';
    readerActions.innerHTML = '';
    const item = getSelectedItem();

    if (!item || contentLoading || !selectableItems().some(i => itemKey(i) === selectedItemKey)) {
      readerToolbar.hidden = true;
      readerContent.innerHTML = '<p class="sdm-reader-empty">Select an item to view content.</p>';
      return;
    }

    readerToolbar.hidden = false;
    const key = itemKey(item);
    const done = !!pending.completions[key];
    const dirty = isCompletionDirty(key);
    const cfg = LEVEL_CONFIG.find(l => l.level === item.level) || LEVEL_CONFIG[0];

    completeBtn.className = 'sdm-complete-btn'
      + (done ? ' done' : '')
      + (dirty ? ' pending' : '');
    completeIcon.innerHTML = done ? SVG_ICONS.circleCheck : SVG_ICONS.circle;
    completeLabel.textContent = done
      ? (dirty ? 'Complete (unsaved)' : 'Completed')
      : 'Mark complete';

    readerMeta.innerHTML = '';
    const metaLine = el('span');
    metaLine.textContent = `${cfg.label} · ${item.type || 'resource'}`;
    readerMeta.appendChild(metaLine);
    if (dirty) {
      const pendingHint = el('span', { className: 'sdm-reader-meta__pending' });
      pendingHint.textContent = 'Change pending save';
      readerMeta.appendChild(pendingHint);
    }
    if (item.completed_at && done) {
      const dateLine = el('span', { className: 'sdm-reader-meta__date' });
      dateLine.textContent = formatDate(item.completed_at);
      readerMeta.appendChild(dateLine);
    }

    renderReaderActions(item);

    const titleH = el('h2', { className: 'sdm-reader-title' });
    titleH.textContent = item.title || 'Untitled';
    readerContent.appendChild(titleH);

    if (item.is_user_content) {
      const prose = el('div', { className: 'sdm-reader-prose' });
      prose.innerHTML = renderDescription(item.description, item.description_format || 'markdown');
      readerContent.appendChild(prose);
    } else if (item.description) {
      const prose = el('div', { className: 'sdm-reader-prose' });
      prose.innerHTML = item.override_description || item.description;
      readerContent.appendChild(prose);
    }

    if (item.url) {
      const link = el('a', {
        className: 'skill-detail-accordion-link sdm-reader-link',
        href: item.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      link.textContent = 'Open resource';
      readerContent.appendChild(link);
    }

    if (item.is_user_content) {
      const badge = el('span', { className: 'mp-user-content-badge' });
      badge.textContent = 'My item';
      readerContent.appendChild(badge);
    } else if (item.has_override) {
      const badge = el('span', { className: 'mp-override-badge' });
      badge.textContent = 'Modified';
      readerContent.appendChild(badge);
    }
  }

  function renderLogList() {
    logListEl.innerHTML = '';
    const currentLogs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    logCountBadge.textContent = `${currentLogs.length} ${currentLogs.length === 1 ? 'entry' : 'entries'}`;

    if (!currentLogs.length) {
      const emptyLog = el('div', { className: 'empty-state empty-state--compact' });
      emptyLog.textContent = 'No training log entries yet.';
      logListEl.appendChild(emptyLog);
      return;
    }

    const reversedLogs = currentLogs.slice().reverse();
    reversedLogs.slice(0, visibleLogCount).forEach(log => {
      logListEl.appendChild(buildTrainingLogEntry(log));
    });

    if (currentLogs.length > visibleLogCount) {
      const remaining = currentLogs.length - visibleLogCount;
      const moreBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm sdm-log-more' });
      moreBtn.textContent = `Show more (${remaining} remaining)`;
      moreBtn.addEventListener('click', () => {
        visibleLogCount += 5;
        renderLogList();
      });
      logListEl.appendChild(moreBtn);
    }
  }

  function syncCompletionStateFromItems() {
    allContentItems.forEach(item => {
      const key = itemKey(item);
      saved.completions[key] = !!item.completed;
    });
    pending.completions = { ...saved.completions };
  }

  function refreshContent() {
    contentLoading = true;
    selectedItemKey = selectedItemKey;
    renderList();
    renderReader();

    api.get(`/api/plans/${_engineerId}/skills/${planSkill.id}/content`).then(data => {
      contentLoading = false;
      allContentItems = (Array.isArray(data.items) ? data.items : [])
        .filter(item => item && item.title && String(item.title).trim() !== '' && [1, 2, 3, 4, 5].includes(item.level));

      syncCompletionStateFromItems();

      if (!selectedItemKey) {
        const first = visibleItems()[0];
        selectedItemKey = first ? itemKey(first) : null;
      }

      renderList();
      renderReader();
      updateProgress();
      updateDirtyUI();
    }).catch(() => {
      contentLoading = false;
      listScroll.innerHTML = '';
      const errEl = el('div', { className: 'empty-state empty-state--compact' });
      errEl.textContent = 'Unable to load content.';
      listScroll.appendChild(errEl);
      readerToolbar.hidden = true;
      readerContent.innerHTML = '<p class="sdm-reader-empty">Unable to load content.</p>';
    });
  }

  function discardChanges() {
    pending.status = saved.status;
    pending.focus = saved.focus;
    pending.prof = saved.prof;
    pending.completions = { ...saved.completions };
    statusSelect.value = saved.status;
    focusSelect.value = saved.focus;
    profSelect.value = saved.prof;
    updateDirtyUI();
    renderList();
    renderReader();
    updateProgress();
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
    renderSections();
  }

  async function doSave() {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await api.put(`/api/plans/${_engineerId}/skills/${planSkill.id}`, {
        status: pending.status,
        proficiency_level: pending.prof ? Number(pending.prof) : null,
        focus_area: pending.focus,
        notes: planSkill.notes || null,
      });

      for (const item of allContentItems) {
        const key = itemKey(item);
        if (pending.completions[key] === saved.completions[key]) continue;

        const endpoint = item.is_user_content
          ? `/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${item.id}/complete`
          : `/api/plans/${_engineerId}/skills/${planSkill.id}/content/${item.id}/complete`;
        await api.post(endpoint, {});
      }

      showToast('Skill details saved', 'success');
      await reloadPlan();
      closeModal();
    } catch (err) {
      showToast(err.message || 'Failed to save changes', 'error');
      saveBtn.disabled = !isDirty();
      saveBtn.textContent = 'Save skill details';
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (isDirty()) {
        showToast('Save or discard pending changes before closing', 'warning');
        return;
      }
      closeModal();
    }
  }

  statusSelect.addEventListener('change', () => {
    pending.status = statusSelect.value;
    updateDirtyUI();
  });

  focusSelect.addEventListener('change', () => {
    pending.focus = focusSelect.value;
    resetTreeForFocus();
    renderList();
    renderReader();
    updateProgress();
    updateDirtyUI();
  });

  profSelect.addEventListener('change', () => {
    pending.prof = profSelect.value;
    updateDirtyUI();
  });

  completeBtn.addEventListener('click', () => {
    const item = getSelectedItem();
    if (!item) return;
    const key = itemKey(item);
    pending.completions[key] = !pending.completions[key];
    updateProgress();
    renderList();
    renderReader();
    updateDirtyUI();
  });

  addMyItemBtn.addEventListener('click', () => {
    const levelKey = pending.focus || 'education';
    const level = FOCUS_TO_LEVEL[levelKey] || 1;
    openLibraryModal({ mode: 'create', planSkill, engineerId: _engineerId, levelKey, level }, () => refreshContent());
  });

  logToggle.addEventListener('click', () => {
    const open = logPanel.classList.toggle('open');
    logToggle.setAttribute('aria-expanded', String(open));
  });

  resyncBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm(
      'Restore all hidden catalog items for this skill? This will bring back any items you previously dismissed.',
      true,
    );
    if (!confirmed) return;
    resyncBtn.disabled = true;
    try {
      const resp = await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/resync`, {});
      showToast(resp.detail || 'Catalog items restored', 'success');
      refreshContent();
    } catch (err) {
      showToast(err.message || 'Failed to re-sync', 'error');
    } finally {
      resyncBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', doSave);

  discardBtn.addEventListener('click', async () => {
    if (!isDirty()) return;
    const confirmed = await showConfirm('Discard all pending changes?', true);
    if (confirmed) discardChanges();
  });

  closeBtn.addEventListener('click', async () => {
    if (isDirty()) {
      const action = await showConfirm('You have unsaved changes. Save before closing?');
      if (action) { await doSave(); return; }
      const discard = await showConfirm('Discard pending changes and close?', true);
      if (!discard) return;
      discardChanges();
    }
    closeModal();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !isDirty()) closeModal();
  });

  document.addEventListener('keydown', onKeyDown);

  renderLogList();
  refreshContent();
  updateDirtyUI();
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

const TRAINING_LOG_BADGE_LABELS = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  added: 'Added',
  updated: 'Updated',
  removed: 'Removed',
  moved: 'Moved',
};

function parseTrainingLogTitle(rawTitle) {
  const title = (rawTitle || '').trim();
  const patterns = [
    { re: /^uncompleted:\s*(.+)$/i, action: 'incomplete' },
    { re: /^marked incomplete:\s*(.+)$/i, action: 'incomplete' },
    { re: /^completed:\s*(.+)$/i, action: 'completed' },
    { re: /^marked complete:\s*(.+)$/i, action: 'completed' },
  ];
  for (const { re, action } of patterns) {
    const match = title.match(re);
    if (match) return { action, label: match[1].trim() };
  }
  return { action: null, label: title || 'Untitled' };
}

function inferTrainingLogBadge(log) {
  const parsed = parseTrainingLogTitle(log.title);
  if (parsed.action) return parsed.action;

  const title = (log.title || '').toLowerCase();
  if (title.includes('moved from') || title.startsWith('moved')) return 'moved';
  if (title.startsWith('added') || title.includes('imported')) return 'added';
  if (title.startsWith('hidden') || title.startsWith('removed') || title.startsWith('deleted')) return 'removed';
  if (title.startsWith('updated') || title.includes('override')) return 'updated';
  return 'updated';
}

function buildTrainingLogEntry(log) {
  const parsed = parseTrainingLogTitle(log.title);
  const badgeType = parsed.action || inferTrainingLogBadge(log);
  const entry = el('div', { className: 'sdm-log-entry' });

  const badge = el('span', { className: `sdm-log-badge sdm-log-badge--${badgeType}` });
  badge.textContent = TRAINING_LOG_BADGE_LABELS[badgeType] || badgeType;
  entry.appendChild(badge);

  const textWrap = el('div', { className: 'sdm-log-entry__text' });
  const titleEl = el('strong');
  titleEl.textContent = parsed.label;
  textWrap.appendChild(titleEl);

  if (log.completed_at) {
    const timeEl = el('span', { className: 'sdm-log-entry__time' });
    timeEl.textContent = formatDate(log.completed_at);
    textWrap.appendChild(timeEl);
  }

  if (log.notes) {
    const notesEl = el('span', { className: 'sdm-log-entry__time' });
    notesEl.textContent = log.notes;
    textWrap.appendChild(notesEl);
  }

  entry.appendChild(textWrap);
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

function showAddSkillMenu(e) {
  document.querySelectorAll('.mp-add-skill-menu').forEach(m => m.remove());

  const menu = el('div', { className: 'mp-add-skill-menu mp-context-menu' });

  const ownItem = el('button', { className: 'mp-context-menu-item' });
  ownItem.appendChild(svgIcon('circle', '16px'));
  const ownLabel = el('span');
  ownLabel.textContent = 'Own Skill';
  ownItem.appendChild(ownLabel);
  ownItem.addEventListener('mouseenter', () => { ownItem.style.background = 'var(--bg-hover)'; });
  ownItem.addEventListener('mouseleave', () => { ownItem.style.background = 'none'; });
  ownItem.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    openOwnSkillModal();
  });
  menu.appendChild(ownItem);

  const teamItem = el('button', { className: 'mp-context-menu-item' });
  const teamIconSpan = el('span', { className: 'mp-icon' });
  teamIconSpan.style.fontSize = '16px';
  teamIconSpan.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  teamItem.appendChild(teamIconSpan);
  const teamLabel = el('span');
  teamLabel.textContent = "My Team's Skills";
  teamItem.appendChild(teamLabel);
  teamItem.addEventListener('mouseenter', () => { teamItem.style.background = 'var(--bg-hover)'; });
  teamItem.addEventListener('mouseleave', () => { teamItem.style.background = 'none'; });
  teamItem.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    window.location.hash = '#/catalog?addMode=team';
  });
  menu.appendChild(teamItem);

  const catalogItem = el('button', { className: 'mp-context-menu-item' });
  catalogItem.appendChild(svgIcon('bookOpen', '16px'));
  const catalogLabel = el('span');
  catalogLabel.textContent = 'From Catalog';
  catalogItem.appendChild(catalogLabel);
  catalogItem.addEventListener('mouseenter', () => { catalogItem.style.background = 'var(--bg-hover)'; });
  catalogItem.addEventListener('mouseleave', () => { catalogItem.style.background = 'none'; });
  catalogItem.addEventListener('click', (ev) => {
    ev.stopPropagation();
    menu.remove();
    window.location.hash = '#/catalog?addMode=all';
  });
  menu.appendChild(catalogItem);

  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.minWidth = '180px';

  document.body.appendChild(menu);

  const dismiss = (ev) => {
    if (!menu.contains(ev.target)) {
      menu.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);
}

function openOwnSkillModal() {
  const bodyEl = el('div', { className: 'mp-own-skill-body' });

  const nameGroup = el('div', { className: 'form-group' });
  const nameLabel = el('label', { className: 'form-label' });
  nameLabel.textContent = 'Name *';
  const nameInput = el('input', { type: 'text', className: 'form-input', placeholder: 'Skill name' });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  bodyEl.appendChild(nameGroup);

  const descGroup = el('div', { className: 'form-group' });
  const descLabel = el('label', { className: 'form-label' });
  descLabel.textContent = 'Description';
  const descInput = el('textarea', { className: 'form-textarea', rows: '3', placeholder: 'Optional description...' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descInput);
  bodyEl.appendChild(descGroup);

  const statusGroup = el('div', { className: 'form-group' });
  const statusLabel = el('label', { className: 'form-label' });
  statusLabel.textContent = 'Status';
  const statusSelect = el('select', { className: 'form-select' });
  [
    { value: 'planned', label: 'Planned' },
    { value: 'developing', label: 'Developing' },
    { value: 'mastered', label: 'Mastered' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    if (value === 'planned') opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  bodyEl.appendChild(statusGroup);

  const profGroup = el('div', { className: 'form-group' });
  const profLabel = el('label', { className: 'form-label' });
  profLabel.textContent = 'Skill Proficiency Level';
  const profSelect = el('select', { className: 'form-select' });
  [
    { value: '', label: 'Not set' },
    { value: '1', label: '1 — Beginner' },
    { value: '2', label: '2 — Working Knowledge' },
    { value: '3', label: '3 — Intermediate' },
    { value: '4', label: '4 — Advanced' },
    { value: '5', label: '5 — Expert' },
  ].forEach(({ value, label }) => {
    const opt = el('option', { value });
    opt.textContent = label;
    profSelect.appendChild(opt);
  });
  profGroup.appendChild(profLabel);
  profGroup.appendChild(profSelect);
  bodyEl.appendChild(profGroup);

  const notesGroup = el('div', { className: 'form-group' });
  const notesLabel = el('label', { className: 'form-label' });
  notesLabel.textContent = 'Notes';
  const notesInput = el('textarea', { className: 'form-textarea', rows: '3', placeholder: 'Optional notes...' });
  notesGroup.appendChild(notesLabel);
  notesGroup.appendChild(notesInput);
  bodyEl.appendChild(notesGroup);

  showModal({
    title: 'Create Own Skill',
    body: bodyEl,
    confirmText: 'Create Skill',
    cancelText: 'Cancel',
    onConfirm: async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Skill name is required', 'error');
        return false;
      }
      const profVal = profSelect.value;
      try {
        await api.post(`/api/plans/${_engineerId}/own-skills`, {
          name,
          description: descInput.value.trim() || null,
          status: statusSelect.value,
          proficiency_level: profVal ? Number(profVal) : null,
          notes: notesInput.value.trim() || null,
        });
        showToast('Own skill created', 'success');
        await reloadPlan();
      } catch (err) {
        showToast(err.message || 'Failed to create own skill', 'error');
        return false;
      }
    },
  });
}


function showPermissionError(msg) {
  const contentEl = _container.querySelector('.mp-plan-content');
  if (!contentEl) return;
  contentEl.innerHTML = '';
  const errDiv = el('div', {
    className: 'empty-state empty-state--error',
  });
  const title = el('div', { className: 'empty-state-title' });
  title.textContent = "You don't have permission to view this plan";
  const desc = el('div', { className: 'empty-state-desc' });
  desc.textContent = msg || 'Contact your manager or administrator for access.';
  errDiv.appendChild(title);
  errDiv.appendChild(desc);
  contentEl.appendChild(errDiv);
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
