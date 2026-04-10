import { api } from '../api.js';
import { Store } from '../state.js';
import { Router } from '../router.js';
import { showToast } from '../components/toast.js';

export function mountLogin(container, params) {
  if (Store.isLoggedIn) {
    Router.go('/');
    return;
  }

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'auth-page';

  const card = document.createElement('div');
  card.className = 'card auth-card';

  const logoWrap = document.createElement('div');
  logoWrap.className = 'auth-logo';
  logoWrap.innerHTML = `
    <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  `;

  const title = document.createElement('h1');
  title.className = 'auth-title';
  title.textContent = 'MatrixPro';

  const subtitle = document.createElement('p');
  subtitle.className = 'auth-subtitle';
  subtitle.textContent = 'Sign in to your account';

  const form = document.createElement('form');
  form.className = 'auth-form';
  form.setAttribute('novalidate', '');

  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';

  const emailLabel = document.createElement('label');
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

  card.appendChild(logoWrap);
  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(form);
  wrapper.appendChild(card);
  container.appendChild(wrapper);

  emailInput.focus();

  form.addEventListener('submit', async e => {
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

      const user = await api.get('/api/auth/me');
      Store.set('user', user);

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
}
