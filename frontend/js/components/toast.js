const SVG_ICONS = {
  success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

const DURATION_DEFAULT = 4000;

function getRoot() {
  return document.getElementById('toastRoot');
}

/**
 * Show a toast notification.
 *
 * Accepts two calling conventions:
 *   showToast('message text', 'success')              — positional args
 *   showToast({ message: 'text', type: 'success' })   — object arg
 */
export function showToast(messageOrOpts, type = 'info', duration = DURATION_DEFAULT) {
  let message;
  if (typeof messageOrOpts === 'object' && messageOrOpts !== null) {
    message = messageOrOpts.message ?? String(messageOrOpts);
    type = messageOrOpts.type ?? type;
    duration = messageOrOpts.duration ?? duration;
  } else {
    message = String(messageOrOpts);
  }

  const root = getRoot();
  if (!root) return;

  const toast = document.createElement('div');
  toast.className = `toast-item toast-item--${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.innerHTML = SVG_ICONS[type] ?? SVG_ICONS.info;

  const text = document.createElement('span');
  text.className = 'toast-msg';
  text.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.appendChild(close);
  root.appendChild(toast);

  function dismiss() {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  close.addEventListener('click', dismiss);
  const timer = setTimeout(dismiss, duration);

  close.addEventListener('click', () => clearTimeout(timer), { once: true });
}
