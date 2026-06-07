// ─── Shared DOM utilities ─────────────────────────────────────────────────────

export function createElement(tag, props) {
  const el = document.createElement(tag);
  if (!props) return el;
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'htmlFor') el.htmlFor = v;
    else if (k === 'style') {
      if (typeof v === 'string') el.setAttribute('style', v);
      else if (v && typeof v === 'object') Object.assign(el.style, v);
    } else el.setAttribute(k, v);
  });
  return el;
}

export { createElement as el };

/** Escape text for safe HTML interpolation. */
export function escHtml(value) {
  const s = String(value ?? '');
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
