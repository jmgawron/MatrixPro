export function mountHome(container, params) {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'page-placeholder';

  const inner = document.createElement('div');
  inner.className = 'container';

  const icon = document.createElement('div');
  icon.className = 'placeholder-icon';
  icon.innerHTML = `
    <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  `;

  const heading = document.createElement('h1');
  heading.textContent = 'MatrixPro';

  const sub = document.createElement('p');
  sub.className = 'placeholder-sub';
  sub.textContent = 'Start Page — Phase 6';

  const phase = document.createElement('span');
  phase.className = 'triage-chip triage-signal';
  phase.textContent = 'Coming in Phase 6';

  inner.appendChild(icon);
  inner.appendChild(heading);
  inner.appendChild(sub);
  inner.appendChild(phase);
  section.appendChild(inner);
  container.appendChild(section);
}
