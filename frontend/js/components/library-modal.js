import { api } from '../api.js';
import { showToast } from './toast.js';
import { el } from '../utils/dom.js';
import {
  mountMarkdownEditor,
  renderDescription,
} from './markdown-editor.js';

const LEVEL_LABELS = { 1: 'Education', 2: 'Exposure', 3: 'Experience' };
const TYPE_OPTIONS = ['course', 'certification', 'reading', 'link', 'action'];
const BUCKET_LABELS = {
  1: 'From my team',
  2: 'From my domain',
  3: 'From other teams',
};
const IMPORT_CAP = 50;
const DISCOVER_PAGE_SIZE = 20;

export function openLibraryModal(opts, onSaved) {
  const {
    mode = 'create',
    item = null,
    planSkill,
    engineerId,
    levelKey,
    level,
  } = opts || {};

  const isEdit = mode === 'edit';
  const initialLevel = isEdit ? Number(item.level) : Number(level);
  const levelLabel = LEVEL_LABELS[initialLevel] || 'Content';

  const root = document.getElementById('modalRoot');
  if (!root) return;

  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal library-modal' });

  const header = el('div', { className: 'modal-header' });
  const titleEl = el('h2', { className: 'modal-title' });
  titleEl.textContent = isEdit
    ? `Edit My Item — ${item.title}`
    : `Add ${levelLabel} Item`;
  const closeBtn = el('button', { className: 'modal-close', 'aria-label': 'Close' });
  closeBtn.textContent = '\u2715';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const body = el('div', { className: 'modal-body library-modal__body' });

  let tabs = null;
  let createPane = null;
  let discoverPane = null;
  let createCtx = null;
  let discoverCtx = null;

  if (!isEdit) {
    tabs = el('div', { className: 'library-modal__tabs', role: 'tablist' });
    const createTabBtn = el('button', {
      className: 'library-modal__tab library-modal__tab--active',
      role: 'tab',
      'aria-selected': 'true',
    });
    createTabBtn.textContent = 'Create New';
    const discoverTabBtn = el('button', {
      className: 'library-modal__tab',
      role: 'tab',
      'aria-selected': 'false',
    });
    discoverTabBtn.textContent = 'Discover';
    tabs.appendChild(createTabBtn);
    tabs.appendChild(discoverTabBtn);
    body.appendChild(tabs);

    createPane = el('div', { className: 'library-modal__pane library-modal__pane--active' });
    discoverPane = el('div', { className: 'library-modal__pane' });
    body.appendChild(createPane);
    body.appendChild(discoverPane);

    function activate(which) {
      const isCreate = which === 'create';
      createTabBtn.classList.toggle('library-modal__tab--active', isCreate);
      discoverTabBtn.classList.toggle('library-modal__tab--active', !isCreate);
      createTabBtn.setAttribute('aria-selected', String(isCreate));
      discoverTabBtn.setAttribute('aria-selected', String(!isCreate));
      createPane.classList.toggle('library-modal__pane--active', isCreate);
      discoverPane.classList.toggle('library-modal__pane--active', !isCreate);
      footer.style.display = isCreate ? '' : 'none';
      importFooter.style.display = isCreate ? 'none' : '';
      if (!isCreate && discoverCtx && !discoverCtx.initialized) {
        discoverCtx.init();
      }
    }
    createTabBtn.addEventListener('click', () => activate('create'));
    discoverTabBtn.addEventListener('click', () => activate('discover'));
  } else {
    createPane = el('div', { className: 'library-modal__pane library-modal__pane--active library-modal__pane--edit' });
    body.appendChild(createPane);
  }

  const footer = el('div', { className: 'modal-footer' });
  const cancelBtn = el('button', { className: 'btn btn-secondary' });
  cancelBtn.textContent = 'Cancel';
  const saveBtn = el('button', { className: 'btn btn-primary' });
  saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Item';
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);

  const importFooter = el('div', { className: 'modal-footer library-modal__import-footer' });
  importFooter.style.display = 'none';
  const importCancelBtn = el('button', { className: 'btn btn-secondary' });
  importCancelBtn.textContent = 'Cancel';
  const importCountLabel = el('span', { className: 'library-modal__import-count' });
  importCountLabel.textContent = '0 selected';
  const importBtn = el('button', { className: 'btn btn-primary' });
  importBtn.textContent = 'Import Selected';
  importBtn.disabled = true;
  importFooter.appendChild(importCancelBtn);
  importFooter.appendChild(importCountLabel);
  importFooter.appendChild(importBtn);

  modal.appendChild(body);
  modal.appendChild(footer);
  modal.appendChild(importFooter);
  overlay.appendChild(modal);
  root.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('open'));

  function close() {
    overlay.classList.remove('open');
    if (createCtx && createCtx.destroy) createCtx.destroy();
    setTimeout(() => overlay.remove(), 200);
  }

  cancelBtn.addEventListener('click', close);
  importCancelBtn.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  createCtx = buildCreatePane({
    container: createPane,
    isEdit,
    item,
    planSkill,
    engineerId,
    initialLevel,
    saveBtn,
    onDone: () => {
      if (typeof onSaved === 'function') onSaved();
      close();
    },
  });

  if (!isEdit) {
    discoverCtx = buildDiscoverPane({
      container: discoverPane,
      planSkill,
      engineerId,
      initialLevel,
      importBtn,
      importCountLabel,
      onImported: () => {
        if (typeof onSaved === 'function') onSaved();
      },
      onClose: close,
    });
  }
}

function buildCreatePane({ container, isEdit, item, planSkill, engineerId, initialLevel, saveBtn, onDone }) {
  const wizard = el('div', { className: 'library-modal__wizard' });
  container.appendChild(wizard);

  const stepIndicator = el('div', { className: 'library-modal__steps' });
  const step1Pill = el('span', { className: 'library-modal__step library-modal__step--active' });
  step1Pill.textContent = '1. Details';
  const step2Pill = el('span', { className: 'library-modal__step' });
  step2Pill.textContent = '2. Description';
  stepIndicator.appendChild(step1Pill);
  stepIndicator.appendChild(el('span', { className: 'library-modal__step-sep' }));
  stepIndicator.appendChild(step2Pill);
  wizard.appendChild(stepIndicator);

  const step1 = el('div', { className: 'library-modal__step-panel library-modal__step-panel--active' });
  const step2 = el('div', { className: 'library-modal__step-panel' });
  wizard.appendChild(step1);
  wizard.appendChild(step2);

  const hint = el('p', { className: 'mp-form-hint' });
  hint.textContent = 'This item is personal to you. Other engineers can discover it unless you mark it private.';
  step1.appendChild(hint);

  const titleGroup = el('div', { className: 'form-group' });
  const titleLabel = el('label', { className: 'form-label' });
  titleLabel.textContent = 'Title';
  const titleInput = el('input', { type: 'text', className: 'form-input', placeholder: 'e.g. Cisco Live session, Lab exercise…' });
  if (isEdit && item) titleInput.value = item.title || '';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  step1.appendChild(titleGroup);

  const urlGroup = el('div', { className: 'form-group' });
  const urlLabel = el('label', { className: 'form-label' });
  urlLabel.textContent = 'URL (optional)';
  const urlInput = el('input', { type: 'url', className: 'form-input', placeholder: 'https://…' });
  if (isEdit && item) urlInput.value = item.url || '';
  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlInput);
  step1.appendChild(urlGroup);

  const rowFields = el('div', { className: 'library-modal__row' });

  const typeGroup = el('div', { className: 'form-group library-modal__row-item' });
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
  rowFields.appendChild(typeGroup);

  const levelGroup = el('div', { className: 'form-group library-modal__row-item' });
  const levelDisplayLabel = el('label', { className: 'form-label' });
  levelDisplayLabel.textContent = 'Level';
  const levelDisplay = el('div', { className: 'library-modal__level-locked' });
  levelDisplay.textContent = `${LEVEL_LABELS[initialLevel]} (locked)`;
  levelGroup.appendChild(levelDisplayLabel);
  levelGroup.appendChild(levelDisplay);
  rowFields.appendChild(levelGroup);

  step1.appendChild(rowFields);

  const privacyGroup = el('label', { className: 'library-modal__privacy' });
  const privacyInput = el('input', { type: 'checkbox', className: 'library-modal__privacy-cb' });
  if (isEdit && item && item.is_private) privacyInput.checked = true;
  const privacyText = el('span', { className: 'library-modal__privacy-text' });
  privacyText.textContent = 'Keep this item private (others can\u2019t discover it)';
  privacyGroup.appendChild(privacyInput);
  privacyGroup.appendChild(privacyText);
  step1.appendChild(privacyGroup);

  const nextBtn = el('button', { type: 'button', className: 'btn btn-primary library-modal__next-btn' });
  nextBtn.textContent = 'Next: Description';
  step1.appendChild(nextBtn);

  const descLabel = el('label', { className: 'form-label' });
  descLabel.textContent = 'Description';
  step2.appendChild(descLabel);

  const editorHost = el('div', { className: 'library-modal__editor-host' });
  step2.appendChild(editorHost);

  let editorApi = null;
  if (isEdit && item && item.description_format === 'legacy_html') {
    const legacyWarn = el('div', { className: 'library-modal__legacy-warn' });
    legacyWarn.textContent = 'This item uses legacy formatting. Saving will convert it to Markdown.';
    step2.insertBefore(legacyWarn, editorHost);
  }

  const backBtn = el('button', { type: 'button', className: 'btn btn-secondary library-modal__back-btn' });
  backBtn.textContent = '\u2190 Back';
  step2.appendChild(backBtn);

  let initialMarkdown = '';
  if (isEdit && item) {
    if (item.description_format === 'legacy_html') {
      initialMarkdown = '';
    } else {
      initialMarkdown = item.description || '';
    }
  }

  function ensureEditor() {
    if (editorApi) return;
    editorApi = mountMarkdownEditor(editorHost, {
      initialMarkdown,
      placeholder: 'Notes, links, takeaways…',
    });
  }

  nextBtn.addEventListener('click', () => {
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      showToast('Title is required', 'error');
      titleInput.focus();
      return;
    }
    step1.classList.remove('library-modal__step-panel--active');
    step2.classList.add('library-modal__step-panel--active');
    step1Pill.classList.remove('library-modal__step--active');
    step2Pill.classList.add('library-modal__step--active');
    ensureEditor();
    requestAnimationFrame(() => editorApi && editorApi.focus());
  });

  backBtn.addEventListener('click', () => {
    step2.classList.remove('library-modal__step-panel--active');
    step1.classList.add('library-modal__step-panel--active');
    step2Pill.classList.remove('library-modal__step--active');
    step1Pill.classList.add('library-modal__step--active');
  });

  if (isEdit) {
    step1.classList.remove('library-modal__step-panel--active');
    step2.classList.add('library-modal__step-panel--active');
    step1Pill.classList.remove('library-modal__step--active');
    step2Pill.classList.add('library-modal__step--active');
    nextBtn.style.display = 'none';
    backBtn.textContent = '\u2190 Edit Details';
    ensureEditor();
  }

  saveBtn.addEventListener('click', async () => {
    const titleVal = titleInput.value.trim();
    if (!titleVal) {
      showToast('Title is required', 'error');
      step1Pill.click && step1Pill.click();
      titleInput.focus();
      return;
    }

    saveBtn.disabled = true;
    const originalLabel = saveBtn.textContent;
    saveBtn.textContent = 'Saving…';

    const markdown = editorApi ? editorApi.getMarkdown() : (initialMarkdown || '');
    const urlVal = urlInput.value.trim() || null;
    const isPrivate = !!privacyInput.checked;

    try {
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
          level: initialLevel,
          type: typeSelect.value,
          title: titleVal,
          description: markdown || null,
          description_format: 'markdown',
          url: urlVal,
          is_private: isPrivate,
        });
        showToast('Item added', 'success');
      }
      onDone();
    } catch (err) {
      showToast(err.message || 'Failed to save item', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = originalLabel;
    }
  });

  return {
    destroy() {
      if (editorApi) editorApi.destroy();
    },
  };
}

function buildDiscoverPane({ container, planSkill, engineerId, initialLevel, importBtn, importCountLabel, onImported, onClose }) {
  const ctx = { initialized: false };

  const filterBar = el('div', { className: 'library-modal__filter-bar' });
  const searchInput = el('input', {
    type: 'search',
    className: 'form-input library-modal__search',
    placeholder: 'Search titles, descriptions, URLs…',
  });
  const levelChips = el('div', { className: 'library-modal__level-chips' });
  let activeLevel = initialLevel;
  [1, 2, 3].forEach(lv => {
    const chip = el('button', {
      type: 'button',
      className: 'library-modal__chip',
      'data-level': String(lv),
    });
    chip.textContent = LEVEL_LABELS[lv];
    if (lv === activeLevel) chip.classList.add('library-modal__chip--active');
    chip.addEventListener('click', () => {
      activeLevel = lv;
      Array.from(levelChips.children).forEach(c =>
        c.classList.toggle('library-modal__chip--active', Number(c.dataset.level) === lv),
      );
      reload();
    });
    levelChips.appendChild(chip);
  });
  filterBar.appendChild(searchInput);
  filterBar.appendChild(levelChips);
  container.appendChild(filterBar);

  const resultsScroll = el('div', { className: 'library-modal__results' });
  container.appendChild(resultsScroll);

  const emptyState = el('div', { className: 'library-modal__empty' });
  emptyState.textContent = 'No items found.';

  const loadingState = el('div', { className: 'library-modal__loading' });
  loadingState.textContent = 'Loading…';

  const selected = new Map();
  let cursor = null;
  let hasMore = false;
  let loading = false;
  let lastQuery = '';
  let debounceTimer = null;

  function updateSelectionUI() {
    const n = selected.size;
    importCountLabel.textContent = `${n} selected`;
    importBtn.disabled = n === 0 || n > IMPORT_CAP;
    importBtn.textContent = n > 0 ? `Import ${n} Item${n === 1 ? '' : 's'}` : 'Import Selected';
    if (n > IMPORT_CAP) {
      importCountLabel.textContent = `${n} selected — max ${IMPORT_CAP} per import`;
    }
  }

  function clearSelection() {
    selected.clear();
    Array.from(resultsScroll.querySelectorAll('.library-modal__card--selected')).forEach(c => {
      c.classList.remove('library-modal__card--selected');
      const cb = c.querySelector('.library-modal__card-cb');
      if (cb) cb.checked = false;
    });
    Array.from(resultsScroll.querySelectorAll('.library-modal__card--skipped')).forEach(c => {
      c.classList.remove('library-modal__card--skipped');
    });
    updateSelectionUI();
  }

  async function load(append = false) {
    if (loading) return;
    if (append && !hasMore) return;
    loading = true;
    if (!append) {
      resultsScroll.innerHTML = '';
      resultsScroll.appendChild(loadingState);
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
      const finalUrl = `/api/plans/${engineerId}/skills/${skillIdForApi}/library/search?${params.toString()}`;
      const data = await api.get(finalUrl);
      if (!append) resultsScroll.innerHTML = '';
      cursor = data.next_cursor || null;
      hasMore = !!data.has_more;
      lastQuery = q;

      const groups = Array.isArray(data.results) ? groupByBucket(data.results) : [];
      if (groups.length === 0 && !append && resultsScroll.children.length === 0) {
        resultsScroll.appendChild(emptyState);
        return;
      }
      groups.forEach(group => renderGroup(group, append));
      if (hasMore) {
        const moreBtn = el('button', { type: 'button', className: 'btn btn-secondary library-modal__load-more' });
        moreBtn.textContent = 'Load more';
        moreBtn.addEventListener('click', () => {
          moreBtn.remove();
          load(true);
        });
        resultsScroll.appendChild(moreBtn);
      }
    } catch (err) {
      resultsScroll.innerHTML = '';
      const errEl = el('div', { className: 'library-modal__error' });
      errEl.textContent = err.message || 'Failed to load library';
      resultsScroll.appendChild(errEl);
    } finally {
      loading = false;
    }
  }

  function groupByBucket(items) {
    const map = new Map();
    items.forEach(item => {
      const b = item.bucket || 3;
      if (!map.has(b)) map.set(b, []);
      map.get(b).push(item);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, list]) => ({ bucket, items: list }));
  }

  function renderGroup(group, append) {
    const bucket = group.bucket || group.proximity || 3;
    const items = group.items || [];
    if (!items.length) return;

    let groupEl = resultsScroll.querySelector(`[data-bucket="${bucket}"]`);
    let groupCount;
    if (groupEl) {
      groupCount = groupEl.querySelector('.library-modal__group-count');
    } else {
      groupEl = el('div', { className: 'library-modal__group', 'data-bucket': String(bucket) });
      const groupHeader = el('div', { className: 'library-modal__group-header' });
      groupHeader.textContent = BUCKET_LABELS[bucket] || 'Other';
      groupCount = el('span', { className: 'library-modal__group-count' });
      groupCount.textContent = '0';
      groupHeader.appendChild(groupCount);
      groupEl.appendChild(groupHeader);
      resultsScroll.appendChild(groupEl);
    }

    items.forEach(item => groupEl.appendChild(renderCard(item)));
    const total = groupEl.querySelectorAll('.library-modal__card').length;
    if (groupCount) groupCount.textContent = String(total);
  }

  function renderCard(item) {
    const card = el('div', { className: 'library-modal__card' });
    card.dataset.itemId = String(item.id);

    const cb = el('input', { type: 'checkbox', className: 'library-modal__card-cb' });
    if (selected.has(item.id)) {
      cb.checked = true;
      card.classList.add('library-modal__card--selected');
    }
    cb.addEventListener('change', () => {
      if (cb.checked) {
        selected.set(item.id, item);
        card.classList.add('library-modal__card--selected');
      } else {
        selected.delete(item.id);
        card.classList.remove('library-modal__card--selected');
      }
      updateSelectionUI();
    });

    const main = el('div', { className: 'library-modal__card-main' });
    const titleRow = el('div', { className: 'library-modal__card-title-row' });
    const title = el('div', { className: 'library-modal__card-title' });
    title.textContent = item.title || '(untitled)';
    titleRow.appendChild(title);
    const meta = el('div', { className: 'library-modal__card-meta' });
    const typeBadge = el('span', { className: 'library-modal__card-type' });
    typeBadge.textContent = item.type || '';
    meta.appendChild(typeBadge);
    if (item.owner_name) {
      const owner = el('span', { className: 'library-modal__card-owner' });
      owner.textContent = item.is_mine ? 'by you' : `by ${item.owner_name}`;
      meta.appendChild(owner);
    }
    if (item.is_private) {
      const priv = el('span', { className: 'library-modal__card-private' });
      priv.textContent = 'Private';
      meta.appendChild(priv);
    }
    titleRow.appendChild(meta);
    main.appendChild(titleRow);

    if (item.description) {
      const desc = el('div', { className: 'library-modal__card-desc' });
      desc.innerHTML = renderDescription(item.description, item.description_format || 'markdown');
      main.appendChild(desc);
    }
    if (item.url) {
      const urlEl = el('a', {
        className: 'library-modal__card-url',
        href: item.url,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      urlEl.textContent = item.url;
      urlEl.addEventListener('click', (e) => e.stopPropagation());
      main.appendChild(urlEl);
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

  function reload() {
    clearSelection();
    load(false);
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(reload, 250);
  });

  importBtn.addEventListener('click', async () => {
    const ids = Array.from(selected.keys());
    if (ids.length === 0) return;
    if (ids.length > IMPORT_CAP) {
      showToast(`Cannot import more than ${IMPORT_CAP} items at once`, 'error');
      return;
    }
    importBtn.disabled = true;
    importBtn.textContent = 'Importing…';

    try {
      const skillIdForApi = planSkill.skill_id || planSkill.skillId;
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

      Array.from(resultsScroll.querySelectorAll('.library-modal__card')).forEach(card => {
        const id = Number(card.dataset.itemId);
        if (skippedIds.has(id)) {
          card.classList.add('library-modal__card--skipped');
        } else if (selected.has(id)) {
          card.classList.remove('library-modal__card--selected');
          const cb = card.querySelector('.library-modal__card-cb');
          if (cb) cb.checked = false;
          selected.delete(id);
        }
      });
      updateSelectionUI();
    } catch (err) {
      showToast(err.message || 'Import failed', 'error');
    } finally {
      importBtn.disabled = false;
      const n = selected.size;
      importBtn.textContent = n > 0 ? `Import ${n} Item${n === 1 ? '' : 's'}` : 'Import Selected';
    }
  });

  ctx.init = () => {
    if (ctx.initialized) return;
    ctx.initialized = true;
    load(false);
  };

  return ctx;
}
