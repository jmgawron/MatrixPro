import { api } from '../api.js';
import { Store } from '../state.js';
import { showSkeleton } from '../components/skeleton.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { createElement } from '../utils/dom.js?v=2';
import { createComboboxMulti } from '../components/combobox-multi.js?v=2';

const THREE_E_LEVEL_LABELS = { 1: 'Education', 2: 'Exposure', 3: 'Experience' };

function formatThreeELevel(level, levelLabel) {
  if (levelLabel) return levelLabel;
  const n = Number(level);
  return THREE_E_LEVEL_LABELS[n] || 'Content';
}

// ─── Module-level page state ─────────────────────────────────────────────────

let _container = null;
let _teamsData = [];
let _domainsData = [];
let _debounceTimer = null;
let _searchResultsEl = null;
let _refinementEl = null;
let _domainFiltersEl = null;
let _teamFilterHost = null;
let _statusHost = null;
let _focusHost = null;
let _shiftHost = null;
let _activeFiltersEl = null;
let _compareBodyEl = null;
let _skillPickerInput = null;
let _skillSuggestEl = null;
let _skillComboDestroy = null;

let _selectedSkills = [];
let _activeStatuses = new Set(['developing', 'mastered']);
let _activeFocus = new Set(['education', 'exposure', 'experience']);
let _activeShifts = new Set([1, 2, 3, 4]);
let _activeDomainIds = new Set();
let _selectedTeamIds = [];
let _selectedContentIds = [];
let _contentCompleted = null;
let _hasSearched = false;
let _contentCombo = null;
let _teamCombo = null;

// ─── Entry point ─────────────────────────────────────────────────────────────

export function mountSkillExplorer(container, params) {
  _container = container;
  container.innerHTML = '';

  _teamsData = [];
  _domainsData = [];
  _selectedSkills = [];
  _activeStatuses = new Set(['developing', 'mastered']);
  _activeFocus = new Set(['education', 'exposure', 'experience']);
  _activeShifts = new Set([1, 2, 3, 4]);
  _activeDomainIds = new Set();
  _selectedTeamIds = [];
  _selectedContentIds = [];
  _contentCompleted = null;
  _hasSearched = false;
  _searchResultsEl = null;
  _refinementEl = null;
  _domainFiltersEl = null;
  _teamFilterHost = null;
  _statusHost = null;
  _focusHost = null;
  _shiftHost = null;
  _activeFiltersEl = null;
  _compareBodyEl = null;
  _skillPickerInput = null;
  _skillSuggestEl = null;
  _skillComboDestroy = null;
  _contentCombo = null;
  _teamCombo = null;

  buildPageShell(container);
  loadTeams();

  return () => {
    clearTimeout(_debounceTimer);
    if (_skillComboDestroy) _skillComboDestroy();
    if (_contentCombo) _contentCombo.destroy({ removeRoot: true });
    if (_teamCombo) _teamCombo.destroy({ removeRoot: true });
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadTeams() {
  try {
    _teamsData = await api.get('/api/teams/');
    if (!Array.isArray(_teamsData)) _teamsData = [];
    _domainsData = deriveDomainsFromTeams(_teamsData);
    _activeDomainIds = new Set(_domainsData.map(d => d.id));
    renderAllExplorerFilters();
    populateTeamSelectors();
  } catch (err) {
    showToast(err.message || 'Failed to load teams', 'error');
  }
}

function deriveDomainsFromTeams(teams) {
  const map = new Map();
  teams.forEach((team) => {
    if (team.domain_id == null) return;
    if (!map.has(team.domain_id)) {
      map.set(team.domain_id, {
        id: team.domain_id,
        name: team.domain_name || `Domain ${team.domain_id}`,
      });
    }
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchSkillSuggestions(query) {
  const q = (query || '').trim();
  if (!q) return [];
  try {
    const skills = await api.get(`/api/skills/?search=${encodeURIComponent(q)}`);
    return Array.isArray(skills) ? skills.slice(0, 12) : [];
  } catch {
    return [];
  }
}

async function loadContentOptions() {
  if (!_selectedSkills.length) return [];
  const ids = _selectedSkills.map(s => s.id).join(',');
  try {
    const data = await api.get(`/api/skills/explorer/content?skill_ids=${encodeURIComponent(ids)}`);
    return Array.isArray(data?.options) ? data.options : [];
  } catch {
    return [];
  }
}

function buildSearchQueryString() {
  const params = [];

  if (_selectedSkills.length) {
    params.push(`skill_ids=${_selectedSkills.map(s => s.id).join(',')}`);
  }

  if (_activeStatuses.size > 0 && _activeStatuses.size < 2) {
    params.push(`status=${[..._activeStatuses].join(',')}`);
  } else if (_activeStatuses.size === 2) {
    params.push('status=developing,mastered');
  }

  if (_activeStatuses.has('developing') && _activeFocus.size > 0 && _activeFocus.size < 3) {
    params.push(`focus=${[..._activeFocus].join(',')}`);
  }

  if (_activeShifts.size > 0 && _activeShifts.size < 4) {
    params.push(`shift=${[..._activeShifts].sort((a, b) => a - b).join(',')}`);
  }

  if (_domainsData.length && _activeDomainIds.size > 0 && _activeDomainIds.size < _domainsData.length) {
    params.push(`domain_ids=${[..._activeDomainIds].sort((a, b) => a - b).join(',')}`);
  }

  if (_selectedTeamIds.length) {
    params.push(`team_ids=${_selectedTeamIds.join(',')}`);
  }

  if (_selectedContentIds.length && _contentCompleted !== null) {
    params.push(`content_ids=${_selectedContentIds.join(',')}`);
    params.push(`content_completed=${_contentCompleted ? 'true' : 'false'}`);
  }

  return params.length ? `?${params.join('&')}` : '';
}

async function runSearch() {
  if (!_searchResultsEl) return;

  if (!_selectedSkills.length) {
    _searchResultsEl.innerHTML = '';
    const placeholder = createElement('div', {
      className: 'empty-state empty-state--inline',
    });
    placeholder.textContent = 'Select one or more skills to search for engineers.';
    _searchResultsEl.appendChild(placeholder);
    await syncRefinementPanel();
    return;
  }

  showSkeleton(_searchResultsEl, 'table');
  const qs = buildSearchQueryString();

  try {
    const data = await api.get(`/api/skills/explorer${qs}`);
    _hasSearched = true;
    renderSearchResults(data);
    await syncRefinementPanel();
  } catch (err) {
    _searchResultsEl.innerHTML = '';
    renderErrorState(_searchResultsEl, err.message || 'Search failed');
  }
}

async function syncRefinementPanel() {
  if (!_refinementEl) return;

  const hasSkills = _selectedSkills.length > 0;
  _refinementEl.hidden = !hasSkills;
  if (!hasSkills) {
    if (_contentCombo) {
      _contentCombo.destroy();
      _contentCombo = null;
    }
    const comboHost = _refinementEl.querySelector('.explorer-refinement-combo');
    if (comboHost) comboHost.innerHTML = '';
    return;
  }

  const options = await loadContentOptions();
  const mapped = options.map(o => {
    const tier = formatThreeELevel(o.level, o.level_label);
    return {
      id: o.id,
      label: `${o.skill_name} · ${o.title}`,
      group: tier,
    };
  });

  const validIds = new Set(mapped.map(o => o.id));
  _selectedContentIds = _selectedContentIds.filter(id => validIds.has(id));

  const comboHost = _refinementEl.querySelector('.explorer-refinement-combo');
  if (!comboHost) return;

  if (_contentCombo) {
    _contentCombo.updateOptions(mapped);
    _contentCombo.setSelected(_selectedContentIds);
    return;
  }

  comboHost.innerHTML = '';
  _contentCombo = createComboboxMulti({
    options: mapped,
    selectedValues: _selectedContentIds,
    placeholder: 'Filter by catalog 3E activities…',
    emptyText: 'No matching activities for selected skills',
    onChange: (ids) => {
      _selectedContentIds = ids;
      updateActiveFilterCount();
    },
  });
  comboHost.appendChild(_contentCombo.element);
}

async function applyRefinement() {
  if (!_selectedContentIds.length) {
    showToast('Select at least one 3E activity to refine results', 'warning');
    return;
  }
  if (_contentCompleted === null) {
    showToast('Choose Completed or Not Completed for the selected activities', 'warning');
    return;
  }
  await runSearch();
}

async function runComparison(teamAId, teamBId) {
  if (!_compareBodyEl) return;
  showSkeleton(_compareBodyEl, 'table');

  try {
    const data = await api.get(`/api/skills/compare?team_a=${teamAId}&team_b=${teamBId}`);
    renderComparison(data);
  } catch (err) {
    _compareBodyEl.innerHTML = '';
    renderErrorState(_compareBodyEl, err.message || 'Comparison failed');
  }
}

// ─── Page shell construction ──────────────────────────────────────────────────

function buildPageShell(container) {
  const wrapper = createElement('div', { className: 'mp-wrapper' });

  const header = createElement('div', { className: 'mp-header' });
  const headerText = createElement('div', { className: 'mp-header-text' });
  const title = createElement('h1', { className: 'mp-title' });
  title.appendChild(document.createTextNode('Skill '));
  const gradientSpan = createElement('span', { className: 'mp-title-gradient' });
  gradientSpan.textContent = 'Explorer';
  title.appendChild(gradientSpan);
  const subtitle = createElement('p', { className: 'mp-subtitle' });
  subtitle.textContent = 'Search engineers by skill and compare teams';
  headerText.appendChild(title);
  headerText.appendChild(subtitle);
  header.appendChild(headerText);
  wrapper.appendChild(header);

  const main = createElement('div', { className: 'page-body--col' });

  const user = Store.get('user');
  if (user?.role === 'manager' || user?.role === 'admin') {
    main.appendChild(buildSearchSection());
  }

  main.appendChild(buildComparisonSection());

  wrapper.appendChild(main);
  container.appendChild(wrapper);
}

// ─── Section A: Engineer Search ───────────────────────────────────────────────

function buildSearchSection() {
  const section = createElement('div', { className: 'content-section' });

  const header = createElement('div', { className: 'content-section-header' });
  const headerTitle = createElement('h2', { className: 'content-section-title' });
  headerTitle.textContent = 'Engineer Search';
  const headerDesc = createElement('span', { className: 'content-section-desc' });
  headerDesc.textContent = 'Find engineers by skill, organization, and development progress';
  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  const panel = createElement('div', { className: 'explorer-filter-panel' });

  const primary = createElement('div', { className: 'explorer-filter-primary' });
  const primaryLabel = createElement('div', { className: 'explorer-filter-group__head' });
  const primaryTitle = createElement('span', { className: 'explorer-filter-group__title' });
  primaryTitle.textContent = 'Skills';
  const primaryDesc = createElement('span', { className: 'explorer-filter-group__desc' });
  primaryDesc.textContent = 'Select one or more catalog skills to search across engineers';
  primaryLabel.appendChild(primaryTitle);
  primaryLabel.appendChild(primaryDesc);
  primary.appendChild(primaryLabel);
  primary.appendChild(buildSkillPicker());
  panel.appendChild(primary);

  const groups = createElement('div', { className: 'explorer-filter-groups' });

  const progressGroup = createElement('div', { className: 'explorer-filter-group' });
  progressGroup.appendChild(createFilterGroupHead(
    'Skill progress',
    'Plan status and current 3E development focus',
  ));
  const progressBody = createElement('div', {
    className: 'explorer-filter-group__body explorer-filter-group__body--stack',
  });
  _statusHost = createElement('div', { className: 'explorer-filter-field' });
  _focusHost = createElement('div', { className: 'explorer-filter-field explorer-filter-subrow' });
  progressBody.appendChild(_statusHost);
  progressBody.appendChild(_focusHost);
  progressGroup.appendChild(progressBody);
  groups.appendChild(progressGroup);

  const orgGroup = createElement('div', { className: 'explorer-filter-group' });
  orgGroup.appendChild(createFilterGroupHead(
    'Organization',
    'Narrow by domain, team, and follow-the-sun shift',
  ));
  const orgBody = createElement('div', {
    className: 'explorer-filter-group__body explorer-filter-group__body--stack',
  });
  _domainFiltersEl = createElement('div', { className: 'explorer-filter-field' });
  _teamFilterHost = createElement('div', { className: 'explorer-filter-field' });
  _shiftHost = createElement('div', { className: 'explorer-filter-field' });
  orgBody.appendChild(_domainFiltersEl);
  orgBody.appendChild(_teamFilterHost);
  orgBody.appendChild(_shiftHost);
  orgGroup.appendChild(orgBody);
  groups.appendChild(orgGroup);

  panel.appendChild(groups);

  const actions = createElement('div', { className: 'explorer-filter-actions' });
  _activeFiltersEl = createElement('span', {
    className: 'explorer-filter-actions__count',
    'aria-live': 'polite',
  });
  const clearBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm explorer-filter-clear',
  });
  clearBtn.textContent = 'Reset filters';
  clearBtn.addEventListener('click', () => resetExplorerFilters());
  const searchBtn = createElement('button', {
    className: 'btn btn-primary btn-sm explorer-search-btn',
    type: 'button',
  });
  searchBtn.textContent = 'Search engineers';
  searchBtn.addEventListener('click', () => runSearch());
  actions.appendChild(_activeFiltersEl);
  actions.appendChild(clearBtn);
  actions.appendChild(searchBtn);
  panel.appendChild(actions);

  section.appendChild(panel);

  _refinementEl = buildRefinementPanel();
  section.appendChild(_refinementEl);

  const resultsContainer = createElement('div', {
    id: 'explorer-results',
    className: 'content-section-body',
  });
  const placeholder = createElement('div', {
    className: 'empty-state empty-state--inline',
  });
  placeholder.textContent = 'Select one or more skills to search for engineers.';
  resultsContainer.appendChild(placeholder);

  _searchResultsEl = resultsContainer;
  section.appendChild(resultsContainer);

  renderAllExplorerFilters();

  return section;
}

function createFilterGroupHead(title, desc) {
  const head = createElement('div', { className: 'explorer-filter-group__head' });
  const titleEl = createElement('span', { className: 'explorer-filter-group__title' });
  titleEl.textContent = title;
  const descEl = createElement('span', { className: 'explorer-filter-group__desc' });
  descEl.textContent = desc;
  head.appendChild(titleEl);
  head.appendChild(descEl);
  return head;
}

function buildSkillPicker() {
  const wrap = createElement('div', { className: 'explorer-skill-picker' });

  const field = createElement('div', { className: 'explorer-skill-picker__field' });
  const chipsEl = createElement('div', { className: 'explorer-skill-picker__chips' });

  _skillPickerInput = createElement('input', {
    type: 'text',
    className: 'explorer-search-input',
    placeholder: 'Type to search the skill catalog…',
    'aria-label': 'Search skills',
    autocomplete: 'off',
  });

  _skillSuggestEl = createElement('div', {
    className: 'explorer-skill-suggestions',
    role: 'listbox',
    hidden: true,
  });

  field.appendChild(chipsEl);
  field.appendChild(_skillPickerInput);
  wrap.appendChild(field);
  wrap.appendChild(_skillSuggestEl);

  function renderSkillChips() {
    chipsEl.innerHTML = '';
    _selectedSkills.forEach((skill) => {
      const chip = createElement('span', { className: 'explorer-skill-chip' });
      chip.textContent = skill.name;
      const remove = createElement('button', {
        type: 'button',
        className: 'explorer-skill-chip__remove',
        'aria-label': `Remove ${skill.name}`,
      });
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        _selectedSkills = _selectedSkills.filter(s => s.id !== skill.id);
        _selectedContentIds = [];
        renderSkillChips();
        syncRefinementPanel();
      });
      chip.appendChild(remove);
      chipsEl.appendChild(chip);
    });
  }

  let suggestTimer = null;
  let activeSuggestions = [];

  function hideSuggestions() {
    _skillSuggestEl.hidden = true;
    _skillSuggestEl.innerHTML = '';
    activeSuggestions = [];
  }

  function addSkill(skill) {
    if (_selectedSkills.some(s => s.id === skill.id)) return;
    _selectedSkills.push({ id: skill.id, name: skill.name });
    renderSkillChips();
    _skillPickerInput.value = '';
    hideSuggestions();
    syncRefinementPanel();
  }

  async function showSuggestions(query) {
    const q = query.trim();
    if (!q) {
      hideSuggestions();
      return;
    }
    activeSuggestions = await fetchSkillSuggestions(q);
    _skillSuggestEl.innerHTML = '';
    if (!activeSuggestions.length) {
      const empty = createElement('div', { className: 'explorer-skill-suggestions__empty' });
      empty.textContent = 'No matching skills';
      _skillSuggestEl.appendChild(empty);
    } else {
      activeSuggestions.forEach((skill) => {
        const row = createElement('button', {
          type: 'button',
          className: 'explorer-skill-suggestions__item',
          role: 'option',
        });
        row.textContent = skill.name;
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          addSkill(skill);
        });
        _skillSuggestEl.appendChild(row);
      });
    }
    _skillSuggestEl.hidden = false;
  }

  _skillPickerInput.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => showSuggestions(_skillPickerInput.value), 250);
  });

  _skillPickerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && activeSuggestions.length) {
      e.preventDefault();
      addSkill(activeSuggestions[0]);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) hideSuggestions();
  });

  renderSkillChips();
  return wrap;
}

function buildChipFilterGroup({ label, ariaLabel, items, isActive, onToggle, inline = false }) {
  const group = createElement('div', {
    className: inline ? 'explorer-filter-chips' : 'cat-shift-filters',
    role: 'group',
    'aria-label': ariaLabel,
  });

  if (inline) {
    const sublabel = createElement('span', { className: 'explorer-filter-sublabel' });
    sublabel.textContent = label;
    group.appendChild(sublabel);
  } else {
    const labelEl = createElement('span', { className: 'cat-shift-filters__label' });
    labelEl.textContent = label;
    group.appendChild(labelEl);
  }

  const chips = createElement('div', {
    className: inline ? 'explorer-filter-chips__row' : 'cat-shift-filters__chips',
  });
  items.forEach(({ value, label: chipLabel }) => {
    const active = isActive(value);
    const btn = createElement('button', {
      type: 'button',
      className: active ? 'cat-shift-btn active' : 'cat-shift-btn',
    });
    btn.textContent = chipLabel;
    btn.dataset.value = String(value);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.addEventListener('click', () => {
      onToggle(value, btn);
      updateActiveFilterCount();
    });
    chips.appendChild(btn);
  });
  group.appendChild(chips);
  return group;
}

function renderAllExplorerFilters() {
  renderStatusFilters();
  renderFocusFilters();
  renderShiftFilters();
  renderDomainFilters();
  renderTeamFilter();
  updateActiveFilterCount();
}

function countActiveFilters() {
  let count = 0;
  if (_activeStatuses.size < 2) count += 1;
  if (_activeStatuses.has('developing') && _activeFocus.size < 3) count += 1;
  if (_activeShifts.size < 4) count += 1;
  if (_domainsData.length && _activeDomainIds.size < _domainsData.length) count += 1;
  if (_selectedTeamIds.length) count += 1;
  if (_selectedContentIds.length && _contentCompleted !== null) count += 1;
  return count;
}

function updateActiveFilterCount() {
  if (!_activeFiltersEl) return;
  const count = countActiveFilters();
  _activeFiltersEl.textContent = count
    ? `${count} filter${count !== 1 ? 's' : ''} applied`
    : 'All filters at default';
}

function resetExplorerFilters() {
  _activeStatuses = new Set(['developing', 'mastered']);
  _activeFocus = new Set(['education', 'exposure', 'experience']);
  _activeShifts = new Set([1, 2, 3, 4]);
  _activeDomainIds = new Set(_domainsData.map(d => d.id));
  _selectedTeamIds = [];
  _selectedContentIds = [];
  _contentCompleted = null;
  renderAllExplorerFilters();
  if (_hasSearched && _selectedSkills.length) runSearch();
}

function renderStatusFilters() {
  if (!_statusHost) return;
  _statusHost.innerHTML = '';
  _statusHost.appendChild(buildChipFilterGroup({
    label: 'Status',
    ariaLabel: 'Filter by skill status',
    inline: true,
    items: [
      { value: 'developing', label: 'In Development' },
      { value: 'mastered', label: 'Mastered' },
    ],
    isActive: (value) => _activeStatuses.has(value),
    onToggle: (value, btn) => {
      if (_activeStatuses.has(value)) {
        if (_activeStatuses.size > 1) {
          _activeStatuses.delete(value);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        _activeStatuses.add(value);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      updateFocusFilterVisibility();
    },
  }));
}

function renderFocusFilters() {
  if (!_focusHost) return;
  _focusHost.innerHTML = '';
  _focusHost.appendChild(buildChipFilterGroup({
    label: 'Development focus',
    ariaLabel: 'Filter by 3E development focus',
    inline: true,
    items: [
      { value: 'education', label: 'Education' },
      { value: 'exposure', label: 'Exposure' },
      { value: 'experience', label: 'Experience' },
    ],
    isActive: (value) => _activeFocus.has(value),
    onToggle: (value, btn) => {
      if (_activeFocus.has(value)) {
        if (_activeFocus.size > 1) {
          _activeFocus.delete(value);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        _activeFocus.add(value);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
    },
  }));
  updateFocusFilterVisibility();
}

function renderShiftFilters() {
  if (!_shiftHost) return;
  _shiftHost.innerHTML = '';
  _shiftHost.appendChild(buildChipFilterGroup({
    label: 'Shift',
    ariaLabel: 'Filter by team shift',
    inline: true,
    items: [1, 2, 3, 4].map(n => ({ value: n, label: `Shift ${n}` })),
    isActive: (value) => _activeShifts.has(value),
    onToggle: (value, btn) => {
      if (_activeShifts.has(value)) {
        if (_activeShifts.size > 1) {
          _activeShifts.delete(value);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        _activeShifts.add(value);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
    },
  }));
}

function updateFocusFilterVisibility() {
  if (!_focusHost) return;
  const show = _activeStatuses.has('developing');
  _focusHost.hidden = !show;
  _focusHost.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function renderDomainFilters() {
  if (!_domainFiltersEl) return;
  _domainFiltersEl.innerHTML = '';

  if (!_domainsData.length) {
    const pending = createElement('span', { className: 'explorer-filter-sublabel explorer-filter-sublabel--muted' });
    pending.textContent = 'Domain — loading…';
    _domainFiltersEl.appendChild(pending);
    return;
  }

  _domainFiltersEl.appendChild(buildChipFilterGroup({
    label: 'Domain',
    ariaLabel: 'Filter by domain',
    inline: true,
    items: _domainsData.map(d => ({ value: d.id, label: d.name })),
    isActive: (value) => _activeDomainIds.has(value),
    onToggle: (value, btn) => {
      if (_activeDomainIds.has(value)) {
        if (_activeDomainIds.size > 1) {
          _activeDomainIds.delete(value);
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        }
      } else {
        _activeDomainIds.add(value);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
    },
  }));
}

function renderTeamFilter() {
  if (!_teamFilterHost) return;
  _teamFilterHost.innerHTML = '';

  const wrap = createElement('div', { className: 'explorer-filter-chips explorer-filter-chips--field' });
  const sublabel = createElement('span', { className: 'explorer-filter-sublabel' });
  sublabel.textContent = 'Team';
  wrap.appendChild(sublabel);

  const comboHost = createElement('div', { className: 'explorer-team-filter__combo' });
  wrap.appendChild(comboHost);
  _teamFilterHost.appendChild(wrap);

  if (!_teamsData.length) return;

  if (_teamCombo) {
    _teamCombo.destroy();
    _teamCombo = null;
  }

  const teamOptions = [..._teamsData]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map(team => ({
      id: team.id,
      label: team.name,
      group: team.domain_name || 'Other',
    }));

  _teamCombo = createComboboxMulti({
    options: teamOptions,
    selectedValues: _selectedTeamIds,
    placeholder: 'All teams — search to narrow…',
    emptyText: 'No matching teams',
    onChange: (ids) => {
      _selectedTeamIds = ids;
      updateActiveFilterCount();
    },
  });
  comboHost.appendChild(_teamCombo.element);
}

function buildRefinementPanel() {
  const panel = createElement('div', {
    className: 'explorer-refinement-panel explorer-filter-group explorer-filter-group--refinement',
    hidden: true,
  });

  panel.appendChild(createFilterGroupHead(
    'Refine by 3E activities',
    'After your initial search, filter engineers by catalog activity completion',
  ));

  const comboHost = createElement('div', { className: 'explorer-refinement-combo' });
  panel.appendChild(comboHost);

  const completionRow = createElement('div', { className: 'explorer-refinement-completion explorer-filter-chips' });
  const completionLabel = createElement('span', { className: 'explorer-filter-sublabel' });
  completionLabel.textContent = 'Activity status';
  completionRow.appendChild(completionLabel);

  const chips = createElement('div', { className: 'explorer-filter-chips__row' });
  [
    { value: true, label: 'Completed' },
    { value: false, label: 'Not Completed' },
  ].forEach(({ value, label }) => {
    const btn = createElement('button', {
      type: 'button',
      className: _contentCompleted === value ? 'cat-shift-btn active' : 'cat-shift-btn',
    });
    btn.textContent = label;
    btn.setAttribute('aria-pressed', _contentCompleted === value ? 'true' : 'false');
    btn.addEventListener('click', () => {
      _contentCompleted = value;
      chips.querySelectorAll('.cat-shift-btn').forEach(b => {
        const isActive = (value === true && b.textContent === 'Completed')
          || (value === false && b.textContent === 'Not Completed');
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      updateActiveFilterCount();
    });
    chips.appendChild(btn);
  });
  completionRow.appendChild(chips);
  panel.appendChild(completionRow);

  const applyBtn = createElement('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
  });
  applyBtn.textContent = 'Apply Refinement';
  applyBtn.addEventListener('click', () => applyRefinement());
  panel.appendChild(applyBtn);

  return panel;
}

// ─── Search results rendering ─────────────────────────────────────────────────

function renderSearchResults(data) {
  if (!_searchResultsEl) return;
  _searchResultsEl.innerHTML = '';

  const results = Array.isArray(data?.results) ? data.results : [];

  if (results.length === 0) {
    const empty = createElement('div', { className: 'empty-state' });
    const icon = createElement('div', { className: 'empty-state-icon' });
    icon.textContent = '∅';
    const msg = createElement('div', { className: 'empty-state-desc' });
    msg.textContent = 'No engineers found matching your criteria.';
    empty.appendChild(icon);
    empty.appendChild(msg);
    _searchResultsEl.appendChild(empty);
    return;
  }

  const countBar = createElement('div', { className: 'explorer-count-bar' });
  const countBadge = createElement('span', { className: 'triage-chip triage-signal' });
  countBadge.textContent = `${data.total ?? results.length} result${(data.total ?? results.length) !== 1 ? 's' : ''}`;
  countBar.appendChild(countBadge);
  _searchResultsEl.appendChild(countBar);

  const tableWrap = createElement('div', { className: 'explorer-table-wrap' });
  const table = createElement('table', { className: 'explorer-table' });

  const thead = createElement('thead');
  const headerRow = createElement('tr');
  const cols = [
    'Engineer',
    'Team',
    'Shift',
    'Skill',
    'Status',
    'Development Focus',
    'Skill Progress',
  ];
  cols.forEach((col) => {
    const th = createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = createElement('tbody');
  results.forEach((row) => {
    const tr = createElement('tr');

    const engineerTd = createElement('td', { className: 'bold-cell' });
    engineerTd.textContent = row.engineer_name || `Engineer ${row.engineer_id}`;
    tr.appendChild(engineerTd);

    const teamTd = createElement('td');
    teamTd.textContent = row.team_name || '—';
    tr.appendChild(teamTd);

    const shiftTd = createElement('td');
    shiftTd.textContent = row.shift ? `Shift ${row.shift}` : '—';
    tr.appendChild(shiftTd);

    const skillTd = createElement('td');
    skillTd.textContent = row.skill_name || '—';
    tr.appendChild(skillTd);

    const statusTd = createElement('td');
    statusTd.appendChild(buildStatusChip(row.status));
    tr.appendChild(statusTd);

    const focusTd = createElement('td');
    focusTd.textContent = row.development_focus || (row.status === 'mastered' ? '—' : 'Not set');
    tr.appendChild(focusTd);

    const progressTd = createElement('td');
    progressTd.appendChild(buildSkillProgressCell(row));
    tr.appendChild(progressTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  _searchResultsEl.appendChild(tableWrap);
}

function buildSkillProgressCell(row) {
  const wrap = createElement('div', { className: 'explorer-progress' });
  const progress = row.progress;
  const isMastered = row.status === 'mastered';
  const pct = Math.max(0, Math.min(100, progress?.completion_pct ?? (isMastered ? 100 : 0)));
  const completed = progress?.completed_items ?? 0;
  const total = progress?.total_items ?? 0;

  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', '100');
  wrap.setAttribute('aria-valuenow', String(pct));
  wrap.setAttribute(
    'aria-label',
    `${row.engineer_name || 'Engineer'} — ${pct}% skill progress (${completed} of ${total} items)`,
  );

  const track = createElement('div', {
    className: isMastered ? 'explorer-progress__track explorer-progress__track--mastered' : 'explorer-progress__track',
  });
  const fill = createElement('div', {
    className: isMastered ? 'explorer-progress__fill explorer-progress__fill--mastered' : 'explorer-progress__fill',
    style: { width: `${pct}%` },
  });
  track.appendChild(fill);
  wrap.appendChild(track);

  const meta = createElement('div', { className: 'explorer-progress__meta' });
  const pctEl = createElement('span', {
    className: isMastered ? 'explorer-progress__pct explorer-progress__pct--mastered' : 'explorer-progress__pct',
  });
  pctEl.textContent = `${pct}%`;
  meta.appendChild(pctEl);

  const countEl = createElement('span', { className: 'explorer-progress__count' });
  countEl.textContent = total ? `${completed}/${total} items` : 'No content items';
  meta.appendChild(countEl);

  wrap.appendChild(meta);
  return wrap;
}

function buildStatusChip(status) {
  const labelMap = {
    developing: 'In Development',
    mastered: 'Mastered',
    planned: 'Planned',
  };
  const slug = ['planned', 'developing', 'mastered'].includes(status) ? status : 'unknown';
  const label = labelMap[status] || status || '—';

  const chip = createElement('span', { className: `status-chip status-chip--${slug}` });
  chip.textContent = label;
  return chip;
}

// ─── Section B: Cross-Team Comparison ────────────────────────────────────────

function buildComparisonSection() {
  const section = createElement('div', { className: 'content-section' });

  const header = createElement('div', { className: 'content-section-header' });
  const headerTitle = createElement('h2', { className: 'content-section-title' });
  headerTitle.textContent = 'Cross-Team Comparison';
  const headerDesc = createElement('span', { className: 'content-section-desc' });
  headerDesc.textContent = 'Compare skill coverage across two teams';
  header.appendChild(headerTitle);
  header.appendChild(headerDesc);
  section.appendChild(header);

  const selectorsRow = createElement('div', { className: 'explorer-compare-selectors' });
  const teamAWrap = buildTeamSelectorGroup('compare-team-a', 'Compare Team');
  const vsLabel = createElement('div', { className: 'explorer-compare-vs' });
  vsLabel.textContent = 'vs.';
  const teamBWrap = buildTeamSelectorGroup('compare-team-b', 'With Team');

  selectorsRow.appendChild(teamAWrap);
  selectorsRow.appendChild(vsLabel);
  selectorsRow.appendChild(teamBWrap);

  const compareBtn = createElement('button', { className: 'btn btn-primary btn-sm' });
  compareBtn.textContent = 'Compare';
  compareBtn.addEventListener('click', () => {
    const selA = document.getElementById('compare-team-a');
    const selB = document.getElementById('compare-team-b');
    if (!selA?.value || !selB?.value) {
      showToast('Please select both teams to compare', 'warning');
      return;
    }
    runComparison(selA.value, selB.value);
  });
  selectorsRow.appendChild(compareBtn);

  section.appendChild(selectorsRow);

  const compareBody = createElement('div', {
    id: 'compare-body',
    className: 'content-section-body--lg',
  });
  const comparePlaceholder = createElement('div', {
    className: 'empty-state empty-state--inline',
  });
  comparePlaceholder.textContent = 'Select two teams above and click Compare to see skill overlap.';
  compareBody.appendChild(comparePlaceholder);

  _compareBodyEl = compareBody;
  section.appendChild(compareBody);

  return section;
}

function buildTeamSelectorGroup(inputId, label) {
  const wrap = createElement('div', { className: 'explorer-selector-group' });
  const labelEl = createElement('label', { className: 'explorer-selector-label' });
  labelEl.textContent = label;
  labelEl.setAttribute('for', inputId);
  const select = createElement('select', {
    id: inputId,
    className: 'explorer-selector-select',
  });
  const placeholder = createElement('option', { value: '' });
  placeholder.textContent = '— Select team —';
  select.appendChild(placeholder);
  wrap.appendChild(labelEl);
  wrap.appendChild(select);
  return wrap;
}

function populateTeamSelectors() {
  const selA = document.getElementById('compare-team-a');
  const selB = document.getElementById('compare-team-b');
  if (!selA || !selB) return;

  const user = Store.get('user');

  _teamsData.forEach(team => {
    const optA = createElement('option', { value: String(team.id) });
    optA.textContent = team.name;
    selA.appendChild(optA);

    const optB = createElement('option', { value: String(team.id) });
    optB.textContent = team.name;
    selB.appendChild(optB);
  });

  if (user?.team_id) {
    selB.value = String(user.team_id);
  }
}

// ─── Comparison rendering ─────────────────────────────────────────────────────

function renderComparison(data) {
  if (!_compareBodyEl) return;
  _compareBodyEl.innerHTML = '';

  const teamA = data?.team_a || {};
  const teamB = data?.team_b || {};
  const overlapPercent = typeof data?.overlap_percent === 'number'
    ? Math.round(data.overlap_percent * 10) / 10
    : 0;

  const circleRow = createElement('div', { className: 'explorer-circle-row' });
  circleRow.appendChild(buildOverlapCircle(overlapPercent));

  const overlapLabel = createElement('div', { className: 'explorer-overlap-label' });
  overlapLabel.textContent = `${data.overlap_count ?? 0} shared skill${(data.overlap_count ?? 0) !== 1 ? 's' : ''} between teams`;
  circleRow.appendChild(overlapLabel);
  _compareBodyEl.appendChild(circleRow);

  const splitLayout = createElement('div', { className: 'explorer-split-layout' });
  splitLayout.appendChild(buildTeamSkillPanel(teamA, 'A', data));
  splitLayout.appendChild(buildTeamSkillPanel(teamB, 'B', data));
  _compareBodyEl.appendChild(splitLayout);
}

function buildOverlapCircle(percent) {
  const size = 120;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  const wrap = createElement('div', { className: 'explorer-circle-row' });
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-label', `${percent}% skill overlap`);

  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  track.setAttribute('cx', String(size / 2));
  track.setAttribute('cy', String(size / 2));
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'var(--border-soft)');
  track.setAttribute('stroke-width', '8');
  svg.appendChild(track);

  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  arc.setAttribute('cx', String(size / 2));
  arc.setAttribute('cy', String(size / 2));
  arc.setAttribute('r', String(radius));
  arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', 'var(--accent)');
  arc.setAttribute('stroke-width', '8');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('stroke-dasharray', String(circumference));
  arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);

  if (prefersReducedMotion) {
    arc.setAttribute('stroke-dashoffset', String(circumference - (percent / 100) * circumference));
  } else {
    arc.setAttribute('stroke-dashoffset', String(circumference));
    arc.style.transition = 'stroke-dashoffset 1s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arc.setAttribute('stroke-dashoffset', String(circumference - (percent / 100) * circumference));
      });
    });
  }

  svg.appendChild(arc);

  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('x', String(size / 2));
  textEl.setAttribute('y', String(size / 2 + 5));
  textEl.setAttribute('text-anchor', 'middle');
  textEl.setAttribute('font-size', '18');
  textEl.setAttribute('font-weight', '700');
  textEl.setAttribute('fill', 'var(--text-primary)');
  textEl.textContent = `${percent}%`;
  svg.appendChild(textEl);

  const subTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  subTextEl.setAttribute('x', String(size / 2));
  subTextEl.setAttribute('y', String(size / 2 + 20));
  subTextEl.setAttribute('text-anchor', 'middle');
  subTextEl.setAttribute('font-size', '10');
  subTextEl.setAttribute('fill', 'var(--text-muted)');
  subTextEl.textContent = 'overlap';
  svg.appendChild(subTextEl);

  wrap.appendChild(svg);
  return wrap;
}

function buildTeamSkillPanel(team, side, compareData) {
  const panel = createElement('div', { className: 'explorer-team-panel' });
  const panelHeader = createElement('div', { className: 'explorer-team-panel-header' });

  const teamLabel = createElement('span', { className: 'explorer-team-side-label' });
  teamLabel.textContent = side === 'A' ? 'Team A' : 'Team B';

  const teamName = createElement('span', { className: 'explorer-team-name' });
  teamName.textContent = team.team_name || '—';

  const skillCount = createElement('span', { className: 'triage-chip triage-signal' });
  const skills = Array.isArray(team.skills) ? team.skills : [];
  skillCount.textContent = `${skills.length} skill${skills.length !== 1 ? 's' : ''}`;

  panelHeader.appendChild(teamLabel);
  panelHeader.appendChild(teamName);
  panelHeader.appendChild(skillCount);
  panel.appendChild(panelHeader);

  const skillsList = createElement('div', { className: 'explorer-skill-list' });
  if (skills.length === 0) {
    const empty = createElement('div', { className: 'empty-state empty-state--inline' });
    empty.textContent = 'No skills found for this team.';
    skillsList.appendChild(empty);
  } else {
    skills.forEach(skill => {
      skillsList.appendChild(buildSkillCard(skill, side, compareData));
    });
  }

  panel.appendChild(skillsList);
  return panel;
}

function buildSkillCard(skill, side, compareData) {
  const isOverlap = skill.is_overlap === true;
  const card = createElement('div', {
    className: isOverlap ? 'explorer-skill-card explorer-skill-card--overlap' : 'explorer-skill-card',
  });

  const left = createElement('div', { className: 'explorer-skill-card-info' });
  const nameEl = createElement('div', { className: 'explorer-skill-card-name' });
  nameEl.textContent = skill.name || `Skill ${skill.id}`;
  left.appendChild(nameEl);

  if (isOverlap) {
    const overlapBadge = createElement('span', { className: 'explorer-overlap-badge' });
    overlapBadge.textContent = 'Shared';
    left.appendChild(overlapBadge);
  }

  card.appendChild(left);

  if (side === 'A' && !isOverlap) {
    const user = Store.get('user');
    if (user) card.appendChild(buildAddToPlanButton(skill, user));
  }

  return card;
}

function buildAddToPlanButton(skill, user) {
  const btn = createElement('button', { className: 'explorer-add-btn' });
  btn.textContent = '+ Add to My Plan';

  btn.addEventListener('click', async () => {
    if (user.role === 'manager' || user.role === 'admin') {
      showToast('Use the My Plan page to import skills for your team members', 'info');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Adding…';
    btn.style.opacity = '0.7';
    btn.style.cursor = 'not-allowed';

    try {
      await api.post(`/api/plans/${user.id}/skills`, { skill_id: skill.id });
      btn.textContent = 'Added';
      btn.className = 'explorer-add-btn explorer-add-btn--added';
      btn.style.opacity = '1';
      showToast(`"${skill.name}" added to your plan`, 'success');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('409') || msg.toLowerCase().includes('already')) {
        showToast('Skill already in your plan', 'info');
      } else {
        showToast(err.message || 'Failed to add skill to plan', 'error');
      }
      btn.disabled = false;
      btn.textContent = '+ Add to My Plan';
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.className = 'explorer-add-btn';
    }
  });

  return btn;
}

function renderErrorState(container, msg) {
  const wrap = createElement('div', { className: 'explorer-error-state' });
  const icon = createElement('div', { className: 'explorer-error-icon' });
  icon.textContent = 'X';
  const title = createElement('div', { className: 'explorer-error-title' });
  title.textContent = 'Something went wrong';
  const desc = createElement('div', { className: 'explorer-error-desc' });
  desc.textContent = msg || 'Please try again.';
  wrap.appendChild(icon);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  container.appendChild(wrap);
}
