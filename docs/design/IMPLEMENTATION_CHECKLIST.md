# Glassmorphism Skill Cards - Implementation Checklist

> Last Updated: Apr 14, 2026  
> Status: Ready for Implementation  
> Effort: ~2-3 hours

---

## PHASE 1: Icon Library Setup (30 min)

- [ ] **Download Tabler Icons**
  ```bash
  git clone --depth 1 https://github.com/tabler/tabler-icons.git /tmp/tabler
  ```

- [ ] **Copy essential icons to project** (~15-20 icons)
  ```bash
  mkdir -p frontend/assets/icons
  cp /tmp/tabler/icons/{router,wifi,shield,cloud,server,settings,code,wrench,book,certificate,lock,alert,database,check-circle,zap}.svg frontend/assets/icons/
  ```

- [ ] **Verify SVG format**
  - All icons should have: `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`
  - All should be 24×24 grid with 2px stroke

---

## PHASE 2: CSS Foundation (45 min)

- [ ] **Create glassmorphism stylesheet**
  - File: `frontend/css/skill-cards.css`
  - Include:
    - `.skill-grid` — responsive grid layout
    - `.skill-card` — glassmorphic container
    - `.skill-icon-container` — 56px square icon background
    - `.skill-icon` — 40px icon sizing + color
    - Hover states + transitions

- [ ] **Update main stylesheet**
  - Add `@import url('skill-cards.css');` to `frontend/css/style.css`
  - Ensure CSS custom properties align with existing design tokens:
    - `--accent-blue`: `#0ea5e9`
    - `--accent-purple`: `#9333ea`
    - `--text-white`: `#ffffff`

- [ ] **Test responsive breakpoints**
  - Desktop (1280px+): 4-column grid
  - Tablet (768px): 2-3 columns
  - Mobile (320px): 1 column

---

## PHASE 3: Icon Component (45 min)

- [ ] **Create icon loader**
  - File: `frontend/js/components/icon-loader.js`
  - Async function: `loadIcon(name)` → returns SVG string
  - Cache loaded icons in memory

- [ ] **Create skill card component**
  - File: `frontend/js/components/skill-card.js`
  - Export: `renderSkillCard(skill)` → HTML string
  - Include icon, skill name, category

- [ ] **Update catalog page**
  - File: `frontend/js/pages/catalog.js`
  - Replace existing card layout with `.skill-grid`
  - Use `renderSkillCard()` for each skill

- [ ] **Update skill explorer page**
  - File: `frontend/js/pages/skill-explorer.js`
  - Apply glassmorphism styling to search results

---

## PHASE 4: Skill → Icon Mapping (20 min)

- [ ] **Create mapping constants**
  - File: `frontend/js/constants/skill-icons.js`
  - Define `SKILL_CATEGORY_ICONS` object:
    ```javascript
    {
      'Wi-Fi & Wireless': 'wifi',
      'Network Infrastructure': 'router',
      'Security & Compliance': 'shield',
      'Cloud & Virtualization': 'cloud',
      'Data Center': 'server',
      'Development': 'code',
      'Operations': 'settings',
    }
    ```

- [ ] **Update database** (optional)
  - Add `icon_name` column to `Skill` model if needed
  - Or use category-based mapping (simpler)

---

## PHASE 5: Testing & Polish (30 min)

- [ ] **Test on browsers**
  - Chrome/Safari: Verify backdrop-filter blur
  - Firefox: Test fallback (may not support blur)
  - Mobile: Test responsive grid

- [ ] **Accessibility checks**
  - Icon alt text via `aria-label`
  - Color contrast (white icons on blurred gradient)
  - Keyboard navigation through skill cards

- [ ] **Performance**
  - Lazy load SVGs on scroll (if >20 cards visible)
  - Check bundle size: SVGs should be <100KB total

- [ ] **Polish details**
  - Hover animation smooth (cubic-bezier)
  - Icon colors inherit from CSS custom properties
  - Fallback color if icon fails to load

---

## Files to Create/Modify

### New Files
```
frontend/assets/icons/*.svg              (15-20 Tabler icons)
frontend/css/skill-cards.css             (glassmorphism styles)
frontend/js/components/icon-loader.js    (icon fetching)
frontend/js/components/skill-card.js     (card rendering)
frontend/js/constants/skill-icons.js     (category → icon mapping)
```

### Modified Files
```
frontend/css/style.css                   (add import + tokens)
frontend/js/pages/catalog.js             (use skill-card component)
frontend/js/pages/skill-explorer.js      (apply grid styling)
frontend/index.html                      (add style link if needed)
```

---

## CSS Quick Reference

**Glassmorphic Card**
```css
.skill-card {
  background: linear-gradient(to top left, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: inset 0 2px 8px rgba(255, 255, 255, 0.1), 0 8px 32px rgba(0, 0, 0, 0.15);
}
```

**Icon Container**
```css
.skill-icon-container {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-icon {
  width: 40px;
  height: 40px;
  color: var(--accent-blue);
}

.skill-icon svg {
  stroke: currentColor;
  fill: none;
}
```

**Grid Layout**
```css
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}
```

---

## JavaScript Quick Reference

**Load SVG Icon**
```javascript
async function loadIcon(name) {
  const response = await fetch(`/assets/icons/${name}.svg`);
  return await response.text();
}
```

**Render Skill Card**
```javascript
async function renderSkillCard(skill) {
  const icon = await loadIcon(SKILL_CATEGORY_ICONS[skill.category]);
  return `
    <div class="skill-card">
      <div class="skill-icon-container">
        <div class="skill-icon">${icon}</div>
      </div>
      <h3 class="skill-name">${skill.name}</h3>
      <div class="skill-category">${skill.category}</div>
    </div>
  `;
}
```

**Render Grid**
```javascript
const skillGrid = document.querySelector('.skill-grid');
for (const skill of skills) {
  skillGrid.innerHTML += await renderSkillCard(skill);
}
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Tabler Icons** | 6,000+ icons for networking/infrastructure; MIT Licensed; 24×24 grid consistency |
| **Glassmorphism** | Modern, matches Cisco design language; adds visual hierarchy via blur depth |
| **40×56px Icons** | 15-20% of card width; readable at all sizes; no CDN needed |
| **3-4 Column Grid** | Balanced content density; responsive via CSS Grid auto-fit |
| **Inline SVG** | No build step; self-contained; can customize via CSS current color |
| **Backdrop Blur** | Creates frosted glass effect; supported in Safari/Chrome (Firefox fades gracefully) |

---

## Known Limitations

- Firefox doesn't support `backdrop-filter: blur()` — will show semi-transparent cards without blur (still readable)
- Mobile Safari may have performance impact if >50 cards visible — consider lazy loading
- IE11 not supported (browser is deprecated)
- On older Safari (<15), use `-webkit-backdrop-filter` fallback (already in CSS)

---

## References

- **Design Analysis**: `docs/design/ICON_DESIGN_ANALYSIS.md`
- **Live Demo**: `docs/design/skill-card-demo.html` (open in browser)
- **Tabler Icons Repo**: https://github.com/tabler/tabler-icons
- **Icon Gallery**: https://tabler.io/icons (browse + copy SVG)
- **CSS Glassmorphism Guide**: https://vinish.dev/glassmorphism-using-css

---

## Timeline

- **Day 1 (Hour 1-2)**: Download icons + create CSS
- **Day 1 (Hour 2-3)**: Icon loader + skill card component  
- **Day 2 (Hour 1)**: Update pages + testing
- **Day 2 (Hour 1-2)**: Polish + accessibility

**Total Effort**: 4-5 hours (including testing)

---

## Sign-Off

Once complete:
- [ ] All 15-20 icons loaded successfully
- [ ] Cards render in responsive grid
- [ ] Hover animations smooth
- [ ] Icons colored correctly via CSS custom properties
- [ ] No console errors
- [ ] Mobile responsive tested
