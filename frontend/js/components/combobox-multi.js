// ─── Combobox Multi-Select Component ────────────────────────────────────────
//
// createComboboxMulti({ options, selectedValues, placeholder?, groupLabel?,
//                       emptyText?, onChange? })
//   → { element, getSelected(), setSelected(values), destroy() }
//
// Token-style multi-select: chips above an input, typing filters a dropdown
// of options, Enter / click adds to selection. Backspace on empty input
// removes the last chip. Options may optionally be grouped via `group` field.

import { createElement } from '../utils/dom.js';

export function createComboboxMulti({
  options = [],
  selectedValues = [],
  placeholder = 'Search and select…',
  emptyText = 'No matches',
  onChange = null,
  onOpen = null,
} = {}) {
  const selected = new Set(selectedValues);
  const optionsById = new Map();
  options.forEach(o => optionsById.set(o.id, o));

  const root = createElement('div', { className: 'combobox-multi' });

  const field = createElement('div', { className: 'combobox-multi__field' });
  const chipsContainer = createElement('div', { className: 'combobox-multi__chips' });
  const input = createElement('input', {
    className: 'combobox-multi__input',
    type: 'text',
    placeholder,
    'aria-label': placeholder,
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-autocomplete': 'list',
  });
  field.appendChild(chipsContainer);
  field.appendChild(input);
  root.appendChild(field);

  const dropdown = createElement('div', { className: 'combobox-multi__dropdown combobox-multi__dropdown--portal', role: 'listbox' });
  dropdown.style.display = 'none';
  dropdown.style.position = 'fixed';
  document.body.appendChild(dropdown);

  let activeIndex = -1;
  let filteredOptions = [];

  function renderChips() {
    chipsContainer.innerHTML = '';
    selected.forEach(id => {
      const opt = optionsById.get(id);
      if (!opt) return;
      const chip = createElement('span', { className: 'combobox-multi__chip' });
      const text = createElement('span', { className: 'combobox-multi__chip-text' });
      text.textContent = opt.label;
      chip.appendChild(text);
      if (opt.group) {
        const groupTag = createElement('span', { className: 'combobox-multi__chip-group' });
        groupTag.textContent = opt.group;
        chip.appendChild(groupTag);
      }
      const close = createElement('button', {
        type: 'button',
        className: 'combobox-multi__chip-close',
        'aria-label': `Remove ${opt.label}`,
      });
      close.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        selected.delete(id);
        renderChips();
        notifyChange();
        if (dropdown.style.display !== 'none') renderDropdown(input.value);
      });
      chip.appendChild(close);
      chipsContainer.appendChild(chip);
    });
  }

  function renderDropdown(query) {
    dropdown.innerHTML = '';
    const q = (query || '').trim().toLowerCase();
    filteredOptions = options.filter(o => {
      if (selected.has(o.id)) return false;
      if (!q) return true;
      return (o.label || '').toLowerCase().includes(q) ||
             (o.group || '').toLowerCase().includes(q);
    });

    if (!filteredOptions.length) {
      const empty = createElement('div', { className: 'combobox-multi__empty' });
      empty.textContent = emptyText;
      dropdown.appendChild(empty);
      activeIndex = -1;
      return;
    }

    const groups = new Map();
    filteredOptions.forEach(o => {
      const g = o.group || '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(o);
    });

    let flatIndex = 0;
    groups.forEach((items, groupName) => {
      if (groupName) {
        const gh = createElement('div', { className: 'combobox-multi__group-header' });
        gh.textContent = groupName;
        dropdown.appendChild(gh);
      }
      items.forEach(opt => {
        const idx = flatIndex++;
        const row = createElement('div', {
          className: 'combobox-multi__option',
          role: 'option',
          'data-index': String(idx),
        });
        if (idx === activeIndex) row.classList.add('is-active');
        row.textContent = opt.label;
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectOption(opt);
        });
        row.addEventListener('mouseenter', () => {
          activeIndex = idx;
          highlightActive();
        });
        dropdown.appendChild(row);
      });
    });

    if (activeIndex < 0 || activeIndex >= filteredOptions.length) {
      activeIndex = 0;
      highlightActive();
    }
  }

  function highlightActive() {
    dropdown.querySelectorAll('.combobox-multi__option').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIndex);
    });
    const activeEl = dropdown.querySelector('.combobox-multi__option.is-active');
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectOption(opt) {
    if (!opt) return;
    selected.add(opt.id);
    input.value = '';
    renderChips();
    renderDropdown('');
    notifyChange();
    input.focus();
  }

  function positionDropdown() {
    const fieldRect = field.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportH - fieldRect.bottom;
    const spaceAbove = fieldRect.top;
    const margin = 8;
    const desired = 280;
    const flipUp = spaceBelow < desired + margin && spaceAbove > spaceBelow;
    const maxH = Math.max(120, Math.min(desired, (flipUp ? spaceAbove : spaceBelow) - margin));

    dropdown.style.left = fieldRect.left + 'px';
    dropdown.style.width = fieldRect.width + 'px';
    dropdown.style.maxHeight = maxH + 'px';
    if (flipUp) {
      dropdown.style.top = '';
      dropdown.style.bottom = (viewportH - fieldRect.top + 4) + 'px';
    } else {
      dropdown.style.bottom = '';
      dropdown.style.top = (fieldRect.bottom + 4) + 'px';
    }
  }

  function openDropdown() {
    const wasOpen = dropdown.style.display !== 'none';
    dropdown.style.display = '';
    input.setAttribute('aria-expanded', 'true');
    field.classList.add('is-open');
    renderDropdown(input.value);
    positionDropdown();
    if (!wasOpen && typeof onOpen === 'function') onOpen(root);
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    input.setAttribute('aria-expanded', 'false');
    field.classList.remove('is-open');
    root.classList.remove('combobox-multi--up');
  }

  // Re-evaluate position on viewport changes while open
  window.addEventListener('resize', () => {
    if (dropdown.style.display !== 'none') positionDropdown();
  });
  window.addEventListener('scroll', () => {
    if (dropdown.style.display !== 'none') positionDropdown();
  }, true);

  function notifyChange() {
    if (typeof onChange === 'function') onChange(Array.from(selected));
  }

  field.addEventListener('click', (e) => {
    if (e.target === field || e.target === chipsContainer) input.focus();
  });

  input.addEventListener('focus', openDropdown);

  input.addEventListener('input', () => {
    activeIndex = 0;
    if (dropdown.style.display === 'none') openDropdown();
    else renderDropdown(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (dropdown.style.display === 'none') openDropdown();
      activeIndex = Math.min(activeIndex + 1, filteredOptions.length - 1);
      highlightActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightActive();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filteredOptions[activeIndex]) {
        e.preventDefault();
        selectOption(filteredOptions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    } else if (e.key === 'Backspace' && !input.value && selected.size > 0) {
      const arr = Array.from(selected);
      selected.delete(arr[arr.length - 1]);
      renderChips();
      notifyChange();
      renderDropdown(input.value);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!root.contains(e.target) && !dropdown.contains(e.target)) closeDropdown();
  });

  renderChips();

  return {
    element: root,
    getSelected() { return Array.from(selected); },
    setSelected(values) {
      selected.clear();
      (values || []).forEach(v => selected.add(v));
      renderChips();
      notifyChange();
    },
    destroy() {
      root.remove();
      dropdown.remove();
    },
  };
}
