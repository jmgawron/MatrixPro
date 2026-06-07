import { api } from '../api.js';
import { Store } from '../state.js';
import { showToast } from './toast.js';
import { showConfirm, showModal } from './modal.js';
import { createElement } from '../utils/dom.js';
import { getSkillIconSVG, SKILL_ICONS } from './icons.js';
import { THREE_E_ICON_SVG } from './three-e-icons.js?v=1';

const WINDOW_ICONS = {
  maximize: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  minimize: '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>',
};

const GRIP_ICON = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

const THREE_E_SECTION_ICONS = THREE_E_ICON_SVG;

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

const CONTENT_TYPES = ['course', 'certification', 'reading', 'link', 'action'];

const LEVEL_CONFIG = [
  { key: 'education', label: 'Education' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'experience', label: 'Experience' },
];
const LEVEL_MAP = { 1: 'education', 2: 'exposure', 3: 'experience' };
const LEVEL_REVERSE = { education: 1, exposure: 2, experience: 3 };
const SECTION_ORDER = ['education', 'exposure', 'experience'];

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

function formSnapshot(data) {
  const normalized = { ...data };
  ['team_ids', 'certificate_ids', 'category_ids', 'tag_names'].forEach((key) => {
    if (Array.isArray(normalized[key])) {
      normalized[key] = [...normalized[key]].sort((a, b) => a - b);
    }
  });
  return JSON.stringify(normalized);
}

/**
 * Unified Skill Catalog editor — My Plan shell parity with pending Save Details flow.
 * @param {object|null} skill - Skill object or null for create
 * @param {{ initialTab?: 'content'|'details' }} options
 * @param {object} helpers - buildSkillForm, readSkillForm, validateSkillForm, loadFormData, refreshCatalog, switchTabAndFilter
 */
export function openCatalogSkillEditor(skill, options = {}, helpers) {
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot || !helpers) return;

  const { initialTab = 'content' } = options;
  const user = Store.get('user');
  const canEdit = skill?.id
    ? (helpers.canEditCatalogSkill?.(skill, user) ?? false)
    : (user?.role === 'admin' || user?.role === 'manager');
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  let isCreateMode = !skill?.id;

  let currentSkill = skill ? { ...skill } : null;
  let activeTab = isCreateMode ? 'details' : (canEdit ? initialTab : 'content');
  let isMaximized = false;
  let tempItemId = -1;

  const overlay = createElement('div', { className: 'modal-overlay' });
  const modal = createElement('div', {
    className: 'modal skill-detail-modal sdm-plan-modal catalog-skill-modal catalog-unified-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': isCreateMode ? 'Create skill' : `${currentSkill?.name || 'Skill'} — Skill catalog`,
  });

  const body = createElement('div', { className: 'modal-body sdm-modal-body catalog-unified-body' });

  /* ── Header ─────────────────────────────────────────────────────────── */
  const headerBlock = createElement('header', { className: 'sdm-header catalog-skill-header' });
  const headerTop = createElement('div', { className: 'sdm-header__top' });
  const titleWrap = createElement('div', { className: 'catalog-skill-header__title-wrap' });
  const titleIconWrap = createElement('div', { className: 'catalog-skill-header__icon', 'aria-hidden': 'true' });
  const titleEl = createElement('h1', { className: 'sdm-header__title' });
  titleWrap.appendChild(titleIconWrap);
  titleWrap.appendChild(titleEl);

  const headerActions = createElement('div', { className: 'sdm-header__actions' });
  const maximizeBtn = createElement('button', {
    type: 'button',
    className: 'sdm-window-btn sdm-maximize-btn',
    'aria-label': 'Maximize',
    title: 'Maximize',
  });
  maximizeBtn.innerHTML = WINDOW_ICONS.maximize;
  const closeBtn = createElement('button', {
    type: 'button',
    className: 'sdm-window-btn sdm-close',
    'aria-label': 'Close',
    title: 'Close',
  });
  closeBtn.textContent = '\u2715';
  const windowControls = createElement('div', { className: 'sdm-header__window-controls' });
  windowControls.appendChild(maximizeBtn);
  windowControls.appendChild(closeBtn);
  headerActions.appendChild(windowControls);
  headerTop.appendChild(titleWrap);
  headerTop.appendChild(headerActions);
  headerBlock.appendChild(headerTop);

  const archivedBadge = createElement('div', { className: 'catalog-skill-archived' });
  archivedBadge.textContent = 'Archived';
  archivedBadge.hidden = true;

  const descEl = createElement('p', { className: 'sdm-notes' });
  const descToggle = createElement('button', { type: 'button', className: 'sdm-notes-toggle' });
  descToggle.textContent = 'Show more';
  descToggle.hidden = true;
  let descExpanded = false;

  const metaPanel = createElement('div', { className: 'catalog-skill-meta' });

  headerBlock.appendChild(archivedBadge);
  headerBlock.appendChild(descEl);
  headerBlock.appendChild(descToggle);
  headerBlock.appendChild(metaPanel);
  body.appendChild(headerBlock);

  /* ── Tabs (manager/admin only) ─────────────────────────────────────── */
  const tabBar = createElement('div', {
    className: 'catalog-unified-tabs',
    role: 'tablist',
    'aria-label': 'Skill editor sections',
  });
  const contentTabBtn = createElement('button', {
    type: 'button',
    className: 'catalog-unified-tab',
    role: 'tab',
    'aria-selected': 'false',
    'data-tab': 'content',
  });
  contentTabBtn.textContent = 'Content';
  const detailsTabBtn = createElement('button', {
    type: 'button',
    className: 'catalog-unified-tab',
    role: 'tab',
    'aria-selected': 'false',
    'data-tab': 'details',
  });
  detailsTabBtn.textContent = 'Details';
  if (canEdit) {
    tabBar.appendChild(contentTabBtn);
    tabBar.appendChild(detailsTabBtn);
    body.appendChild(tabBar);
  }

  /* ── Panels ─────────────────────────────────────────────────────────── */
  const contentPanel = createElement('div', {
    className: 'catalog-unified-panel',
    role: 'tabpanel',
    'data-panel': 'content',
  });
  const detailsPanel = createElement('div', {
    className: 'catalog-unified-panel catalog-unified-panel--details',
    role: 'tabpanel',
    'data-panel': 'details',
  });
  const detailsScroll = createElement('div', { className: 'catalog-unified-details-scroll' });
  detailsPanel.appendChild(detailsScroll);
  body.appendChild(contentPanel);
  if (canEdit) body.appendChild(detailsPanel);

  /* Content tab layout */
  const mainArea = createElement('div', { className: 'sdm-main' });
  const listCol = createElement('div', { className: 'sdm-list-col' });
  const listScroll = createElement('div', { className: 'sdm-list-scroll' });
  const listFooter = createElement('div', { className: 'sdm-list-footer catalog-skill-list-footer' });
  listCol.appendChild(listScroll);
  listCol.appendChild(listFooter);
  const readerCol = createElement('div', { className: 'sdm-reader-col' });
  const readerToolbar = createElement('div', { className: 'sdm-reader-toolbar catalog-skill-reader-toolbar' });
  const readerToolbarLeft = createElement('div', { className: 'sdm-reader-toolbar__left' });
  const readerActions = createElement('div', { className: 'sdm-reader-actions' });
  readerToolbarLeft.appendChild(readerActions);
  const readerMeta = createElement('div', { className: 'sdm-reader-meta' });
  readerToolbar.appendChild(readerToolbarLeft);
  readerToolbar.appendChild(readerMeta);
  const readerScroll = createElement('div', { className: 'sdm-reader-scroll' });
  const readerContent = createElement('div', { className: 'sdm-reader-content' });
  readerScroll.appendChild(readerContent);
  readerCol.appendChild(readerToolbar);
  readerCol.appendChild(readerScroll);
  mainArea.appendChild(listCol);
  mainArea.appendChild(readerCol);
  contentPanel.appendChild(mainArea);

  /* Add Item dropdown */
  const addItemBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm catalog-add-item-btn',
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
  });
  addItemBtn.textContent = '+ Add Item \u25be';
  const addItemMenu = createElement('div', { className: 'catalog-add-item-menu', role: 'menu' });
  LEVEL_CONFIG.forEach(({ key, label }) => {
    const menuBtn = createElement('button', { type: 'button', role: 'menuitem', 'data-level': key });
    const bubble = createElement('span', { className: 'sdm-3e-section__bubble', 'aria-hidden': 'true' });
    bubble.innerHTML = THREE_E_SECTION_ICONS[key] || '';
    menuBtn.appendChild(bubble);
    menuBtn.appendChild(document.createTextNode(label));
    menuBtn.addEventListener('click', () => {
      addItemMenu.classList.remove('open');
      addItemBtn.setAttribute('aria-expanded', 'false');
      startItemEditor('add', key, null);
    });
    addItemMenu.appendChild(menuBtn);
  });
  const reorderHint = createElement('p', { className: 'catalog-reorder-hint' });
  reorderHint.textContent = 'Drag the grip or use arrows to set item order within each section.';
  if (canEdit) {
    listFooter.appendChild(reorderHint);
    listFooter.appendChild(addItemBtn);
    listFooter.appendChild(addItemMenu);
  } else {
    listFooter.hidden = true;
  }

  modal.appendChild(body);

  /* ── Footer ─────────────────────────────────────────────────────────── */
  const footer = createElement('div', { className: 'modal-footer sdm-footer catalog-skill-footer' });
  const footerStatus = createElement('span', { className: 'sdm-footer__status catalog-skill-footer__hint' });
  footerStatus.textContent = 'No pending changes';
  const footerActions = createElement('div', { className: 'catalog-skill-footer__actions' });
  const closeFooterBtn = createElement('button', { type: 'button', className: 'btn btn-secondary' });
  closeFooterBtn.textContent = 'Close';
  const discardBtn = createElement('button', { type: 'button', className: 'btn btn-secondary' });
  discardBtn.textContent = 'Discard Changes';
  const saveBtn = createElement('button', { type: 'button', className: 'btn btn-primary' });
  saveBtn.textContent = 'Save Details';
  footer.appendChild(footerStatus);
  footer.appendChild(footerActions);
  if (canEdit) {
    footerActions.appendChild(discardBtn);
    footerActions.appendChild(saveBtn);
  } else {
    footerActions.appendChild(closeFooterBtn);
  }
  modal.appendChild(footer);

  overlay.appendChild(modal);
  modalRoot.appendChild(overlay);

  /* ── State ──────────────────────────────────────────────────────────── */
  let contentGroups = { education: [], exposure: [], experience: [] };
  let contentLoading = !isCreateMode;
  let selectedItemId = null;
  const expandedSections = { education: false, exposure: false, experience: false };
  let dragSectionKey = null;
  let draggingItemId = null;

  let itemEditorMode = null;
  let itemEditorLevel = null;
  let itemEditorTargetId = null;
  let quillInstance = null;

  let detailsFormEl = null;
  let savedFormSnapshot = '';
  let formBaselineReady = false;
  let userTouchedDetailsForm = false;
  let initialIsNonTechnical = false;
  let reclassifyPreview = null;

  const saved = { content: [] };
  const pending = {
    deletes: new Set(),
    adds: [],
    edits: new Map(),
    orderByLevel: { education: null, exposure: null, experience: null },
  };

  let itemEditorDraft = null;

  function setModalMaximized(maximized) {
    isMaximized = maximized;
    overlay.classList.toggle('modal-overlay--maximized', maximized);
    modal.classList.toggle('sdm-plan-modal--maximized', maximized);
    maximizeBtn.setAttribute('aria-label', maximized ? 'Restore window size' : 'Maximize');
    maximizeBtn.title = maximized ? 'Restore' : 'Maximize';
    maximizeBtn.innerHTML = maximized ? WINDOW_ICONS.minimize : WINDOW_ICONS.maximize;
  }

  function closeModal() {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 200);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('click', closeAddMenuOnOutside);
    destroyQuill();
  }

  function destroyQuill() {
    quillInstance = null;
  }

  function updateHeader() {
    const s = currentSkill;
    titleEl.textContent = s?.name || (isCreateMode ? 'New Skill' : 'Skill');
    titleIconWrap.innerHTML = '';
    if (s?.icon && SKILL_ICONS[s.icon]) {
      titleIconWrap.innerHTML = getSkillIconSVG(s.icon, 26);
    } else {
      titleIconWrap.style.display = 'none';
    }

    archivedBadge.hidden = !s?.is_archived;

    const descText = (s?.description || '').trim();
    if (!descText) {
      descEl.classList.add('sdm-notes--empty');
      descEl.textContent = '';
      descToggle.hidden = true;
    } else {
      descEl.classList.remove('sdm-notes--empty');
      descEl.textContent = descText;
      const overflow = descText.length > 140;
      descToggle.hidden = !overflow;
      descToggle.classList.toggle('visible', overflow);
      descToggle.textContent = descExpanded ? 'Show less' : 'Show more';
      descEl.classList.toggle('sdm-notes--long', descExpanded);
    }

    metaPanel.innerHTML = '';
    const categories = Array.isArray(s?.categories) ? s.categories : [];
    const teams = Array.isArray(s?.teams) ? s.teams : [];
    const certificates = Array.isArray(s?.certificates) ? s.certificates : [];
    const tags = Array.isArray(s?.tags) ? s.tags : [];

    function appendMetaRow(labelText, chipsBuilder) {
      const chips = chipsBuilder();
      if (!chips.length) return;
      const row = createElement('div', { className: 'catalog-skill-meta__row' });
      const label = createElement('span', { className: 'catalog-skill-meta__label' });
      label.textContent = labelText;
      const chipWrap = createElement('div', { className: 'catalog-skill-meta__chips' });
      chips.forEach(chip => chipWrap.appendChild(chip));
      row.appendChild(label);
      row.appendChild(chipWrap);
      metaPanel.appendChild(row);
    }

    appendMetaRow('Category', () => categories.map(cat => {
      const chip = createElement('span', { className: 'mp-modal-category-chip' });
      chip.appendChild(categoryIconSpan(cat.slug, '14px'));
      const name = createElement('span', { className: 'mp-modal-category-chip__name' });
      name.textContent = cat.name;
      chip.appendChild(name);
      return chip;
    }));

    appendMetaRow('Teams', () => {
      const VISIBLE = 3;
      const chips = [];
      teams.slice(0, VISIBLE).forEach(team => {
        const chip = createElement('span', { className: 'triage-chip triage-signal chip-sm' });
        chip.textContent = team.name || team;
        chips.push(chip);
      });
      if (teams.length > VISIBLE) {
        const hidden = teams.slice(VISIBLE);
        const overflow = createElement('span', {
          className: 'triage-chip triage-signal chip-sm team-chip-overflow',
          tabindex: '0',
          'aria-label': `${hidden.length} more teams`,
        });
        overflow.textContent = `+${hidden.length} more`;
        const popover = createElement('span', { className: 'team-chip-overflow__popover', role: 'tooltip' });
        hidden.forEach(team => {
          const line = createElement('span', { className: 'team-chip-overflow__item' });
          line.textContent = team.name || team;
          popover.appendChild(line);
        });
        overflow.appendChild(popover);
        chips.push(overflow);
      }
      return chips;
    });

    appendMetaRow('Certifications', () => certificates.map(cert => {
      const chip = createElement('button', {
        type: 'button',
        className: 'meta-badge meta-badge--cert meta-badge--clickable',
      });
      chip.textContent = cert.name || cert;
      chip.addEventListener('click', () => {
        closeModal();
        helpers.switchTabAndFilter('cert', 'cert_id', cert.id, cert.name);
      });
      return chip;
    }));

    appendMetaRow('Tags', () => tags.map(tag => {
      const chip = createElement('span', { className: 'triage-chip triage-feedback chip-sm' });
      chip.textContent = tag.name || tag;
      return chip;
    }));
  }

  descToggle.addEventListener('click', () => {
    descExpanded = !descExpanded;
    updateHeader();
  });

  function allItemsFlat() {
    const items = [];
    SECTION_ORDER.forEach(key => {
      getSectionItems(key).forEach(item => items.push(item));
    });
    return items;
  }

  function getSectionItems(secKey) {
    const base = contentGroups[secKey] || [];
    const adds = pending.adds.filter(a => LEVEL_MAP[a.level] === secKey);
    const ids = new Set();
    const result = [];

    base.forEach(item => {
      if (pending.deletes.has(item.id)) return;
      const edit = pending.edits.get(item.id);
      result.push(edit ? { ...item, ...edit } : { ...item });
      ids.add(item.id);
    });

    adds.forEach(item => {
      if (!ids.has(item.id)) result.push({ ...item });
    });

    const customOrder = pending.orderByLevel[secKey];
    if (customOrder) {
      const byId = new Map(result.map(i => [i.id, i]));
      const ordered = customOrder.map(id => byId.get(id)).filter(Boolean);
      const remaining = result.filter(i => !customOrder.includes(i.id));
      return ordered.concat(remaining);
    }

    return result.sort((a, b) => {
      const pd = (a.position ?? 0) - (b.position ?? 0);
      return pd !== 0 ? pd : a.id - b.id;
    });
  }

  function findItemById(id) {
    return allItemsFlat().find(item => item.id === id) || null;
  }

  function sortedItems(key) {
    return getSectionItems(key);
  }

  function selectableItems() {
    return SECTION_ORDER.flatMap(key => (
      expandedSections[key] ? sortedItems(key) : []
    ));
  }

  function ensureSelectedVisible() {
    if (selectedItemId && selectableItems().some(i => i.id === selectedItemId)) return;
    const first = selectableItems()[0];
    selectedItemId = first ? first.id : null;
  }

  function hasItemEditorDraft() {
    if (!itemEditorMode || !itemEditorDraft) return false;
    const emptyBody = '<p><br></p>';
    if (itemEditorMode === 'add') {
      return itemEditorDraft.title !== ''
        || itemEditorDraft.url !== ''
        || (itemEditorDraft.description !== '' && itemEditorDraft.description !== emptyBody);
    }
    const orig = findItemById(itemEditorTargetId);
    if (!orig) return true;
    return itemEditorDraft.title !== (orig.title || '')
      || itemEditorDraft.type !== (orig.type || '')
      || itemEditorDraft.url !== (orig.url || '')
      || itemEditorDraft.description !== (orig.description || '');
  }

  function captureFormBaseline() {
    if (!detailsFormEl) return;
    savedFormSnapshot = formSnapshot(helpers.readSkillForm(detailsFormEl));
    formBaselineReady = true;
  }

  function markDetailsTouched() {
    userTouchedDetailsForm = true;
    updateDirtyUI();
  }

  function makeFormHooks() {
    let asyncPending = 0;
    return {
      hooks: {
        notifyChange: markDetailsTouched,
        beginAsync: () => { asyncPending += 1; },
        endAsync: () => {
          asyncPending = Math.max(0, asyncPending - 1);
          if (asyncPending === 0 && detailsFormEl) {
            if (!formBaselineReady) {
              if (!userTouchedDetailsForm) {
                captureFormBaseline();
              }
            } else if (!isDetailsDirty()) {
              captureFormBaseline();
            }
            updateDirtyUI();
          }
        },
      },
      getAsyncPending: () => asyncPending,
    };
  }

  function waitForFormBaseline(maxMs = 5000) {
    return new Promise((resolve) => {
      if (formBaselineReady) {
        resolve();
        return;
      }
      const started = Date.now();
      const tick = () => {
        if (formBaselineReady || Date.now() - started > maxMs) {
          if (!formBaselineReady && detailsFormEl && !userTouchedDetailsForm) {
            captureFormBaseline();
          }
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function isDetailsDirty() {
    if (!detailsFormEl) return isCreateMode;
    const current = formSnapshot(helpers.readSkillForm(detailsFormEl));
    if (!formBaselineReady) {
      if (userTouchedDetailsForm) return current !== savedFormSnapshot;
      return false;
    }
    return current !== savedFormSnapshot;
  }

  /** PUT payload with only fields that changed vs the saved baseline. */
  function buildDetailsUpdatePayload() {
    if (!detailsFormEl || !formBaselineReady || !isDetailsDirty()) return null;
    const current = helpers.readSkillForm(detailsFormEl);
    const baseline = JSON.parse(savedFormSnapshot);
    const payload = {};
    for (const key of ['name', 'description', 'icon', 'is_non_technical']) {
      const cur = current[key] ?? null;
      const base = baseline[key] ?? null;
      if (cur !== base) payload[key] = cur;
    }
    for (const key of ['team_ids', 'certificate_ids', 'category_ids', 'tag_names']) {
      const cur = JSON.stringify(current[key] ?? []);
      const base = JSON.stringify(baseline[key] ?? []);
      if (cur !== base) payload[key] = current[key];
    }
    return Object.keys(payload).length ? payload : null;
  }

  function isContentDirty() {
    if (pending.deletes.size) return true;
    if (pending.adds.length) return true;
    if (pending.edits.size) return true;
    return SECTION_ORDER.some(k => pending.orderByLevel[k] !== null);
  }

  function isDirty() {
    return isContentDirty() || isDetailsDirty() || hasItemEditorDraft();
  }

  function updateDirtyUI() {
    const dirty = isDirty();
    modal.classList.toggle('dirty', dirty);
    footer.classList.toggle('sdm-footer--dirty', dirty);
    footerStatus.textContent = dirty
      ? 'Pending changes — click Save Details to apply'
      : (canEdit ? 'No pending changes' : 'Browse catalog learning content.');
    if (canEdit) {
      saveBtn.disabled = false;
    }
  }

  function updateTabUI() {
    if (!canEdit) {
      contentPanel.classList.add('active');
      return;
    }
    contentTabBtn.classList.toggle('active', activeTab === 'content');
    detailsTabBtn.classList.toggle('active', activeTab === 'details');
    contentTabBtn.setAttribute('aria-selected', String(activeTab === 'content'));
    detailsTabBtn.setAttribute('aria-selected', String(activeTab === 'details'));
    contentPanel.classList.toggle('active', activeTab === 'content');
    detailsPanel.classList.toggle('active', activeTab === 'details');
    contentTabBtn.disabled = isCreateMode;
    if (isCreateMode) {
      contentTabBtn.title = 'Save skill details first to add content';
    } else {
      contentTabBtn.removeAttribute('title');
    }
    renderAddControls();
  }

  async function switchTab(tab) {
    if (tab === activeTab) return;
    if (isDirty()) {
      const choice = await showModal({
        title: 'Unsaved Changes',
        body: 'You have unsaved changes. Discard them and switch tabs?',
        modalClass: 'modal-confirm-actions',
        actions: [
          { label: 'Stay', value: 'stay', className: 'btn btn-secondary' },
          { label: 'Discard & Switch', value: 'discard', className: 'btn btn-danger' },
        ],
      });
      if (choice !== 'discard') return;
      await discardAllPending();
    }
    if (tab === 'content' && isCreateMode) return;
    activeTab = tab;
    if (tab === 'details' && !detailsFormEl) {
      await mountDetailsForm();
    }
    updateTabUI();
    if (tab === 'content') {
      renderList();
      renderReader();
    }
  }

  async function mountDetailsForm() {
    detailsScroll.innerHTML = '';
    formBaselineReady = false;
    userTouchedDetailsForm = false;
    try {
      const formData = await helpers.loadFormData();
      if (currentSkill?.id) {
        try {
          reclassifyPreview = await api.get(`/api/skills/${currentSkill.id}/reclassify-preview`);
          initialIsNonTechnical = reclassifyPreview.current_is_non_technical;
        } catch {
          initialIsNonTechnical = false;
        }
      }
      const { hooks: formHooks, getAsyncPending } = makeFormHooks();

      detailsFormEl = helpers.buildSkillForm(
        currentSkill,
        formData,
        isAdmin,
        isManager,
        user,
        initialIsNonTechnical,
        formHooks,
      );
      detailsScroll.appendChild(detailsFormEl);
      savedFormSnapshot = formSnapshot(helpers.readSkillForm(detailsFormEl));
      detailsFormEl.addEventListener('input', markDetailsTouched);
      detailsFormEl.addEventListener('change', markDetailsTouched);
      if (getAsyncPending() === 0) {
        captureFormBaseline();
      }
      updateDirtyUI();
    } catch {
      const err = createElement('div', { className: 'empty-state empty-state--compact' });
      err.textContent = 'Unable to load skill form.';
      detailsScroll.appendChild(err);
    }
  }

  function renderAddControls() {
    if (!canEdit) return;
    addItemBtn.hidden = activeTab !== 'content' || isCreateMode || contentLoading;
    reorderHint.hidden = activeTab !== 'content' || isCreateMode || contentLoading;
  }

  function initExpandedSectionsFromContent() {
    SECTION_ORDER.forEach((key) => {
      expandedSections[key] = (contentGroups[key]?.length ?? 0) > 0;
    });
  }

  function sectionHasSelectedItem(secKey) {
    return sortedItems(secKey).some(item => item.id === selectedItemId);
  }

  function applySectionOrder(secKey, orderIds) {
    pending.orderByLevel[secKey] = orderIds.slice();
    updateDirtyUI();
    ensureSelectedVisible();
    renderList();
    renderReader();
  }

  function moveItemInSection(secKey, itemId, delta) {
    const items = sortedItems(secKey);
    const idx = items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= items.length) return;
    const order = items.map(i => i.id);
    order.splice(idx, 1);
    order.splice(newIdx, 0, itemId);
    selectedItemId = itemId;
    applySectionOrder(secKey, order);
  }

  function renderList() {
    listScroll.innerHTML = '';

    if (contentLoading) {
      const sk = createElement('div', { className: 'skeleton-list' });
      for (let i = 0; i < 4; i++) {
        sk.appendChild(createElement('div', { className: 'skeleton skeleton-row' }));
      }
      listScroll.appendChild(sk);
      return;
    }

    const track = createElement('div', { className: 'sdm-3e-track' });

    SECTION_ORDER.forEach((secKey, sectionIndex) => {
      const items = sortedItems(secKey);
      const cfg = LEVEL_CONFIG.find(l => l.key === secKey);
      const expanded = expandedSections[secKey];

      const sectionClasses = ['sdm-3e-section', `sdm-3e-section--${secKey}`];
      if (!expanded) sectionClasses.push('sdm-3e-section--collapsed');
      if (expanded && sectionHasSelectedItem(secKey)) sectionClasses.push('sdm-3e-section--focus');
      if (sectionIndex === SECTION_ORDER.length - 1) sectionClasses.push('sdm-3e-section--last');

      const section = createElement('div', { className: sectionClasses.join(' ') });

      const rail = createElement('div', { className: 'sdm-3e-section__rail' });
      const bubble = createElement('div', { className: 'sdm-3e-section__bubble', 'aria-hidden': 'true' });
      bubble.innerHTML = THREE_E_SECTION_ICONS[secKey] || '';
      rail.appendChild(bubble);
      rail.appendChild(createElement('div', { className: 'sdm-3e-section__connector', 'aria-hidden': 'true' }));

      const main = createElement('div', { className: 'sdm-3e-section__main' });

      const hdr = createElement('button', {
        type: 'button',
        className: 'sdm-3e-section__header',
        'aria-expanded': String(expanded),
      });
      const hdrLabel = createElement('span', { className: 'sdm-3e-section__label' });
      hdrLabel.textContent = cfg.label;
      const hdrCount = createElement('span', { className: 'sdm-3e-section__count' });
      hdrCount.textContent = String(items.length);
      const toggleGlyph = createElement('span', { className: 'sdm-3e-section__toggle', 'aria-hidden': 'true' });
      toggleGlyph.textContent = expanded ? '\u2212' : '+';
      hdr.appendChild(hdrLabel);
      hdr.appendChild(hdrCount);
      hdr.appendChild(toggleGlyph);

      hdr.addEventListener('click', () => {
        expandedSections[secKey] = !expandedSections[secKey];
        ensureSelectedVisible();
        renderList();
        renderReader();
        updateDirtyUI();
      });

      main.appendChild(hdr);

      const sectionBody = createElement('div', { className: 'sdm-3e-section__body' });

      if (!items.length) {
        const empty = createElement('p', { className: 'catalog-tree-empty' });
        empty.textContent = 'No items in this section yet.';
        sectionBody.appendChild(empty);
      } else {
        items.forEach((item, itemIndex) => {
          const isPendingAdd = item.id < 0;
          const isPendingEdit = pending.edits.has(item.id);
          const isPendingReorder = pending.orderByLevel[secKey] !== null;
          const row = createElement('div', {
            className: 'sdm-list-item catalog-list-item'
              + (item.id === selectedItemId ? ' active' : '')
              + (isPendingAdd || isPendingEdit || isPendingReorder ? ' catalog-list-item--pending' : ''),
            'data-item-id': String(item.id),
            'data-section': secKey,
          });

          if (canEdit) {
            row.draggable = true;

            const dragHandle = createElement('span', {
              className: 'sdm-list-grip catalog-drag-handle',
              title: 'Drag to reorder',
              'aria-label': 'Drag to reorder',
            });
            dragHandle.innerHTML = GRIP_ICON;

            row.addEventListener('dragstart', (e) => {
              if (e.target.closest('.catalog-list-item__reorder') || e.target.closest('.sdm-list-item__body')) {
                e.preventDefault();
                return;
              }
              draggingItemId = item.id;
              dragSectionKey = secKey;
              row.classList.add('sdm-list-item--dragging');
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(item.id));
            });
            row.addEventListener('dragend', () => {
              row.draggable = true;
              row.classList.remove('sdm-list-item--dragging');
              listScroll.querySelectorAll('.catalog-list-item').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom', 'sdm-list-item--drop-target');
              });
              draggingItemId = null;
              dragSectionKey = null;
            });
            row.addEventListener('dragover', handleDragOver);
            row.addEventListener('dragleave', handleDragLeave);
            row.addEventListener('drop', (e) => handleDrop.call(row, e, secKey, item.id));
            row.appendChild(dragHandle);
          }

          const textBtn = createElement('button', { type: 'button', className: 'sdm-list-item__body' });
          const titleSpan = createElement('span', { className: 'sdm-list-item__title' });
          titleSpan.textContent = item.title || 'Untitled';
          const metaSpan = createElement('span', { className: 'sdm-list-item__meta' });
          metaSpan.textContent = item.type || 'resource';
          textBtn.appendChild(titleSpan);
          textBtn.appendChild(metaSpan);
          textBtn.addEventListener('click', async () => {
            if (hasItemEditorDraft()) {
              const ok = await showConfirm('Discard unsaved item edits?', true);
              if (!ok) return;
              cancelItemEditor();
            }
            selectedItemId = item.id;
            itemEditorMode = null;
            renderList();
            renderReader();
          });
          row.appendChild(textBtn);

          if (canEdit && items.length > 1) {
            const reorderBtns = createElement('div', { className: 'catalog-list-item__reorder' });
            const upBtn = createElement('button', {
              type: 'button',
              className: 'catalog-reorder-btn',
              'aria-label': 'Move item up',
              disabled: itemIndex === 0,
            });
            upBtn.textContent = '\u2191';
            upBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              moveItemInSection(secKey, item.id, -1);
            });
            const downBtn = createElement('button', {
              type: 'button',
              className: 'catalog-reorder-btn',
              'aria-label': 'Move item down',
              disabled: itemIndex === items.length - 1,
            });
            downBtn.textContent = '\u2193';
            downBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              moveItemInSection(secKey, item.id, 1);
            });
            reorderBtns.appendChild(upBtn);
            reorderBtns.appendChild(downBtn);
            row.appendChild(reorderBtns);
          }
          sectionBody.appendChild(row);
        });
      }

      main.appendChild(sectionBody);
      section.appendChild(rail);
      section.appendChild(main);
      track.appendChild(section);
    });

    listScroll.appendChild(track);
    ensureSelectedVisible();
    renderAddControls();
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = this;
    if (!draggingItemId || parseInt(target.dataset.itemId, 10) === draggingItemId) return;
    if (target.dataset.section !== dragSectionKey) return;
    const rect = target.getBoundingClientRect();
    target.classList.toggle('drag-over-top', e.clientY < rect.top + rect.height / 2);
    target.classList.toggle('drag-over-bottom', e.clientY >= rect.top + rect.height / 2);
  }

  function handleDragLeave() {
    this.classList.remove('drag-over-top', 'drag-over-bottom');
  }

  function handleDrop(e, secKey, targetId) {
    e.preventDefault();
    e.stopPropagation();
    const target = this;
    target.classList.remove('drag-over-top', 'drag-over-bottom');
    const fromId = draggingItemId ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!fromId || fromId === targetId || !Number.isFinite(fromId)) return;
    const rect = target.getBoundingClientRect();
    const insertAfter = e.clientY >= rect.top + rect.height / 2;
    reorderItemInSection(secKey, fromId, targetId, insertAfter);
  }

  function reorderItemInSection(secKey, fromId, toId, insertAfter = false) {
    const items = sortedItems(secKey);
    const currentOrder = items.map(i => i.id);
    const fromIdx = currentOrder.indexOf(fromId);
    let toIdx = currentOrder.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx === toIdx && !insertAfter) return;
    currentOrder.splice(fromIdx, 1);
    if (fromIdx < toIdx) toIdx -= 1;
    if (insertAfter) toIdx += 1;
    currentOrder.splice(toIdx, 0, fromId);
    selectedItemId = fromId;
    applySectionOrder(secKey, currentOrder);
  }

  function readItemEditorForm() {
    const titleInput = readerContent.querySelector('#catalog-item-title');
    const typeSelect = readerContent.querySelector('#catalog-item-type');
    const urlInput = readerContent.querySelector('#catalog-item-url');
    let description = '';
    if (quillInstance) {
      description = quillInstance.root.innerHTML;
    } else {
      const fallback = readerContent.querySelector('#catalog-item-body-editor');
      if (fallback) description = fallback.innerHTML;
    }
    return {
      title: titleInput?.value.trim() || '',
      type: typeSelect?.value || 'course',
      url: urlInput?.value.trim() || '',
      description,
    };
  }

  function commitItemEditor() {
    if (!canEdit) return false;
    const draft = readItemEditorForm();
    if (!draft.title) {
      showToast('Title is required', 'warning');
      readerContent.querySelector('#catalog-item-title')?.focus();
      return false;
    }

    const payload = {
      title: draft.title,
      type: draft.type,
      description: draft.description,
      url: draft.url || null,
    };

    if (itemEditorMode === 'add') {
      const level = LEVEL_REVERSE[itemEditorLevel];
      const newItem = {
        id: tempItemId--,
        level,
        position: sortedItems(itemEditorLevel).length,
        ...payload,
      };
      pending.adds.push(newItem);
      selectedItemId = newItem.id;
      expandedSections[itemEditorLevel] = true;
    } else if (itemEditorMode === 'edit' && itemEditorTargetId != null) {
      const existing = findItemById(itemEditorTargetId);
      if (itemEditorTargetId < 0) {
        const addIdx = pending.adds.findIndex(a => a.id === itemEditorTargetId);
        if (addIdx >= 0) {
          pending.adds[addIdx] = { ...pending.adds[addIdx], ...payload };
        }
      } else {
        pending.edits.set(itemEditorTargetId, payload);
      }
      selectedItemId = itemEditorTargetId;
    }

    itemEditorMode = null;
    itemEditorTargetId = null;
    itemEditorLevel = null;
    itemEditorDraft = null;
    destroyQuill();
    renderList();
    renderReader();
    updateDirtyUI();
    return true;
  }

  function cancelItemEditor() {
    itemEditorMode = null;
    itemEditorTargetId = null;
    itemEditorLevel = null;
    itemEditorDraft = null;
    destroyQuill();
    renderReader();
    updateDirtyUI();
  }

  async function mountItemEditorQuill(existingDescription) {
    const editorEl = readerContent.querySelector('#catalog-item-body-editor');
    if (!editorEl) return;
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
      if (existingDescription) {
        quillInstance.root.innerHTML = existingDescription;
      }
    } catch {
      editorEl.contentEditable = 'true';
      editorEl.style.cssText = 'min-height:120px;padding:10px;border:1px solid var(--border-soft);border-radius:var(--radius-md);background:var(--bg-input);color:var(--text-primary);';
      if (existingDescription) editorEl.innerHTML = existingDescription;
      quillInstance = { root: editorEl };
    }
  }

  function buildItemEditorPanel(mode, levelKey, item) {
    const panel = createElement('div', { className: 'catalog-item-editor' });
    const scroll = createElement('div', { className: 'catalog-item-editor__scroll' });

    const hdr = createElement('div', { className: 'catalog-item-editor__header' });
    const hdrTitle = createElement('h3');
    hdrTitle.textContent = mode === 'add' ? 'Add Content Item' : 'Edit Content Item';
    const levelLabel = createElement('p', { className: 'catalog-item-editor__level' });
    const cfg = LEVEL_CONFIG.find(l => l.key === (levelKey || LEVEL_MAP[item?.level]));
    levelLabel.textContent = cfg ? `Level: ${cfg.label}` : '';
    hdr.appendChild(hdrTitle);
    hdr.appendChild(levelLabel);
    scroll.appendChild(hdr);

    const titleGroup = createElement('div', { className: 'form-group' });
    titleGroup.appendChild(createElement('label', { className: 'form-label required', htmlFor: 'catalog-item-title', textContent: 'Title' }));
    const titleInput = createElement('input', {
      type: 'text',
      id: 'catalog-item-title',
      placeholder: 'e.g. Cisco Learning Network Course',
      value: item?.title || '',
    });
    titleGroup.appendChild(titleInput);
    scroll.appendChild(titleGroup);

    const typeGroup = createElement('div', { className: 'form-group' });
    typeGroup.appendChild(createElement('label', { className: 'form-label required', htmlFor: 'catalog-item-type', textContent: 'Type' }));
    const typeSelect = createElement('select', { id: 'catalog-item-type', className: 'form-select' });
    CONTENT_TYPES.forEach(t => {
      const opt = createElement('option', { value: t });
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if ((item?.type || 'course') === t) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeGroup.appendChild(typeSelect);
    scroll.appendChild(typeGroup);

    const bodyGroup = createElement('div', { className: 'form-group' });
    bodyGroup.appendChild(createElement('label', { className: 'form-label', htmlFor: 'catalog-item-body-editor', textContent: 'Description' }));
    const editorWrap = createElement('div', { className: 'content-edit-quill-wrap' });
    editorWrap.appendChild(createElement('div', { id: 'catalog-item-body-editor' }));
    bodyGroup.appendChild(editorWrap);
    scroll.appendChild(bodyGroup);

    const urlGroup = createElement('div', { className: 'form-group' });
    urlGroup.appendChild(createElement('label', { className: 'form-label', htmlFor: 'catalog-item-url', textContent: 'URL (optional)' }));
    urlGroup.appendChild(createElement('input', {
      type: 'url',
      id: 'catalog-item-url',
      placeholder: 'https://...',
      value: item?.url || '',
    }));
    scroll.appendChild(urlGroup);

    const actions = createElement('div', { className: 'catalog-item-editor__actions' });
    const cancelEditorBtn = createElement('button', { type: 'button', className: 'btn btn-secondary' });
    cancelEditorBtn.textContent = 'Cancel';
    const doneBtn = createElement('button', { type: 'button', className: 'btn btn-primary' });
    doneBtn.textContent = mode === 'add' ? 'Add to pending' : 'Apply changes';
    cancelEditorBtn.addEventListener('click', cancelItemEditor);
    doneBtn.addEventListener('click', () => commitItemEditor());
    actions.appendChild(cancelEditorBtn);
    actions.appendChild(doneBtn);

    panel.appendChild(scroll);
    panel.appendChild(actions);
    return panel;
  }

  function startItemEditor(mode, levelKey, item) {
    if (!canEdit) return;
    itemEditorMode = mode;
    itemEditorLevel = levelKey;
    itemEditorTargetId = item?.id ?? null;
    selectedItemId = item?.id ?? null;
    renderList();
    renderReader();
    requestAnimationFrame(() => {
      const desc = item?.description || '';
      mountItemEditorQuill(desc);
    });
  }

  function renderReader() {
    readerContent.innerHTML = '';
    readerActions.innerHTML = '';

    if (itemEditorMode) {
      readerToolbar.hidden = true;
      const editItem = itemEditorMode === 'edit' ? findItemById(itemEditorTargetId) : null;
      readerContent.appendChild(buildItemEditorPanel(itemEditorMode, itemEditorLevel, editItem));
      return;
    }

    const item = selectedItemId ? findItemById(selectedItemId) : null;

    if (!item || contentLoading || !selectableItems().some(i => i.id === selectedItemId)) {
      readerToolbar.hidden = true;
      readerContent.innerHTML = '<p class="sdm-reader-empty">Select an item from an expanded section to view content.</p>';
      return;
    }

    readerToolbar.hidden = false;
    const secKey = LEVEL_MAP[item.level];
    const cfg = LEVEL_CONFIG.find(l => l.key === secKey) || LEVEL_CONFIG[0];
    readerMeta.textContent = `${cfg.label} · ${item.type || 'resource'}`;

    if (canEdit) {
      const editBtn = createElement('button', {
        type: 'button',
        className: 'btn btn-secondary btn-sm',
        'aria-label': 'Edit item',
      });
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        startItemEditor('edit', secKey, item);
      });

      const deleteBtn = createElement('button', {
        type: 'button',
        className: 'btn btn-danger btn-sm',
        'aria-label': 'Delete item',
      });
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          `Remove "${item.title || 'this item'}"? Engineers with this skill on their plan will lose this item and any completion progress for it. Applies when you save.`,
          true,
        );
        if (!confirmed) return;
        if (item.id < 0) {
          pending.adds = pending.adds.filter(a => a.id !== item.id);
        } else {
          pending.deletes.add(item.id);
          pending.edits.delete(item.id);
        }
        if (selectedItemId === item.id) selectedItemId = null;
        renderList();
        renderReader();
        updateDirtyUI();
      });

      readerActions.appendChild(editBtn);
      readerActions.appendChild(deleteBtn);
    }

    const titleH = createElement('h2', { className: 'sdm-reader-title' });
    titleH.textContent = item.title || 'Untitled';
    readerContent.appendChild(titleH);

    if (item.description) {
      const prose = createElement('div', { className: 'sdm-reader-prose' });
      prose.innerHTML = item.description;
      readerContent.appendChild(prose);
    }

    if (item.url) {
      const link = createElement('a', {
        className: 'skill-detail-accordion-link sdm-reader-link',
        href: item.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      link.textContent = 'Open resource';
      readerContent.appendChild(link);
    }
  }

  function applyContent(rawContent) {
    contentGroups = { education: [], exposure: [], experience: [] };
    (Array.isArray(rawContent) ? rawContent : [])
      .filter(row => row && row.title && String(row.title).trim() !== '' && [1, 2, 3].includes(row.level))
      .forEach(row => {
        const k = LEVEL_MAP[row.level];
        if (k) contentGroups[k].push(row);
      });
    initExpandedSectionsFromContent();
    if (selectedItemId == null) {
      for (const key of SECTION_ORDER) {
        const first = sortedItems(key)[0];
        if (first) {
          selectedItemId = first.id;
          break;
        }
      }
    }
    saved.content = JSON.parse(JSON.stringify(allItemsFlat()));
    contentLoading = false;
    renderList();
    renderReader();
    renderAddControls();
    updateDirtyUI();
  }

  async function reloadContent() {
    if (!currentSkill?.id) return;
    contentLoading = true;
    renderList();
    renderReader();
    try {
      const raw = await api.get(`/api/skills/${currentSkill.id}/content`);
      applyContent(raw);
    } catch {
      contentLoading = false;
      listScroll.innerHTML = '';
      listScroll.appendChild(createElement('div', { className: 'empty-state empty-state--compact', textContent: 'Unable to load learning content.' }));
    }
  }

  function resetPendingContent() {
    pending.deletes.clear();
    pending.adds = [];
    pending.edits.clear();
    pending.orderByLevel = { education: null, exposure: null, experience: null };
  }

  async function discardAllPending() {
    cancelItemEditor();
    resetPendingContent();
    if (detailsFormEl) {
      await remountDetailsFromSkill();
    }
    if (currentSkill?.id) {
      await reloadContent();
    }
    updateDirtyUI();
  }

  async function remountDetailsFromSkill() {
    if (!detailsFormEl) return;
    formBaselineReady = false;
    userTouchedDetailsForm = false;
    const formData = await helpers.loadFormData();
    const { hooks: formHooks, getAsyncPending } = makeFormHooks();
    const fresh = helpers.buildSkillForm(
      currentSkill,
      formData,
      isAdmin,
      isManager,
      user,
      initialIsNonTechnical,
      formHooks,
    );
    detailsFormEl.replaceWith(fresh);
    detailsFormEl = fresh;
    savedFormSnapshot = formSnapshot(helpers.readSkillForm(detailsFormEl));
    detailsFormEl.addEventListener('input', markDetailsTouched);
    detailsFormEl.addEventListener('change', markDetailsTouched);
    if (getAsyncPending() === 0) {
      captureFormBaseline();
    }
    await waitForFormBaseline();
  }

  async function doSave() {
    if (!canEdit) return;
    if (itemEditorMode && hasItemEditorDraft()) {
      const ok = commitItemEditor();
      if (!ok) return;
    }

    const formData = detailsFormEl ? helpers.readSkillForm(detailsFormEl) : null;
    if (formData) {
      const errors = helpers.validateSkillForm(formData);
      if (errors.length) {
        showToast(errors[0], 'warning');
        activeTab = 'details';
        updateTabUI();
        detailsFormEl?.querySelector('#skill-name')?.focus();
        return;
      }

      if (currentSkill?.id && formData.is_non_technical !== initialIsNonTechnical) {
        const affectedCount = reclassifyPreview?.engineers_affected || 0;
        const targetDesc = formData.is_non_technical ? 'the NTECH-GEN shifts' : 'regular teams';
        const msg = `Reclassifying this skill will clear its current team assignments and reassign it to ${targetDesc}. ${affectedCount} engineer(s) currently have this skill in their plan — their plan entries will be preserved as personal artifacts. Continue?`;
        const confirmed = await showConfirm({
          title: 'Reclassify skill',
          body: msg,
          danger: true,
        });
        if (!confirmed) return;
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving\u2026';

    try {
      let skillId = currentSkill?.id;

      if (!skillId && formData) {
        const created = await api.post('/api/skills/', formData);
        currentSkill = created;
        skillId = created.id;
        initialIsNonTechnical = formData.is_non_technical;
        isCreateMode = false;
        try {
          reclassifyPreview = await api.get(`/api/skills/${skillId}/reclassify-preview`);
        } catch { /* optional */ }
        modal.setAttribute('aria-label', `${created.name} — Skill catalog`);
        updateHeader();
        updateTabUI();
      }

      const idMap = new Map();

      /* Content mutations first so deletes succeed even if metadata PUT would fail. */
      for (const id of pending.deletes) {
        if (id > 0) await api.del(`/api/skills/${skillId}/content/${id}`);
      }

      for (const add of pending.adds) {
        const result = await api.post(`/api/skills/${skillId}/content`, {
          title: add.title,
          type: add.type,
          description: add.description,
          url: add.url,
          level: add.level,
        });
        idMap.set(add.id, result.id);
      }

      for (const [id, payload] of pending.edits) {
        const realId = id < 0 ? idMap.get(id) : id;
        if (!realId) continue;
        await api.put(`/api/skills/${skillId}/content/${realId}`, payload);
      }

      for (const secKey of SECTION_ORDER) {
        if (pending.orderByLevel[secKey] === null) continue;
        const items = getSectionItems(secKey)
          .map((item, idx) => ({
            id: item.id < 0 ? idMap.get(item.id) : item.id,
            position: (idx + 1) * 10,
          }))
          .filter(entry => entry.id && entry.id > 0);
        if (items.length) {
          await api.put(`/api/skills/${skillId}/content/reorder`, { items });
        }
      }

      const detailsPayload = buildDetailsUpdatePayload();
      if (detailsPayload) {
        const updated = await api.put(`/api/skills/${skillId}`, detailsPayload);
        currentSkill = { ...currentSkill, ...updated };
        if ('is_non_technical' in detailsPayload) {
          initialIsNonTechnical = detailsPayload.is_non_technical;
        }
        updateHeader();
      }

      resetPendingContent();
      if (detailsFormEl) {
        captureFormBaseline();
        userTouchedDetailsForm = false;
      }
      helpers.refreshCatalog();
      await reloadContent();
      if (currentSkill?.id) {
        try {
          const freshSkill = await api.get(`/api/skills/${currentSkill.id}`);
          currentSkill = freshSkill;
          updateHeader();
          await remountDetailsFromSkill();
        } catch { /* keep current */ }
      }
      showToast('Skill details saved', 'success');
      updateDirtyUI();
    } catch (err) {
      let msg = err?.message || err?.detail || 'Failed to save changes';
      if (msg === 'Failed to fetch') {
        msg = 'Could not reach the server — check that the API is running and reload the page.';
      }
      showToast(typeof msg === 'string' ? msg : 'Failed to save changes', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Details';
    }
  }

  async function attemptClose() {
    if (hasItemEditorDraft()) {
      const ok = await showConfirm('Discard unsaved item edits?', true);
      if (!ok) return;
      cancelItemEditor();
    }
    if (!isDirty()) {
      closeModal();
      return;
    }
    const choice = await showModal({
      title: 'Unsaved Changes',
      body: 'You have unsaved changes. What would you like to do?',
      modalClass: 'modal-confirm-actions',
      actions: [
        { label: 'Continue Editing', value: 'continue', className: 'btn btn-secondary' },
        { label: 'Discard Changes', value: 'discard', className: 'btn btn-danger' },
        { label: 'Save Details', value: 'save', className: 'btn btn-primary' },
      ],
    });
    if (choice === 'save') {
      await doSave();
      if (!isDirty()) closeModal();
      return;
    }
    if (choice === 'discard') {
      await discardAllPending();
      closeModal();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (addItemMenu.classList.contains('open')) {
        addItemMenu.classList.remove('open');
        addItemBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      e.preventDefault();
      attemptClose();
    }
  }

  maximizeBtn.addEventListener('click', () => setModalMaximized(!isMaximized));
  closeBtn.addEventListener('click', () => attemptClose());
  closeFooterBtn.addEventListener('click', () => closeModal());
  overlay.addEventListener('click', e => { if (e.target === overlay) attemptClose(); });
  document.addEventListener('keydown', onKeyDown);

  contentTabBtn.addEventListener('click', () => switchTab('content'));
  detailsTabBtn.addEventListener('click', () => switchTab('details'));

  if (canEdit) {
    addItemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = addItemMenu.classList.toggle('open');
      addItemBtn.setAttribute('aria-expanded', String(open));
    });

    function closeAddMenuOnOutside(e) {
      if (!addItemMenu.classList.contains('open')) return;
      if (listFooter.contains(e.target)) return;
      addItemMenu.classList.remove('open');
      addItemBtn.setAttribute('aria-expanded', 'false');
    }
    document.addEventListener('click', closeAddMenuOnOutside);

    saveBtn.addEventListener('click', () => doSave());
    discardBtn.addEventListener('click', async () => {
      if (!isDirty()) return;
      const confirmed = await showConfirm('Discard all pending changes?', true);
      if (confirmed) await discardAllPending();
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  updateHeader();
  updateTabUI();

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    closeBtn.focus();
  });

  if (canEdit && (activeTab === 'details' || isCreateMode)) {
    mountDetailsForm().then(() => updateDirtyUI());
  }

  if (!isCreateMode) {
    reloadContent();
  } else {
    contentLoading = false;
    renderList();
    renderReader();
    updateDirtyUI();
  }

  if (canEdit && activeTab === 'content' && !isCreateMode) {
    /* content tab active on open */
  }
}
