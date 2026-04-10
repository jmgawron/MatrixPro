const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
const DURATION_DEFAULT = 4000;

function getRoot() {
  return document.getElementById('toastRoot');
}

export function showToast(message, type = 'info', duration = DURATION_DEFAULT) {
  const root = getRoot();
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = ICONS[type] ?? ICONS.info;

  const text = document.createElement('span');
  text.className = 'toast-message';
  text.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '✕';

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.appendChild(close);
  root.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-enter'));

  function dismiss() {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  close.addEventListener('click', dismiss);
  const timer = setTimeout(dismiss, duration);

  close.addEventListener('click', () => clearTimeout(timer), { once: true });
}
