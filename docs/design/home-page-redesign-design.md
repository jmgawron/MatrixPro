# MatrixPro Home Page — Redesign Concepts

**Status:** Mockups for review (not implemented)  
**Interactive preview:** `docs/design/home-page-redesign-mockups.html`  
**Current production:** `frontend/js/pages/home.js` + `style.css` § Home Page

---

## Current state (baseline)

The live home page is a **centered hero stack**:

- Brand tile + “MatrixPro” wordmark  
- Headline + gradient subtitle  
- Three animated stat counters (Engineers / Teams / Skills)  
- Primary + secondary CTA  
- Full-width **3E philosophy** card grid below the fold  

**Strengths:** Clear messaging, on-brand Cisco blue accent, 3E story is well explained.  
**Gaps:** Feels like a marketing landing page rather than an **operational TAC workspace**; stats and CTAs compete vertically; no quick paths to core modules; limited visual hierarchy below the hero.

---

## Design goals

| Goal | Rationale |
|------|-----------|
| **Professional enterprise tone** | TAC engineers expect tooling, not a generic SaaS splash |
| **Action-oriented** | Surface My Plan, Catalog, Team Matrix, Explorer immediately |
| **Retain 3E story** | Education · Exposure · Experience remains the product philosophy |
| **Design system parity** | Glass cards, tokens, dark-first — align with My Plan / Catalog modals |
| **Role-aware** | Engineer vs manager vs admin see relevant shortcuts (mockups show engineer view) |

---

## Concept A — Command Center *(preferred direction)*

**Tagline:** *Split hero + activity feed*

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Nav                                                        │
├──────────────────────────┬──────────────────────────────────┤
│  Hero copy + CTAs        │  Quick updates & news (feed)     │
│  Plan status strip       │  · last login                    │
│  (developing / planned / │  · stalled skills                │
│   mastered counts)       │  · recently updated skills       │
│                          │  · recently updated skills       │
│                          │  · team matrix changes           │
│                          │  · manager message (future)      │
├──────────────────────────┴──────────────────────────────────┤
│  3E timeline (book / globe / star icons in circles)         │
└─────────────────────────────────────────────────────────────┘
```

### Why it works

- **Left = narrative** (“Your skills. Your plan. Your growth.” + career-growth description), **right = personalized activity**  
- **Plan status strip** shows the signed-in engineer’s **In development / Planned / Mastered** counts (not org-wide stats)  
- **Quick actions removed** — CTAs in hero are sufficient; nav covers module access  
- 3E uses **production grid icons** (Education book, Exposure globe, Experience star) inside timeline circles  
- **News feed** consolidates disparate signals engineers care about on login  

### Quick updates & news (mock content types)

| Type | Example | Data source (future) |
|------|---------|----------------------|
| Last login | Today · 9:14 AM | Auth session / audit |
| Stalled skill | No activity in 62 days | Plan activity + stagnation logic |
| Recently updated | Training log / catalog version bump | Plan logs + skill `catalog_version` |
| Team matrix | Skill added / status changed | Team matrix audit / change logs |
| Manager message | Note from alice@ | **Future feature** — dashed badge in mockup |

### Best for

Teams who want the home page to feel like a **mission control** entry point with situational awareness.

### Implementation notes

- Reuse `stats-row` / `stat-block` with new wrapper classes; wire to `GET /api/plans/{engineer_id}` status counts  
- News panel: static v1 → aggregate from existing audit/activity endpoints later  
- Manager messages: placeholder UI only until messaging feature exists  
- 3E icons: same SVGs as `home.js` `THREE_E_CARDS`  

---

## Concept B — Bento Dashboard

**Tagline:** *Modern glass grid — asymmetric, high visual density*

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Nav                                                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┬────────┐ ┌────────┐ ┌────────┐   │
│  │  Hero (2×2)          │ Eng 48 │ │Team 84 │ │Skill 70│   │
│  │  Welcome + CTAs      ├────────┴─┴────────┴─┴────────┘   │
│  │                      │  My Plan tile (featured)          │
│  ├──────────┬───────────┼──────────┬──────────┬───────────┤ │
│  │ Catalog  │ My Team   │ Explorer │ Reporting│ Admin*    │ │
│  ├──────────┴───────────┴──────────┴──────────┴───────────┤ │
│  │  3E bento cards (Education | Exposure | Experience)      │ │
│  └─────────────────────────────────────────────────────────┘ │
```

### Why it works

- **Bento grid** is familiar from modern enterprise dashboards (Apple, Linear, Vercel)  
- Stats become **first-class tiles** instead of secondary text  
- Every major module gets an **icon tile** with hover affordance  
- Mesh gradient background adds depth without clutter  

### Best for

Maximum **visual impact** and parity with the glassmorphism used elsewhere in MatrixPro.

### Implementation notes

- CSS Grid with `grid-template-areas` — responsive collapse to single column < 1024px  
- Featured “My Plan” tile can show real progress later (`GET /api/plans/{id}`)  
- Heaviest CSS surface area of the three concepts  

---

## Concept C — Editorial Executive

**Tagline:** *Restrained typography, whitespace, premium corporate*

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Nav                                                        │
├─────────────────────────────────────────────────────────────┤
│              [pill] TAC Skill Development                   │
│         Skill development, measured in mastery.             │
│              subcopy (single line, muted)                   │
│         [ Primary CTA ]  [ Secondary ]                      │
│    48 engineers · 84 teams · 70 skills  (inline meta)       │
├─────────────────────────────────────────────────────────────┤
│  ── Explore ─────────────────────────────────────────────   │
│  [ My Plan ]  [ Catalog ]  [ My Team ]  [ Explorer ]        │
├─────────────────────────────────────────────────────────────┤
│  THE 3E MODEL                                               │
│  01 Education ─── 02 Exposure ─── 03 Experience             │
│  (horizontal steps + short copy, no heavy cards)            │
└─────────────────────────────────────────────────────────────┘
```

### Why it works

- **Minimal decoration** — confidence through typography  
- Stats as **inline metadata** (like a report header) feel executive-grade  
- 3E as **numbered steps** reduces card fatigue  
- Fastest to implement; lowest risk to existing CSS  

### Best for

Stakeholders who prefer **clarity over chrome**, or constrained maintenance bandwidth.

---

## Comparison matrix

| Criterion | A Command Center | B Bento | C Editorial |
|-----------|------------------|---------|-------------|
| Visual impact | ★★★★ | ★★★★★ | ★★★ |
| Implementation effort | Medium | High | Low |
| Module discoverability | ★★★★ (via nav + CTAs) | ★★★★★ | ★★★★ |
| 3E storytelling | Timeline | Card grid | Step strip |
| Mobile responsiveness | Good | Needs care | Excellent |
| Matches glass modal system | ★★★★ | ★★★★★ | ★★★ |

---

## Recommended path

1. **Review mockups** in browser (`python3 -m http.server` from `docs/design/`)  
2. **Pick a direction** (or hybrid: e.g. Bento stats + A’s snapshot panel)  
3. **Phase 1:** Hero + quick actions + stats (no live snapshot)  
4. **Phase 2:** Role-aware tiles + optional progress widget  
5. **Phase 3:** Wire snapshot / “continue where you left off” from API  

---

## Preview

```bash
cd docs/design && python3 -m http.server 8767
# → http://localhost:8767/home-page-redesign-mockups.html
```

Use the concept tabs and theme toggle in the mockup chrome to compare all three options in dark and light mode.
