export function mountCatalog(container, params) {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'page-placeholder';

  const inner = document.createElement('div');
  inner.className = 'container';

  const icon = document.createElement('div');
  icon.className = 'placeholder-icon';
  icon.textContent = '📚';

  const heading = document.createElement('h1');
  heading.textContent = 'Catalog Explorer';

  const sub = document.createElement('p');
  sub.className = 'placeholder-sub';
  sub.textContent = 'Catalog Explorer — Phase 2';

  const phase = document.createElement('span');
  phase.className = 'triage-chip triage-signal';
  phase.textContent = 'Coming in Phase 2';

  inner.appendChild(icon);
  inner.appendChild(heading);
  inner.appendChild(sub);
  inner.appendChild(phase);
  section.appendChild(inner);
  container.appendChild(section);
}
