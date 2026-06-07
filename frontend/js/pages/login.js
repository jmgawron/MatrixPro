import { api } from '../api.js';
import { Store } from '../state.js';
import { Router } from '../router.js';
import { showToast } from '../components/toast.js';
import { mountHome } from './home.js?v=16';

const AUTH_ICON = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  <rect x="9" y="11" width="6" height="5" rx="1"/>
  <path d="M10 11V9a2 2 0 0 1 4 0v2"/>
</svg>`;

let _activeLoginModal = null;

function closeLoginModal() {
  if (!_activeLoginModal) return;
  const { overlay, onKey } = _activeLoginModal;
  document.removeEventListener('keydown', onKey);
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 200);
  _activeLoginModal = null;
}

export function openLoginModal({ onClose } = {}) {
  if (Store.isLoggedIn) {
    onClose?.();
    return () => {};
  }

  if (_activeLoginModal) closeLoginModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay--auth';

  const modal = document.createElement('div');
  modal.className = 'modal modal-auth';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'login-modal-title');

  const header = document.createElement('div');
  header.className = 'modal-header modal-auth__header';

  const headerMain = document.createElement('div');
  headerMain.className = 'modal-auth__header-main';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'modal-auth__icon';
  iconWrap.innerHTML = AUTH_ICON;

  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.id = 'login-modal-title';
  title.className = 'modal-title';
  title.textContent = 'Sign in';

  const subtitle = document.createElement('p');
  subtitle.className = 'modal-auth__subtitle';
  subtitle.textContent = 'Authenticate to access MatrixPro';

  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);
  headerMain.appendChild(iconWrap);
  headerMain.appendChild(titleWrap);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close sign in');
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  header.appendChild(headerMain);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'modal-body modal-auth__body';

  const form = document.createElement('form');
  form.className = 'auth-form modal-auth__form';
  form.setAttribute('novalidate', '');

  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';
  const emailLabel = document.createElement('label');
  emailLabel.className = 'form-label';
  emailLabel.htmlFor = 'login-email';
  emailLabel.textContent = 'Email';
  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'login-email';
  emailInput.className = 'form-input';
  emailInput.placeholder = 'you@cisco.com';
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  const passGroup = document.createElement('div');
  passGroup.className = 'form-group';
  const passLabel = document.createElement('label');
  passLabel.className = 'form-label';
  passLabel.htmlFor = 'login-password';
  passLabel.textContent = 'Password';
  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.id = 'login-password';
  passInput.className = 'form-input';
  passInput.placeholder = '••••••••';
  passInput.autocomplete = 'current-password';
  passInput.required = true;
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);

  const errorEl = document.createElement('div');
  errorEl.className = 'auth-error';
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  errorEl.hidden = true;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary auth-submit';
  submitBtn.textContent = 'Sign In';

  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(errorEl);
  form.appendChild(submitBtn);
  body.appendChild(form);

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);

  const dismiss = () => {
    closeLoginModal();
    onClose?.();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') dismiss();
  };

  closeBtn.addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });
  document.addEventListener('keydown', onKey);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
      errorEl.textContent = 'Email and password are required.';
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';

    try {
      const data = await api.post('/api/auth/login', { email, password });
      const token = data.access_token ?? data.token;
      if (!token) throw new Error('No token received from server.');

      localStorage.setItem('matrixpro_token', token);
      localStorage.setItem('matrixpro_last_login', new Date().toISOString());

      const user = await api.get('/api/auth/me');
      Store.set('user', user);

      closeLoginModal();
      showToast(`Welcome back, ${user.name ?? user.email}!`, 'success');
      Router.go('/');
    } catch (err) {
      errorEl.textContent = err.message ?? 'Login failed. Please try again.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
      passInput.value = '';
      passInput.focus();
    }
  });

  document.getElementById('modalRoot').appendChild(overlay);
  _activeLoginModal = { overlay, onKey };

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    emailInput.focus();
  });

  return closeLoginModal;
}

export function mountLogin(container) {
  if (Store.isLoggedIn) {
    Router.go('/');
    return;
  }

  mountHome(container);

  const closeModal = openLoginModal({
    onClose: () => {
      if (Router.current() === '/login') Router.go('/');
    },
  });

  return () => closeModal();
}
