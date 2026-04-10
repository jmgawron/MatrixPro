function skeletonEl(className) {
  const el = document.createElement('div');
  el.className = `skeleton ${className}`;
  return el;
}

const BUILDERS = {
  cards(container) {
    const grid = document.createElement('div');
    grid.className = 'grid-3 skeleton-grid';
    for (let i = 0; i < 6; i++) {
      const card = document.createElement('div');
      card.className = 'card skeleton-card';
      card.appendChild(skeletonEl('skeleton-title'));
      card.appendChild(skeletonEl('skeleton-line'));
      card.appendChild(skeletonEl('skeleton-line skeleton-line--short'));
      grid.appendChild(card);
    }
    container.appendChild(grid);
  },

  table(container) {
    const wrap = document.createElement('div');
    wrap.className = 'skeleton-table-wrap';
    const header = document.createElement('div');
    header.className = 'skeleton-table-header';
    for (let i = 0; i < 4; i++) header.appendChild(skeletonEl('skeleton-cell'));
    wrap.appendChild(header);
    for (let r = 0; r < 6; r++) {
      const row = document.createElement('div');
      row.className = 'skeleton-table-row';
      for (let c = 0; c < 4; c++) row.appendChild(skeletonEl('skeleton-cell'));
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  },

  list(container) {
    const list = document.createElement('div');
    list.className = 'skeleton-list';
    for (let i = 0; i < 8; i++) {
      const item = document.createElement('div');
      item.className = 'skeleton-list-item';
      item.appendChild(skeletonEl('skeleton-avatar'));
      const lines = document.createElement('div');
      lines.className = 'skeleton-lines';
      lines.appendChild(skeletonEl('skeleton-line'));
      lines.appendChild(skeletonEl('skeleton-line skeleton-line--short'));
      item.appendChild(lines);
      list.appendChild(item);
    }
    container.appendChild(list);
  },

  detail(container) {
    const wrap = document.createElement('div');
    wrap.className = 'skeleton-detail';
    wrap.appendChild(skeletonEl('skeleton-heading'));
    wrap.appendChild(skeletonEl('skeleton-line'));
    wrap.appendChild(skeletonEl('skeleton-line'));
    wrap.appendChild(skeletonEl('skeleton-line skeleton-line--short'));
    const meta = document.createElement('div');
    meta.className = 'skeleton-meta-row';
    for (let i = 0; i < 3; i++) meta.appendChild(skeletonEl('skeleton-badge'));
    wrap.appendChild(meta);
    container.appendChild(wrap);
  },
};

export function showSkeleton(container, type = 'cards') {
  container.innerHTML = '';
  const build = BUILDERS[type] ?? BUILDERS.cards;
  build(container);
}
