// ─── Matrix status model & helpers ───────────────────────────────────────────

export const MATRIX_STATUS = Object.freeze({
  MISSING:         'missing',
  PLANNED:         'planned',
  DEV_EXPOSURE:    'dev-exposure',
  DEV_EDUCATION:   'dev-education',
  DEV_EXPERIENCE:  'dev-experience',
  MASTERED:        'mastered',
});

export const STALLED_DAYS = 45;

const STATUS_LABELS = Object.freeze({
  [MATRIX_STATUS.MISSING]:         'Not in Plan',
  [MATRIX_STATUS.PLANNED]:         'Planned',
  [MATRIX_STATUS.DEV_EXPOSURE]:    'In-Development · Exposure',
  [MATRIX_STATUS.DEV_EDUCATION]:   'In-Development · Education',
  [MATRIX_STATUS.DEV_EXPERIENCE]:  'In-Development · Experience',
  [MATRIX_STATUS.MASTERED]:        'Mastered',
});

const ICONS = Object.freeze({
  [MATRIX_STATUS.MISSING]: '',
  [MATRIX_STATUS.PLANNED]:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  [MATRIX_STATUS.DEV_EXPOSURE]:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
  [MATRIX_STATUS.DEV_EDUCATION]:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  [MATRIX_STATUS.DEV_EXPERIENCE]:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  [MATRIX_STATUS.MASTERED]:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
});

export function resolveMatrixStatus(cell) {
  if (!cell || cell.status === 'not_in_plan') return MATRIX_STATUS.MISSING;
  if (cell.status === 'mastered')              return MATRIX_STATUS.MASTERED;
  if (cell.status === 'planned')               return MATRIX_STATUS.PLANNED;

  if (cell.status === 'developing') {
    const lvl = Number(cell.proficiency_level) || 0;
    if (lvl >= 3) return MATRIX_STATUS.DEV_EXPERIENCE;
    if (lvl === 1) return MATRIX_STATUS.DEV_EDUCATION;
    return MATRIX_STATUS.DEV_EXPOSURE;
  }

  return MATRIX_STATUS.MISSING;
}

// ─── Stalled detection (no activity within STALLED_DAYS) ─────────────────────

export function isStalled(cell) {
  if (!cell) return false;
  if (cell.status === 'not_in_plan' || cell.status === 'mastered') return false;
  const ts = cell.last_training_at || cell.last_updated_at;
  if (!ts) return false;
  const ageMs = Date.now() - new Date(ts).getTime();
  return ageMs > STALLED_DAYS * 24 * 60 * 60 * 1000;
}

export function getMatrixCellStyle(cell) {
  const kind = resolveMatrixStatus(cell);
  const stalled = isStalled(cell);
  return {
    kind,
    stalled,
    label: STATUS_LABELS[kind],
    iconHtml: ICONS[kind] || '',
    cssClass:
      'matrix-cell matrix-cell--' + kind +
      (stalled ? ' matrix-cell--stalled' : ''),
  };
}

export const MATRIX_LEGEND_ITEMS = Object.freeze([
  { kind: MATRIX_STATUS.MASTERED,        label: 'Mastered' },
  { kind: MATRIX_STATUS.DEV_EXPERIENCE,  label: 'Experience' },
  { kind: MATRIX_STATUS.DEV_EDUCATION,   label: 'Education' },
  { kind: MATRIX_STATUS.DEV_EXPOSURE,    label: 'Exposure' },
  { kind: MATRIX_STATUS.PLANNED,         label: 'Planned' },
  { kind: MATRIX_STATUS.MISSING,         label: 'Not in Plan' },
  { kind: 'stalled',                     label: `Stalled (${STALLED_DAYS}+ days)` },
]);

export function getLegendIcon(kind) {
  return ICONS[kind] || '';
}
