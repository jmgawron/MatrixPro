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
    id: 'shifts',
    label: 'Shifts',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  },
  {
    id: 'assignments',
    label: 'Skill Assignments',
    icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  },
];

// Static organisations (TAC=1, PS=2, CMS=3, CSS=4)
const ORGS = [
  { id: 1, name: 'TAC' },
  { id: 2, name: 'PS' },
  { id: 3, name: 'CMS' },
  { id: 4, name: 'CSS' },
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
        <p class="mp-subtitle">Manage domains, shifts, certifications, campaigns, and skill assignments</p>
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
  else if (tabId === 'shifts') renderShiftsTab(content);
  else if (tabId === 'certifications') renderCertificationsTab(content);
  else if (tabId === 'campaigns') renderCampaignsTab(content);
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
  const orgMap = Object.fromEntries(ORGS.map(o => [o.id, o.name]));

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
            <th class="sortable" data-sort="organisation">Organisation</th>
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
      const s = searchTerm.toLowerCase();
      return (d.name + ' ' + (orgMap[d.organisation_id] || '')).toLowerCase().includes(s);
    });

    filtered.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (sortField === 'organisation') {
        va = (orgMap[a.organisation_id] || '').toLowerCase();
        vb = (orgMap[b.organisation_id] || '').toLowerCase();
      }
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
          <td>${orgMap[d.organisation_id] || '<span class="text-muted">—</span>'}</td>
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

  content.querySelector('#addDomainBtn').addEventListener('click', () => openDomainModal(content, null, teams));

  content.querySelector('#domainsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const domainId = parseInt(editBtn.dataset.id);
      const domain = domains.find(d => d.id === domainId);
      if (domain) openDomainModal(content, domain, teams);
    }

    if (deleteBtn) {
      const domainId = parseInt(deleteBtn.dataset.id);
      const domain = domains.find(d => d.id === domainId);
      if (!domain) return;
      const confirmed = await showConfirm({
        title: 'Delete Domain',
        message: `Are you sure you want to delete <strong>${escHtml(domain.name)}</strong>? All associated teams and shifts must be removed first.`,
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

async function openDomainModal(content, existingDomain, teams) {
  const isEdit = !!existingDomain;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalDomainName">Domain Name *</label>
      <input type="text" id="modalDomainName" value="${isEdit ? escHtml(existingDomain.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalDomainOrg">Organisation *</label>
      <select id="modalDomainOrg" required>
        <option value="">— Select Organisation —</option>
        ${ORGS.map(o => `<option value="${o.id}" ${isEdit && existingDomain.organisation_id === o.id ? 'selected' : ''}>${escHtml(o.name)}</option>`).join('')}
      </select>
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
  const orgId = parseInt(body.querySelector('#modalDomainOrg').value);
  const isTechnical = body.querySelector('#modalDomainTechnical').checked;

  if (!name || !orgId) {
    showToast({ message: 'Name and organisation are required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/domains/${existingDomain.id}`, { name, organisation_id: orgId, is_technical: isTechnical });
      showToast({ message: 'Domain updated', type: 'success' });
    } else {
      await api.post('/api/domains/', { name, organisation_id: orgId, is_technical: isTechnical });
      showToast({ message: 'Domain created', type: 'success' });
    }
    renderDomainsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}


// ═══════════════════════════════════════════════════════════
// SHIFTS TAB
// ═══════════════════════════════════════════════════════════

async function renderShiftsTab(content) {
  try {
    const [shifts, domains] = await Promise.all([
      api.get('/api/shifts/'),
      api.get('/api/domains/'),
    ]);
    renderShiftsTable(content, shifts, domains);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load shifts: ${escHtml(err.message)}</p>`;
  }
}

function renderShiftsTable(content, shifts, domains) {
  const domainMap = Object.fromEntries(domains.map(d => [d.id, d.name]));

  content.innerHTML = `
    <div class="admin-tab-header">
      <h2>Shifts <span class="admin-count">${shifts.length}</span></h2>
      <div class="admin-tab-actions">
        <select class="search-input search-input--sm" id="shiftDomainFilter">
          <option value="">All Domains</option>
          ${domains.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" id="addShiftBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Shift
        </button>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="shiftsTable">
        <thead>
          <tr>
            <th class="sortable" data-sort="name">Name</th>
            <th class="sortable" data-sort="domain">Domain</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="shiftsBody"></tbody>
      </table>
    </div>
  `;

  let filterDomainId = '';
  let sortField = 'name';
  let sortDir = 1;

  function renderRows() {
    const filtered = shifts.filter(s => {
      if (!filterDomainId) return true;
      return s.domain_id === parseInt(filterDomainId);
    });

    filtered.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (sortField === 'domain') {
        va = (domainMap[a.domain_id] || '').toLowerCase();
        vb = (domainMap[b.domain_id] || '').toLowerCase();
      }
      if (va < vb) return -sortDir;
      if (va > vb) return sortDir;
      return 0;
    });

    const tbody = content.querySelector('#shiftsBody');
    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${escHtml(s.name)}</strong></td>
        <td>${domainMap[s.domain_id] || '<span class="text-muted">—</span>'}</td>
        <td class="admin-actions-cell">
          <button class="admin-action-btn edit-btn" data-id="${s.id}" title="Edit">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="admin-action-btn delete-btn" data-id="${s.id}" title="Delete">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');

    content.querySelectorAll('th.sortable').forEach(th => {
      th.classList.toggle('sort-asc', th.dataset.sort === sortField && sortDir === 1);
      th.classList.toggle('sort-desc', th.dataset.sort === sortField && sortDir === -1);
    });
  }

  renderRows();

  content.querySelector('#shiftDomainFilter').addEventListener('change', e => {
    filterDomainId = e.target.value;
    renderRows();
  });

  content.querySelector('#shiftsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const field = th.dataset.sort;
    if (sortField === field) sortDir *= -1;
    else { sortField = field; sortDir = 1; }
    renderRows();
  });

  content.querySelector('#addShiftBtn').addEventListener('click', () => openShiftModal(content, null, domains));

  content.querySelector('#shiftsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const shiftId = parseInt(editBtn.dataset.id);
      const shift = shifts.find(s => s.id === shiftId);
      if (shift) openShiftModal(content, shift, domains);
    }

    if (deleteBtn) {
      const shiftId = parseInt(deleteBtn.dataset.id);
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) return;
      const confirmed = await showConfirm({
        title: 'Delete Shift',
        message: `Are you sure you want to delete <strong>${escHtml(shift.name)}</strong>?`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/shifts/${shiftId}`);
        showToast({ message: 'Shift deleted', type: 'success' });
        renderShiftsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete shift', type: 'error' });
      }
    }
  });
}

async function openShiftModal(content, existingShift, domains) {
  const isEdit = !!existingShift;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';
  body.innerHTML = `
    <div class="form-group">
      <label for="modalShiftName">Shift Name *</label>
      <input type="text" id="modalShiftName" value="${isEdit ? escHtml(existingShift.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalShiftDomain">Domain *</label>
      <select id="modalShiftDomain" required>
        <option value="">— Select Domain —</option>
        ${domains.map(d => `<option value="${d.id}" ${isEdit && existingShift.domain_id === d.id ? 'selected' : ''}>${escHtml(d.name)}</option>`).join('')}
      </select>
    </div>
  `;

  const result = await showModal({
    title: isEdit ? 'Edit Shift' : 'Add Shift',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create Shift', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalShiftName').value.trim();
  const domainId = parseInt(body.querySelector('#modalShiftDomain').value);

  if (!name || !domainId) {
    showToast({ message: 'Name and domain are required', type: 'error' });
    return;
  }

  try {
    if (isEdit) {
      await api.put(`/api/shifts/${existingShift.id}`, { name, domain_id: domainId });
      showToast({ message: 'Shift updated', type: 'success' });
    } else {
      await api.post('/api/shifts/', { name, domain_id: domainId });
      showToast({ message: 'Shift created', type: 'success' });
    }
    renderShiftsTab(content);
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

  // Cert Domains table
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

  content.querySelector('#addCertDomainBtn').addEventListener('click', () => openCertDomainModal(content, null, certDomains, certificates));

  content.querySelector('#certDomainsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn[data-type="certdomain"]');
    const deleteBtn = e.target.closest('.delete-btn[data-type="certdomain"]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = certDomains.find(d => d.id === id);
      if (item) openCertDomainModal(content, item, certDomains, certificates);
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

  // Certificates table
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

  content.querySelector('#addCertBtn').addEventListener('click', () => openCertModal(content, null, certDomains, certificates));

  content.querySelector('#certsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn[data-type="cert"]');
    const deleteBtn = e.target.closest('.delete-btn[data-type="cert"]');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = certificates.find(c => c.id === id);
      if (item) openCertModal(content, item, certDomains, certificates);
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

async function openCertDomainModal(content, existing, certDomains, certificates) {
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

async function openCertModal(content, existing, certDomains, certificates) {
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
// CAMPAIGNS TAB
// ═══════════════════════════════════════════════════════════

async function renderCampaignsTab(content) {
  try {
    const [campaigns, domains] = await Promise.all([
      api.get('/api/campaigns/'),
      api.get('/api/domains/'),
    ]);
    renderCampaignsTable(content, campaigns, domains);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load campaigns: ${escHtml(err.message)}</p>`;
  }
}

function renderCampaignsTable(content, campaigns, domains) {
  const orgMap = Object.fromEntries(ORGS.map(o => [o.id, o.name]));
  const domainMap = Object.fromEntries(domains.map(d => [d.id, d.name]));

  content.innerHTML = `
    <div class="admin-tab-header">
      <h2>Campaigns <span class="admin-count">${campaigns.length}</span></h2>
      <div class="admin-tab-actions">
        <input type="text" class="search-input search-input--sm" id="campaignSearch" placeholder="Search campaigns...">
        <button class="btn btn-primary btn-sm" id="addCampaignBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Campaign
        </button>
      </div>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table" id="campaignsTable">
        <thead>
          <tr>
            <th class="sortable" data-sort="name">Name</th>
            <th class="sortable" data-sort="organisation">Organisation</th>
            <th class="sortable" data-sort="domain">Domain</th>
            <th class="sortable" data-sort="start_date">Dates</th>
            <th>Mandatory</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="campaignsBody"></tbody>
      </table>
    </div>
  `;

  let searchTerm = '';
  let sortField = 'name';
  let sortDir = 1;

  function renderRows() {
    const filtered = campaigns.filter(c => {
      if (!searchTerm) return true;
      return (c.name + ' ' + (orgMap[c.organisation_id] || '')).toLowerCase().includes(searchTerm.toLowerCase());
    });

    filtered.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') {
        va = a.name.toLowerCase(); vb = b.name.toLowerCase();
      } else if (sortField === 'organisation') {
        va = (orgMap[a.organisation_id] || '').toLowerCase();
        vb = (orgMap[b.organisation_id] || '').toLowerCase();
      } else if (sortField === 'domain') {
        va = (domainMap[a.domain_id] || '').toLowerCase();
        vb = (domainMap[b.domain_id] || '').toLowerCase();
      } else if (sortField === 'start_date') {
        va = a.start_date || ''; vb = b.start_date || '';
      }
      if (va < vb) return -sortDir;
      if (va > vb) return sortDir;
      return 0;
    });

    const tbody = content.querySelector('#campaignsBody');
    tbody.innerHTML = filtered.map(c => {
      const mandatoryBadge = c.is_mandatory
        ? '<span class="role-badge" style="background:rgba(245,158,11,.15);color:var(--warning);border-color:rgba(245,158,11,.3)">Mandatory</span>'
        : '<span class="text-muted">Optional</span>';
      const startDate = c.start_date ? new Date(c.start_date).toLocaleDateString() : '—';
      const endDate = c.end_date ? new Date(c.end_date).toLocaleDateString() : '—';
      return `
        <tr>
          <td><strong>${escHtml(c.name)}</strong></td>
          <td>${orgMap[c.organisation_id] || '<span class="text-muted">—</span>'}</td>
          <td>${domainMap[c.domain_id] || '<span class="text-muted">—</span>'}</td>
          <td><span class="text-muted" style="font-size:13px;">${startDate} &rarr; ${endDate}</span></td>
          <td>${mandatoryBadge}</td>
          <td class="admin-actions-cell">
            <button class="admin-action-btn edit-btn" data-id="${c.id}" title="Edit">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="admin-action-btn delete-btn" data-id="${c.id}" title="Delete">
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

  content.querySelector('#campaignSearch').addEventListener('input', e => {
    searchTerm = e.target.value;
    renderRows();
  });

  content.querySelector('#campaignsTable thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const field = th.dataset.sort;
    if (sortField === field) sortDir *= -1;
    else { sortField = field; sortDir = 1; }
    renderRows();
  });

  content.querySelector('#addCampaignBtn').addEventListener('click', () => openCampaignModal(content, null, domains));

  content.querySelector('#campaignsBody').addEventListener('click', async e => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const campaign = campaigns.find(c => c.id === id);
      if (campaign) openCampaignModal(content, campaign, domains);
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) return;
      const confirmed = await showConfirm({
        title: 'Delete Campaign',
        message: `Are you sure you want to delete <strong>${escHtml(campaign.name)}</strong>?`,
      });
      if (!confirmed) return;
      try {
        await api.del(`/api/campaigns/${id}`);
        showToast({ message: 'Campaign deleted', type: 'success' });
        renderCampaignsTab(content);
      } catch (err) {
        showToast({ message: err.message || 'Failed to delete campaign', type: 'error' });
      }
    }
  });
}

async function openCampaignModal(content, existing, allDomains) {
  const isEdit = !!existing;

  const body = document.createElement('div');
  body.className = 'admin-modal-form';

  // Build initial domains for selected org
  const initialOrgId = isEdit ? existing.organisation_id : '';
  const filteredDomains = initialOrgId
    ? allDomains.filter(d => d.organisation_id === initialOrgId)
    : allDomains;

  body.innerHTML = `
    <div class="form-group">
      <label for="modalCampName">Campaign Name *</label>
      <input type="text" id="modalCampName" value="${isEdit ? escHtml(existing.name) : ''}" required>
    </div>
    <div class="form-group">
      <label for="modalCampDesc">Description</label>
      <textarea id="modalCampDesc" rows="3">${isEdit && existing.description ? escHtml(existing.description) : ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="modalCampOrg">Organisation *</label>
        <select id="modalCampOrg" required>
          <option value="">— Select Organisation —</option>
          ${ORGS.map(o => `<option value="${o.id}" ${isEdit && existing.organisation_id === o.id ? 'selected' : ''}>${escHtml(o.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="modalCampDomain">Domain</label>
        <select id="modalCampDomain">
          <option value="">— Select Domain —</option>
          ${filteredDomains.map(d => `<option value="${d.id}" ${isEdit && existing.domain_id === d.id ? 'selected' : ''}>${escHtml(d.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="modalCampStart">Start Date</label>
        <input type="date" id="modalCampStart" value="${isEdit && existing.start_date ? existing.start_date.split('T')[0] : ''}">
      </div>
      <div class="form-group">
        <label for="modalCampEnd">End Date</label>
        <input type="date" id="modalCampEnd" value="${isEdit && existing.end_date ? existing.end_date.split('T')[0] : ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="catalog-checkbox-label">
        <input type="checkbox" id="modalCampMandatory" ${isEdit && existing.is_mandatory ? 'checked' : ''}>
        <span>Mandatory Campaign</span>
      </label>
    </div>
  `;

  // Dynamic domain filter by org
  body.querySelector('#modalCampOrg').addEventListener('change', e => {
    const orgId = parseInt(e.target.value);
    const domainSelect = body.querySelector('#modalCampDomain');
    const domains = orgId ? allDomains.filter(d => d.organisation_id === orgId) : allDomains;
    domainSelect.innerHTML = `
      <option value="">— Select Domain —</option>
      ${domains.map(d => `<option value="${d.id}">${escHtml(d.name)}</option>`).join('')}
    `;
  });

  const result = await showModal({
    title: isEdit ? 'Edit Campaign' : 'Add Campaign',
    body,
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: isEdit ? 'Save Changes' : 'Create Campaign', className: 'btn btn-primary', value: 'save' },
    ],
  });

  if (result !== 'save') return;

  const name = body.querySelector('#modalCampName').value.trim();
  const description = body.querySelector('#modalCampDesc').value.trim() || null;
  const orgId = parseInt(body.querySelector('#modalCampOrg').value);
  const domainIdRaw = body.querySelector('#modalCampDomain').value;
  const domainId = domainIdRaw ? parseInt(domainIdRaw) : null;
  const startDate = body.querySelector('#modalCampStart').value || null;
  const endDate = body.querySelector('#modalCampEnd').value || null;
  const isMandatory = body.querySelector('#modalCampMandatory').checked;

  if (!name || !orgId) {
    showToast({ message: 'Name and organisation are required', type: 'error' });
    return;
  }

  const payload = { name, description, organisation_id: orgId, domain_id: domainId, start_date: startDate, end_date: endDate, is_mandatory: isMandatory };

  try {
    if (isEdit) {
      await api.put(`/api/campaigns/${existing.id}`, payload);
      showToast({ message: 'Campaign updated', type: 'success' });
    } else {
      await api.post('/api/campaigns/', payload);
      showToast({ message: 'Campaign created', type: 'success' });
    }
    renderCampaignsTab(content);
  } catch (err) {
    showToast({ message: err.message || 'Operation failed', type: 'error' });
  }
}


// ═══════════════════════════════════════════════════════════
// SKILL ASSIGNMENTS TAB
// ═══════════════════════════════════════════════════════════

async function renderAssignmentsTab(content) {
  try {
    const [skills, domains, teams, shifts, certDomains, certificates, campaigns] = await Promise.all([
      api.get('/api/skills/'),
      api.get('/api/domains/'),
      api.get('/api/teams/'),
      api.get('/api/shifts/'),
      api.get('/api/certification-domains/'),
      api.get('/api/certificates/'),
      api.get('/api/campaigns/'),
    ]);
    renderAssignmentsUI(content, skills, domains, teams, shifts, certDomains, certificates, campaigns);
  } catch (err) {
    content.innerHTML = `<p class="admin-error">Failed to load data: ${escHtml(err.message)}</p>`;
  }
}

function renderAssignmentsUI(content, skills, domains, teams, shifts, certDomains, certificates, campaigns) {
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
    await loadSkillAssignments(content, skillId, skills, domains, teams, shifts, certDomains, certificates, campaigns);
  });
}

async function loadSkillAssignments(content, skillId, skills, domains, teams, shifts, certDomains, certificates, campaigns) {
  const panel = content.querySelector('#assignmentsPanel');
  panel.style.display = 'block';
  showSkeleton(panel, 'detail');

  let current = {};
  try {
    const detail = await api.get(`/api/skills/${skillId}`);
    current = {
      organisation_ids: (detail.organisations || []).map(o => o.id),
      domain_ids: (detail.domains || []).map(d => d.id),
      team_ids: (detail.teams || []).map(t => t.id),
      shift_ids: (detail.shifts || []).map(s => s.id),
      certificate_ids: (detail.certificates || []).map(c => c.id),
      campaign_ids: (detail.campaigns || []).map(c => c.id),
    };
  } catch {
    current = {
      organisation_ids: [], domain_ids: [], team_ids: [],
      shift_ids: [], certificate_ids: [], campaign_ids: [],
    };
  }

  const skill = skills.find(s => s.id === skillId);

  panel.innerHTML = `
    <div class="catalog-assignments-header">
      <h3>Assignments for <strong>${skill ? escHtml(skill.name) : 'Skill'}</strong></h3>
      <p class="text-muted" style="font-size:13px;margin-top:4px;">Check the items this skill should be assigned to, then click Save.</p>
    </div>
    <div class="catalog-assignments-grid">
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Organisations</div>
        ${ORGS.map(o => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="org_ids" value="${o.id}" ${(current.organisation_ids || []).includes(o.id) ? 'checked' : ''}>
            <span>${escHtml(o.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Domains</div>
        ${domains.length === 0 ? '<span class="text-muted">No domains</span>' : domains.map(d => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="domain_ids" value="${d.id}" ${(current.domain_ids || []).includes(d.id) ? 'checked' : ''}>
            <span>${escHtml(d.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Teams</div>
        ${teams.length === 0 ? '<span class="text-muted">No teams</span>' : teams.map(t => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="team_ids" value="${t.id}" ${(current.team_ids || []).includes(t.id) ? 'checked' : ''}>
            <span>${escHtml(t.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Shifts</div>
        ${shifts.length === 0 ? '<span class="text-muted">No shifts</span>' : shifts.map(s => {
          const domainName = (domains.find(d => d.id === s.domain_id) || {}).name || '';
          const label = domainName ? `${domainName} / ${s.name}` : s.name;
          return `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="shift_ids" value="${s.id}" ${(current.shift_ids || []).includes(s.id) ? 'checked' : ''}>
            <span>${escHtml(label)}</span>
          </label>
        `;}).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Certificates</div>
        ${certificates.length === 0 ? '<span class="text-muted">No certificates</span>' : certificates.map(c => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="certificate_ids" value="${c.id}" ${(current.certificate_ids || []).includes(c.id) ? 'checked' : ''}>
            <span>${escHtml(c.name)}</span>
          </label>
        `).join('')}
      </div>
      <div class="catalog-assign-group">
        <div class="catalog-assign-group-title">Campaigns</div>
        ${campaigns.length === 0 ? '<span class="text-muted">No campaigns</span>' : campaigns.map(c => `
          <label class="catalog-checkbox-label">
            <input type="checkbox" name="campaign_ids" value="${c.id}" ${(current.campaign_ids || []).includes(c.id) ? 'checked' : ''}>
            <span>${escHtml(c.name)}</span>
          </label>
        `).join('')}
      </div>
    </div>
    <div class="catalog-assignments-actions">
      <button class="btn btn-primary" id="saveAssignmentsBtn">Save Assignments</button>
    </div>
  `;

  panel.querySelector('#saveAssignmentsBtn').addEventListener('click', async () => {
    const getChecked = (name) => Array.from(panel.querySelectorAll(`input[name="${name}"]:checked`)).map(el => parseInt(el.value));

    const payload = {
      organisation_ids: getChecked('org_ids'),
      domain_ids: getChecked('domain_ids'),
      team_ids: getChecked('team_ids'),
      shift_ids: getChecked('shift_ids'),
      certificate_ids: getChecked('certificate_ids'),
      campaign_ids: getChecked('campaign_ids'),
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
