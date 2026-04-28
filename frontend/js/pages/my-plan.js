import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { el } from '../utils/dom.js';
import { getSkillIconSVG } from '../components/icons.js';

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
  reportBtn.addEventListener('click', openReportingModal);
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
    sectionEl.dataset.status = _currentSection;
    const oldGrid = sectionEl.querySelector('.mp-section-grid');
    if (oldGrid) oldGrid.remove();
    const newGrid = el('div', { className: 'mp-section-grid', id: `mp-grid-${_currentSection}` });
    sectionEl.appendChild(newGrid);
    _sectionGridEls = { [_currentSection]: newGrid };
  }

  const grid = document.getElementById(`mp-grid-${_currentSection}`);
  if (!grid) return;

  grid.innerHTML = '';

  if (activeSkills.length === 0) {
    const empty = el('div', { className: 'empty-state empty-state--inline' });
    empty.textContent = _searchQuery || _activeDomainFilters.size > 0 || _active3EFilters.size > 0 || _activeProficiencyFilters.size > 0
      ? 'No matching skills in this section.'
      : 'No skills yet — browse the catalog to get started!';
    grid.appendChild(empty);
    return;
  }

  const sectionDef = SECTIONS.find(s => s.status === _currentSection);
  activeSkills.forEach(planSkill => {
    const card = buildCard(planSkill, _currentSection, sectionDef?.iconClass || 'mp-card-icon--dev');
    grid.appendChild(card);
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

  const badgeWrap = el('div', { className: 'mp-card-badge' });
  const profLabel = el('span', { className: 'mp-card-prof-label' });
  profLabel.textContent = 'Skill Proficiency';
  badgeWrap.appendChild(profLabel);
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
  const statusSelector = el('div', { className: 'mp-modal-status-selector' });
  let currentStatus = planSkill.status;

  const statusOptions = [
    { value: 'planned', label: 'Planned', icon: SVG_ICONS.layers },
    { value: 'developing', label: 'Developing', icon: SVG_ICONS.wrench },
    { value: 'mastered', label: 'Mastered', icon: SVG_ICONS.shield },
  ];

  statusOptions.forEach(({ value, label, icon }) => {
    const btn = el('button', { className: 'mp-modal-status-btn', 'data-status': value });
    if (currentStatus === value) btn.classList.add('active');
    
    const iconSpan = el('span', { className: 'mp-icon' });
    iconSpan.innerHTML = icon;
    btn.appendChild(iconSpan);
    
    const textSpan = el('span');
    textSpan.textContent = label;
    btn.appendChild(textSpan);
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentStatus = value;
      statusSelector.querySelectorAll('.mp-modal-status-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.status === value);
      });
    });
    
    statusSelector.appendChild(btn);
  });
  
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelector);
  formCol.appendChild(statusGroup);

  const levelGroup = el('div', { className: 'form-group' });
  const levelLabel = el('label', { className: 'form-label' });
  levelLabel.textContent = 'Focus Area';
  const levelSelector = el('div', { className: 'mp-modal-prof-selector' });
  let currentLevel = planSkill.focus_area || '';

  const levelOptions = [
    { value: 'education', label: 'Education', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    { value: 'exposure', label: 'Exposure', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>' },
    { value: 'experience', label: 'Experience', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  ];

  levelOptions.forEach(({ value, label, icon }) => {
    const btn = el('button', { className: 'mp-modal-prof-btn', 'data-level': value });
    if (currentLevel === value) btn.classList.add('active');
    
    if (icon) {
      const iconSpan = el('span', { className: 'mp-icon' });
      iconSpan.innerHTML = icon;
      btn.appendChild(iconSpan);
    }
    
    const textSpan = el('span');
    textSpan.textContent = label;
    btn.appendChild(textSpan);
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentLevel === value) {
        currentLevel = '';
        btn.classList.remove('active');
      } else {
        currentLevel = value;
        levelSelector.querySelectorAll('.mp-modal-prof-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.level === value);
        });
      }
      refreshContent();
    });
    
    levelSelector.appendChild(btn);
  });

  levelGroup.appendChild(levelLabel);
  levelGroup.appendChild(levelSelector);
  formCol.appendChild(levelGroup);

  const profLevelGroup = el('div', { className: 'form-group' });
  const profLevelLabel = el('label', { className: 'form-label' });
  profLevelLabel.textContent = 'Skill Proficiency Level';
  const profLevelSelector = el('div', { className: 'mp-modal-proflevel-selector' });
  let currentProfLevel = String(planSkill.proficiency_level ?? '');

  const profLevelOptions = [
    { value: '1', label: '1', tooltip: 'Beginner' },
    { value: '2', label: '2', tooltip: 'Working Knowledge' },
    { value: '3', label: '3', tooltip: 'Intermediate' },
    { value: '4', label: '4', tooltip: 'Advanced' },
    { value: '5', label: '5', tooltip: 'Expert' },
  ];

  profLevelOptions.forEach(({ value, label, tooltip }) => {
    const btn = el('button', { className: 'mp-proflevel-btn', 'data-level': value, title: `${label} — ${tooltip}` });
    if (currentProfLevel === value) btn.classList.add('active');
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentProfLevel === value) {
        currentProfLevel = '';
        btn.classList.remove('active');
      } else {
        currentProfLevel = value;
        profLevelSelector.querySelectorAll('.mp-proflevel-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.level === value);
        });
      }
    });
    profLevelSelector.appendChild(btn);
  });

  profLevelGroup.appendChild(profLevelLabel);
  profLevelGroup.appendChild(profLevelSelector);
  formCol.appendChild(profLevelGroup);

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
    { key: 'education', level: 1, label: 'Education', chipClass: 'chip-education', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    { key: 'exposure', level: 2, label: 'Exposure', chipClass: 'chip-exposure', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>' },
    { key: 'experience', level: 3, label: 'Experience', chipClass: 'chip-experience', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  ];

  const LEVEL_MAP = { 1: 'education', 2: 'exposure', 3: 'experience' };

  const contentTitle = el('div', { className: 'mp-modal-content-title' });
  contentTitle.textContent = 'Learning Content';

  const resyncBtn = el('button', { className: 'btn btn-secondary btn-sm mp-resync-btn', 'aria-label': 'Re-sync from catalog', title: 'Re-sync hidden items from catalog' });
  resyncBtn.innerHTML = SVG_ICONS.refresh;
  resyncBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('Restore all hidden catalog items for this skill? This will bring back any items you previously dismissed.', true);
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

  const logToggleBtn = el('button', { className: 'mp-modal-log-toggle-btn', title: 'Toggle Training Log' });
  logToggleBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const logToggleBtnCount = el('span');
  const initialLogs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
  logToggleBtnCount.textContent = String(initialLogs.length);
  logToggleBtn.appendChild(logToggleBtnCount);

  logToggleBtn.addEventListener('click', () => {
    logCol.classList.toggle('mp-modal-log-col--hidden');
    logToggleBtn.classList.toggle('active');
  });

  const contentTitleRow = el('div', { className: 'mp-modal-content-title-row' });
  contentTitleRow.appendChild(contentTitle);
  contentTitleRow.appendChild(logToggleBtn);
  contentTitleRow.appendChild(resyncBtn);
  contentCol.appendChild(contentTitleRow);

  const tabBar = el('div', { className: 'skill-detail-tabs', role: 'tablist', 'aria-label': 'Content level tabs' });
  const tabButtons = {};
  const tabPanels = {};
  const tabPanelsWrap = el('div', { className: 'mp-modal-tab-panels-wrap' });

  LEVEL_CONFIG.forEach(({ key, label, icon }) => {
    const tabBtn = el('button', { className: 'skill-detail-tab', 'data-tab': key, role: 'tab', 'aria-selected': 'false', 'aria-controls': `mp-panel-${key}` });
    
    const iconSpan = el('span', { className: 'skill-detail-tab-icon' });
    iconSpan.innerHTML = icon;
    tabBtn.appendChild(iconSpan);

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

  const logCol = el('div', { className: 'mp-modal-log-col mp-modal-log-col--hidden' });
  const logSection = el('div', { className: 'mp-modal-log-section' });
  const logToggle = el('div', { className: 'mp-modal-log-toggle', style: 'cursor: default' });
  const logToggleText = el('span');
  logToggleText.textContent = 'Training Log';
  const logToggleCount = el('span', { className: 'mp-modal-log-count' });
  const logs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
  logToggleCount.textContent = String(logs.length);
  logToggle.appendChild(logToggleText);
  logToggle.appendChild(logToggleCount);
  logSection.appendChild(logToggle);

  const logBody = el('div', { className: 'mp-modal-log-body' });
  const logListEl = el('div', { className: 'mp-edit-log-list' });

  let visibleLogCount = 5;

  function renderLogList() {
    logListEl.innerHTML = '';
    const currentLogs = Array.isArray(planSkill.training_logs) ? planSkill.training_logs : [];
    logToggleCount.textContent = String(currentLogs.length);
    logToggleBtnCount.textContent = String(currentLogs.length);
    if (currentLogs.length === 0) {
      const emptyLog = el('div', { className: 'empty-state empty-state--compact' });
      emptyLog.textContent = 'No training log entries yet.';
      logListEl.appendChild(emptyLog);
    } else {
      const reversedLogs = currentLogs.slice().reverse();
      reversedLogs.slice(0, visibleLogCount).forEach(log => {
        logListEl.appendChild(buildTrainingLogEntry(log));
      });
      if (currentLogs.length > visibleLogCount) {
        const remaining = currentLogs.length - visibleLogCount;
        const moreBtn = el('button', { className: 'btn btn-secondary btn-sm mp-log-more' });
        moreBtn.textContent = `Show more (${remaining} remaining)`;
        moreBtn.addEventListener('click', () => {
          visibleLogCount += 5;
          renderLogList();
        });
        logListEl.appendChild(moreBtn);
      }
    }
  }
  renderLogList();

  logBody.appendChild(logListEl);
  logSection.appendChild(logBody);
  logSection.classList.add('expanded');
  logCol.appendChild(logSection);
  topRow.appendChild(logCol);

  body.appendChild(topRow);

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
    }

    let openItem = null;

    sorted.forEach(item => {
      const isUserItem = !!item.is_user_content;
      const accItem = el('div', { className: `skill-detail-accordion-item${item.completed ? ' completed' : ''}${isUserItem ? ' user-content-item' : ''}` });
      accItem.dataset.itemId = item.id;
      if (isUserItem) accItem.dataset.userContent = 'true';

      const trigger = el('button', { className: 'skill-detail-accordion-trigger' });

      const checkbox = el('span', {
        className: `mp-content-checkbox${item.completed ? ' checked' : ''}`,
        role: 'checkbox',
        'aria-checked': String(item.completed),
        'aria-label': `Mark "${item.title}" as completed`,
        tabIndex: 0,
      });
      checkbox.innerHTML = item.completed ? SVG_ICONS.circleCheck : SVG_ICONS.circle;
      let _checkBusy = false;
      const toggleCheck = async (e) => {
        e.stopPropagation();
        if (_checkBusy) return;
        _checkBusy = true;
        checkbox.classList.add('busy');
        try {
          const endpoint = isUserItem
            ? `/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${item.id}/complete`
            : `/api/plans/${_engineerId}/skills/${planSkill.id}/content/${item.id}/complete`;
          const resp = await api.post(endpoint, {});
          item.completed = resp.completed;
          item.completed_at = resp.completed_at;
          checkbox.innerHTML = item.completed ? SVG_ICONS.circleCheck : SVG_ICONS.circle;
          checkbox.classList.toggle('checked', item.completed);
          checkbox.setAttribute('aria-checked', String(item.completed));
          accItem.classList.toggle('completed', item.completed);
          updateProgressDisplay();

          const freshPlan = await api.get(`/api/plans/${_engineerId}`);
          _planData = freshPlan;
          const freshSkill = (freshPlan.skills || []).find(s => s.id === planSkill.id);
          if (freshSkill) planSkill.training_logs = freshSkill.training_logs;
          renderLogList();
        } catch (err) {
          showToast(err.message || 'Failed to toggle completion', 'error');
        } finally {
          _checkBusy = false;
          checkbox.classList.remove('busy');
        }
      };
      checkbox.addEventListener('click', toggleCheck);
      checkbox.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCheck(e); } });
      trigger.appendChild(checkbox);

      const levelCfg = LEVEL_CONFIG.find(l => l.key === key);
      const typeChip = el('span', { className: `triage-chip ${levelCfg.chipClass} chip-sm` });
      typeChip.textContent = item.type || 'resource';
      trigger.appendChild(typeChip);

      const titleSpan = el('span', { className: 'skill-detail-accordion-title' });
      titleSpan.textContent = item.title || 'Untitled';
      trigger.appendChild(titleSpan);

      if (isUserItem) {
        const userBadge = el('span', { className: 'mp-user-content-badge' });
        userBadge.textContent = 'My Item';
        trigger.appendChild(userBadge);
      } else if (item.has_override) {
        const badge = el('span', { className: 'mp-override-badge' });
        badge.textContent = 'Modified';
        trigger.appendChild(badge);
      }

      if (item.completed && item.completed_at) {
        const doneDate = el('span', { className: 'mp-completed-date' });
        doneDate.textContent = formatDate(item.completed_at);
        trigger.appendChild(doneDate);
      }

      /* Edit / Delete actions for user items */
      if (isUserItem) {
        const actions = el('span', { className: 'accordion-admin-actions' });
        const editBtn = el('button', { className: 'btn btn-secondary accordion-action-btn', 'aria-label': 'Edit item', title: 'Edit' });
        editBtn.innerHTML = SVG_ICONS.pencil;
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openUserContentEditor({ mode: 'edit', item, planSkill, levelKey: key }, () => refreshContent());
        });
        const delBtn = el('button', { className: 'btn btn-danger accordion-action-btn', 'aria-label': 'Delete item', title: 'Delete' });
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
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
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        trigger.appendChild(actions);
      } else {
        const hideBtn = el('button', { className: 'btn btn-secondary accordion-action-btn mp-hide-item-btn', 'aria-label': 'Hide item', title: 'Hide from my view' });
        hideBtn.textContent = '✕';
        hideBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const confirmed = await showConfirm(`Hide "${item.title}" from your view? You can restore it later with the re-sync button.`, true);
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
        const actions = el('span', { className: 'accordion-admin-actions' });
        actions.appendChild(hideBtn);
        trigger.appendChild(actions);
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

      /* "Add My Notes" only for catalog items */
      if (!isUserItem) {
        const editOverrideBtn = el('button', { className: 'btn btn-secondary btn-sm mp-override-btn' });
        editOverrideBtn.textContent = item.has_override ? 'Edit My Notes' : 'Add My Notes';
        editOverrideBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openOverrideEditor(item, planSkill, () => {
            refreshContent();
          });
        });
        bodyInner.appendChild(editOverrideBtn);
      }

      accBody.appendChild(bodyInner);
      accItem.appendChild(trigger);
      accItem.appendChild(accBody);
      panel.appendChild(accItem);

      trigger.addEventListener('click', (e) => {
        if (e.target.closest('.mp-content-checkbox') || e.target.closest('.accordion-admin-actions')) return;
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

    /* "Add My Item" button at bottom of each tab panel */
    const levelCfg = LEVEL_CONFIG.find(l => l.key === key);
    const addMyItemBtn = el('button', { className: 'btn btn-secondary content-add-btn mp-add-my-item-btn' });
    addMyItemBtn.textContent = `+ Add My ${levelCfg.label} Item`;
    addMyItemBtn.addEventListener('click', () => {
      openUserContentEditor({ mode: 'create', planSkill, levelKey: key, level: levelCfg.level }, () => refreshContent());
    });
    panel.appendChild(addMyItemBtn);
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
      if (skeletonEl.parentNode) skeletonEl.remove();
      allContentItems = (Array.isArray(data.items) ? data.items : [])
        .filter(item => item && item.title && String(item.title).trim() !== '' && [1, 2, 3, 4, 5].includes(item.level));
      const focusLevelNum = { education: 1, exposure: 2, experience: 3 }[currentLevel] || null;

      const groups = { education: [], exposure: [], experience: [] };
      allContentItems.forEach(item => {
        const key = LEVEL_MAP[item.level];
        if (key) groups[key].push(item);
      });

      LEVEL_CONFIG.forEach(({ key, level }) => {
        const isVisible = !focusLevelNum || level <= focusLevelNum;
        tabButtons[key].style.display = isVisible ? '' : 'none';
        tabPanels[key].style.display = isVisible ? '' : 'none';
        if (isVisible) {
          renderPanelContent(key, groups[key]);
        }
      });

      const visibleTabs = LEVEL_CONFIG.filter(({ level }) => !focusLevelNum || level <= focusLevelNum);
      const firstWithContent = visibleTabs.find(({ key }) => groups[key].length > 0);
      activateTab(firstWithContent ? firstWithContent.key : (visibleTabs[0]?.key || 'education'));

      updateProgressDisplay();
    }).catch(() => {
      if (skeletonEl.parentNode) skeletonEl.remove();
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

  const initialStatus = planSkill.status;
  const initialLevel = planSkill.focus_area || '';
  const initialProfLevel = String(planSkill.proficiency_level ?? '');
  const initialNotes = planSkill.notes || '';

  function isDirty() {
    return currentStatus !== initialStatus || currentLevel !== initialLevel || currentProfLevel !== initialProfLevel || notesTextarea.value !== initialNotes;
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
    renderSections();
  }

  async function doSave() {
    const newStatus = currentStatus;
    const newLevel = currentProfLevel ? Number(currentProfLevel) : null;
    const newNotes = notesTextarea.value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await api.put(`/api/plans/${_engineerId}/skills/${planSkill.id}`, {
        status: newStatus,
        proficiency_level: newLevel,
        focus_area: currentLevel || '',
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
        const fl = { education: 1, exposure: 2, experience: 3 }[currentLevel] || null;
        return !fl || level <= fl;
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

function openUserContentEditor(opts, onSaved) {
  const { mode, item, planSkill, levelKey, level } = opts;
  const isEdit = mode === 'edit';
  const levelNum = isEdit ? item.level : level;
  const levelLabel = { 1: 'Education', 2: 'Exposure', 3: 'Experience', 4: 'Practice', 5: 'Mastery' }[levelNum] || 'Content';

  const root = document.getElementById('modalRoot');
  if (!root) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal content-edit-modal user-content-editor-modal' });

  const header = el('div', { className: 'modal-header' });
  const titleEl = el('h2', { className: 'modal-title' });
  titleEl.textContent = isEdit ? `Edit My Item — ${item.title}` : `Add My ${levelLabel} Item`;
  const closeBtn = el('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', { className: 'modal-body' });

  const hint = el('p', { className: 'mp-form-hint' });
  hint.textContent = 'This item is personal to you and won\u2019t affect the global catalog.';
  body.appendChild(hint);

  const titleGroup = el('div', { className: 'form-group' });
  const titleLabel = el('label', { className: 'form-label' });
  titleLabel.textContent = 'Title';
  const titleInput = el('input', { type: 'text', className: 'form-input', placeholder: 'e.g. Cisco Live session, Lab exercise…' });
  if (isEdit) titleInput.value = item.title || '';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  body.appendChild(titleGroup);

  const typeGroup = el('div', { className: 'form-group' });
  const typeLabel = el('label', { className: 'form-label' });
  typeLabel.textContent = 'Type';
  const typeSelect = el('select', { className: 'form-select' });
  ['course', 'certification', 'reading', 'link', 'action'].forEach(t => {
    const opt = el('option', { value: t });
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (isEdit && item.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  body.appendChild(typeGroup);

  const urlGroup = el('div', { className: 'form-group' });
  const urlLabel = el('label', { className: 'form-label' });
  urlLabel.textContent = 'URL (optional)';
  const urlInput = el('input', { type: 'url', className: 'form-input', placeholder: 'https://…' });
  if (isEdit && item.url) urlInput.value = item.url;
  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlInput);
  body.appendChild(urlGroup);

  const descGroup = el('div', { className: 'form-group' });
  const descLabel = el('label', { className: 'form-label' });
  descLabel.textContent = 'Description (optional)';
  body.appendChild(descGroup);

  const toolbar = el('div', { className: 'uce-toolbar' });
  const toolbarActions = [
    { cmd: 'bold', icon: '<b>B</b>', title: 'Bold' },
    { cmd: 'italic', icon: '<i>I</i>', title: 'Italic' },
    { cmd: 'insertUnorderedList', icon: '• List', title: 'Bullet list' },
    { cmd: 'insertOrderedList', icon: '1. List', title: 'Numbered list' },
    { cmd: 'createLink', icon: '🔗', title: 'Insert link' },
    { cmd: 'removeFormat', icon: '⊘', title: 'Clear formatting' },
  ];
  toolbarActions.forEach(({ cmd, icon, title }) => {
    const btn = el('button', { type: 'button', className: 'uce-toolbar-btn', title });
    btn.innerHTML = icon;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (cmd === 'createLink') {
        const url = prompt('Enter URL:');
        if (url) document.execCommand(cmd, false, url);
      } else {
        document.execCommand(cmd, false, null);
      }
      editorEl.focus();
    });
    toolbar.appendChild(btn);
  });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(toolbar);

  const editorEl = el('div', { className: 'uce-editor', contentEditable: 'true' });
  if (isEdit && item.description) editorEl.innerHTML = item.description;
  descGroup.appendChild(editorEl);

  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  const saveBtn = el('button', { className: 'btn btn-primary' });
  saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  root.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    titleInput.focus();
  });

  function close() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
  }

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  saveBtn.addEventListener('click', async () => {
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      showToast('Title is required', 'error');
      titleInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const descHtml = editorEl.innerHTML.trim();
    const urlVal = urlInput.value.trim() || null;

    try {
      if (isEdit) {
        await api.put(`/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${item.id}`, {
          title: titleVal,
          type: typeSelect.value,
          description: descHtml || null,
          url: urlVal,
        });
        showToast('Item updated', 'success');
      } else {
        await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/user-content`, {
          level: levelNum,
          type: typeSelect.value,
          title: titleVal,
          description: descHtml || null,
          url: urlVal,
        });
        showToast('Item added', 'success');
      }
      close();
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(err.message || 'Failed to save item', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
    }
  });
}

function buildTrainingLogEntry(log) {
  const entry = el('div', { className: 'mt-activity-item' });

  const bodyEl = el('div', { className: 'mt-activity-body' });

  const textEl = el('div', { className: 'mt-activity-text' });
  
  const titleEl = el('strong');
  titleEl.textContent = log.title || 'Untitled';
  textEl.appendChild(titleEl);

  const typeBadge = el('span', { className: 'triage-chip triage-signal chip-sm' });
  typeBadge.style.cssText = 'font-size: 11px; margin-left: 6px; padding: 2px 6px;';
  typeBadge.textContent = log.type || 'entry';
  textEl.appendChild(typeBadge);

  bodyEl.appendChild(textEl);

  const metaEl = el('div', { className: 'mt-activity-meta' });
  
  if (log.completed_at) {
    const timeEl = el('span', { className: 'mt-activity-time' });
    timeEl.textContent = formatDate(log.completed_at);
    metaEl.appendChild(timeEl);
  }

  if (log.notes) {
    if (log.completed_at) {
      const sep = el('span');
      sep.textContent = ' • ';
      metaEl.appendChild(sep);
    }
    const notesEl = el('span');
    notesEl.textContent = log.notes;
    metaEl.appendChild(notesEl);
  }

  bodyEl.appendChild(metaEl);
  entry.appendChild(bodyEl);

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

function openReportingModal() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const bodyEl = el('div');

  const timeframeRow = el('div');
  timeframeRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;';

  const timeframeLabel = el('span');
  timeframeLabel.textContent = 'Time Frame:';
  timeframeLabel.style.cssText = 'font-size:13px;color:var(--text-muted);font-weight:600;white-space:nowrap;';

  const fromLabel = el('label');
  fromLabel.textContent = 'From';
  fromLabel.style.cssText = 'font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;';
  const fromInput = el('input', { type: 'date' });
  fromInput.value = thirtyDaysAgo;
  fromInput.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:13px;';
  fromLabel.appendChild(fromInput);

  const toLabel = el('label');
  toLabel.textContent = 'To';
  toLabel.style.cssText = 'font-size:13px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;';
  const toInput = el('input', { type: 'date' });
  toInput.value = todayStr;
  toInput.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-soft);border-radius:var(--radius-sm);padding:6px 10px;color:var(--text-primary);font-size:13px;';
  toLabel.appendChild(toInput);

  timeframeRow.appendChild(timeframeLabel);
  timeframeRow.appendChild(fromLabel);
  timeframeRow.appendChild(toLabel);
  bodyEl.appendChild(timeframeRow);

  const tabBar = el('div', { className: 'skill-detail-tabs', role: 'tablist', 'aria-label': 'Reporting tabs' });
  const changeLogsTab = el('button', { className: 'skill-detail-tab active', role: 'tab', 'aria-selected': 'true' });
  changeLogsTab.textContent = 'Change Logs';
  const skillsOverviewTab = el('button', { className: 'skill-detail-tab', role: 'tab', 'aria-selected': 'false' });
  skillsOverviewTab.textContent = 'Skills Overview';
  tabBar.appendChild(changeLogsTab);
  tabBar.appendChild(skillsOverviewTab);
  bodyEl.appendChild(tabBar);

  const contentArea = el('div');
  contentArea.style.cssText = 'margin-top:12px;';
  bodyEl.appendChild(contentArea);

  const changeLogsPanel = el('div', { className: 'skill-detail-tab-panel' });

  async function renderChangeLogs() {
    const fromDate = fromInput.value;
    const toDate = toInput.value;
    changeLogsPanel.innerHTML = '';

    const loadingMsg = el('div', { className: 'empty-state empty-state--compact' });
    loadingMsg.textContent = 'Loading…';
    changeLogsPanel.appendChild(loadingMsg);

    try {
      const logs = await api.get(`/api/export/plans/${_engineerId}/change-logs?from_date=${fromDate}&to_date=${toDate}`);
      changeLogsPanel.innerHTML = '';

      const listWrap = el('div');
      listWrap.style.cssText = 'max-height:320px;overflow-y:auto;border:1px solid var(--border-soft);border-radius:var(--radius-md);margin-bottom:12px;';

      if (!Array.isArray(logs) || logs.length === 0) {
        const empty = el('div', { className: 'empty-state empty-state--compact' });
        empty.textContent = 'No change logs found for this period.';
        empty.style.padding = '24px';
        listWrap.appendChild(empty);
      } else {
        logs.forEach(log => {
          const entry = el('div');
          entry.style.cssText = 'padding:10px 12px;border-bottom:1px solid var(--border-soft);display:flex;gap:12px;align-items:flex-start;';

          const tsCol = el('div');
          tsCol.style.cssText = 'min-width:110px;font-size:12px;color:var(--text-muted);padding-top:2px;white-space:nowrap;';
          tsCol.textContent = formatDate(log.timestamp);

          const mainCol = el('div');
          mainCol.style.cssText = 'flex:1;';

          const skillName = el('div');
          skillName.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:2px;';
          skillName.textContent = log.skill_name || '—';

          const desc = el('div');
          desc.style.cssText = 'font-size:13px;color:var(--text-secondary);';
          desc.textContent = log.description || '';

          const typeBadge = el('span', { className: 'triage-chip' });
          typeBadge.style.cssText = 'font-size:11px;margin-left:6px;';
          typeBadge.textContent = log.type === 'training_log' ? 'Training' : 'Audit';
          typeBadge.style.background = log.type === 'training_log' ? 'rgba(6,182,212,.12)' : 'rgba(168,85,247,.12)';
          typeBadge.style.color = log.type === 'training_log' ? 'var(--info)' : 'var(--purple)';
          typeBadge.style.border = log.type === 'training_log' ? '1px solid rgba(6,182,212,.3)' : '1px solid rgba(168,85,247,.3)';

          skillName.appendChild(typeBadge);
          mainCol.appendChild(skillName);
          mainCol.appendChild(desc);
          entry.appendChild(tsCol);
          entry.appendChild(mainCol);
          listWrap.appendChild(entry);
        });
      }

      changeLogsPanel.appendChild(listWrap);

      const exportPdfBtn = el('button', { className: 'btn btn-primary btn-sm' });
      exportPdfBtn.textContent = 'Export to PDF';
      exportPdfBtn.addEventListener('click', () => {
        const fd = fromInput.value;
        const td = toInput.value;
        downloadExport(`/api/export/plans/${_engineerId}/change-logs/pdf?from_date=${fd}&to_date=${td}`, 'change_logs.pdf');
      });
      changeLogsPanel.appendChild(exportPdfBtn);
    } catch (err) {
      changeLogsPanel.innerHTML = '';
      const errEl = el('div', { className: 'empty-state empty-state--compact' });
      errEl.textContent = err.message || 'Failed to load change logs.';
      changeLogsPanel.appendChild(errEl);
    }
  }

  const skillsOverviewPanel = el('div', { className: 'skill-detail-tab-panel' });
  skillsOverviewPanel.style.display = 'none';

  async function renderSkillsOverview() {
    skillsOverviewPanel.innerHTML = '';

    const loadingMsg = el('div', { className: 'empty-state empty-state--compact' });
    loadingMsg.textContent = 'Loading…';
    skillsOverviewPanel.appendChild(loadingMsg);

    try {
      const data = await api.get(`/api/export/plans/${_engineerId}/skills-overview`);
      skillsOverviewPanel.innerHTML = '';

      const groups = [
        { key: 'developing', label: 'Developing', color: 'var(--warning)' },
        { key: 'planned', label: 'Planned', color: 'var(--accent)' },
        { key: 'mastered', label: 'Mastered', color: 'var(--success)' },
      ];

      const listWrap = el('div');
      listWrap.style.cssText = 'max-height:320px;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:12px;';

      groups.forEach(({ key, label, color }) => {
        const skills = Array.isArray(data[key]) ? data[key] : [];
        const groupEl = el('div');
        groupEl.style.cssText = 'border:1px solid var(--border-soft);border-radius:var(--radius-md);overflow:hidden;';

        const groupHeader = el('div');
        groupHeader.style.cssText = `display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg-elevated);border-bottom:1px solid var(--border-soft);`;
        const dot = el('span');
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;
        const headerText = el('span');
        headerText.style.cssText = 'font-size:13px;font-weight:700;color:var(--text-primary);';
        headerText.textContent = label;
        const countBadge = el('span');
        countBadge.style.cssText = 'font-size:12px;color:var(--text-muted);margin-left:4px;';
        countBadge.textContent = `(${skills.length})`;
        groupHeader.appendChild(dot);
        groupHeader.appendChild(headerText);
        groupHeader.appendChild(countBadge);
        groupEl.appendChild(groupHeader);

        if (skills.length === 0) {
          const emptyRow = el('div');
          emptyRow.style.cssText = 'padding:10px 14px;font-size:13px;color:var(--text-muted);font-style:italic;';
          emptyRow.textContent = 'No skills in this category.';
          groupEl.appendChild(emptyRow);
        } else {
          skills.forEach(skill => {
            const row = el('div');
            row.style.cssText = 'padding:8px 14px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;gap:8px;';
            const name = el('span');
            name.style.cssText = 'font-size:13px;color:var(--text-secondary);';
            name.textContent = skill.skill_name || skill;
            row.appendChild(name);
            if (skill.proficiency_level) {
              const lvl = el('span');
              lvl.style.cssText = 'font-size:11px;color:var(--text-muted);margin-left:auto;';
              lvl.textContent = `Level ${skill.proficiency_level}`;
              row.appendChild(lvl);
            }
            groupEl.appendChild(row);
          });
        }

        listWrap.appendChild(groupEl);
      });

      skillsOverviewPanel.appendChild(listWrap);

      const exportPdfBtn = el('button', { className: 'btn btn-primary btn-sm' });
      exportPdfBtn.textContent = 'Export to PDF';
      exportPdfBtn.addEventListener('click', () => {
        downloadExport(`/api/export/plans/${_engineerId}/skills-overview/pdf`, 'skills_overview.pdf');
      });
      skillsOverviewPanel.appendChild(exportPdfBtn);
    } catch (err) {
      skillsOverviewPanel.innerHTML = '';
      const errEl = el('div', { className: 'empty-state empty-state--compact' });
      errEl.textContent = err.message || 'Failed to load skills overview.';
      skillsOverviewPanel.appendChild(errEl);
    }
  }

  contentArea.appendChild(changeLogsPanel);
  contentArea.appendChild(skillsOverviewPanel);

  function activateTab(tab) {
    if (tab === 'change-logs') {
      changeLogsTab.classList.add('active');
      changeLogsTab.setAttribute('aria-selected', 'true');
      skillsOverviewTab.classList.remove('active');
      skillsOverviewTab.setAttribute('aria-selected', 'false');
      changeLogsPanel.style.display = '';
      skillsOverviewPanel.style.display = 'none';
      renderChangeLogs();
    } else {
      skillsOverviewTab.classList.add('active');
      skillsOverviewTab.setAttribute('aria-selected', 'true');
      changeLogsTab.classList.remove('active');
      changeLogsTab.setAttribute('aria-selected', 'false');
      skillsOverviewPanel.style.display = '';
      changeLogsPanel.style.display = 'none';
      renderSkillsOverview();
    }
  }

  changeLogsTab.addEventListener('click', () => activateTab('change-logs'));
  skillsOverviewTab.addEventListener('click', () => activateTab('skills-overview'));

  fromInput.addEventListener('change', () => {
    if (changeLogsPanel.style.display !== 'none') renderChangeLogs();
  });
  toInput.addEventListener('change', () => {
    if (changeLogsPanel.style.display !== 'none') renderChangeLogs();
  });

  showModal({
    title: 'Reporting',
    body: bodyEl,
    modalClass: 'modal-wide',
    confirmText: 'Close',
    cancelText: '',
    onConfirm: () => {},
  });

  renderChangeLogs();
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
