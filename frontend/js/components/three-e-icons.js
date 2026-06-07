/** Canonical 3E icons — Book · Flask · Terminal (Proposed B) */

const SVG_OPEN =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

export const THREE_E_ICON_SVG = Object.freeze({
  education:
    `<svg ${SVG_OPEN} aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  exposure:
    `<svg ${SVG_OPEN} aria-hidden="true"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .899 1.45h12.762a1 1 0 0 0 .899-1.45L14.21 10.424a2 2 0 0 1-.211-.897V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>`,
  experience:
    `<svg ${SVG_OPEN} aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
});

/** @param {'education'|'exposure'|'experience'} name @param {number} [size] */
export function threeEIcon(name, size = 24) {
  const svg = THREE_E_ICON_SVG[name];
  if (!svg) return '';
  if (size === 24) return svg;
  return svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
}
