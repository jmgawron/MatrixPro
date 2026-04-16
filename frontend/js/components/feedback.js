import { api } from '../api.js';
import { Store } from '../state.js';
import { Router } from '../router.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const ROUTE_MODULE_MAP = {
  '/': 'Home Page',
  '/login': 'Login',
  '/my-plan': 'My Plan',
  '/my-team': 'My Team',
  '/catalog': 'Catalog',
  '/skill-explorer': 'Skill Explorer',
  '/admin': 'Admin',
  '/settings': 'Settings',
};

const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug' },
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'missing', label: 'Missing Functionality' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
];

function detectModule() {
  const path = Router.current();
  for (const [route, label] of Object.entries(ROUTE_MODULE_MAP)) {
    if (route === '/') {
      if (path === '/') return label;
    } else if (path.startsWith(route)) {
      return label;
    }
  }
  return 'Unknown';
}

function formatDateTime() {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function openFeedbackModal() {
  const user = Store.get('user');
  if (!user) {
    showToast({ message: 'Please log in to send feedback', type: 'warning' });
    return;
  }

  const sourceModule = detectModule();
  const userName = user.name + (user.surname ? ' ' + user.surname : '');
  const dateTime = formatDateTime();

  const body = document.createElement('div');
  body.className = 'feedback-modal-form';
  body.innerHTML = `
    <div class="feedback-meta">
      <div class="feedback-meta-row">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${dateTime}</span>
      </div>
      <div class="feedback-meta-row">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>${userName}</span>
      </div>
      <div class="feedback-meta-row">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span>${sourceModule}</span>
      </div>
    </div>
    <div class="form-group">
      <label for="feedbackType">Feedback Type</label>
      <select id="feedbackType">
        ${FEEDBACK_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="feedbackMessage">Message *</label>
      <textarea id="feedbackMessage" rows="5" placeholder="Describe your feedback in detail..."></textarea>
    </div>
  `;

  const result = await showModal({
    title: 'Send Feedback',
    body,
    modalClass: 'feedback-modal',
    actions: [
      { label: 'Cancel', className: 'btn btn-secondary' },
      { label: 'Send', className: 'btn btn-primary', value: 'send' },
    ],
  });

  if (result !== 'send') return;

  const feedbackType = body.querySelector('#feedbackType').value;
  const message = body.querySelector('#feedbackMessage').value.trim();

  if (!message) {
    showToast({ message: 'Please enter a message', type: 'error' });
    return;
  }

  try {
    await api.post('/api/feedback/', {
      feedback_type: feedbackType,
      source_module: sourceModule,
      message,
    });
    showToast({ message: 'Feedback sent — thank you!', type: 'success' });
  } catch (err) {
    showToast({ message: err.message || 'Failed to send feedback', type: 'error' });
  }
}

export function initFeedbackButton() {
  const btn = document.getElementById('feedbackBtn');
  if (!btn) return;
  btn.addEventListener('click', () => openFeedbackModal());

  function updateVisibility() {
    const user = Store.get('user');
    btn.style.display = user ? '' : 'none';
  }
  updateVisibility();
  Store.on('user', updateVisibility);
}
