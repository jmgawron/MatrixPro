// ─── Shared DOM utilities ─────────────────────────────────────────────────────

export function createElement(tag, props) {
  const el = document.createElement(tag);
  if (!props) return el;
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'textContent') el.textContent = v;
    else if (k === 'htmlFor') el.htmlFor = v;
    else el.setAttribute(k, v);
  });
  return el;
}

export { createElement as el };
