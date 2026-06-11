# MatrixPro — Application Review (2026-06-11)

Scope: full frontend (all pages, components, CSS), backend (ruff lint + test suite), repo/operational hygiene.
Status: **4 fixes applied during the review** (marked ✅). Everything else is a recommendation, ordered by priority.

---

## Fixed during this review ✅

1. **Stale cache-bust versions** — `index.html` still shipped `style.css?v=116` and `app.js?v=94` despite the extensive
   CSS/JS changes of recent sessions; returning users would have kept the old styles indefinitely.
   Bumped to `v=117` / `v=95`. *Process recommendation: bump these in the same commit as any CSS/JS change, or derive
   the version at build/deploy time.*

2. **Class-name bug in `catalog.js`** — `renderTeamChipRow()` had default `chipClass: 'triage-signal'`, which the
   template then expanded to `triage-triage-signal` (a class that styles nothing). No current caller hit the default,
   but it was a trap. Default corrected to `'signal'`.

3. **Backend lint (25 of 31 ruff findings auto-fixed)** — 22 unused imports and 3 placeholder-less f-strings removed.
   Test suite re-run after the fix: **88 passed, 1 xfailed** — green.

4. *(Verified non-issue)* `form-textarea` / `form-control` / several other classes referenced in JS have no CSS rules,
   but all inputs are styled by element-level selectors — purely cosmetic naming inconsistency, no visual defect.

---

## High priority

5. **FastAPI lifecycle deprecation** — `backend/app/main.py` uses `@app.on_event("startup")` (and shutdown).
   Deprecated since FastAPI 0.103; will be removed. Migrate to the `lifespan` context-manager pattern.

6. **Remaining 6 ruff findings (manual):**
   - 2× `E712`: `Skill.is_custom == True` / `UserContentOverride.is_active == True` — in SQLAlchemy filters use
     `.is_(True)` to keep intent explicit and silence the linter correctly.
   - 3× `F841` unused locals (`spec`, `item_type`, `existing_consumers`) — likely leftovers of removed logic; verify
     nothing was meant to use them, then delete.
   - 1× `E731` lambda assignment → `def`.

7. **Slow load test in the default suite** — `tests/test_search_load.py` generates 100k items and runs minutes-long in
   the standard `pytest` invocation (everything else finishes in ~13s). Mark it `@pytest.mark.slow` and exclude by
   default (`-m "not slow"`), running it in a dedicated CI stage.

## Medium priority

8. **Dead code in `catalog.js` (~120 lines)** — after the V5 card redesign, `renderTeamChipRow`,
   `renderTeamChipRowEmpty` and `renderConsumerChipRow` have no callers anywhere (the first two are exported but no
   module imports them). Safe to delete along with their export entries.

9. **Dead data in `my-plan.js`** — `SECTIONS[].iconClass` fields (`mp-card-icon--dev/pipe/prof`) reference CSS classes
   that no longer exist after the V5 card redesign. Harmless, but misleading.

10. **`btn-ghost` class** (catalog card action buttons) has no CSS definition — buttons render fine via the other
    classes, but either add the ghost variant or drop the token from the class string.

11. **`style.css` is a 15,800-line monolith** — repeated section numbers (§7.21 appears 3×, §7.22 2×) already show the
    navigation cost. Recommend splitting into per-module files (tokens, base, nav, cards, my-plan, catalog, my-team,
    modals, home, admin) with a tiny build step or `@import` layer — this was the root cause of several "leftover rule"
    bugs found in earlier sessions (bluish card gradient, category-header gradient, inline chip tab-style).

## Low priority / hygiene

12. **Repo root clutter** — a dozen one-off status documents (`DEPLOYMENT_COMPLETE.md`, `SESSION_SUMMARY.md`,
    `SEARCH_*` etc.) plus `.playwright-mcp/` (~660 trace dirs), `.logs/`, `tmp/`. None are git-tracked beyond the docs,
    but moving reports to `docs/archive/` and ignoring the tool dirs would clean the tree.
    Git hygiene is otherwise good: no `venv`/`__pycache__`/`.pyc` tracked, `.env` correctly ignored.

13. **Security posture (positive)** — `config.py` refuses known-insecure JWT secrets; bcrypt for passwords; 401
    handling in `api.js` debounces the login redirect properly. No bare `except: pass` patterns found in the backend.

14. **Test depth note** — frontend has no automated tests; the suite is backend-only. Given the recent visual refactors
    were the main bug source, even a small Playwright smoke pack (login → each module renders → toggle theme) would
    catch class/markup regressions cheaply. (Playwright traces in the repo suggest it was used manually before.)

---

### Verification summary
- `node --check` on all 20 frontend JS files: clean
- 765 class references cross-checked against CSS: 32 intentional/no-op, 0 visual breaks
- No duplicate DOM ids, no `console.log` leftovers, no TODO/FIXME debt markers
- Backend: ruff clean except 6 manual items above; tests 88 passed / 1 xfailed after fixes
