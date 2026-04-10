let _activeModal = null;

function removeModal() {
  if (!_activeModal) return;
  const { overlay } = _activeModal;
  overlay.classList.add('modal-exit');
  overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  _activeModal = null;
}

export function showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, danger = false }) {
  if (_activeModal) removeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title);

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '✕';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.textContent = cancelText;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  confirmBtn.textContent = confirmText;

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  modal.appendChild(header);
  modal.appendChild(bodyEl);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  document.getElementById('modalRoot').appendChild(overlay);
  _activeModal = { overlay };

  requestAnimationFrame(() => overlay.classList.add('modal-enter'));

  const confirm = () => { removeModal(); onConfirm?.(); };
  const cancel = () => { removeModal(); onCancel?.(); };

  confirmBtn.addEventListener('click', confirm);
  cancelBtn.addEventListener('click', cancel);
  closeBtn.addEventListener('click', cancel);

  overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });

  const onKey = e => {
    if (e.key === 'Escape') { cancel(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

export function showConfirm(message, danger = false) {
  return new Promise(resolve => {
    showModal({
      title: 'Confirm',
      body: message,
      confirmText: 'Yes',
      cancelText: 'No',
      danger,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
