import { api } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { showModal, showConfirm } from '../components/modal.js';
import { showSkeleton } from '../components/skeleton.js';

const CATALOG_TABS = [
  {
    id: 'domains',
    label: 'Domains',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  },
  {
    id: 'assignments',
    label: 'Skill Assignments',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  },
];

let currentTab = 'domains';

export function mountCatalogAdmin(container) {
  const user = Store.get('user');
  if (!user || user.role !== 'admin') {
    container.innerHTML = '<p class="text-center" style="padding:4rem;">Access denied.</p>';
    return;
  }
  renderAdminShell(container);
}

function renderAdminShell(container) {
  container.innerHTML = `
    <div class="admin-page">
      <div class="mp-header">
        <h1 class="mp-title">Catalog <span class="mp-title-gradient">Admin</span></h1>
        <p class="mp-subtitle">Manage domains, teams, certifications, and skill assignments</p>
      </div>
      <div class="admin-layout">
        <aside class="admin-sidebar" id="adminSidebar"></aside>
        <main class="admin-content" id="adminContent"></main>
      </div>
    </div>
  `;

  renderSidebar(container);
  switchTab(container, currentTab);
}

function renderSidebar(container) {
  const sidebar = container.querySelector('#adminSidebar');
  sidebar.innerHTML = CATALOG_TABS.map(tab => `
    <button class="admin-tab-btn ${tab.id === currentTab ? 'active' : ''}" data-tab="${tab.id}">
      ${tab.icon}
      <span>${tab.label}</span>
    </button>
  `).join('');

  sidebar.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-tab-btn');
    if (!btn) return;
    const tabId = btn.dataset.tab;
    currentTab = tabId;
    sidebar.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchTab(container, tabId);
  });
}

function switchTab(container, tabId) {
  const content = container.querySelector('#adminContent');
  showSkeleton(content, 'list');
  if (tabId === 'domains') renderDomainsTab(content);
  else if (tabId === 'teams') renderTeamsTab(content);
  else if (tabId === 'certifications') renderCertificationsTab(content);
  else if (tabId === 'assignments') renderAssignmentsTab(content);
}


// ═══════════════════════════════════════════════════════════
// DOMAINS TAB
// ═══════════════════════════════════════════════════════════

async function renderDomainsTab(content) {
  try {
    const [domains, teams] = await Promise.all([
      api.get('/api/domains/'),
      api.get('/api/teams/'),
    ]);
    renderDomainsTable(content, domains, teams);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load domains: ${escHtml(err.message)}</p>`;
  }
}

function renderDomainsTable(content, domains, teams) {
  content.innerHTML = `
    <div class="admin-tab-header">
      <h2>Domains <span class="admin-count">${domains.length}</span></h2>
      <div class="admin-tab-actions">
        <input type="text" class="search-input search-input--sm" id="domainSearch" placeholder="Search domains...">
        <button class="btn btn-primary btn-sm" id="addDomainBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Domain
        </button>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="domainsTable">
        <thead>
          <tr>
            <th class="sortable" data-sort="name">Name</th>
            <th>Technical</th>
            <th>Teams</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="domainsBody"></tbody>
      </table>
    </div>
  `;

  let searchTerm = '';
  let sortField = 'name';
  let sortDir = 1;

  function renderRows() {
    const filtered = domains.filter(d => {
      if (!searchTerm) return true;
      return d.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    filtered.sort((a, b) => {
      const va = a.name.toLowerCase();
      const vb = b.name.toLowerCase();
      if (va < vb) return -sortDir;
      if (va > vb) return sortDir;
      return 0;
    });

    const tbody = content.querySelector('#domainsBody');
    tbody.innerHTML = filtered.map(d => {
      const domainTeams = teams.filter(t => t.domain_id === d.id);
      const techBadge = d.is_technical
        ? '<span class="role-badge" style="background:rgba(34,197,94,.15);color:var(--success);border-color:rgba(34,197,94,.3)">Yes</span>'
        : '<span class="role-badge" style="background:rgba(239,68,68,.15);color:var(--danger);border-color:rgba(239,68,68,.3)">No</span>';
      return `
        <tr>
          <td><strong>${escHtml(d.name)}</strong></td>
          <td>${techBadge}</td>
          <td>
            ${domainTeams.length > 0
              ? `<span class="admin-count" style="font-size:13px;">${domainTeams.length}</span>`
              : '<span class="text-muted">0</span>'
            }
          </td>
          <td class="admin-actions-cell">
            <button class="admin-action-btn edit-btn" data-id="${d.id}" title="Edit">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="admin-action-btn delete-btn" data-id="${d.id}" title="Delete">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    content.querySelectorAll('th.sortable').forEach(th => {
      th.classList.toggle('sort-asc', th.dataset.sort === sortField && sortDir === 1);
      th.classList.toggle('sort-desc', th.dataset.sort === sortField && sortDir === -1);
    });
  }

  renderRows();

  content.querySelector('#domainSearch').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderRows();
  });

  content.querySelector('#domainsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const field = th.dataset.sort;
    if (sortField === field) sortDir *= -1;
    else { sortField = field; sortDir = 1; }
    renderRows();
  });

  content.querySelector('#addDomainBtn').addEventListener('click', () => openDomainModal(content, null));

  content.querySelector('#domainsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const domainId = parseInt(editBtn.dataset.id);
      const domain = domains.find(d => d.id === domainId);
      if (domain) openDomainModal(content, domain);
    }

    if (deleteBtn) {
      const domainId = parseInt(deleteBtn.dataset.id);
      const domain = domains.find(d => d.id === domainId);
      if (!domain) return;
      const confirmed = await showConfirm({
        title: 'Delete Domain',
        message: `Are you sure you want to delete <strong>${escHtml(domain.name)}</strong>? All associated teams must be removed first.`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/domains/${domainId}`);
        showToast({ message: 'Domain deleted', type: 'success' });
        renderDomainsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete domain', type: 'error' });
      }
    }
  });
}

async function openDomainModal(content, existingDomain) {
  const isEdit = !!existingDomain;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalDomainName">Domain Name *</label>
      <input type="text" id="modalDomainName" value="${isEdit ? escHtml(existingDomain.name) : ''}" required>
    </div>
    <div class="form-group">
      <label class="catalog-checkbox-label">
        <input type="checkbox" id="modalDomainTechnical" ${!isEdit || existingDomain.is_technical ? 'checked' : ''}>
        <span>Technical Domain</span>
      </label>
    </div>
  `;

  const result = await showModal({
    title: isEdit ? 'Edit Domain' : 'Add Domain',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create Domain', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalDomainName').value.trim();
  const isTechnical = body.querySelector('#modalDomainTechnical').checked;

  if (!name) {
    showToast({ message: 'Name is required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/domains/${existingDomain.id}`, { name, is_technical: isTechnical });
      showToast({ message: 'Domain updated', type: 'success' });
    } else {
      await api.post('/api/domains/', { name, is_technical: isTechnical });
      showToast({ message: 'Domain created', type: 'success' });
    }
    renderDomainsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}


// ═══════════════════════════════════════════════════════════
// TEAMS TAB
// ═══════════════════════════════════════════════════════════

async function renderTeamsTab(content) {
  try {
    const [teams, domains] = await Promise.all([
      api.get('/api/teams/'),
      api.get('/api/domains/'),
    ]);
    renderTeamsTable(content, teams, domains);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load teams: ${escHtml(err.message)}</p>`;
  }
}

function renderTeamsTable(content, teams, domains) {
  content.innerHTML = `
    <div class="admin-tab-header">
      <h2>Teams <span class="admin-count">${teams.length}</span></h2>
      <div class="admin-tab-actions">
        <input type="text" class="search-input search-input--sm" id="teamSearch" placeholder="Search teams...">
        <button class="btn btn-primary btn-sm" id="addTeamBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Team
        </button>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="teamsTable">
        <thead>
          <tr>
            <th class="sortable" data-sort="name">Name</th>
            <th class="sortable" data-sort="domain">Domain</th>
            <th class="sortable" data-sort="shift">Shift</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="teamsBody"></tbody>
      </table>
    </div>
  `;

  let searchTerm = '';
  let sortField = 'name';
  let sortDir = 1;

  function renderRows() {
    const filtered = teams.filter(t => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (t.name + ' ' + (t.domain_name || '')).toLowerCase().includes(s);
    });

    filtered.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (sortField === 'domain') {
        va = (a.domain_name || '').toLowerCase();
        vb = (b.domain_name || '').toLowerCase();
      } else if (sortField === 'shift') {
        va = a.shift || 0; vb = b.shift || 0;
        if (va < vb) return -sortDir;
        if (va > vb) return sortDir;
        return 0;
      }
      if (va < vb) return -sortDir;
      if (va > vb) return sortDir;
      return 0;
    });

    const tbody = content.querySelector('#teamsBody');
    tbody.innerHTML = filtered.map(t => `
      <tr>
        <td><strong>${escHtml(t.name)}</strong></td>
        <td>${t.domain_name ? escHtml(t.domain_name) : '<span class="text-muted">—</span>'}</td>
        <td>${t.shift != null ? t.shift : '<span class="text-muted">—</span>'}</td>
        <td class="admin-actions-cell">
          <button class="admin-action-btn edit-btn" data-id="${t.id}" title="Edit">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="admin-action-btn delete-btn" data-id="${t.id}" title="Delete">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    content.querySelectorAll('#teamsTable th.sortable').forEach(th => {
      th.classList.toggle('sort-asc', th.dataset.sort === sortField && sortDir === 1);
      th.classList.toggle('sort-desc', th.dataset.sort === sortField && sortDir === -1);
    });
  }

  renderRows();

  content.querySelector('#teamSearch').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderRows();
  });

  content.querySelector('#teamsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const field = th.dataset.sort;
    if (sortField === field) sortDir *= -1;
    else { sortField = field; sortDir = 1; }
    renderRows();
  });

  content.querySelector('#addTeamBtn').addEventListener('click', () => openTeamModal(content, null, domains));

  content.querySelector('#teamsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const teamId = parseInt(editBtn.dataset.id);
      const team = teams.find(t => t.id === teamId);
      if (team) openTeamModal(content, team, domains);
    }

    if (deleteBtn) {
      const teamId = parseInt(deleteBtn.dataset.id);
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      const confirmed = await showConfirm({
        title: 'Delete Team',
        message: `Are you sure you want to delete <strong>${escHtml(team.name)}</strong>?`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/teams/${teamId}`);
        showToast({ message: 'Team deleted', type: 'success' });
        renderTeamsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete team', type: 'error' });
      }
    }
  });
}

async function openTeamModal(content, existingTeam, domains) {
  const isEdit = !!existingTeam;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalTeamName">Team Name *</label>
      <input type="text" id="modalTeamName" value="${isEdit ? escHtml(existingTeam.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalTeamDomain">Domain *</label>
      <select id="modalTeamDomain" required>
        <option value="">— Select Domain —</option>
        ${domains.map(d => `<option value="${d.id}" ${isEdit && existingTeam.domain_id === d.id ? 'selected' : ''}>${escHtml(d.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="modalTeamShift">Shift *</label>
      <select id="modalTeamShift" required>
        <option value="">— Select Shift —</option>
        ${[1, 2, 3, 4].map(n => `<option value="${n}" ${isEdit && existingTeam.shift === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
    </div>
  `;

  const result = await showModal({
    title: isEdit ? 'Edit Team' : 'Add Team',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create Team', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalTeamName').value.trim();
  const domainId = parseInt(body.querySelector('#modalTeamDomain').value);
  const shift = parseInt(body.querySelector('#modalTeamShift').value);

  if (!name || !domainId || !shift) {
    showToast({ message: 'Name, domain, and shift are required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/teams/${existingTeam.id}`, { name, domain_id: domainId, shift });
      showToast({ message: 'Team updated', type: 'success' });
    } else {
      await api.post('/api/teams/', { name, domain_id: domainId, shift });
      showToast({ message: 'Team created', type: 'success' });
    }
    renderTeamsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}


// ═══════════════════════════════════════════════════════════
// CERTIFICATIONS TAB
// ═══════════════════════════════════════════════════════════

async function renderCertificationsTab(content) {
  try {
    const [certDomains, certificates] = await Promise.all([
      api.get('/api/certification-domains/'),
      api.get('/api/certificates/'),
    ]);
    renderCertificationsContent(content, certDomains, certificates);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load certifications: ${escHtml(err.message)}</p>`;
  }
}

function renderCertificationsContent(content, certDomains, certificates) {
  const certDomainMap = Object.fromEntries(certDomains.map(d => [d.id, d.name]));

  content.innerHTML = `
    <div class="catalog-section">
      <div class="admin-tab-header">
        <h2>Certification Domains <span class="admin-count">${certDomains.length}</span></h2>
        <div class="admin-tab-actions">
          <input type="text" class="search-input search-input--sm" id="certDomainSearch" placeholder="Search cert domains...">
          <button class="btn btn-primary btn-sm" id="addCertDomainBtn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Domain
          </button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="certDomainsTable">
          <thead>
            <tr>
              <th class="sortable" data-sort="name">Name</th>
              <th>Description</th>
              <th>Certificates</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="certDomainsBody"></tbody>
        </table>
      </div>
    </div>

    <div class="catalog-section" style="margin-top: 32px;">
      <div class="admin-tab-header">
        <h2>Certificates <span class="admin-count">${certificates.length}</span></h2>
        <div class="admin-tab-actions">
          <input type="text" class="search-input search-input--sm" id="certSearch" placeholder="Search certificates...">
          <button class="btn btn-primary btn-sm" id="addCertBtn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Certificate
          </button>
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table" id="certsTable">
          <thead>
            <tr>
              <th class="sortable" data-sort="name">Name</th>
              <th>Description</th>
              <th class="sortable" data-sort="domain">Domain</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="certsBody"></tbody>
        </table>
      </div>
    </div>
  `;

  let cdSearch = '';
  let cdSort = 'name';
  let cdDir = 1;

  function renderCertDomainRows() {
    const filtered = certDomains.filter(d => {
      if (!cdSearch) return true;
      return d.name.toLowerCase().includes(cdSearch.toLowerCase());
    });
    filtered.sort((a, b) => {
      const va = a.name.toLowerCase(), vb = b.name.toLowerCase();
      if (va < vb) return -cdDir;
      if (va > vb) return cdDir;
      return 0;
    });

    const tbody = content.querySelector('#certDomainsBody');
    tbody.innerHTML = filtered.map(d => {
      const certCount = certificates.filter(c => c.certification_domain_id === d.id).length;
      return `
        <tr>
          <td><strong>${escHtml(d.name)}</strong></td>
          <td>${d.description ? escHtml(d.description) : '<span class="text-muted">—</span>'}</td>
          <td><span class="admin-count" style="font-size:13px;">${certCount}</span></td>
          <td class="admin-actions-cell">
            <button class="admin-action-btn edit-btn" data-id="${d.id}" data-type="certdomain" title="Edit">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="admin-action-btn delete-btn" data-id="${d.id}" data-type="certdomain" title="Delete">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderCertDomainRows();

  content.querySelector('#certDomainSearch').addEventListener('input', e => {
    cdSearch = e.target.value;
    renderCertDomainRows();
  });

  content.querySelector('#certDomainsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    if (cdSort === th.dataset.sort) cdDir *= -1;
    else { cdSort = th.dataset.sort; cdDir = 1; }
    renderCertDomainRows();
  });

  content.querySelector('#addCertDomainBtn').addEventListener('click', () => openCertDomainModal(content, null));

  content.querySelector('#certDomainsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn[data-type="certdomain"]');
    const deleteBtn = e.target.closest('.delete-btn[data-type="certdomain"]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = certDomains.find(d => d.id === id);
      if (item) openCertDomainModal(content, item);
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      const item = certDomains.find(d => d.id === id);
      if (!item) return;
      const confirmed = await showConfirm({
        title: 'Delete Certification Domain',
        message: `Are you sure you want to delete <strong>${escHtml(item.name)}</strong>?`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/certification-domains/${id}`);
        showToast({ message: 'Certification domain deleted', type: 'success' });
        renderCertificationsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete', type: 'error' });
      }
    }
  });

  let certSearch = '';
  let certSort = 'name';
  let certDir = 1;

  function renderCertRows() {
    const filtered = certificates.filter(c => {
      if (!certSearch) return true;
      return (c.name + ' ' + (certDomainMap[c.certification_domain_id] || '')).toLowerCase().includes(certSearch.toLowerCase());
    });
    filtered.sort((a, b) => {
      let va, vb;
      if (certSort === 'name') {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (certSort === 'domain') {
        va = (certDomainMap[a.certification_domain_id] || '').toLowerCase();
        vb = (certDomainMap[b.certification_domain_id] || '').toLowerCase();
      }
      if (va < vb) return -certDir;
      if (va > vb) return certDir;
      return 0;
    });

    const tbody = content.querySelector('#certsBody');
    tbody.innerHTML = filtered.map(c => `
      <tr>
        <td><strong>${escHtml(c.name)}</strong></td>
        <td>${c.description ? escHtml(c.description) : '<span class="text-muted">—</span>'}</td>
        <td>${certDomainMap[c.certification_domain_id] || '<span class="text-muted">—</span>'}</td>
        <td class="admin-actions-cell">
          <button class="admin-action-btn edit-btn" data-id="${c.id}" data-type="cert" title="Edit">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="admin-action-btn delete-btn" data-id="${c.id}" data-type="cert" title="Delete">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    content.querySelectorAll('#certsTable th.sortable').forEach(th => {
      th.classList.toggle('sort-asc', th.dataset.sort === certSort && certDir === 1);
      th.classList.toggle('sort-desc', th.dataset.sort === certSort && certDir === -1);
    });
  }

  renderCertRows();

  content.querySelector('#certSearch').addEventListener('input', e => {
    certSearch = e.target.value;
    renderCertRows();
  });

  content.querySelector('#certsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    if (certSort === th.dataset.sort) certDir *= -1;
    else { certSort = th.dataset.sort; certDir = 1; }
    renderCertRows();
  });

  content.querySelector('#addCertBtn').addEventListener('click', () => openCertModal(content, null, certDomains));

  content.querySelector('#certsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn[data-type="cert"]');
    const deleteBtn = e.target.closest('.delete-btn[data-type="cert"]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = certificates.find(c => c.id === id);
      if (item) openCertModal(content, item, certDomains);
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      const item = certificates.find(c => c.id === id);
      if (!item) return;
      const confirmed = await showConfirm({
        title: 'Delete Certificate',
        message: `Are you sure you want to delete <strong>${escHtml(item.name)}</strong>?`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/certificates/${id}`);
        showToast({ message: 'Certificate deleted', type: 'success' });
        renderCertificationsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete', type: 'error' });
      }
    }
  });
}

async function openCertDomainModal(content, existing) {
  const isEdit = !!existing;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalCDName">Name *</label>
      <input type="text" id="modalCDName" value="${isEdit ? escHtml(existing.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalCDDesc">Description</label>
      <textarea id="modalCDDesc" rows="3">${isEdit && existing.description ? escHtml(existing.description) : ''}</textarea>
    </div>
  `;

  const result = await showModal({
    title: isEdit ? 'Edit Certification Domain' : 'Add Certification Domain',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalCDName').value.trim();
  const description = body.querySelector('#modalCDDesc').value.trim() || null;

  if (!name) {
    showToast({ message: 'Name is required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/certification-domains/${existing.id}`, { name, description });
      showToast({ message: 'Certification domain updated', type: 'success' });
    } else {
      await api.post('/api/certification-domains/', { name, description });
      showToast({ message: 'Certification domain created', type: 'success' });
    }
    renderCertificationsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}

async function openCertModal(content, existing, certDomains) {
  const isEdit = !!existing;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalCertName">Name *</label>
      <input type="text" id="modalCertName" value="${isEdit ? escHtml(existing.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalCertDesc">Description</label>
      <textarea id="modalCertDesc" rows="3">${isEdit && existing.description ? escHtml(existing.description) : ''}</textarea>
    </div>
    <div class="form-group">
      <label for="modalCertDomain">Certification Domain *</label>
      <select id="modalCertDomain" required>
        <option value="">— Select Domain —</option>
        ${certDomains.map(d => `<option value="${d.id}" ${isEdit && existing.certification_domain_id === d.id ? 'selected' : ''}>${escHtml(d.name)}</option>`).join('')}
      </select>
    </div>
  `;

  const result = await showModal({
    title: isEdit ? 'Edit Certificate' : 'Add Certificate',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalCertName').value.trim();
  const description = body.querySelector('#modalCertDesc').value.trim() || null;
  const certDomainId = parseInt(body.querySelector('#modalCertDomain').value);

  if (!name || !certDomainId) {
    showToast({ message: 'Name and certification domain are required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/certificates/${existing.id}`, { name, description, certification_domain_id: certDomainId });
      showToast({ message: 'Certificate updated', type: 'success' });
    } else {
      await api.post('/api/certificates/', { name, description, certification_domain_id: certDomainId });
      showToast({ message: 'Certificate created', type: 'success' });
    }
    renderCertificationsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}


// ═══════════════════════════════════════════════════════════
// SKILL ASSIGNMENTS TAB
// ═══════════════════════════════════════════════════════════

async function renderAssignmentsTab(content) {
  try {
    const [skills, teams, certDomains, certificates] = await Promise.all([
      api.get('/api/skills/'),
      api.get('/api/teams/'),
      api.get('/api/certification-domains/'),
      api.get('/api/certificates/'),
    ]);
    renderAssignmentsUI(content, skills, teams, certDomains, certificates);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load data: ${escHtml(err.message)}</p>`;
  }
}

function renderAssignmentsUI(content, skills, teams, certDomains, certificates) {
  content.innerHTML = `
    <div class="admin-tab-header">
      <h2>Skill Assignments</h2>
    </div>
    <div class="catalog-assignments-wrap">
      <div class="form-group" style="max-width:420px;">
        <label for="assignSkillSelect">Select Skill</label>
        <select id="assignSkillSelect">
          <option value="">— Choose a skill —</option>
          ${skills.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div id="assignmentsPanel" class="catalog-assignments-panel" style="display:none;"></div>
    </div>
  `;

  content.querySelector('#assignSkillSelect').addEventListener('change', async e => {
    const skillId = parseInt(e.target.value);
    if (!skillId) {
      content.querySelector('#assignmentsPanel').style.display = 'none';
      return;
    }
    await loadSkillAssignments(content, skillId, skills, teams, certDomains, certificates);
  });
}

async function loadSkillAssignments(content, skillId, skills, teams, certDomains, certificates) {
  const panel = content.querySelector('#assignmentsPanel');
  panel.style.display = 'block';
  showSkeleton(panel, 'detail');

  let current = { team_ids: [], certificate_ids: [], tag_names: [] };
  try {
    const detail = await api.get(`/api/skills/${skillId}`);
    current = {
      team_ids: (detail.teams || []).map(t => t.id),
      certificate_ids: (detail.certificates || []).map(c => c.id),
      tag_names: (detail.tags || []).map(t => t.name),
    };
  } catch {
    current = { team_ids: [], certificate_ids: [], tag_names: [] };
  }

  const skill = skills.find(s => s.id === skillId);

  panel.innerHTML = `
    <div class="catalog-assignments-header">
      <h3>Assignments for <strong>${skill ? escHtml(skill.name) : 'Skill'}</strong></h3>
      <p class="text-muted" style="font-size:13px;margin-top:4px;">Check the items this skill should be assigned to, then click Save.</p>
    </div>
    <div class="catalog-assignments-grid">
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Teams</div>
        ${teams.length === 0 ? '<span class="text-muted">No teams</span>' : teams.map(t => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="team_ids" value="${t.id}" ${current.team_ids.includes(t.id) ? 'checked' : ''}>
            <span>${escHtml(t.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Certificates</div>
        ${certDomains.map(cd => {
          const domainCerts = certificates.filter(c => c.certification_domain_id === cd.id);
          if (domainCerts.length === 0) return '';
          return `
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 4px;">${escHtml(cd.name)}</div>
            ${domainCerts.map(c => `
              <label class="catalog-checkbox-label">
                <input type="checkbox" name="certificate_ids" value="${c.id}" ${current.certificate_ids.includes(c.id) ? 'checked' : ''}>
                <span>${escHtml(c.name)}</span>
              </label>
            `).join('')}
          `;
        }).join('')}
        ${certificates.length === 0 ? '<span class="text-muted">No certificates</span>' : ''}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Tags</div>
        <div class="form-group" style="margin:0;">
          <input type="text" id="assignTagsInput" class="search-input" placeholder="Comma-separated tags" value="${escHtml(current.tag_names.join(', '))}">
          <p class="text-muted" style="font-size:12px;margin-top:4px;">Enter tags separated by commas</p>
        </div>
      </div>
    </div>
    <div class="catalog-assignments-actions">
      <button class="btn btn-primary" id="saveAssignmentsBtn">Save Assignments</button>
    </div>
  `;

  panel.querySelector('#saveAssignmentsBtn').addEventListener('click', async () => {
    const getChecked = (name) => Array.from(panel.querySelectorAll(`input[name="${name}"]:checked`)).map(el => parseInt(el.value));
    const tagsRaw = panel.querySelector('#assignTagsInput').value;
    const tagNames = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const payload = {
      team_ids: getChecked('team_ids'),
      certificate_ids: getChecked('certificate_ids'),
      tag_names: tagNames,
    };

    try {
      await api.post(`/api/skills/${skillId}/assignments`, payload);
      showToast({ message: 'Assignments saved successfully', type: 'success' });
    } catch (err) {
      showToast({ message: err.message || 'Failed to save assignments', type: 'error' });
    }
  });
}


// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
