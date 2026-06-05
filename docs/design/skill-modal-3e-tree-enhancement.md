# Skill Modal — 3E Expandable Tree Enhancement

**Status:** Mockup ready for review (v3)  
**Mockup:** `docs/design/skill-detail-modal-mockup.html`  
**Production today:** Cumulative list filter (v2) in `frontend/js/pages/my-plan.js`

---

## Problem

The left panel currently shows **all sections up to the focus level** as flat, always-expanded lists. Users want a **tree** that:

1. Hides future sections (not yet in focus)
2. Shows ancestor sections as **collapsed headers** (framework awareness)
3. Expands only the **active focus section** by default
4. Allows optional manual expand of collapsed ancestors via **+ / −**

---

## Focus → Tree layout (authoritative)

| Focus area | Education | Exposure | Experience |
|------------|-----------|----------|------------|
| **Education** | Expanded (items visible) | Hidden | Hidden |
| **Exposure** | Collapsed header only | Expanded | Hidden |
| **Experience** | Collapsed header | Collapsed header | Expanded |

### Visual example (Experience focus)

```
+ Education                    2/3
+ Exposure                     1/3
− Experience                   0/3
    ☐ Own a sev-2 VLAN outage end-to-end
    ☐ VTP v3 domain migration — lead cutover
    ☐ Design review: campus segmentation blueprint
```

---

## State model (implementation)

```javascript
const FOCUS_TREE_DEFAULTS = {
  education: {
    education:   { visible: true, expanded: true,  canToggle: false, isFocus: true },
    exposure:    { visible: false },
    experience:  { visible: false },
  },
  exposure: {
    education:   { visible: true, expanded: false, canToggle: true,  isFocus: false },
    exposure:    { visible: true, expanded: true,  canToggle: false, isFocus: true },
    experience:  { visible: false },
  },
  experience: {
    education:   { visible: true, expanded: false, canToggle: true,  isFocus: false },
    exposure:    { visible: true, expanded: false, canToggle: true,  isFocus: false },
    experience:  { visible: true, expanded: true,  canToggle: false, isFocus: true },
  },
};

// User overrides for canToggle sections only (reset when focus changes)
let manualExpanded = {};
```

**Rules:**

- Changing **Focus area** resets `manualExpanded` and reapplies defaults.
- **Focus section** (`isFocus: true`) is always expanded; toggle hidden/disabled (`canToggle: false`).
- **Hidden sections** are not rendered (not merely collapsed).
- **Progress bar** counts all items in **visible** sections (including collapsed headers), so users see full framework progress.
- **Item selection** only from **expanded** sections; if selection becomes hidden, auto-select first item in active expanded section.

---

## UI / DOM structure

Replace flat `.sdm-section` with:

```html
<div class="sdm-tree-section sdm-tree-section--focus|collapsed|locked">
  <button class="sdm-tree-section__header" aria-expanded="true|false">
    <span class="sdm-tree-section__toggle">+</span>
    <span class="sdm-tree-section__label">Education</span>
    <span class="sdm-tree-section__count">2/3</span>
  </button>
  <div class="sdm-tree-section__body">
    <!-- existing .sdm-list-item rows -->
  </div>
</div>
```

### CSS hooks (add to `style.css` §7.25)

| Class | Purpose |
|-------|---------|
| `.sdm-tree-section--collapsed` | Hides `.sdm-tree-section__body` |
| `.sdm-tree-section--focus` | Subtle accent on active focus section |
| `.sdm-tree-section--locked` | Dimmed ± (focus section cannot collapse) |
| `.sdm-tree-section__toggle` | Monospace + / − glyph |

Light theme: reuse existing token overrides pattern from v2 modal.

---

## Accessibility

- Section header = `<button>` with `aria-expanded`
- Toggle glyph marked `aria-hidden="true"`; label includes section name
- Keyboard: Enter/Space on header toggles when `canToggle`
- Focus ring via existing `:focus-visible` patterns

---

## Production implementation plan (after approval)

| File | Change |
|------|--------|
| `frontend/js/pages/my-plan.js` | Replace `visibleSections()` / `renderList()` with tree state + manual overrides |
| `frontend/css/style.css` | Add `.sdm-tree-section*` rules (dark + light) |
| Cache bumps | `my-plan.js`, `style.css`, `index.html`, `app.js` |

**No backend changes** — focus area still saved via existing `PUT /api/plans/.../skills/{id}`.

**Estimated scope:** ~120 lines JS, ~80 lines CSS, 1–2 hours including manual QA across three focus modes + theme toggle.

---

## QA checklist (post-implementation)

- [ ] Education focus: only Education tree node; ± locked expanded
- [ ] Exposure focus: Education collapsed (+ expands manually); Exposure expanded; Experience absent
- [ ] Experience focus: all three headers; only Experience expanded by default; + on Edu/Exp works
- [ ] Focus change clears manual expand state
- [ ] Selected item moves when section collapses/hides
- [ ] Progress counts visible sections
- [ ] Deferred save unchanged (completion toggles still pending until Save)
- [ ] Light + dark themes

---

## Open questions for approval

1. **Manual expand on Exposure focus** — Should collapsed Education be expandable (+)? Mockup: **yes** (helps peek at prior work).
2. **Empty sections** — Hide section header if zero items, or show `0/0`? Proposed: **hide** empty sections.
3. **Progress scope** — Count only expanded items vs all visible sections? Mockup uses **all visible sections**.

---

## Preview mockup

```bash
cd docs/design && python3 -m http.server 8766
# → http://localhost:8766/skill-detail-modal-mockup.html
```

Use **Focus area** dropdown and click **+ / −** on section headers to validate behavior.
