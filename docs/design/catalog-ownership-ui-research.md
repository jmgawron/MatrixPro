# Catalog Ownership UI — Research & Change Specification

> **Status:** Design / mockup phase — awaiting approval before implementation  
> **Scope:** Skill Catalog page + unified skill editor + related modals  
> **Backend model:** `SkillTeam.role ∈ {owner, consumer}` (already shipped)  
> **Mockups:** [`catalog-ownership-ui-mockup.html`](catalog-ownership-ui-mockup.html)

---

## 1. Executive summary

The backend ownership redesign is largely complete: skills expose `owner_teams[]` and `consumer_teams[]`, RBAC distinguishes **owner managers** (full edit) from **consumer managers** (consumer attach/detach only), and delete/duplicate/fork semantics are in place.

The **frontend is ~70% aligned**. Grid cards and the Details-tab form already split owner vs consumer teams. The remaining work is **visual language**, **RBAC-aware UX**, and **consistency** across every catalog touchpoint — especially the unified editor header, consumer-manager workflow, and chip styling.

This document inventories every UI surface, defines the target behavior per role, and maps gaps to mockup sections.

---

## 2. Ownership concepts (UI vocabulary)

| Term | Meaning in UI | Visual treatment |
|------|---------------|------------------|
| **Owner team** | Team that defines and maintains the skill in the global catalog | Solid accent chip (`triage-owner`), lock icon optional in edit panels |
| **Consumer team** | Team that may browse the skill and assign it to engineers; cannot edit skill metadata | Outlined / secondary chip (`triage-consumer`), link icon optional |
| **Owner manager** | Manager whose `team_id` (or report team) is in `owner_teams` | Full Edit, Delete, Duplicate, both association panels editable |
| **Consumer manager** | Manager on `consumer_teams` only (not owner) | **Manage access** action → consumer panel only; metadata read-only |
| **Admin** | `role=admin` | Full override on all fields |
| **Engineer** | Browse catalog, add skills to plan | Read-only; no association editing |

**Rule:** When a manager is on both owner and consumer teams for the same skill, **owner wins** (single full-edit experience).

---

## 3. UI surface inventory

### 3.1 Catalog page (`frontend/js/pages/catalog.js`)

| # | Surface | Current state | Required change |
|---|---------|---------------|-----------------|
| A1 | **Skill grid card** | Owner + Consumer rows with labels | Polish: distinct chip colors, optional role legend in toolbar |
| A2 | **Card actions** (Edit / Duplicate / Delete) | Shown only if `canEditCatalogSkill` (owner-only) | Add **Manage access** for consumer managers; hide Delete/Duplicate for consumer-only |
| A3 | **Sidebar tree filter** | `team_id` matches any association | Optional: tree tooltip “Shows skills owned or consumed by this team” |
| A4 | **Shift filter** | Filters on combined `skill.teams` | Update to union of `owner_teams` + `consumer_teams` shifts |
| A5 | **Add New Skill** | Opens editor in create mode | No ownership change; copy clarifies new skill’s manager team = sole owner |
| A6 | **Delete modal** | Fork preview, typed confirm | Add one line: “Owner teams lose catalog entry; consumer teams lose catalog visibility” |
| A7 | **Duplicate** | Toast on success | Add info toast: “Consumer teams not copied — assign separately if needed” |

### 3.2 Unified skill editor (`frontend/js/components/catalog-skill-editor.js`)

| # | Surface | Current state | Required change |
|---|---------|---------------|-----------------|
| B1 | **Modal header meta** | Single row “Teams” from `s.teams` | **Split:** “Owners” row + “Consumers” row with distinct chip styles |
| B2 | **Archived badge** | Still shown when `is_archived` | **Remove** per ownership supersession (archive retired) |
| B3 | **Details tab — Owner panel** | Combobox + shift filter | Add helper text; lock read-only when consumer-only mode |
| B4 | **Details tab — Consumer panel** | Combobox, no shift filter | Add helper text; accent border when consumer-only edit mode |
| B5 | **Details tab — Certs / Identity** | Editable for owner managers | Read-only/disabled for consumer-only managers |
| B6 | **Content tab (3E)** | Owner edit only | Unchanged for owner; hidden/disabled for consumer-only |
| B7 | **Save footer** | “Save Details” | Consumer mode: “Save consumer access” |
| B8 | **RBAC gate** | `canEditCatalogSkill` = owner only | New `getSkillAccessLevel(skill, user)` → `admin \| owner \| consumer \| none` |

### 3.3 Shared form builder (`buildSkillForm` in catalog.js)

| # | Surface | Current state | Required change |
|---|---------|---------------|-----------------|
| C1 | **Owner Teams panel** | `skill-assoc-section` | Add `.skill-assoc-section--owners` styling + description |
| C2 | **Consumer Teams panel** | `skill-assoc-section--consumers` (no CSS) | Dedicated consumer styling + description |
| C3 | **NTECH path** | Owner = shift checkboxes | Rename label to “Owner shift teams”; keep consumers hidden |
| C4 | **Combobox scope** | All teams for managers | Filter options to `manager_accessible_team_ids` where applicable |
| C5 | **Validation** | ≥1 owner required | Unchanged; consumer-only saves skip owner validation |

### 3.4 Modals & flows (catalog.js + modal.js)

| Modal | Ownership UI |
|-------|----------------|
| **Create skill** | Same form; default owner = manager’s team (backend); show banner |
| **Delete skill** | Impact card lists engineer count; add owner/consumer team count |
| **Duplicate skill** | Optional confirm: shows source owners, notes no consumers |
| **Reclassify NTECH** | Existing typed confirm; mention owner team reassignment |
| **Unsaved changes** | No change |

### 3.5 Out of scope (v1 mockups note only)

| Surface | Reason |
|---------|--------|
| Skill Explorer team filter | Flat team list; no owner/consumer model |
| My Plan skill cards | Uses `is_custom` personal badge (already done) |
| Admin panel | No catalog ownership editor |

---

## 4. RBAC matrix (target UX)

| Action | Admin | Owner mgr | Consumer mgr | Engineer |
|--------|-------|-----------|--------------|----------|
| View catalog card | ✅ | ✅ | ✅ | ✅ |
| Open skill modal | ✅ | ✅ | ✅ | ✅ browse |
| Edit metadata (name, desc, icon, cats, tags, certs) | ✅ | ✅ | ❌ read-only |
| Edit 3E content | ✅ | ✅ | ❌ |
| Edit owner teams | ✅ | ✅ (scoped teams) | ❌ read-only |
| Edit consumer teams | ✅ | ✅ | ✅ own team attach/detach* |
| Delete skill | ✅ | ✅ | ❌ |
| Duplicate skill | ✅ | ✅ | ❌ |
| Card action label | Edit | Edit | **Manage access** | — |

\*Consumer manager PUT is already limited server-side to `consumer_team_ids`; UI should expose only the consumer combobox (pre-selected with their team if attached).

---

## 5. Visual design system (proposed)

### 5.1 Chip tokens

```css
/* Owner — authoritative, catalog source */
.triage-owner {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

/* Consumer — adopted / shared visibility */
.triage-consumer {
  background: transparent;
  color: var(--text-secondary);
  border: 1px dashed rgba(156, 163, 175, 0.45);
}
```

Replace current misuse of `triage-signal` (owner) and missing `triage-planned` (consumer) with explicit **owner/consumer** class names to avoid collision with plan-status semantics.

### 5.2 Association panels

| Panel | Border accent | Header |
|-------|---------------|--------|
| Owners | `--accent` left rule 3px | “Owner teams” + count badge |
| Consumers | `--text-muted` dashed left rule | “Consumer teams” + count badge |

### 5.3 Meta panel (modal header)

Two rows instead of one:

```
OWNERS     [TAC-ENT-LANSW-SHIFT2] [TAC-ENT-LANSW-SHIFT3] +1 more
CONSUMERS  [TAC-ENT-ROUT-SHIFT1] [TAC-ENT-WLAN-SHIFT2]
```

Empty consumer row: muted “None — assign consumer teams to share catalog visibility”.

### 5.4 Role badges in modal chrome

| Access | Badge near title |
|--------|------------------|
| Owner edit | (none) |
| Consumer edit | `Consumer access` pill — amber/outline |
| Browse | `View only` pill |

---

## 6. Gap analysis (current vs target)

### Already implemented ✅

- Grid card owner/consumer chip rows with labels
- Form panels: Owner Teams + Consumer Teams comboboxes
- Save payload: `owner_team_ids`, `consumer_team_ids`
- Owner-manager card actions (Edit, Delete, Duplicate)
- NTECH owner shift checkboxes
- Delete fork modal copy

### Incomplete ⚠️

1. **Modal header meta** — still merged `teams` row  
2. **Consumer manager workflow** — no UI path to edit consumer associations  
3. **Chip CSS** — `triage-planned` undefined; owner/consumer not semantically named  
4. **Consumer panel styling** — class exists, no visual differentiation  
5. **Client filters** — shift filter uses legacy `skill.teams`  
6. **Archived badge** — still in editor header  
7. **Duplicate UX** — no consumer-copy disclaimer  
8. **Combobox team scope** — shows all teams, 403 on save  

---

## 7. Implementation phases (post-approval)

### Phase 1 — Visual parity (low risk)

- Add `.triage-owner` / `.triage-consumer` CSS; update `renderTeamChipRow`  
- Split modal meta panel (Owners / Consumers)  
- Style `.skill-assoc-section--owners` / `--consumers`  
- Remove archived badge from editor  
- Duplicate/delete copy tweaks  

### Phase 2 — RBAC UX

- Add `getSkillAccessLevel()` shared helper (mirror backend)  
- Consumer manager: **Manage access** button → editor Details tab, consumer panel only  
- Disable owner fields + content tab for consumer-only  
- Filter combobox options to accessible teams  

### Phase 3 — Filter correctness

- Shift/org client filters use owner ∪ consumer team sets  
- Optional sidebar filter legend  

**Estimated touch files:** `catalog.js`, `catalog-skill-editor.js`, `style.css` (~120–180 lines CSS, ~200 lines JS).

---

## 8. Mockup index

Open [`catalog-ownership-ui-mockup.html`](catalog-ownership-ui-mockup.html) and review tabs:

| Tab | Shows |
|-----|-------|
| **1 — Grid cards** | Owner/consumer chip rows, role legend, card actions by role |
| **2 — Modal meta** | Split header rows, empty consumer state |
| **3 — Owner edit** | Full Details tab, both association panels |
| **4 — Consumer edit** | Locked metadata, editable consumer panel only |
| **5 — Create skill** | Default owner team banner |
| **6 — Delete / Duplicate** | Updated confirm copy |
| **7 — Engineer browse** | Read-only modal, no actions |

Toggle **Light / Dark** and **Role** (Owner mgr / Consumer mgr / Engineer) in mockup chrome.

---

## 9. Approval checklist

Before implementation, confirm:

- [ ] Owner vs consumer chip visual language (solid accent vs dashed outline)  
- [ ] Consumer manager **Manage access** vs full **Edit** label  
- [ ] Modal meta: two rows vs single row with inline prefixes (current cards use prefixes)  
- [ ] Whether consumer managers may attach teams outside their own (backend: own team only)  
- [ ] Remove archived badge everywhere in catalog  
- [ ] Duplicate disclaimer toast vs inline modal step  

---

## 10. File reference map

| File | Role |
|------|------|
| `frontend/js/pages/catalog.js` | Grid, form, delete/duplicate, `canEditCatalogSkill`, `renderTeamChipRow` |
| `frontend/js/components/catalog-skill-editor.js` | Modal shell, meta panel, save/RBAC |
| `frontend/js/components/combobox-multi.js` | Team pickers |
| `frontend/css/style.css` | Chips, assoc panels, meta rows |
| `backend/app/services/skill_ownership.py` | Authoritative RBAC rules |
