import { api } from '../api.js';
import { showToast } from './toast.js';
import { el } from '../utils/dom.js';
import {
  mountMarkdownEditor,
  renderDescription,
} from './markdown-editor.js';

const LEVEL_LABELS = { 1: 'Education', 2: 'Exposure', 3: 'Experience' };
const LEVEL_CLS = { 1: 'edu', 2: 'exp', 3: 'xp' };
const TYPE_OPTIONS = ['course', 'certification', 'reading', 'link', 'action'];
const IMPORT_CAP = 50;
const DISCOVER_PAGE_SIZE = 20;

const ICONS = {
  education: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  exposure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>',
  experience: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  domain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
};

const BUCKET_DEFS = {
  1: { cls: 'team', icon: ICONS.team, title: 'My team', subtitle: 'Engineers on your team' },
  2: { cls: 'domain', icon: ICONS.domain, title: 'My domain (all shifts)', subtitle: 'Same domain, all shifts' },
  3: { cls: 'other', icon: ICONS.other, title: 'Other teams & domains', subtitle: 'Cross-team contributions' },
};

const BUCKET_ORDER = [1, 2, 3];

function iconSpan(html) {
  const span = el('span');
  span.innerHTML = html;
  return span;
}

export function openLibraryModal(opts, onSaved) {
  const {
    mode = 'create',
    item = null,
    planSkill,
    engineerId,
    level,
    deferSave = false,
  } = opts || {};

  const isEdit = mode === 'edit';
  const initialLevel = isEdit ? Number(item.level) : Number(level);
  const levelLabel = LEVEL_LABELS[initialLevel] || 'Content';
  const skillName = planSkill?.skill_name || planSkill?.skillName
    || (planSkill?.skill_id ? `Skill #${planSkill.skill_id}` : 'Skill');

  const root = document.getElementById('modalRoot');
  if (!root) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal lib-modal-v2' });

  const header = el('header', { className: 'lib-modal-v2__header' });
  const headerTop = el('div', { className: 'lib-modal-v2__header-top' });
  const headerText = el('div');
  const titleEl = el('h2', { className: 'lib-modal-v2__title' });
  titleEl.textContent = isEdit
    ? `Edit My Item — ${item.title}`
    : `Add ${levelLabel} Item`;
  const contextEl = el('p', { className: 'lib-modal-v2__context' });
  contextEl.textContent = `${skillName} · ${levelLabel}`;
  headerText.appendChild(titleEl);
  if (!isEdit) headerText.appendChild(contextEl);
  const closeBtn = el('button', {
    type: 'button',
    className: 'lib-modal-v2__close',
    'aria-label': 'Close',
  });
  closeBtn.textContent = '\u2715';
  headerTop.appendChild(headerText);
  headerTop.appendChild(closeBtn);
  header.appendChild(headerTop);

  let createTabBtn = null;
  let discoverTabBtn = null;
  let createPane = null;
  let discoverPane = null;
  let createCtx = null;
  let discoverCtx = null;

  if (!isEdit) {
    const modes = el('div', { className: 'lib-modal-v2__modes', role: 'tablist' });
    createTabBtn = el('button', {
      type: 'button',
      className: 'lib-modal-v2__mode lib-modal-v2__mode--active',
      role: 'tab',
      'aria-selected': 'true',
    });
    createTabBtn.textContent = 'Create new';
    discoverTabBtn = el('button', {
      type: 'button',
      className: 'lib-modal-v2__mode',
      role: 'tab',
      'aria-selected': 'false',
    });
    discoverTabBtn.textContent = 'Discover existing';
    modes.appendChild(createTabBtn);
    modes.appendChild(discoverTabBtn);
    header.appendChild(modes);
  }

  modal.appendChild(header);

  const body = el('div', { className: 'lib-modal-v2__body' });

  createPane = el('div', {
    className: `lib-modal-v2__pane lib-modal-v2__pane--active${isEdit ? '' : ''}`,
    'data-pane': 'create',
  });
  body.appendChild(createPane);

  if (!isEdit) {
    discoverPane = el('div', {
      className: 'lib-modal-v2__pane',
      'data-pane': 'discover',
    });
    body.appendChild(discoverPane);
  }

  modal.appendChild(body);

  const footer = el('footer', { className: 'lib-modal-v2__footer' });
  const footerHint = el('span', { className: 'lib-modal-v2__footer-left' });
  footerHint.textContent = 'Personal to your plan unless marked private.';
  const cancelBtn = el('button', { type: 'button', className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  const primaryBtn = el('button', { type: 'button', className: 'btn btn-primary' });
  primaryBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
  footer.appendChild(footerHint);
  footer.appendChild(cancelBtn);
  footer.appendChild(primaryBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  root.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('open'));

  function close() {
    overlay.classList.remove('open');
    if (createCtx && createCtx.destroy) createCtx.destroy();
    setTimeout(() => overlay.remove(), 200);
  }

  function activate(which) {
    const isCreate = which === 'create';
    createTabBtn.classList.toggle('lib-modal-v2__mode--active', isCreate);
    discoverTabBtn.classList.toggle('lib-modal-v2__mode--active', !isCreate);
    createTabBtn.setAttribute('aria-selected', String(isCreate));
    discoverTabBtn.setAttribute('aria-selected', String(!isCreate));
    createPane.classList.toggle('lib-modal-v2__pane--active', isCreate);
    discoverPane.classList.toggle('lib-modal-v2__pane--active', !isCreate);
    if (isCreate) {
      footerHint.textContent = 'Personal to your plan unless marked private.';
      primaryBtn.textContent = 'Add Item';
      primaryBtn.disabled = false;
    } else if (discoverCtx) {
      discoverCtx.syncFooter(primaryBtn);
      if (!discoverCtx.initialized) discoverCtx.init();
    }
  }

  cancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  if (!isEdit) {
    createTabBtn.addEventListener('click', () => activate('create'));
    discoverTabBtn.addEventListener('click', () => activate('discover'));
  }

  createCtx = buildCreatePane({
    container: createPane,
    isEdit,
    item,
    planSkill,
    engineerId,
    initialLevel,
    deferSave,
    onLevelChange: isEdit ? null : (lv) => {
      const lbl = LEVEL_LABELS[lv] || 'Content';
      contextEl.textContent = `${skillName} · ${lbl}`;
      titleEl.textContent = `Add ${lbl} Item`;
    },
    onDone: (payload) => {
      if (typeof onSaved === 'function') onSaved(payload);
      close();
    },
  });

  if (!isEdit) {
    discoverCtx = buildDiscoverPane({
      container: discoverPane,
      planSkill,
      engineerId,
      initialLevel,
      deferSave,
      onImported: (payload) => {
        if (typeof onSaved === 'function') onSaved(payload);
      },
      onClose: close,
      onSelectionChange: (n) => {
        if (discoverPane.classList.contains('lib-modal-v2__pane--active')) {
          if (n > IMPORT_CAP) {
            footerHint.textContent = `${n} selected — max ${IMPORT_CAP} per import`;
          } else if (n > 0) {
            footerHint.textContent = `${n} selected`;
          } else {
            footerHint.textContent = 'Select items to import into your plan.';
          }
          primaryBtn.disabled = n === 0 || n > IMPORT_CAP;
          primaryBtn.textContent = n > 0 ? `Import ${n} Item${n === 1 ? '' : 's'}` : 'Import Selected';
        }
      },
    });
  }

  primaryBtn.addEventListener('click', () => {
    if (!isEdit && discoverPane.classList.contains('lib-modal-v2__pane--active')) {
      discoverCtx.handleImport(primaryBtn);
    } else {
      createCtx.save(primaryBtn);
    }
  });
}

function buildCreatePane({
  container, isEdit, item, planSkill, engineerId, initialLevel, deferSave, onLevelChange, onDone,
}) {
  let selectedLevel = initialLevel;

  const hint = el('p', { className: 'lib-create__hint' });
  hint.textContent = 'Personal to your plan. Others can discover this unless marked private.';
  container.appendChild(hint);

  const titleGroup = el('div', { className: 'form-group' });
  const titleLabel = el('label', { className: 'form-label' });
  titleLabel.textContent = 'Title';
  const titleInput = el('input', {
    type: 'text',
    className: 'form-input',
    placeholder: 'e.g. Cisco Live session, lab exercise…',
  });
  if (isEdit && item) titleInput.value = item.title || '';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  container.appendChild(titleGroup);

  const grid = el('div', { className: 'lib-create__grid' });

  const typeGroup = el('div', { className: 'form-group' });
  const typeLabel = el('label', { className: 'form-label' });
  typeLabel.textContent = 'Type';
  const typeSelect = el('select', { className: 'form-select' });
  TYPE_OPTIONS.forEach(t => {
    const opt = el('option', { value: t });
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (isEdit && item && item.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  grid.appendChild(typeGroup);

  const levelGroup = el('div', { className: 'form-group' });
  const levelDisplayLabel = el('label', { className: 'form-label' });
  levelDisplayLabel.textContent = 'Level';
  if (isEdit) {
    const levelCls = LEVEL_CLS[initialLevel] || 'edu';
    const levelBadge = el('div', { className: `lib-create__level-badge lib-create__level-badge--${levelCls}` });
    levelBadge.appendChild(el('span', { className: 'lib-create__level-dot' }));
    const levelText = el('span');
    levelText.textContent = LEVEL_LABELS[initialLevel] || 'Content';
    levelBadge.appendChild(levelText);
    levelGroup.appendChild(levelDisplayLabel);
    levelGroup.appendChild(levelBadge);
  } else {
    const levelPicker = el('div', { className: 'lib-create__level-picker' });
    const levelButtons = [];

    function syncLevelPicker() {
      levelButtons.forEach(({ btn, lv }) => {
        btn.classList.toggle('active', lv === selectedLevel);
        btn.setAttribute('aria-pressed', String(lv === selectedLevel));
      });
    }

    [1, 2, 3].forEach(lv => {
      const key = lv === 1 ? 'education' : lv === 2 ? 'exposure' : 'experience';
      const btn = el('button', {
        type: 'button',
        className: `lib-discover__level-chip lib-discover__level-chip--${LEVEL_CLS[lv]}`,
        'aria-pressed': String(lv === selectedLevel),
      });
      btn.dataset.level = String(lv);
      btn.appendChild(iconSpan(ICONS[key]));
      btn.appendChild(document.createTextNode(` ${LEVEL_LABELS[lv]}`));
      btn.addEventListener('click', () => {
        selectedLevel = lv;
        syncLevelPicker();
        if (typeof onLevelChange === 'function') onLevelChange(lv);
      });
      levelButtons.push({ btn, lv });
      levelPicker.appendChild(btn);
    });
    syncLevelPicker();
    levelGroup.appendChild(levelDisplayLabel);
    levelGroup.appendChild(levelPicker);
  }
  grid.appendChild(levelGroup);
  container.appendChild(grid);

  const urlGroup = el('div', { className: 'form-group' });
  const urlLabel = el('label', { className: 'form-label' });
  urlLabel.textContent = 'URL (optional)';
  const urlInput = el('input', { type: 'url', className: 'form-input', placeholder: 'https://…' });
  if (isEdit && item) urlInput.value = item.url || '';
  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlInput);
  container.appendChild(urlGroup);

  const privacyGroup = el('label', { className: 'library-modal__privacy' });
  const privacyInput = el('input', { type: 'checkbox', className: 'library-modal__privacy-cb' });
  if (isEdit && item && item.is_private) privacyInput.checked = true;
  const privacyText = el('span', { className: 'library-modal__privacy-text' });
  privacyText.textContent = 'Keep private (hidden from discovery)';
  privacyGroup.appendChild(privacyInput);
  privacyGroup.appendChild(privacyText);
  container.appendChild(privacyGroup);

  const descGroup = el('div', { className: 'form-group' });
  const descLabel = el('label', { className: 'form-label' });
  descLabel.textContent = 'Description';
  descGroup.appendChild(descLabel);

  if (isEdit && item && item.description_format === 'legacy_html') {
    const legacyWarn = el('div', { className: 'library-modal__legacy-warn' });
    legacyWarn.textContent = 'This item uses legacy formatting. Saving will convert it to Markdown.';
    descGroup.appendChild(legacyWarn);
  }

  const editorHost = el('div', { className: 'library-modal__editor-host lib-create__editor-host' });
  descGroup.appendChild(editorHost);
  container.appendChild(descGroup);

  let initialMarkdown = '';
  if (isEdit && item && item.description_format !== 'legacy_html') {
    initialMarkdown = item.description || '';
  }

  let editorApi = null;
  const editorReady = mountMarkdownEditor(editorHost, {
    initialMarkdown,
    placeholder: 'Notes, links, takeaways…',
  }).then((api) => {
    editorApi = api;
    return api;
  });

  async function save(primaryBtn) {
    await editorReady;
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      showToast('Title is required', 'error');
      titleInput.focus();
      return;
    }

    primaryBtn.disabled = true;
    const originalLabel = primaryBtn.textContent;
    primaryBtn.textContent = 'Saving…';

    const markdown = editorApi ? editorApi.getMarkdown() : (initialMarkdown || '');
    const urlVal = urlInput.value.trim() || null;
    const isPrivate = !!privacyInput.checked;

    try {
      const payload = {
        mode: isEdit ? 'update' : 'create',
        id: item?.id,
        level: selectedLevel,
        type: typeSelect.value,
        title: titleVal,
        description: markdown || null,
        description_format: 'markdown',
        url: urlVal,
        is_private: isPrivate,
      };
      if (deferSave) {
        onDone(payload);
        return;
      }
      if (isEdit) {
        await api.put(`/api/plans/${engineerId}/skills/${planSkill.id}/user-content/${item.id}`, {
          title: titleVal,
          type: typeSelect.value,
          description: markdown || null,
          description_format: 'markdown',
          url: urlVal,
          is_private: isPrivate,
        });
        showToast('Item updated', 'success');
      } else {
        await api.post(`/api/plans/${engineerId}/skills/${planSkill.id}/user-content`, {
          level: selectedLevel,
          type: typeSelect.value,
          title: titleVal,
          description: markdown || null,
          description_format: 'markdown',
          url: urlVal,
          is_private: isPrivate,
        });
        showToast('Item added', 'success');
      }
      onDone(null);
    } catch (err) {
      showToast(err.message || 'Failed to save item', 'error');
      primaryBtn.disabled = false;
      primaryBtn.textContent = originalLabel;
    }
  }

  return {
    save,
    destroy() {
      if (editorApi) editorApi.destroy();
    },
  };
}

function buildDiscoverPane({
  container, planSkill, engineerId, initialLevel, deferSave, onImported, onClose, onSelectionChange,
}) {
  const ctx = { initialized: false };

  const toolbar = el('div', { className: 'lib-discover__toolbar' });
  const searchInput = el('input', {
    type: 'search',
    className: 'lib-discover__search',
    placeholder: 'Search titles, descriptions, URLs…',
  });
  const levelChips = el('div', { className: 'lib-discover__levels' });
  let activeLevel = initialLevel;

  [1, 2, 3].forEach(lv => {
    const key = lv === 1 ? 'education' : lv === 2 ? 'exposure' : 'experience';
    const cls = LEVEL_CLS[lv];
    const chip = el('button', {
      type: 'button',
      className: `lib-discover__level-chip lib-discover__level-chip--${cls}${lv === activeLevel ? ' active' : ''}`,
    });
    chip.dataset.level = String(lv);
    chip.appendChild(iconSpan(ICONS[key]));
    chip.appendChild(document.createTextNode(` ${LEVEL_LABELS[lv]}`));
    chip.addEventListener('click', () => {
      activeLevel = lv;
      Array.from(levelChips.children).forEach(c => {
        const on = Number(c.dataset.level) === lv;
        c.classList.toggle('active', on);
      });
      reload();
    });
    levelChips.appendChild(chip);
  });

  toolbar.appendChild(searchInput);
  toolbar.appendChild(levelChips);
  container.appendChild(toolbar);

  const scrollHost = el('div', { className: 'lib-discover__scroll' });
  const bucketsHost = el('div', { className: 'lib-discover__buckets' });
  scrollHost.appendChild(bucketsHost);
  container.appendChild(scrollHost);

  const loadingState = el('div', { className: 'library-modal__loading' });
  loadingState.textContent = 'Loading…';
  const errorState = el('div', { className: 'library-modal__error' });

  const selected = new Map();
  let cursor = null;
  let hasMore = false;
  let loading = false;
  let debounceTimer = null;
  let bucketsReady = false;

  function ensureBuckets() {
    if (bucketsReady) return;
    bucketsHost.innerHTML = '';
    BUCKET_ORDER.forEach(b => {
      const def = BUCKET_DEFS[b];
      const bucket = el('div', {
        className: `lib-bucket lib-bucket--${def.cls}`,
        'data-bucket': String(b),
      });
      const head = el('button', { type: 'button', className: 'lib-bucket__head' });
      const iconWrap = el('span', { className: 'lib-bucket__icon' });
      iconWrap.appendChild(iconSpan(def.icon));
      head.appendChild(iconWrap);
      const titleWrap = el('span');
      const title = el('span', { className: 'lib-bucket__title' });
      title.textContent = def.title;
      const subtitle = el('span', { className: 'lib-bucket__subtitle' });
      subtitle.textContent = def.subtitle;
      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);
      head.appendChild(titleWrap);
      const count = el('span', { className: 'lib-bucket__count' });
      count.textContent = '0';
      head.appendChild(count);
      const chevron = el('span', { className: 'lib-bucket__chevron', 'aria-hidden': 'true' });
      chevron.textContent = '\u25BC';
      head.appendChild(chevron);
      head.addEventListener('click', () => bucket.classList.toggle('lib-bucket--collapsed'));
      bucket.appendChild(head);
      const bodyEl = el('div', { className: 'lib-bucket__body' });
      const empty = el('div', { className: 'lib-bucket__empty' });
      empty.textContent = 'No items in this group yet.';
      bodyEl.appendChild(empty);
      bucket.appendChild(bodyEl);
      bucketsHost.appendChild(bucket);
    });
    bucketsReady = true;
  }

  function resetBuckets() {
    ensureBuckets();
    bucketsHost.querySelectorAll('.lib-bucket__body').forEach(bodyEl => {
      const empty = bodyEl.querySelector('.lib-bucket__empty');
      Array.from(bodyEl.children).forEach(child => {
        if (child !== empty) child.remove();
      });
      if (empty) empty.hidden = false;
    });
    bucketsHost.querySelectorAll('.lib-bucket__count').forEach(c => { c.textContent = '0'; });
  }

  function updateBucketCount(bucketEl) {
    const bodyEl = bucketEl.querySelector('.lib-bucket__body');
    const count = bucketEl.querySelector('.lib-bucket__count');
    const empty = bucketEl.querySelector('.lib-bucket__empty');
    const cards = bodyEl.querySelectorAll('.lib-card-v2');
    if (count) count.textContent = String(cards.length);
    if (empty) empty.hidden = cards.length > 0;
  }

  function updateSelectionUI() {
    onSelectionChange(selected.size);
  }

  ctx.syncFooter = (primaryBtn) => {
    updateSelectionUI();
    if (selected.size === 0) primaryBtn.disabled = true;
  };

  function clearSelection() {
    selected.clear();
    bucketsHost.querySelectorAll('.lib-card-v2--selected').forEach(c => {
      c.classList.remove('lib-card-v2--selected');
      const cb = c.querySelector('.lib-card-v2__cb');
      if (cb) cb.checked = false;
    });
    bucketsHost.querySelectorAll('.lib-card-v2--skipped').forEach(c => {
      c.classList.remove('lib-card-v2--skipped');
    });
    updateSelectionUI();
  }

  function renderCard(item) {
    const card = el('div', { className: 'lib-card-v2' });
    card.dataset.itemId = String(item.id);

    const cb = el('input', { type: 'checkbox', className: 'lib-card-v2__cb' });
    if (selected.has(item.id)) {
      cb.checked = true;
      card.classList.add('lib-card-v2--selected');
    }
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selected.set(item.id, item);
        card.classList.add('lib-card-v2--selected');
      } else {
        selected.delete(item.id);
        card.classList.remove('lib-card-v2--selected');
      }
      updateSelectionUI();
    });

    const main = el('div', { className: 'lib-card-v2__main' });
    const title = el('div', { className: 'lib-card-v2__title' });
    title.textContent = item.title || '(untitled)';
    main.appendChild(title);

    const meta = el('div', { className: 'lib-card-v2__meta' });
    const typeBadge = el('span', { className: 'lib-card-v2__type' });
    typeBadge.textContent = item.type || '';
    meta.appendChild(typeBadge);
    if (item.owner_name) {
      const owner = el('span', { className: 'lib-card-v2__owner' });
      owner.textContent = `by ${item.owner_name}`;
      meta.appendChild(owner);
    }
    if (item.is_private) {
      const priv = el('span', { className: 'library-modal__card-private' });
      priv.textContent = 'Private';
      meta.appendChild(priv);
    }
    main.appendChild(meta);

    if (item.description) {
      const desc = el('div', { className: 'lib-card-v2__desc' });
      desc.innerHTML = renderDescription(item.description, item.description_format || 'markdown');
      main.appendChild(desc);
    }

    card.appendChild(cb);
    card.appendChild(main);

    card.addEventListener('click', (e) => {
      if (e.target === cb || e.target.closest('a')) return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });

    return card;
  }

  function appendItems(items) {
    items.forEach(item => {
      if (item.is_mine) return;
      const bucket = item.bucket || 3;
      const bucketEl = bucketsHost.querySelector(`[data-bucket="${bucket}"]`);
      if (!bucketEl) return;
      const bodyEl = bucketEl.querySelector('.lib-bucket__body');
      bodyEl.appendChild(renderCard(item));
      updateBucketCount(bucketEl);
    });
  }

  function removeLoadMore() {
    scrollHost.querySelectorAll('.library-modal__load-more').forEach(btn => btn.remove());
  }

  async function load(append = false) {
    if (loading) return;
    if (append && !hasMore) return;
    loading = true;
    removeLoadMore();

    if (!append) {
      resetBuckets();
      scrollHost.appendChild(loadingState);
      cursor = null;
    }

    try {
      const skillIdForApi = planSkill.skill_id || planSkill.skillId;
      const params = new URLSearchParams();
      params.set('level', String(activeLevel));
      params.set('limit', String(DISCOVER_PAGE_SIZE));
      const q = searchInput.value.trim();
      if (q) params.set('q', q);
      if (append && cursor) params.set('cursor', cursor);

      const data = await api.get(
        `/api/plans/${engineerId}/skills/${skillIdForApi}/library/search?${params.toString()}`,
      );

      loadingState.remove();
      cursor = data.next_cursor || null;
      hasMore = !!data.has_more;

      const items = Array.isArray(data.results) ? data.results : [];
      appendItems(items);

      if (hasMore) {
        const moreBtn = el('button', { type: 'button', className: 'btn btn-secondary library-modal__load-more' });
        moreBtn.textContent = 'Load more';
        moreBtn.addEventListener('click', () => load(true));
        scrollHost.appendChild(moreBtn);
      }
    } catch (err) {
      loadingState.remove();
      errorState.textContent = err.message || 'Failed to load library';
      scrollHost.appendChild(errorState);
    } finally {
      loading = false;
    }
  }

  function reload() {
    clearSelection();
    errorState.remove();
    load(false);
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reload, 250);
  });

  ctx.handleImport = async (primaryBtn) => {
    const ids = Array.from(selected.keys());
    if (ids.length === 0) return;
    if (ids.length > IMPORT_CAP) {
      showToast(`Cannot import more than ${IMPORT_CAP} items at once`, 'error');
      return;
    }
    primaryBtn.disabled = true;
    primaryBtn.textContent = 'Importing…';

    try {
      const skillIdForApi = planSkill.skill_id || planSkill.skillId;
      if (deferSave) {
        const items = ids.map(id => selected.get(id)).filter(Boolean);
        onImported({ mode: 'import', level: activeLevel, items });
        onClose();
        return;
      }
      const data = await api.post(
        `/api/plans/${engineerId}/skills/${skillIdForApi}/library/import?level=${activeLevel}`,
        { source_ids: ids },
      );
      const importedCount = Array.isArray(data.imported) ? data.imported.length : 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];
      const skippedIds = new Set(skipped.map(s => s.id));

      if (importedCount > 0 && skipped.length === 0) {
        showToast(`Imported ${importedCount} item${importedCount === 1 ? '' : 's'}`, 'success');
        if (typeof onImported === 'function') onImported();
        onClose();
        return;
      }

      if (importedCount > 0) {
        showToast(`Imported ${importedCount}, skipped ${skipped.length}`, 'info');
      } else {
        showToast(`Nothing imported — ${skipped.length} skipped`, 'error');
      }
      if (typeof onImported === 'function') onImported();

      bucketsHost.querySelectorAll('.lib-card-v2').forEach(card => {
        const id = Number(card.dataset.itemId);
        if (skippedIds.has(id)) {
          card.classList.add('lib-card-v2--skipped');
        } else if (selected.has(id)) {
          card.classList.remove('lib-card-v2--selected');
          const cb = card.querySelector('.lib-card-v2__cb');
          if (cb) cb.checked = false;
          selected.delete(id);
        }
      });
      updateSelectionUI();
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
    } finally {
      primaryBtn.disabled = selected.size === 0 || selected.size > IMPORT_CAP;
      const n = selected.size;
      primaryBtn.textContent = n > 0 ? `Import ${n} Item${n === 1 ? '' : 's'}` : 'Import Selected';
    }
  };

  ctx.init = () => {
    if (ctx.initialized) return;
    ctx.initialized = true;
    ensureBuckets();
    updateSelectionUI();
    load(false);
  };

  return ctx;
}
