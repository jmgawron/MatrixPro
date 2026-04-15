let _activeModal = null;

function removeModal() {
  if (!_activeModal) return;
  const { overlay } = _activeModal;
  overlay.classList.remove('open');
  setTimeout(() => overlay.remove(), 200);
  _activeModal = null;
}

export function showModal({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, danger = false, actions, modalClass }) {
  if (_activeModal) removeModal();

  const useActions = Array.isArray(actions);

  let promiseResolve;
  const promise = useActions ? new Promise(resolve => { promiseResolve = resolve; }) : undefined;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  if (modalClass) modal.classList.add(modalClass);
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
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

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

  const dismiss = (value) => {
    removeModal();
    document.removeEventListener('keydown', onKey);
    if (useActions) {
      promiseResolve(value ?? null);
    }
  };

  if (useActions) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = action.className || 'btn btn-secondary';
      btn.textContent = action.label;
      btn.addEventListener('click', () => dismiss(action.value ?? null));
      footer.appendChild(btn);
    });
  } else {
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    confirmBtn.textContent = confirmText;

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    confirmBtn.addEventListener('click', () => { removeModal(); onConfirm?.(); });
    cancelBtn.addEventListener('click', () => { removeModal(); onCancel?.(); });
  }

  modal.appendChild(header);
  modal.appendChild(bodyEl);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  document.getElementById('modalRoot').appendChild(overlay);
  _activeModal = { overlay };

  requestAnimationFrame(() => overlay.classList.add('open'));

  const cancel = () => {
    if (useActions) {
      dismiss(null);
    } else {
      removeModal();
      onCancel?.();
    }
  };

  closeBtn.addEventListener('click', cancel);
  overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });

  const onKey = e => {
    if (e.key === 'Escape') { cancel(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  return promise;
}

export function showConfirm(messageOrOpts, danger = false) {
  let title = 'Confirm';
  let body;

  if (typeof messageOrOpts === 'object' && messageOrOpts !== null) {
    title = messageOrOpts.title || 'Confirm';
    body = messageOrOpts.message || messageOrOpts.body || '';
    danger = messageOrOpts.danger ?? danger;
  } else {
    body = messageOrOpts;
  }

  return new Promise(resolve => {
    showModal({
      title,
      body,
      confirmText: 'Yes',
      cancelText: 'No',
      danger,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
