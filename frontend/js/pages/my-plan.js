import { api, API_BASE } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { el } from '../utils/dom.js';
import { getSkillIconSVG } from '../components/icons.js';
import { openLibraryModal } from '../components/library-modal.js?v=3';
import { openReportingModal } from './my-plan-reports.js?v=4';
import { renderDescription, mountMarkdownEditor } from '../components/markdown-editor.js';

const CONTENT_TYPE_OPTIONS = [
  { value: 'course', label: 'Course' },
  { value: 'certification', label: 'Certification' },
  { value: 'reading', label: 'Reading' },
  { value: 'link', label: 'Link' },
  { value: 'action', label: 'Action' },
];

const THREE_E_SECTION_ICONS = {
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  exposure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  experience: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

function normalizeOverrideEntry(val) {
  if (!val) return { description: '', type: null, url: null };
  if (typeof val === 'string') return { description: val, type: null, url: null };
  return {
    description: val.description ?? '',
    type: val.type ?? null,
    url: val.url ?? null,
  };
}

function overrideEntriesEqual(a, b) {
  const na = normalizeOverrideEntry(a);
  const nb = normalizeOverrideEntry(b);
  return na.description === nb.description && na.type === nb.type && na.url === nb.url;
}

function formatContentTypeLabel(type) {
  const opt = CONTENT_TYPE_OPTIONS.find(o => o.value === type);
  return opt ? opt.label : (type || 'Resource');
}

let _mountGen = 0;
let _abortController = null;

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
  plus: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  users: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  fileText: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  table: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  bookOpen: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  checkCircle: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  pencil: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  maximize: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  minimize: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>',
  trash: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  grip: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
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

function applyPersonalSkillIcon(iconEl, size = 20) {
  iconEl.className = 'mp-card-icon mp-card-icon--personal';
  const svg = getSkillIconSVG('personal', size);
  iconEl.innerHTML = svg || SVG_ICONS.users;
}

function buildPersonalSkillBadge(title) {
  const badge = el('div', {
    className: 'mp-card__personal-badge',
    title: title || 'You created this skill — it is not part of the shared catalog.',
  });
  badge.textContent = 'My skill';
  return badge;
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
  const mountGen = ++_mountGen;
  if (_abortController) _abortController.abort();
  _abortController = new AbortController();

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
  loadPlan(mountGen);

  return () => {
    if (mountGen === _mountGen) {
      _abortController?.abort();
      _abortController = null;
    }
  };
}

async function getCategories(options = {}) {
  if (_categoriesCache) return _categoriesCache;
  try {
    _categoriesCache = await api.get('/api/skills/categories', options);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    _categoriesCache = [];
  }
  return _categoriesCache;
}

async function loadPlan(mountGen) {
  Object.values(_sectionGridEls).forEach(grid => showSkeleton(grid, 'cards'));
  const signal = _abortController?.signal;

  try {
    const [planRes, cats] = await Promise.all([
      api.get(`/api/plans/${_engineerId}`, { signal }),
      getCategories({ signal }),
    ]);
    if (mountGen !== _mountGen) return;
    _planData = planRes;
    if (!_categoriesInitialized && cats.length > 0) {
      cats.forEach(c => _activeCategoryFilters.add(c.id));
      _categoriesInitialized = true;
    }
    try {
      renderSections();
    } catch (renderErr) {
      console.error('My Plan render error:', renderErr);
      showToast('Failed to render plan view. Please refresh.', 'error');
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
    if (mountGen !== _mountGen) return;
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
  const mountGen = _mountGen;
  const signal = _abortController?.signal;
  try {
    const [planRes, cats] = await Promise.all([
      api.get(`/api/plans/${_engineerId}`, { signal }),
      getCategories({ signal }),
    ]);
    if (mountGen !== _mountGen) return;
    _planData = planRes;
    if (!_categoriesInitialized && cats.length > 0) {
      cats.forEach(c => _activeCategoryFilters.add(c.id));
      _categoriesInitialized = true;
    }
    renderSections();
  } catch (err) {
    if (err?.name === 'AbortError') return;
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
  addBtn.innerHTML = SVG_ICONS.plus + '<span>Add Skill</span>';
  addBtn.addEventListener('click', openAddSkillChooserModal);
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
    applyPersonalSkillIcon(icon);
    card.classList.add('mp-card--personal');
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

  if (planSkill.is_custom) {
    info.appendChild(buildPersonalSkillBadge());
  }

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
  planSkill = (_planData?.skills || []).find(s => s.id === planSkill.id) || planSkill;
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
      education: { visible: true, expanded: true, canToggle: true, isFocus: true },
      exposure: { visible: false },
      experience: { visible: false },
    },
    exposure: {
      education: { visible: true, expanded: false, canToggle: true, isFocus: false },
      exposure: { visible: true, expanded: true, canToggle: true, isFocus: true },
      experience: { visible: false },
    },
    experience: {
      education: { visible: true, expanded: false, canToggle: true, isFocus: false },
      exposure: { visible: true, expanded: false, canToggle: true, isFocus: false },
      experience: { visible: true, expanded: true, canToggle: true, isFocus: true },
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

  const restoreBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm sdm-restore-btn',
    title: 'Restore catalog-managed items from the global skill catalog',
  });
  restoreBtn.textContent = 'Restore from Catalog';

  const closeBtn = el('button', { type: 'button', className: 'sdm-window-btn sdm-close', 'aria-label': 'Close', title: 'Close' });
  closeBtn.textContent = '\u2715';

  const maximizeBtn = el('button', {
    type: 'button',
    className: 'sdm-window-btn sdm-maximize-btn',
    'aria-label': 'Maximize',
    title: 'Maximize',
  });
  maximizeBtn.innerHTML = SVG_ICONS.maximize;

  const windowControls = el('div', { className: 'sdm-header__window-controls' });
  windowControls.appendChild(maximizeBtn);
  windowControls.appendChild(closeBtn);

  headerActions.appendChild(restoreBtn);
  headerActions.appendChild(windowControls);
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
  } else if (planSkill.is_custom) {
    headerBlock.appendChild(buildPersonalSkillBadge());
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
  saveBtn.textContent = 'Save Details';
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
  let fullCatalogItems = [];
  let userContentItems = [];
  let serverHiddenIds = new Set();
  let selectedItemKey = null;
  let visibleLogCount = 5;
  let contentLoading = true;
  let manualExpanded = {};
  let inlineEditKey = null;
  let inlineEditorInstance = null;
  let isMaximized = false;

  function setModalMaximized(maximized) {
    isMaximized = maximized;
    overlay.classList.toggle('modal-overlay--maximized', maximized);
    modal.classList.toggle('sdm-plan-modal--maximized', maximized);
    maximizeBtn.setAttribute('aria-label', maximized ? 'Restore window size' : 'Maximize');
    maximizeBtn.title = maximized ? 'Restore' : 'Maximize';
    maximizeBtn.innerHTML = maximized ? SVG_ICONS.minimize : SVG_ICONS.maximize;
  }

  maximizeBtn.addEventListener('click', () => {
    setModalMaximized(!isMaximized);
  });

  let draggingItemKey = null;
  let tempUserItemId = -1;
  let orderInitialized = false;

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

  const savedContent = {
    overrides: new Map(),
    orderByLevel: { education: [], exposure: [], experience: [] },
  };

  const pendingContent = {
    hideCatalogIds: new Set(),
    deleteUserIds: new Set(),
    catalogRefreshPending: false,
    restoredCatalogIds: new Set(),
    overrides: new Map(),
    pendingUserAdds: [],
    pendingUserEdits: new Map(),
    pendingImports: [],
    orderByLevel: { education: null, exposure: null, experience: null },
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

  function getCatalogBaseline(item) {
    const src = fullCatalogItems.find(c => c.id === item.id);
    return {
      type: src?.type ?? item.type ?? 'action',
      url: src?.url ?? item.url ?? '',
      description: src?.description ?? item.description ?? '',
    };
  }

  function getOverrideState(item) {
    if (pendingContent.overrides.has(item.id)) {
      return normalizeOverrideEntry(pendingContent.overrides.get(item.id));
    }
    if (savedContent.overrides.has(item.id)) {
      return normalizeOverrideEntry(savedContent.overrides.get(item.id));
    }
    return {
      description: item.override_description || '',
      type: item.override_type || null,
      url: item.override_url ?? null,
    };
  }

  function getDetailEditBaseline(item) {
    if (item.is_user_content) {
      const edit = pendingContent.pendingUserEdits.get(item.id);
      return {
        type: edit?.type ?? item.type ?? 'action',
        url: edit?.url ?? item.url ?? '',
        description: edit?.description ?? item.description ?? '',
      };
    }
    const cat = getCatalogBaseline(item);
    const ov = getOverrideState(item);
    return {
      type: ov.type || cat.type,
      url: ov.url !== null && ov.url !== undefined ? ov.url : cat.url,
      description: ov.description?.trim() ? ov.description : cat.description,
    };
  }

  function getEffectiveItemFields(item) {
    if (item.is_user_content) {
      const edit = pendingContent.pendingUserEdits.get(item.id);
      return {
        type: edit?.type ?? item.type ?? 'action',
        url: edit?.url ?? item.url ?? '',
        description: edit?.description ?? item.description ?? '',
        description_format: edit?.description_format ?? item.description_format ?? 'markdown',
        isPersonalized: !!edit,
      };
    }
    const cat = getCatalogBaseline(item);
    const ov = getOverrideState(item);
    const hasDescOverride = !!(ov.description && ov.description.trim());
    const hasTypeOverride = !!(ov.type && ov.type !== cat.type);
    const hasUrlOverride = ov.url !== null && ov.url !== undefined && ov.url !== cat.url;
    return {
      type: ov.type || cat.type,
      url: ov.url !== null && ov.url !== undefined ? ov.url : cat.url,
      description: hasDescOverride ? ov.description : cat.description,
      description_format: 'legacy_html',
      isPersonalized: hasDescOverride || hasTypeOverride || hasUrlOverride,
    };
  }

  function applyOverrideToCatalogCopy(copy, ovRaw) {
    const ov = normalizeOverrideEntry(ovRaw);
    if (ov.description?.trim()) {
      copy.override_description = ov.description;
      copy.has_override = true;
    }
    if (ov.type) copy.type = ov.type;
    if (ov.url !== null && ov.url !== undefined) copy.url = ov.url;
  }

  function isOrderDirty() {
    for (const levelKey of FOCUS_ORDER) {
      const pendingOrder = pendingContent.orderByLevel[levelKey];
      if (!pendingOrder) continue;
      const savedOrder = savedContent.orderByLevel[levelKey] || [];
      if (pendingOrder.length !== savedOrder.length) return true;
      for (let i = 0; i < pendingOrder.length; i++) {
        if (pendingOrder[i] !== savedOrder[i]) return true;
      }
    }
    return false;
  }

  function isContentDirty() {
    if (pendingContent.catalogRefreshPending) return true;
    if (pendingContent.hideCatalogIds.size > 0) return true;
    if (pendingContent.deleteUserIds.size > 0) return true;
    if (pendingContent.pendingUserAdds.length > 0) return true;
    if (pendingContent.pendingUserEdits.size > 0) return true;
    if (pendingContent.pendingImports.length > 0) return true;
    if (isOrderDirty()) return true;
    for (const [id, payload] of pendingContent.overrides) {
      const baseline = savedContent.overrides.get(id);
      if (!overrideEntriesEqual(payload, baseline)) return true;
    }
    return false;
  }

  function hasUnsavedInlineEditDraft() {
    if (!inlineEditKey) return false;
    const item = getSelectedItem();
    if (!item) return false;
    const draft = readInlineEditForm();
    const baseline = getDetailEditBaseline(item);
    return draft.type !== baseline.type
      || draft.url !== baseline.url
      || draft.description !== baseline.description;
  }

  function isDirty() {
    if (pending.status !== saved.status) return true;
    if (pending.focus !== saved.focus) return true;
    if (pending.prof !== saved.prof) return true;
    if (isContentDirty()) return true;
    if (hasUnsavedInlineEditDraft()) return true;
    return allContentItems.some(item => isCompletionDirty(itemKey(item)));
  }

  function syncContentSnapshotsFromItems() {
    savedContent.overrides.clear();
    fullCatalogItems.forEach(item => {
      if (
        item.has_override
        || item.override_description
        || item.override_type
        || item.override_url != null
      ) {
        savedContent.overrides.set(item.id, {
          description: item.override_description || '',
          type: item.override_type || null,
          url: item.override_url ?? null,
        });
      }
    });
  }

  function captureSavedOrder(sourceItems) {
    const items = sourceItems || allContentItems;
    FOCUS_ORDER.forEach(levelKey => {
      const level = FOCUS_TO_LEVEL[levelKey];
      savedContent.orderByLevel[levelKey] = items
        .filter(item => item.level === level)
        .map(itemKey);
    });
  }

  function sortItemsForLevel(items, levelKey) {
    const customOrder = pendingContent.orderByLevel[levelKey]
      || savedContent.orderByLevel[levelKey];
    if (!customOrder || !customOrder.length) {
      return items.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
    }
    const rank = new Map(customOrder.map((key, index) => [key, index]));
    return items.slice().sort((a, b) => {
      const ka = itemKey(a);
      const kb = itemKey(b);
      const ra = rank.has(ka) ? rank.get(ka) : 100000 + a.id;
      const rb = rank.has(kb) ? rank.get(kb) : 100000 + b.id;
      return ra - rb || a.id - b.id;
    });
  }

  function setLevelOrder(levelKey, keys) {
    pendingContent.orderByLevel[levelKey] = keys.slice();
    updateDirtyUI();
  }

  function prunePendingOrder() {
    FOCUS_ORDER.forEach(levelKey => {
      const order = pendingContent.orderByLevel[levelKey];
      if (!order) return;
      const visibleKeys = new Set(
        allContentItems
          .filter(item => LEVEL_MAP[item.level] === levelKey)
          .filter(item => !item.is_user_content || !pendingContent.deleteUserIds.has(item.id))
          .filter(item => item.is_user_content || !pendingContent.hideCatalogIds.has(item.id))
          .map(itemKey),
      );
      const pruned = order.filter(key => visibleKeys.has(key));
      pendingContent.orderByLevel[levelKey] = pruned.length ? pruned : null;
    });
  }

  function buildOrderPayload(tempToReal = new Map()) {
    const orderPayload = [];
    FOCUS_ORDER.forEach(levelKey => {
      const level = FOCUS_TO_LEVEL[levelKey];
      const order = pendingContent.orderByLevel[levelKey]
        || savedContent.orderByLevel[levelKey]
        || [];
      order.forEach((key, index) => {
        const item = allContentItems.find(i => itemKey(i) === key);
        if (!item) return;
        if (item.is_user_content && pendingContent.deleteUserIds.has(item.id)) return;
        if (!item.is_user_content && pendingContent.hideCatalogIds.has(item.id)) return;
        let realId = item.id;
        if (realId < 0 && tempToReal.has(realId)) realId = tempToReal.get(realId);
        if (realId < 0) return;
        orderPayload.push({
          level,
          kind: item.is_user_content ? 'user' : 'catalog',
          id: realId,
          position: (index + 1) * 10,
        });
      });
    });
    return orderPayload;
  }

  function rebuildAllContentItems() {
    const catalog = fullCatalogItems
      .filter(item => {
        if (pendingContent.hideCatalogIds.has(item.id)) return false;
        const hiddenOnServer = serverHiddenIds.has(item.id);
        if (hiddenOnServer && !pendingContent.catalogRefreshPending) return false;
        return true;
      })
      .map(item => {
        const copy = { ...item, is_user_content: false };
        const wasRestored = pendingContent.restoredCatalogIds.has(item.id);
        if (wasRestored && pendingContent.catalogRefreshPending) {
          copy.has_override = false;
          copy.override_description = null;
        } else if (pendingContent.overrides.has(copy.id)) {
          applyOverrideToCatalogCopy(copy, pendingContent.overrides.get(copy.id));
        }
        return copy;
      });

    let users = userContentItems
      .filter(item => !pendingContent.deleteUserIds.has(item.id))
      .map(item => {
        const copy = { ...item };
        if (pendingContent.pendingUserEdits.has(item.id)) {
          Object.assign(copy, pendingContent.pendingUserEdits.get(item.id));
        }
        return copy;
      });

    pendingContent.pendingUserAdds.forEach(item => {
      users.push({
        ...item,
        is_user_content: true,
        completed: false,
        has_override: false,
      });
    });

    pendingContent.pendingImports.forEach(item => {
      users.push({
        ...item,
        is_user_content: true,
        completed: false,
        has_override: false,
        is_pending_import: true,
      });
    });

    allContentItems = [...catalog, ...users];
  }

  function isRestoredPendingItem(item) {
    return !item.is_user_content
      && pendingContent.catalogRefreshPending
      && pendingContent.restoredCatalogIds.has(item.id);
  }

  async function previewRestoreFromCatalog() {
    const skillId = planSkill.skill_id;
    const globalItems = await api.get(`/api/skills/${skillId}/content`);
    const planItems = await api.get(
      `/api/plans/${_engineerId}/skills/${planSkill.id}/content?include_hidden=true`,
    );

    const planCatalogById = new Map();
    (planItems.items || []).filter(i => !i.is_user_content).forEach(i => {
      planCatalogById.set(i.id, i);
    });

    const idsBeingRestored = new Set([
      ...serverHiddenIds,
      ...pendingContent.hideCatalogIds,
    ]);

    fullCatalogItems = globalItems
      .filter(item => item && [1, 2, 3].includes(item.level))
      .map(g => {
        const existing = planCatalogById.get(g.id);
        const wasRestored = idsBeingRestored.has(g.id);
        let override = null;
        let hasOverride = false;
        if (!wasRestored) {
          if (pendingContent.overrides.has(g.id)) {
            const ov = normalizeOverrideEntry(pendingContent.overrides.get(g.id));
            override = ov.description;
            hasOverride = !!(ov.description?.trim() || ov.type || ov.url != null);
          } else if (existing?.has_override) {
            override = existing.override_description;
            hasOverride = true;
          }
        }
        const row = {
          id: g.id,
          skill_id: g.skill_id,
          level: g.level,
          type: g.type,
          title: g.title,
          description: g.description,
          description_format: g.description_format || 'legacy_html',
          url: g.url,
          position: g.position,
          completed: existing?.completed ?? false,
          completed_at: existing?.completed_at ?? null,
          completion_notes: existing?.completion_notes ?? null,
          has_override: hasOverride,
          override_description: typeof override === 'string' ? override : null,
          is_hidden: false,
          is_user_content: false,
        };
        if (pendingContent.overrides.has(g.id) && !wasRestored) {
          applyOverrideToCatalogCopy(row, pendingContent.overrides.get(g.id));
        } else if (existing?.has_override) {
          row.override_type = existing.override_type ?? null;
          row.override_url = existing.override_url ?? null;
          row.type = existing.type ?? g.type;
          row.url = existing.url ?? g.url;
        }
        return row;
      });

    for (const id of idsBeingRestored) {
      pendingContent.overrides.delete(id);
    }
    pendingContent.restoredCatalogIds = idsBeingRestored;
    serverHiddenIds = new Set();
    pendingContent.hideCatalogIds.clear();
    pendingContent.catalogRefreshPending = true;
    refreshContentView();
  }

  function applyLibraryDeferredResult(result) {
    if (!result) return;
    if (result.mode === 'create') {
      pendingContent.pendingUserAdds.push({
        ...result,
        id: tempUserItemId--,
        is_user_content: true,
        completed: false,
      });
    } else if (result.mode === 'update' && result.id) {
      const { mode, id, level, ...updateFields } = result;
      if (result.id < 0) {
        const add = pendingContent.pendingUserAdds.find(a => a.id === result.id);
        if (add) Object.assign(add, updateFields, { id: result.id });
      } else {
        pendingContent.pendingUserEdits.set(result.id, updateFields);
      }
    } else if (result.mode === 'import' && Array.isArray(result.items)) {
      result.items.forEach(src => {
        pendingContent.pendingImports.push({
          id: tempUserItemId--,
          skill_id: planSkill.skill_id,
          level: result.level,
          type: src.type || 'action',
          title: src.title,
          description: src.description,
          description_format: src.description_format || 'markdown',
          url: src.url,
          position: 1000,
          is_private: src.is_private ?? false,
          source_user_content_id: src.id,
          is_user_content: true,
        });
      });
    }
    refreshContentView();
  }

  function refreshContentView(forceResetPending = false) {
    rebuildAllContentItems();
    prunePendingOrder();
    syncCompletionStateFromItems(forceResetPending);

    if (!selectedItemKey) {
      const first = visibleItems()[0];
      selectedItemKey = first ? itemKey(first) : null;
    }

    ensureSelectedItemVisible();
    renderList();
    renderReader();
    updateProgress();
    updateDirtyUI();
  }

  function updateDirtyUI() {
    const dirty = isDirty();
    modal.classList.toggle('dirty', dirty);
    footer.classList.toggle('sdm-footer--dirty', dirty);
    saveBtn.disabled = false;
    footerStatus.textContent = dirty
      ? 'Pending changes — click Save Details to apply'
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
    const visibleSections = [];
    visibleSectionKeys().forEach(secKey => {
      if (itemsBySection[secKey]?.length) visibleSections.push(secKey);
    });

    const track = el('div', { className: 'sdm-3e-track' });

    visibleSections.forEach((secKey, sectionIndex) => {
      const items = itemsBySection[secKey];
      hasAny = true;

      const state = getSectionTreeState(secKey);
      const cfg = LEVEL_CONFIG.find(l => l.key === secKey);
      const sectionClasses = ['sdm-3e-section', `sdm-3e-section--${secKey}`];
      if (!state.expanded) sectionClasses.push('sdm-3e-section--collapsed');
      if (!state.canToggle) sectionClasses.push('sdm-3e-section--locked');
      if (state.isFocus) sectionClasses.push('sdm-3e-section--focus');
      if (sectionIndex === visibleSections.length - 1) sectionClasses.push('sdm-3e-section--last');

      const section = el('div', { className: sectionClasses.join(' ') });

      const rail = el('div', { className: 'sdm-3e-section__rail' });
      const bubble = el('div', { className: 'sdm-3e-section__bubble', 'aria-hidden': 'true' });
      bubble.innerHTML = THREE_E_SECTION_ICONS[secKey] || '';
      rail.appendChild(bubble);
      rail.appendChild(el('div', { className: 'sdm-3e-section__connector', 'aria-hidden': 'true' }));

      const main = el('div', { className: 'sdm-3e-section__main' });

      const hdr = el('button', {
        type: 'button',
        className: 'sdm-3e-section__header',
        'aria-expanded': String(state.expanded),
      });
      const hdrLabel = el('span', { className: 'sdm-3e-section__label' });
      hdrLabel.textContent = cfg.label;
      const done = items.filter(i => pending.completions[itemKey(i)]).length;
      const hdrCount = el('span', { className: 'sdm-3e-section__count' });
      hdrCount.textContent = `${done}/${items.length}`;
      const toggleGlyph = el('span', { className: 'sdm-3e-section__toggle', 'aria-hidden': 'true' });
      toggleGlyph.textContent = state.expanded ? '\u2212' : '+';
      hdr.appendChild(hdrLabel);
      hdr.appendChild(hdrCount);
      hdr.appendChild(toggleGlyph);

      hdr.addEventListener('click', () => {
        const current = getSectionTreeState(secKey);
        if (!current?.canToggle) return;
        manualExpanded[secKey] = !current.expanded;
        ensureSelectedItemVisible();
        renderList();
        renderReader();
      });

      main.appendChild(hdr);

      const body = el('div', { className: 'sdm-3e-section__body' });

      sortItemsForLevel(items, secKey).forEach(item => {
        const key = itemKey(item);
        const row = el('div', {
          className: 'sdm-list-item'
            + (key === selectedItemKey ? ' active' : '')
            + (isCompletionDirty(key) ? ' pending-complete' : '')
            + (pending.completions[key] ? ' completed' : '')
            + (isRestoredPendingItem(item) ? ' sdm-list-item--restore-pending' : ''),
          draggable: 'true',
          'data-item-key': key,
        });

        const grip = el('span', {
          className: 'sdm-list-grip',
          'aria-hidden': 'true',
          title: 'Drag to reorder',
        });
        grip.innerHTML = SVG_ICONS.grip;

        row.addEventListener('dragstart', (e) => {
          draggingItemKey = key;
          row.classList.add('sdm-list-item--dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', key);
        });
        row.addEventListener('dragend', () => {
          draggingItemKey = null;
          row.classList.remove('sdm-list-item--dragging');
          body.querySelectorAll('.sdm-list-item--drop-target').forEach(el => {
            el.classList.remove('sdm-list-item--drop-target');
          });
        });
        row.addEventListener('dragover', (e) => {
          if (!draggingItemKey || draggingItemKey === key) return;
          e.preventDefault();
          row.classList.add('sdm-list-item--drop-target');
        });
        row.addEventListener('dragleave', () => {
          row.classList.remove('sdm-list-item--drop-target');
        });
        row.addEventListener('drop', (e) => {
          e.preventDefault();
          row.classList.remove('sdm-list-item--drop-target');
          const fromKey = draggingItemKey || e.dataTransfer.getData('text/plain');
          if (!fromKey || fromKey === key) return;
          const currentOrder = sortItemsForLevel(items, secKey).map(itemKey);
          const fromIdx = currentOrder.indexOf(fromKey);
          const toIdx = currentOrder.indexOf(key);
          if (fromIdx < 0 || toIdx < 0) return;
          currentOrder.splice(fromIdx, 1);
          currentOrder.splice(toIdx, 0, fromKey);
          setLevelOrder(secKey, currentOrder);
          renderList();
          renderReader();
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
        const eff = getEffectiveItemFields(item);
        const metaParts = [formatContentTypeLabel(eff.type)];
        if (item.is_user_content) metaParts.push('My item');
        metaSpan.textContent = metaParts.join(' · ');
        textWrap.appendChild(titleSpan);
        textWrap.appendChild(metaSpan);
        textWrap.addEventListener('click', async () => {
          if (selectedItemKey !== key) {
            if (hasUnsavedInlineEditDraft()) {
              const discard = await showConfirm('Discard unsaved edits?', true);
              if (!discard) return;
            }
            inlineEditKey = null;
            destroyInlineEditor();
          }
          selectedItemKey = key;
          renderList();
          renderReader();
        });

        row.appendChild(grip);
        row.appendChild(check);
        row.appendChild(textWrap);
        body.appendChild(row);
      });

      main.appendChild(body);
      section.appendChild(rail);
      section.appendChild(main);
      track.appendChild(section);
    });

    if (hasAny) {
      listScroll.appendChild(track);
    }

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

    if (item.is_user_content) {
      const delBtn = el('button', {
        type: 'button',
        className: 'btn btn-danger btn-sm',
        'aria-label': 'Delete item',
        title: 'Delete',
      });
      delBtn.innerHTML = SVG_ICONS.trash;
      delBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          `Remove "${item.title}" from this skill? Applies when you save skill details.`,
          true,
        );
        if (!confirmed) return;
        if (item.id < 0) {
          pendingContent.pendingUserAdds = pendingContent.pendingUserAdds.filter(a => a.id !== item.id);
          pendingContent.pendingImports = pendingContent.pendingImports.filter(a => a.id !== item.id);
        } else {
          pendingContent.deleteUserIds.add(item.id);
        }
        if (selectedItemKey === itemKey(item)) selectedItemKey = null;
        refreshContentView();
      });
      readerActions.appendChild(delBtn);
      return;
    }

    const hideBtn = el('button', {
      type: 'button',
      className: 'btn btn-secondary btn-sm',
      'aria-label': 'Hide item',
      title: 'Hide from my view',
    });
    hideBtn.innerHTML = SVG_ICONS.trash;
    hideBtn.addEventListener('click', async () => {
      const confirmed = await showConfirm(
        `Hide "${item.title}" from your view? You can restore it later with re-sync. Applies when you save skill details.`,
        true,
      );
      if (!confirmed) return;
      pendingContent.hideCatalogIds.add(item.id);
      if (selectedItemKey === itemKey(item)) selectedItemKey = null;
      refreshContentView();
    });
    readerActions.appendChild(hideBtn);
  }

  function destroyInlineEditor() {
    if (inlineEditorInstance?.destroy) {
      inlineEditorInstance.destroy();
    }
    inlineEditorInstance = null;
  }

  function readInlineEditForm() {
    const typeEl = readerContent.querySelector('.sdm-reader-detail__type');
    const urlEl = readerContent.querySelector('.sdm-reader-detail__url');
    let description = '';
    if (inlineEditorInstance?.getMarkdown) {
      description = inlineEditorInstance.getMarkdown();
    } else if (inlineEditorInstance?.quill) {
      description = inlineEditorInstance.quill.root.innerHTML;
    }
    return {
      type: typeEl?.value || 'action',
      url: (urlEl?.value || '').trim(),
      description,
    };
  }

  function mountInlineEditor(item) {
    const host = readerContent.querySelector('.sdm-reader-detail__editor-host');
    if (!host) return;
    destroyInlineEditor();
    const baseline = getDetailEditBaseline(item);
    if (item.is_user_content) {
      mountMarkdownEditor(host, {
        initialMarkdown: baseline.description || '',
      }).then((api) => {
        inlineEditorInstance = api;
      }).catch((err) => {
        console.error('Editor init failed:', err);
        showToast('Failed to load editor', 'error');
      });
    } else if (typeof Quill !== 'undefined') {
      const editorEl = el('div', { className: 'sdm-reader-detail__quill' });
      host.appendChild(editorEl);
      const quill = new Quill(editorEl, {
        theme: 'snow',
        placeholder: 'Add notes or adapt the catalog description for your plan…',
        modules: {
          toolbar: [['bold', 'italic'], [{ header: [2, 3, false] }], ['link'], ['clean']],
        },
      });
      quill.root.innerHTML = baseline.description || '';
      inlineEditorInstance = {
        quill,
        destroy() { host.innerHTML = ''; },
      };
    } else {
      const editorEl = el('div', {
        className: 'sdm-reader-detail__quill',
        contentEditable: 'true',
      });
      editorEl.innerHTML = baseline.description || '';
      host.appendChild(editorEl);
      inlineEditorInstance = {
        quill: { root: editorEl },
        destroy() { host.innerHTML = ''; },
      };
    }
  }

  function cancelInlineEdit() {
    inlineEditKey = null;
    destroyInlineEditor();
    renderReader();
  }

  function startInlineEdit(item) {
    inlineEditKey = itemKey(item);
    destroyInlineEditor();
    renderReader();
    requestAnimationFrame(() => mountInlineEditor(item));
  }

  function commitInlineEdit(item) {
    const draft = readInlineEditForm();
    if (item.is_user_content) {
      pendingContent.pendingUserEdits.set(item.id, {
        type: draft.type,
        url: draft.url || null,
        description: draft.description,
        description_format: 'markdown',
      });
    } else {
      const cat = getCatalogBaseline(item);
      const entry = {
        description: draft.description !== cat.description ? draft.description : '',
        type: draft.type !== cat.type ? draft.type : null,
        url: draft.url !== (cat.url ?? '') ? (draft.url || null) : null,
      };
      const hadSaved = savedContent.overrides.has(item.id);
      const isEmpty = !entry.description?.trim() && !entry.type && entry.url == null;
      if (isEmpty && !hadSaved) {
        pendingContent.overrides.delete(item.id);
      } else {
        pendingContent.overrides.set(item.id, entry);
      }
    }
    inlineEditKey = null;
    destroyInlineEditor();
    refreshContentView();
  }

  function buildTypeSelect(className, value) {
    const select = el('select', { className });
    CONTENT_TYPE_OPTIONS.forEach(opt => {
      const option = el('option', { value: opt.value });
      option.textContent = opt.label;
      if (opt.value === value) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  function buildReaderDetailPanel(item, key) {
    const panel = el('div', { className: 'sdm-reader-detail' });
    const fields = getEffectiveItemFields(item);
    const isEditing = inlineEditKey === key;

    if (isEditing) {
      panel.classList.add('sdm-reader-detail--editing');
      const baseline = getDetailEditBaseline(item);
      const form = el('div', { className: 'sdm-reader-detail__form' });

      const typeRow = el('div', { className: 'sdm-reader-detail__field' });
      typeRow.appendChild(el('label', { className: 'sdm-reader-detail__label', textContent: 'Type' }));
      typeRow.appendChild(buildTypeSelect('form-input sdm-reader-detail__type', baseline.type || 'action'));
      form.appendChild(typeRow);

      const urlRow = el('div', { className: 'sdm-reader-detail__field' });
      urlRow.appendChild(el('label', { className: 'sdm-reader-detail__label', textContent: 'Resource link' }));
      urlRow.appendChild(el('input', {
        type: 'url',
        className: 'form-input sdm-reader-detail__url',
        placeholder: 'https://…',
        value: baseline.url || '',
      }));
      form.appendChild(urlRow);

      const descRow = el('div', { className: 'sdm-reader-detail__field sdm-reader-detail__field--grow' });
      descRow.appendChild(el('label', {
        className: 'sdm-reader-detail__label',
        textContent: item.is_user_content ? 'Description' : 'Notes & description',
      }));
      descRow.appendChild(el('div', { className: 'sdm-reader-detail__editor-host content-edit-quill-wrap' }));
      form.appendChild(descRow);
      panel.appendChild(form);

      const actions = el('div', { className: 'sdm-reader-detail__edit-actions' });
      const hint = el('span', { className: 'sdm-reader-detail__edit-hint' });
      hint.textContent = 'Changes apply when you save skill details.';
      const btnGroup = el('div', { className: 'sdm-reader-detail__edit-btns' });
      const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-sm' });
      cancelBtn.textContent = 'Cancel';
      const applyBtn = el('button', { type: 'button', className: 'btn btn-primary btn-sm' });
      applyBtn.textContent = 'Done';
      cancelBtn.addEventListener('click', cancelInlineEdit);
      applyBtn.addEventListener('click', () => commitInlineEdit(item));
      btnGroup.appendChild(cancelBtn);
      btnGroup.appendChild(applyBtn);
      actions.appendChild(hint);
      actions.appendChild(btnGroup);
      panel.appendChild(actions);
      return panel;
    }

    const head = el('div', { className: 'sdm-reader-detail__head' });
    const meta = el('div', { className: 'sdm-reader-detail__meta' });
    meta.appendChild(el('span', {
      className: 'sdm-reader-detail__type-chip',
      textContent: formatContentTypeLabel(fields.type),
    }));
    if (fields.url) {
      meta.appendChild(el('a', {
        className: 'sdm-reader-detail__resource-link',
        href: fields.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        textContent: 'Open resource',
      }));
    }
    if (item.is_user_content) {
      meta.appendChild(el('span', { className: 'mp-user-content-badge', textContent: 'My item' }));
    }
    const editBtn = el('button', {
      type: 'button',
      className: 'sdm-reader-detail__edit-btn',
      'aria-label': 'Edit item details',
      title: 'Edit',
    });
    editBtn.innerHTML = `${SVG_ICONS.pencil}<span>Edit</span>`;
    editBtn.addEventListener('click', () => startInlineEdit(item));
    head.appendChild(meta);
    head.appendChild(editBtn);
    panel.appendChild(head);

    const body = el('div', { className: 'sdm-reader-detail__body sdm-reader-prose' });
    if (fields.description) {
      body.innerHTML = item.is_user_content
        ? renderDescription(fields.description, fields.description_format)
        : fields.description;
    } else {
      body.appendChild(el('p', {
        className: 'sdm-reader-detail__empty',
        textContent: item.is_user_content
          ? 'No description yet. Click Edit to add one.'
          : 'No description available. Click Edit to add personal notes.',
      }));
    }
    panel.appendChild(body);

    if (fields.isPersonalized && !item.is_user_content) {
      const foot = el('div', { className: 'sdm-reader-detail__foot' });
      foot.appendChild(el('span', { className: 'mp-override-badge', textContent: 'Personalized' }));
      panel.appendChild(foot);
    }

    return panel;
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
    const fields = getEffectiveItemFields(item);

    completeBtn.className = 'sdm-complete-btn'
      + (done ? ' done' : '')
      + (dirty ? ' pending' : '');
    completeIcon.innerHTML = done ? SVG_ICONS.circleCheck : SVG_ICONS.circle;
    completeLabel.textContent = done
      ? (dirty ? 'Complete (unsaved)' : 'Completed')
      : 'Mark complete';

    readerMeta.innerHTML = '';
    const metaLine = el('span');
    metaLine.textContent = `${cfg.label} · ${formatContentTypeLabel(fields.type)}`;
    readerMeta.appendChild(metaLine);
    if (dirty) {
      const pendingHint = el('span', { className: 'sdm-reader-meta__pending' });
      pendingHint.textContent = 'Change pending save';
      readerMeta.appendChild(pendingHint);
    }
    if (isRestoredPendingItem(item)) {
      const restoreHint = el('span', { className: 'sdm-reader-meta__restore-pending' });
      restoreHint.textContent = 'Restored — pending save';
      readerMeta.appendChild(restoreHint);
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

    readerContent.appendChild(buildReaderDetailPanel(item, key));
  }

  function syncTrainingLogsFromPlan() {
    const fresh = (_planData?.skills || []).find(s => s.id === planSkill.id);
    if (fresh?.training_logs) {
      planSkill.training_logs = fresh.training_logs;
    }
    visibleLogCount = 5;
    renderLogList();
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

  function syncCompletionStateFromItems(forceResetPending = false) {
    const nextSaved = {};
    allContentItems.forEach(item => {
      nextSaved[itemKey(item)] = !!item.completed;
    });
    saved.completions = nextSaved;

    if (forceResetPending || !isDirty()) {
      pending.completions = { ...saved.completions };
      return;
    }

    const merged = { ...pending.completions };
    Object.entries(nextSaved).forEach(([key, value]) => {
      if (!(key in merged)) merged[key] = value;
    });
    Object.keys(merged).forEach(key => {
      if (!(key in nextSaved)) delete merged[key];
    });
    pending.completions = merged;
  }

  function refreshContent(forceResetPending = false) {
    contentLoading = true;
    renderList();
    renderReader();

    return api.get(`/api/plans/${_engineerId}/skills/${planSkill.id}/content?include_hidden=true`).then(data => {
      contentLoading = false;
      const items = (Array.isArray(data.items) ? data.items : [])
        .filter(item => item && item.title && String(item.title).trim() !== '' && [1, 2, 3, 4, 5].includes(item.level));

      fullCatalogItems = items.filter(item => !item.is_user_content);
      userContentItems = items.filter(item => item.is_user_content);
      serverHiddenIds = new Set(fullCatalogItems.filter(item => item.is_hidden).map(item => item.id));

      syncContentSnapshotsFromItems();
      refreshContentView(forceResetPending);
      if (!orderInitialized || forceResetPending) {
        captureSavedOrder(items);
        orderInitialized = true;
      }
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

  function resetPendingContent() {
    pendingContent.hideCatalogIds.clear();
    pendingContent.deleteUserIds.clear();
    pendingContent.catalogRefreshPending = false;
    pendingContent.restoredCatalogIds.clear();
    pendingContent.overrides.clear();
    pendingContent.pendingUserAdds = [];
    pendingContent.pendingUserEdits.clear();
    pendingContent.pendingImports = [];
    pendingContent.orderByLevel = { education: null, exposure: null, experience: null };
  }

  function discardPendingState() {
    pending.status = saved.status;
    pending.focus = saved.focus;
    pending.prof = saved.prof;
    pending.completions = { ...saved.completions };
    statusSelect.value = saved.status;
    focusSelect.value = saved.focus;
    profSelect.value = saved.prof;
    inlineEditKey = null;
    destroyInlineEditor();
    resetPendingContent();
  }

  function discardChanges() {
    discardPendingState();
    return refreshContent(true).then(() => {
      updateDirtyUI();
      renderList();
      renderReader();
      updateProgress();
    });
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
    renderSections();
  }

  async function doSave() {
    if (inlineEditKey) {
      const item = getSelectedItem();
      if (item) commitInlineEdit(item);
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await api.put(`/api/plans/${_engineerId}/skills/${planSkill.id}`, {
        status: pending.status,
        proficiency_level: pending.prof ? Number(pending.prof) : null,
        focus_area: pending.focus,
        notes: planSkill.notes || null,
      });

      const tempToReal = new Map();

      for (const add of pendingContent.pendingUserAdds) {
        const created = await api.post(
          `/api/plans/${_engineerId}/skills/${planSkill.id}/user-content`,
          {
            level: add.level,
            type: add.type,
            title: add.title,
            description: add.description,
            description_format: add.description_format || 'markdown',
            url: add.url,
            is_private: add.is_private ?? false,
          },
        );
        tempToReal.set(add.id, created.id);
      }

      const importsByLevel = new Map();
      pendingContent.pendingImports.forEach(item => {
        if (!importsByLevel.has(item.level)) importsByLevel.set(item.level, []);
        importsByLevel.get(item.level).push(item.source_user_content_id);
      });
      for (const [level, sourceIds] of importsByLevel) {
        if (!sourceIds.length) continue;
        const data = await api.post(
          `/api/plans/${_engineerId}/skills/${planSkill.skill_id}/library/import?level=${level}`,
          { source_ids: sourceIds },
        );
        (data.imported || []).forEach(row => {
          const pendingRow = pendingContent.pendingImports.find(
            p => p.source_user_content_id === row.source_user_content_id,
          );
          if (pendingRow) tempToReal.set(pendingRow.id, row.id);
        });
      }

      for (const [itemId, payload] of pendingContent.pendingUserEdits) {
        if (itemId < 0) continue;
        await api.put(
          `/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${itemId}`,
          payload,
        );
      }

      if (pendingContent.catalogRefreshPending) {
        await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/resync`, {});
      }

      if (isOrderDirty()) {
        const orderPayload = buildOrderPayload(tempToReal);
        if (orderPayload.length) {
          await api.put(
            `/api/plans/${_engineerId}/skills/${planSkill.id}/content/order`,
            { items: orderPayload },
          );
        }
      }

      for (const contentId of pendingContent.hideCatalogIds) {
        await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/content/${contentId}/hide`, {});
      }

      for (const userContentId of pendingContent.deleteUserIds) {
        if (userContentId < 0) continue;
        await api.del(`/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${userContentId}`);
      }

      for (const [contentId, payload] of pendingContent.overrides) {
        if (pendingContent.restoredCatalogIds.has(contentId)) continue;
        const baseline = savedContent.overrides.get(contentId);
        if (overrideEntriesEqual(payload, baseline)) continue;
        const norm = normalizeOverrideEntry(payload);
        await api.post(`/api/plans/${_engineerId}/skills/${planSkill.id}/content/${contentId}/override`, {
          override_description: norm.description,
          override_type: norm.type || null,
          override_url: norm.url,
        });
      }

      for (const item of allContentItems) {
        const key = itemKey(item);
        if (pending.completions[key] === saved.completions[key]) continue;
        let itemId = item.id;
        if (itemId < 0 && tempToReal.has(itemId)) itemId = tempToReal.get(itemId);
        if (itemId < 0) continue;

        const endpoint = item.is_user_content
          ? `/api/plans/${_engineerId}/skills/${planSkill.id}/user-content/${itemId}/complete`
          : `/api/plans/${_engineerId}/skills/${planSkill.id}/content/${itemId}/complete`;
        await api.post(endpoint, {});
      }

      saved.status = pending.status;
      saved.focus = pending.focus;
      saved.prof = pending.prof;
      saved.completions = { ...pending.completions };
      FOCUS_ORDER.forEach(levelKey => {
        if (pendingContent.orderByLevel[levelKey]) {
          savedContent.orderByLevel[levelKey] = pendingContent.orderByLevel[levelKey].slice();
        }
      });
      resetPendingContent();

      showToast('Skill details saved', 'success');
      await reloadPlan();
      syncTrainingLogsFromPlan();
      await refreshContent(true);
      updateDirtyUI();
      saveBtn.textContent = 'Save Details';
    } catch (err) {
      showToast(err.message || 'Failed to save changes', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Details';
    }
  }

  async function promptUnsavedChanges() {
    return showModal({
      title: 'Unsaved Changes',
      body: 'You have unsaved changes in this skill. What would you like to do?',
      modalClass: 'modal-confirm-actions',
      actions: [
        { label: 'Continue Editing', value: 'continue', className: 'btn btn-secondary' },
        { label: 'Discard Changes', value: 'discard', className: 'btn btn-danger' },
        { label: 'Save Changes', value: 'save', className: 'btn btn-primary' },
      ],
    });
  }

  async function attemptCloseModal() {
    if (hasUnsavedInlineEditDraft()) {
      const discardNotes = await showConfirm('Discard unsaved edits and close?', true);
      if (!discardNotes) return;
      inlineEditKey = null;
      destroyInlineEditor();
      renderReader();
    }
    if (!isDirty()) {
      closeModal();
      return;
    }
    const choice = await promptUnsavedChanges();
    if (choice === 'save') {
      await doSave();
      return;
    }
    if (choice === 'discard') {
      discardPendingState();
      closeModal();
      return;
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      attemptCloseModal();
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
    openLibraryModal(
      { mode: 'create', planSkill, engineerId: _engineerId, levelKey, level, deferSave: true },
      applyLibraryDeferredResult,
    );
  });

  logToggle.addEventListener('click', () => {
    const open = logPanel.classList.toggle('open');
    logToggle.setAttribute('aria-expanded', String(open));
  });

  restoreBtn.addEventListener('click', async () => {
    const choice = await showModal({
      title: 'Restore from Catalog',
      body: 'Restoring from the catalog will refresh all catalog-managed items and update the list to match the current catalog definition.<br><br>Your personal items and personal notes will be preserved.<br><br>Do you want to continue?',
      actions: [
        { label: 'Cancel', value: 'cancel', className: 'btn btn-secondary' },
        { label: 'Restore from Catalog', value: 'restore', className: 'btn btn-primary' },
      ],
    });
    if (choice !== 'restore') return;
    restoreBtn.disabled = true;
    try {
      await previewRestoreFromCatalog();
      showToast('Catalog items restored in view — click Save Details to keep', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to restore from catalog', 'error');
    } finally {
      restoreBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', doSave);

  discardBtn.addEventListener('click', async () => {
    if (!isDirty()) return;
    const confirmed = await showConfirm('Discard all pending changes?', true);
    if (confirmed) await discardChanges();
  });

  closeBtn.addEventListener('click', () => { attemptCloseModal(); });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) attemptCloseModal();
  });

  document.addEventListener('keydown', onKeyDown);

  renderLogList();
  refreshContent();
  updateDirtyUI();
}

const TRAINING_LOG_BADGE_LABELS = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  added: 'Added',
  updated: 'Updated',
  removed: 'Removed',
  moved: 'Moved',
  restored: 'Restored',
};

function parseTrainingLogTitle(rawTitle) {
  const title = (rawTitle || '').trim();
  const patterns = [
    { re: /^uncompleted:\s*(.+)$/i, action: 'incomplete' },
    { re: /^marked incomplete:\s*(.+)$/i, action: 'incomplete' },
    { re: /^completed:\s*(.+)$/i, action: 'completed' },
    { re: /^marked complete:\s*(.+)$/i, action: 'completed' },
    { re: /^hidden:\s*(.+)$/i, action: 'removed' },
    { re: /^removed user content:\s*(.+)$/i, action: 'removed' },
    { re: /^restored from catalog:\s*(.+)$/i, action: 'restored' },
    { re: /^(?:added|updated) personal notes:\s*(.+)$/i, action: 'updated' },
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
  if (title.includes('restored from catalog')) return 'restored';
  if (title.startsWith('added') || title.includes('imported')) return 'added';
  if (title.startsWith('hidden') || title.startsWith('removed') || title.startsWith('deleted')) return 'removed';
  if (title.includes('personal notes') || title.startsWith('updated') || title.includes('override')) return 'updated';
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

function openAddSkillChooserModal() {
  const root = document.getElementById('modalRoot');
  if (!root) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', {
    className: 'modal modal-add-skill-chooser',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Add Skill',
  });

  const header = el('div', { className: 'modal-header' });
  const title = el('h2', { className: 'modal-title' });
  title.textContent = 'Add Skill';
  const closeBtn = el('button', {
    type: 'button',
    className: 'modal-close',
    'aria-label': 'Close',
  });
  closeBtn.textContent = '\u2715';
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', { className: 'modal-body mp-add-skill-chooser' });
  const intro = el('p', { className: 'mp-add-skill-chooser__intro' });
  intro.textContent = 'Choose how you want to add a skill to your development plan.';
  body.appendChild(intro);

  const options = [
    {
      id: 'own',
      title: 'Own Skill',
      desc: 'Manually create a custom skill that is personal to your plan.',
      icon: 'pencil',
      action: () => openOwnSkillModal(),
    },
    {
      id: 'team',
      title: "My Team's Skills",
      desc: 'Browse technical skills curated for your team in the catalog.',
      icon: 'users',
      action: () => { window.location.hash = '#/catalog?addMode=team'; },
    },
    {
      id: 'catalog',
      title: 'From Catalog',
      desc: 'Explore the complete skills library across all teams and domains.',
      icon: 'bookOpen',
      action: () => { window.location.hash = '#/catalog?addMode=all'; },
    },
  ];

  const grid = el('div', { className: 'mp-add-skill-chooser__grid' });
  options.forEach(opt => {
    const card = el('button', {
      type: 'button',
      className: 'mp-add-skill-option',
      'data-option': opt.id,
    });
    const iconWrap = el('span', { className: 'mp-add-skill-option__icon' });
    iconWrap.appendChild(svgIcon(opt.icon, '22px'));
    const textWrap = el('span', { className: 'mp-add-skill-option__text' });
    const cardTitle = el('span', { className: 'mp-add-skill-option__title' });
    cardTitle.textContent = opt.title;
    const cardDesc = el('span', { className: 'mp-add-skill-option__desc' });
    cardDesc.textContent = opt.desc;
    textWrap.appendChild(cardTitle);
    textWrap.appendChild(cardDesc);
    card.appendChild(iconWrap);
    card.appendChild(textWrap);
    card.addEventListener('click', () => {
      close();
      opt.action();
    });
    grid.appendChild(card);
  });
  body.appendChild(grid);
  modal.appendChild(body);

  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  footer.appendChild(cancelBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 200);
  }

  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    grid.querySelector('.mp-add-skill-option')?.focus();
  });
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

  bodyEl.appendChild(buildOwnSkillCategoryPicker());

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
    title: 'Add Own Skill',
    body: bodyEl,
    confirmText: 'Create Skill',
    cancelText: 'Cancel',
    modalClass: 'modal-own-skill',
    onConfirm: async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Skill name is required', 'error');
        return false;
      }
      const profVal = profSelect.value;
      const selectedCategory = bodyEl.querySelector('.skill-category-item__cb:checked');
      const categoryId = selectedCategory ? Number(selectedCategory.value) : null;
      if (!categoryId || !Number.isFinite(categoryId)) {
        showToast('Select a category', 'error');
        return false;
      }
      try {
        await api.post(`/api/plans/${_engineerId}/own-skills`, {
          name,
          description: descInput.value.trim() || null,
          status: statusSelect.value,
          proficiency_level: profVal ? Number(profVal) : null,
          notes: notesInput.value.trim() || null,
          category_id: categoryId,
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

const OWN_SKILL_CATEGORY_ICONS = {
  foundational: 'seedling',
  core: 'diamond',
  advanced: 'atom',
  ai_future: 'sparkles',
  'ai-future': 'sparkles',
};

function buildOwnSkillCategoryPicker() {
  const group = el('div', { className: 'form-group skill-category-picker mp-own-skill-categories' });
  const label = el('div', { className: 'form-label' });
  label.textContent = 'Category *';
  group.appendChild(label);

  const hint = el('div', { className: 'form-hint' });
  hint.textContent = 'Select one — Foundational, Core, Advanced, or AI & Future Skills.';
  group.appendChild(hint);

  const chips = el('div', { className: 'skill-category-chips' });
  group.appendChild(chips);

  getCategories().then(categories => {
    chips.innerHTML = '';
    if (!Array.isArray(categories) || categories.length === 0) {
      const empty = el('div', { className: 'form-hint' });
      empty.textContent = 'No categories available.';
      chips.appendChild(empty);
      return;
    }

    categories.forEach(cat => {
      const isCore = cat.slug === 'core';
      const chip = el('button', { type: 'button', className: 'mp-filter-chip skill-category-chip' + (isCore ? ' active' : '') });
      chip.dataset.category = cat.slug || '';
      chip.dataset.categoryId = String(cat.id);
      chip.setAttribute('aria-pressed', isCore ? 'true' : 'false');

      const iconName = OWN_SKILL_CATEGORY_ICONS[cat.slug] || OWN_SKILL_CATEGORY_ICONS[cat.slug?.replace(/_/g, '-')] || 'layers';
      chip.appendChild(svgIcon(iconName, '14px'));

      const labelSpan = el('span', { className: 'mp-filter-chip__label' });
      labelSpan.textContent = cat.name;
      chip.appendChild(labelSpan);

      const radio = el('input', { className: 'skill-category-item__cb' });
      radio.type = 'radio';
      radio.name = 'own-skill-category';
      radio.value = String(cat.id);
      radio.checked = isCore;
      chip.appendChild(radio);

      chip.addEventListener('click', () => {
        chips.querySelectorAll('.skill-category-chip').forEach(other => {
          other.classList.remove('active');
          other.setAttribute('aria-pressed', 'false');
          const otherRadio = other.querySelector('.skill-category-item__cb');
          if (otherRadio) otherRadio.checked = false;
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
        radio.checked = true;
      });

      chips.appendChild(chip);
    });
  }).catch(() => {
    const err = el('div', { className: 'form-hint' });
    err.textContent = 'Failed to load categories.';
    chips.appendChild(err);
  });

  return group;
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
