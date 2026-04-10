# MatrixPro — Application Requirements

**Version 1.1 · Developer Reference**

---

## Table of Contents

1. [Overview](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#1-overview)
2. [Core Concept: Skills](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#2-core-concept-skills)
3. [Modules](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#3-modules)
    - 3.1 [Start Page](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#31-start-page)
    - 3.2 [My Plan](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#32-my-plan)
    - 3.3 [My Team](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#33-my-team)
    - 3.4 [Catalog Explorer](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#34-catalog-explorer)
    - 3.5 [Skill Explorer](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#35-skill-explorer)
4. [Data Model](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#4-data-model)
5. [Authentication & Roles](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#5-authentication--roles)
6. [UI & UX Requirements](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#6-ui--ux-requirements)
7. [Design System](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#7-design-system)
8. [Additional Requirements](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#8-additional-requirements)

---

## 1. Overview

MatrixPro is a corporate web application designed to help TAC Engineers and their managers collaboratively build, track, and manage individual skill development plans. The application provides visibility into skill development at the individual, team, and organisational level.

The application is built around a modular architecture — each module can be developed and deployed incrementally — and enforces role-based access control across all views and actions.

---

## 2. Core Concept: Skills

Skills are the fundamental data entity across all modules.

### 2.1 Skill Catalog

- Skills are defined in a global skill catalog, organised hierarchically: **Organisation → Domain → Team**.
- A skill can be associated with multiple teams (many-to-many relationship).
- Each skill record includes: name, description, domain, associated team(s), proficiency-level metadata, and linked training resources for each proficiency level following the 3E Framework (see Section 2.2).

### 2.2 Proficiency Levels — The 3E Framework

Each skill supports three ordered proficiency levels. The framework is progressive — an engineer is expected to complete each level in sequence before advancing to the next, moving from theoretical knowledge through to applied mastery.

|Level|Name|Definition|
|---|---|---|
|1|**Education**|The engineer is actively seeking learning opportunities (courses, reading, training materials). No hands-on experience yet.|
|2|**Exposure**|The engineer has completed foundational education and is seeking practical application opportunities.|
|3|**Experience**|The engineer is proficient and deepening expertise through real-world practice and applied work.|

Each proficiency level may include associated metadata:

- Recommended courses, training materials, and certifications.
- Links to external resources.
- Suggested actions to help the engineer complete and progress past that level.

---

## 3. Modules

### 3.1 Start Page

The Start Page is the application entry point and primary navigation hub.

#### Content & Layout

- Displays the MatrixPro logo and branding prominently.
- A **summary statistics grid** displays live system metrics in card form:
    - Total number of engineers in the system.
    - Total number of teams.
    - Total number of skills in the catalog.
- Provides navigation links to all modules the authenticated user has access to, governed by the user's role (see [Section 5: Authentication & Roles](https://claude.ai/chat/f436b0dc-4cf5-4c58-a38c-cfcf497c07a2#5-authentication--roles)).

#### Visual Design

- The page has a visually striking, modern aesthetic appropriate for a corporate product.
- Background uses a **multi-stop gradient** (e.g., deep navy to mid-blue or indigo to teal), lending depth without being distracting.
- Navigation module cards are displayed in a responsive grid, each with:
    - A representative **icon** (e.g., from Lucide or Heroicons).
    - Module name and a one-line description.
    - A subtle hover state: card lift via `box-shadow` transition + slight `translateY(-2px)`.
- Stat cards use a **glassmorphism** treatment — semi-transparent frosted background (`backdrop-filter: blur(12px)`) with a light border — overlaid on the gradient background.
- Stat values animate in on page load using a **count-up effect**.
- Typography on the Start Page is larger and more expressive than the rest of the application to reinforce the landing-page feel.

---

### 3.2 My Plan

My Plan allows an individual engineer to view and manage their personal skill development plan.

#### Skill Categories

The page is divided into **three primary sections**, displayed as distinct visual panels:

- **In Development** — skills the engineer is currently actively working on.
- **In Pipeline** — skills queued for future development but not yet started.
- **Proficiency** — skills that have been fully developed and are associated with the engineer's profile.

#### Skill Population

- An engineer's plan is initially pre-populated with the skills associated with their assigned team.
- Engineers can browse the global Skill Catalog and add skills from any domain to their personal plan.
- Skills added manually are created with a default status of **In Pipeline** unless explicitly set otherwise.

#### Skill Editing

Engineers can edit individual skill entries on their plan. Editable fields include:

- Current proficiency level (Education / Exposure / Experience).
- Development status (In Development / In Pipeline / Proficiency).
- Personal notes or commentary.
- Log of completed courses or training activities.
- Any additional metadata fields associated with the skill.

> **Note:** All edits to a development plan must be recorded in the audit trail with a UTC timestamp and the identity of the user who made the change.

#### Visual Design

- Each skill is rendered as a **card** within its respective section column.
- Cards display: skill name, current proficiency level badge, last-updated date, and a quick-action menu (edit, move, remove).
- **Proficiency level badges** use colour-coded pill/tag components consistent with the matrix colour scheme (see Section 3.3).
- The three-section layout uses a **kanban-style** arrangement, supporting drag-and-drop to move skills between categories.
- Section headers show a **count indicator** (e.g., "In Development · 4") that updates in real time as cards are moved.
- Skill cards expand inline (accordion or slide-down) when clicked to show full details and the edit form, rather than navigating away.

---

### 3.3 My Team

My Team provides a manager's aggregated view of the development plans for all direct reports.

#### Team Skills Matrix

The primary view is a two-dimensional matrix:

- **Columns (X-axis):** All skills associated with the manager's team (i.e., skills defined at the team level — not skills individually added by engineers to their personal plans).
- **Rows (Y-axis):** Each engineer reporting to the manager.
- **Cell (intersection):** A colour-coded indicator of the engineer's status for that skill.

Colour coding scheme:

|Colour|Status|Meaning|
|---|---|---|
|White|In Pipeline|Skill is queued but not yet started.|
|Black|Not in Plan|Skill is not in the engineer's pipeline or active development.|
|Light green|Education (Level 1)|Engineer is at the Education proficiency level.|
|Medium green|Exposure (Level 2)|Engineer is at the Exposure proficiency level.|
|Dark green|Experience (Level 3)|Engineer is at the Experience proficiency level.|

#### Engineer Drill-Down

- Double-clicking an engineer's name (or row) in the matrix navigates the manager to that engineer's **My Plan** view.
- The manager can edit the individual engineer's plan, subject to the constraint that they can only edit plans of engineers who directly report to them. Each engineer has exactly one manager.
- The manager's view of an engineer's plan must visually indicate it is being viewed in a managerial context (e.g., a persistent banner displaying the engineer's name and a "Viewing as manager" label).

> **Note:** Managers must not be able to edit plans of engineers outside their direct reporting chain, even if they can navigate to them via other routes.

#### Visual Design

- The matrix must support **sticky row and column headers** so that engineer names and skill names remain visible when scrolling in either direction across a large dataset.
- Matrix cells display a **tooltip on hover** showing: engineer's name, skill name, current status, and proficiency level.
- Column (skill) headers support a **filter control** to narrow the matrix to a subset of skills.
- A **colour legend** for the scheme is always visible on the page (e.g., a pinned key in the top-right corner of the matrix).
- Row highlighting on hover improves readability across wide matrices.

---

### 3.4 Catalog Explorer

The Catalog Explorer provides a browsable and searchable view of all skills available in the organisation.

#### Browsing & Structure

- Skills are organised hierarchically: **Organisation → Domain → Team**.
- Users can browse existing skills and view their full 3E proficiency-level details and associated resources.
- A dedicated **"Future Skills"** section displays suggested or emerging skills the organisation is considering adopting.

#### Search & Filtering

- Full-text search by skill name, description, or tag.
- Filter by domain, team, or proficiency-level availability.
- Tagging support for ad-hoc categorisation.

#### Admin Capabilities

Users with the **Admin** role have additional editing privileges within the Catalog Explorer:

- Create and edit the catalog structure: organisations, domains, and teams.
- Create, edit, and archive individual skill records.
- Assign skills to one or more teams.
- Manage the Future Skills section (add, promote to active, or remove entries).

> **Note:** Skill deletion should be soft-deleted (archived) rather than hard-deleted if the skill is referenced in any active development plan, to preserve data integrity.

> **Note:** When a skill's definition or associated resources are updated in the catalog, the change is **not** automatically pushed to engineers who already have that skill on their plan. Updated content is reflected only if the engineer removes and re-adds the skill.

#### Visual Design

- The hierarchy (Organisation → Domain → Team) is presented as a **collapsible sidebar tree** with expand/collapse controls at each level.
- Skills within a selected node are displayed as a **card grid** in the main content area, each showing: skill name, domain, assigned teams, and a proficiency-level availability indicator.
- The Future Skills section uses a distinct accent colour or a "future" badge on cards to differentiate it visually.
- Admin edit controls (edit icon, archive button, assign-to-team) appear **on card hover** rather than cluttering the default view.

---

### 3.5 Skill Explorer

The Skill Explorer enables users to find engineers across the organisation based on their skills and proficiency levels. It is primarily useful for staffing decisions, knowledge sharing, and mentorship matching.

#### Search

- Search engineers by skill name, proficiency level, or domain.
- Results return a list of engineers who have the relevant skill on their profile, along with their current proficiency level and status.

#### Cross-Team Skill Comparison

When a user selects a set of skills from a team other than their own, the application supports a comparison workflow:

- Display a side-by-side comparison of: (a) the selected skill set from the external team, and (b) the skills currently assigned to the user's own team.
- Calculate and display the **percentage overlap** between the two sets.
- List the skills unique to each set (i.e., skills present in one but absent in the other).

#### Importing Skills

- From the comparison view, engineers and managers can select individual skills from the external team's set and add them directly to a development plan.
- Imported skills are added at **In Pipeline** status by default, unless an existing record already exists.
- Skill import must respect standard edit permissions — engineers can import to their own plan; managers can import to their direct reports' plans.

#### Visual Design

- The comparison view uses a **split-panel layout**: the left panel shows the external team's skills and the right panel shows the user's own team's skills.
- Overlapping skills are **highlighted** with a shared accent colour to make the overlap immediately legible.
- The percentage overlap is displayed as a large **circular progress indicator** at the top of the comparison view.
- Skills available to import are shown with a clearly labelled **"+ Add to My Plan"** action button.

---

## 4. Data Model

The application uses a relational data model. Entities are grouped below by concern.

### 4.1 Organisational Structure

|Entity|Key Fields|Notes|
|---|---|---|
|`organisations`|`id`, `name`, `created_at`|Top level of the catalog hierarchy|
|`domains`|`id`, `name`, `organisation_id`, `created_at`|Belongs to one organisation|
|`teams`|`id`, `name`, `domain_id`, `created_at`|Belongs to one domain|
|`users`|`id`, `name`, `email`, `role`, `team_id`, `manager_id`, `created_at`|`role`: `engineer \| manager \| admin`. Each engineer has exactly one manager (`manager_id` → `users.id`).|

### 4.2 Skill Catalog

|Entity|Key Fields|Notes|
|---|---|---|
|`skills`|`id`, `name`, `description`, `domain_id`, `is_future`, `is_archived`, `catalog_version`, `updated_at`, `created_at`|`catalog_version` increments on each edit; used to detect whether a plan's copy of the skill is stale. Many-to-many with teams.|
|`skill_teams`|`skill_id`, `team_id`|Join table for skill–team association.|
|`tags`|`id`, `name`|Global tag registry for catalog search and filtering.|
|`skill_tags`|`skill_id`, `tag_id`|Join table for skill–tag association.|
|`skill_level_content`|`id`, `skill_id`, `level`, `type`, `title`, `description`, `url`, `created_at`|Stores all per-level metadata for a skill. `level`: `1 \| 2 \| 3` (Education / Exposure / Experience). `type`: `course \| certification \| reading \| link \| action`. Rows with `type = action` represent suggested activities to complete that level.|

### 4.3 Development Plans

|Entity|Key Fields|Notes|
|---|---|---|
|`development_plans`|`id`, `engineer_id`, `created_at`|One plan per engineer.|
|`plan_skills`|`id`, `plan_id`, `skill_id`, `status`, `proficiency_level`, `notes`, `skill_version_at_add`, `added_at`, `updated_at`|`status`: `in_development \| in_pipeline \| proficiency`. `skill_version_at_add` stores the value of `skills.catalog_version` at the time the skill was added, enabling the UI to flag when the catalog definition has since been updated.|
|`plan_skill_training_log`|`id`, `plan_skill_id`, `title`, `type`, `completed_at`, `notes`|Records individual training activities or actions completed by the engineer against a skill. `type` mirrors `skill_level_content.type`.|

### 4.4 Audit

|Entity|Key Fields|Notes|
|---|---|---|
|`audit_log`|`id`, `entity_type`, `entity_id`, `changed_by`, `changed_at`, `field`, `old_value`, `new_value`|Tracks all writes to development plans and the skill catalog. `changed_by` → `users.id`. Viewable by admins and by managers scoped to their direct reports.|

### 4.5 Key Relationships Summary

```
organisations  ──< domains ──< teams ──< users
                                  │
                            skill_teams >──< skills ──< skill_level_content
                                                  │
                                              skill_tags >──< tags

users ──── development_plans ──< plan_skills ──< plan_skill_training_log
```

> **Soft delete:** Skills referenced by any `plan_skills` row must not be hard-deleted. Set `is_archived = true` instead. Archived skills remain visible on existing plans but are hidden from the catalog browse and cannot be added to new plans.

---

## 5. Authentication & Roles

The application enforces role-based access control (RBAC). Permissions are defined per role as follows:

|Role|Permissions|
|---|---|
|**Engineer**|View and edit own development plan. Browse the Skill Catalog and Skill Explorer. Add skills from the catalog to own plan.|
|**Manager**|All Engineer permissions. View the My Team matrix for direct reports. View and edit development plans of direct reports only. Cannot edit plans of engineers outside their direct reporting chain.|
|**Admin**|All Manager permissions. Create and manage the catalog structure (organisations, domains, teams). Create, edit, and archive skills. Assign skills to teams. Assign roles to users. Manage team membership and reporting structure.|

> **Note:** All role-based permission checks must be enforced server-side. Client-side UI restrictions alone are not sufficient.

---

## 6. UI & UX Requirements

- Clean, professional corporate design consistent with enterprise application conventions.
- Responsive layout optimised for desktop use (minimum supported viewport: **1280px wide**).
- Consistent top-level navigation accessible from all modules, adapted per user role.
- Dashboard-style views using cards, tables, and progress indicators where appropriate.
- The team skills matrix must handle both horizontal and vertical scrolling gracefully at scale.
- All destructive or irreversible actions must require an explicit confirmation step (modal dialog, not browser `confirm()`).
- Loading states and error states must be handled explicitly for all asynchronous data fetches.
- Empty states (e.g., a plan with no skills yet) must display a helpful prompt or call-to-action rather than a blank area.

---

## 7. Design System

MatrixPro uses the **Sherlock / GenAI-Wireless design system** — a dark-first, glassmorphism-accented system built entirely on CSS custom properties. All UI must be implemented in pure HTML + CSS + JS with no build step or CSS framework dependency.

---

### 7.1 Theming

The application defaults to **dark mode**. A theme toggle in the navigation bar switches to light mode by setting `data-theme="light"` on `<body>` and persisting the preference to `localStorage`.

```css
/* Dark theme (default — :root) */
:root {
    --bg-page:         #0d1117;
    --bg-page-overlay: #111827;
    --bg-panel:        #11161f;
    --bg-card:         #161d29;
    --bg-card-soft:    #1a2230;
    --bg-elevated:     #1f2937;
    --bg-input:        #0f1723;
    --text-primary:    #e6edf3;
    --text-secondary:  #b9c6d8;
    --text-muted:      #8aa0bd;
    --border-strong:   #2e3d55;
    --border-soft:     #273549;
    --accent:          #3b82f6;
    --accent-strong:   #2563eb;
    --accent-soft:     rgba(59,130,246,.15);
    --success:         #22c55e;
    --warning:         #f59e0b;
    --info:            #06b6d4;
    --purple:          #a855f7;
    --danger:          #ef4444;
    --radius-sm:       6px;
    --radius-md:       10px;
    --radius-lg:       14px;
    --shadow-lg:       0 16px 44px rgba(0,0,0,.4);
    --shadow-md:       0 6px 20px rgba(0,0,0,.28);
    --shadow-sm:       0 2px 8px rgba(0,0,0,.18);
    --transition:      .2s ease;
    --nav-h:           60px;
}

/* Light theme override */
[data-theme="light"] {
    --bg-page:         #eef3f9;
    --bg-page-overlay: #e5edf7;
    --bg-panel:        #f5f8fc;
    --bg-card:         #ffffff;
    --bg-card-soft:    #eef4fb;
    --bg-elevated:     #f0f5fc;
    --bg-input:        #ffffff;
    --text-primary:    #0f172a;
    --text-secondary:  #334155;
    --text-muted:      #64748b;
    --border-strong:   #b7c7dd;
    --border-soft:     #cfdaea;
    --accent-soft:     rgba(59,130,246,.1);
    --shadow-lg:       0 14px 34px rgba(15,23,42,.13);
    --shadow-md:       0 5px 16px rgba(15,23,42,.1);
    --shadow-sm:       0 2px 6px rgba(15,23,42,.06);
}
```

### 7.2 Background Treatment

The page background uses fixed radial gradients to create visual depth across all scrolling content:

```css
body {
    background-color: var(--bg-page);
    background-image:
        radial-gradient(1200px 600px at 0% 0%, rgba(59,130,246,.12), transparent 55%),
        radial-gradient(1000px 500px at 100% 0%, rgba(16,185,129,.08), transparent 60%);
    background-repeat: no-repeat;
    background-attachment: fixed;
}
[data-theme="light"] body {
    background-image:
        radial-gradient(1200px 600px at 0% 0%, rgba(59,130,246,.09), transparent 55%),
        radial-gradient(1000px 500px at 100% 0%, rgba(16,185,129,.05), transparent 60%);
}
```

### 7.3 Layout & Spacing

- Page content max-width: **1200px**, centred with `padding: 0 24px`.
- Section vertical padding: **80px top/bottom** (`padding: 80px 0`).
- Base spacing unit: **4px**. All spacing values are multiples thereof.
- Grid system: `.grid-4`, `.grid-3`, `.grid-2` (CSS Grid, `gap: 14–20px`).

**Responsive breakpoints:**

|Breakpoint|Changes|
|---|---|
|≤ 1024px|`.grid-4` → 3 columns|
|≤ 860px|`.grid-3` → 2 columns, `.grid-4` → 2 columns, nav links hidden → hamburger|
|≤ 640px|All grids → 1 column, hero padding reduced|

### 7.4 Navigation

Sticky top navigation with glassmorphism background, pill-shaped active states, theme toggle, and mobile hamburger.

```css
.site-nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(17,22,31,.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-soft);
    height: var(--nav-h);
}
[data-theme="light"] .site-nav { background: rgba(245,248,252,.92); }

/* Active / hover nav link */
.nav-links a { padding: 8px 14px; border-radius: 999px; font-weight: 600; color: var(--text-secondary); transition: all var(--transition); }
.nav-links a:hover, .nav-links a.active { color: var(--text-primary); background: var(--accent-soft); }
.nav-links a.active { color: var(--accent); }
```

- At `≤ 860px`: `.nav-links` hides; hamburger reveals a `.mobile-menu` slide-in panel.
- Theme toggle button shows 🌙 (dark) / ☀️ (light); preference saved to `localStorage`.

### 7.5 Typography

|Style|Size|Weight|Usage|
|---|---|---|---|
|Hero title|`clamp(36px, 5vw, 56px)`|800|Start Page main heading|
|Section title|32px|700|Module page titles|
|Subsection|24px|700|Section headers within pages|
|Card title|18–20px|700|Card and collapsible headers|
|Body|16px|400|Content paragraphs (line-height: 1.7)|
|Label / tag|12–13px|700|Badges, table headers, category chips|
|Caption|13–14px|400|Metadata, timestamps, muted text|

- `--text-primary` for headings and emphasis; `--text-secondary` for body; `--text-muted` for captions.
- `--accent` (`#3b82f6`) for eyebrow labels, active states, and interactive highlights.
- All text must meet **WCAG AA contrast** against its background token.

### 7.6 Cards

#### Standard Cards (module feature cards, My Plan skill cards)

Colour-coded top border with four variants — assign based on skill domain or content type:

```css
.card {
    background: linear-gradient(180deg, rgba(22,29,41,.94), rgba(18,24,35,.96));
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-md);
    transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
}
[data-theme="light"] .card {
    background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(244,248,253,.98));
}
.card:hover { transform: translateY(-3px); border-color: rgba(96,165,250,.55); box-shadow: var(--shadow-lg); }

/* Top-border colour variants */
.card--green  { border-top: 3px solid rgba(34,197,94,.5); }   /* Education / In Development */
.card--amber  { border-top: 3px solid rgba(245,158,11,.5); }  /* In Pipeline / Warning */
.card--cyan   { border-top: 3px solid rgba(6,182,212,.5); }   /* Exposure / Info */
.card--purple { border-top: 3px solid rgba(168,85,247,.5); }  /* Experience / Proficiency */
```

#### Gate Cards (skill detail highlights, notes, constraints)

Left-accent border for decision items or contextual callouts:

```css
.gate-card {
    background: var(--bg-card);
    border: 1px solid var(--border-soft);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 22px 24px;
    margin-bottom: 16px;
    transition: all var(--transition);
}
.gate-card:hover { border-left-color: #93c5fd; box-shadow: var(--shadow-sm); }
```

Use `style="border-left-color: var(--success|--warning|--info|--purple|--danger)"` for status-specific colours.

#### Tool Cards (Catalog Explorer skill items)

```css
.tool-card {
    background: var(--bg-card);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 16px;
    transition: all var(--transition);
}
.tool-card:hover { transform: translateY(-2px); border-color: rgba(96,165,250,.5); box-shadow: var(--shadow-md); }
```

#### Glassmorphism Cards (Start Page stat cards only)

```css
background:      rgba(255, 255, 255, 0.10);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border:          1px solid rgba(255, 255, 255, 0.20);
border-radius:   var(--radius-lg);
```

### 7.7 Buttons

```css
.btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all var(--transition); }

/* Primary — gradient fill */
.btn-primary {
    background: linear-gradient(135deg, rgba(37,99,235,.9), rgba(29,78,189,.95));
    border: 1px solid rgba(96,165,250,.55);
    color: #eaf3ff;
    box-shadow: 0 6px 18px rgba(0,0,0,.28);
}
.btn-primary:hover { transform: translateY(-2px); border-color: rgba(125,190,255,.7); box-shadow: 0 10px 24px rgba(15,53,97,.35); }

/* Secondary — surface fill */
.btn-secondary { background: var(--bg-card); border: 1px solid var(--border-strong); color: var(--text-primary); }
.btn-secondary:hover { transform: translateY(-2px); border-color: var(--accent); color: var(--accent); }
```

- Danger actions use `background: rgba(239,68,68,.15); color: #f87171; border: 1px solid rgba(239,68,68,.3)` — the same pattern as triage chips (see 7.8).
- Focus ring: `outline: 2px solid var(--accent)`, `outline-offset: 2px`.

### 7.8 Proficiency & Status Chips

All status indicators use the **triage chip** pattern: pill shape, semi-transparent colour background, coloured text, and a matching border.

```css
.triage-chip {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
}
```

**Proficiency level mapping:**

|Level / Status|Class|Background|Text|Border|
|---|---|---|---|---|
|Education (1)|`chip-education`|`rgba(34,197,94,.12)`|`#4ade80`|`rgba(34,197,94,.25)`|
|Exposure (2)|`chip-exposure`|`rgba(6,182,212,.12)`|`#22d3ee`|`rgba(6,182,212,.25)`|
|Experience (3)|`chip-experience`|`rgba(168,85,247,.12)`|`#c084fc`|`rgba(168,85,247,.25)`|
|In Pipeline|`chip-pipeline`|`rgba(245,158,11,.12)`|`#fbbf24`|`rgba(245,158,11,.25)`|
|Proficiency|`chip-proficiency`|`rgba(34,197,94,.15)`|`#4ade80`|`rgba(34,197,94,.30)`|

These tokens must be applied consistently across: My Plan skill cards, My Team matrix tooltips, Skill Explorer results, and the Catalog Explorer skill cards.

### 7.9 My Team Matrix Colour Cells

Matrix cells use background fill (not chips) for compact display at scale. The fills map directly to the proficiency colours:

|Status|Cell background|
|---|---|
|Not in Plan|`var(--bg-elevated)` (near-black in dark mode)|
|In Pipeline|`var(--bg-card-soft)` with amber border tint|
|Education|`rgba(34,197,94,.18)` — light green|
|Exposure|`rgba(34,197,94,.42)` — medium green|
|Experience|`rgba(34,197,94,.75)` — dark green|

- Minimum cell size: **40 × 40px**.
- Colour transitions between states: `transition: background-color var(--transition)`.
- A pinned **legend** using triage chips must remain visible at all times when the matrix is on screen.

### 7.10 Stat Pills (Start Page)

```css
.stat-pill {
    background: var(--bg-card-soft);
    border: 1px solid var(--border-soft);
    border-radius: 999px;
    padding: 8px 18px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-secondary);
    box-shadow: var(--shadow-sm);
}
.stat-pill strong { color: var(--text-primary); margin-right: 6px; }
```

- Stat values animate in on page load with a **count-up effect** (JS counter from 0 to target value over ~800ms `ease-out`).
- On the Start Page, stat pills are rendered inside glassmorphism cards overlaid on the gradient background.

### 7.11 Collapsibles / Accordions

Used in the Catalog Explorer (browsing skill hierarchy) and in content-heavy views.

```css
.collapsible-trigger {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    color: var(--text-primary);
    font-size: 18px; font-weight: 700;
    cursor: pointer;
    transition: all var(--transition);
}
.collapsible-trigger:hover { border-color: var(--accent); }
.collapsible.open .collapsible-trigger .chevron { transform: rotate(180deg); }

.collapsible-body {
    display: none;
    padding: 28px 28px 20px;
    border: 1px solid var(--border-soft); border-top: none;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    background: var(--bg-card-soft);
}
.collapsible.open .collapsible-body { display: block; }
```

The first collapsible in any group should carry the `.open` class by default.

### 7.12 Tables

Used in the Catalog Explorer and audit log views:

```css
table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--border-soft); border-radius: var(--radius-md); overflow: hidden; font-size: 15px; }
th { padding: 12px 18px; background: var(--bg-elevated); border-bottom: 2px solid var(--border-strong); font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-primary); }
td { padding: 12px 18px; border-bottom: 1px solid var(--border-soft); color: var(--text-secondary); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(59,130,246,.04); }
```

### 7.13 Pipeline Flow Visualisation

Used to illustrate the **3E Framework progression** (Education → Exposure → Experience) on the My Plan page or any onboarding context.

```css
.pipeline { display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding: 8px 0; }
.pipeline-node {
    background: var(--bg-card); border: 1px solid var(--border-soft);
    border-radius: var(--radius-md); padding: 16px 12px; text-align: center;
    transition: all var(--transition);
}
.pipeline-node:hover { border-color: var(--accent); box-shadow: var(--shadow-md); transform: translateY(-2px); }

/* Arrow connector between steps */
.pipeline-step:not(:last-child)::after {
    content: "";
    position: absolute; top: 50%; right: -4px;
    width: 8px; height: 8px;
    border-right: 2px solid var(--accent); border-bottom: 2px solid var(--accent);
    transform: translateY(-50%) rotate(-45deg);
    opacity: .6;
}
```

At `≤ 860px`, the pipeline stacks vertically with arrows pointing downward.

### 7.14 Modals

- Overlay: `rgba(0, 0, 0, 0.5)` backdrop.
- Modal container: `background: var(--bg-panel)`, `border: 1px solid var(--border-strong)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-lg)`.
- Max-width: `480px` for confirmations; `720px` for forms.
- Entrance animation: `scale(0.95) → scale(1)` + `opacity: 0 → 1`, `150ms ease-out`.

### 7.15 Skeleton Loaders

All async content areas must display a skeleton loader while fetching — not a spinner.

```css
.skeleton {
    background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-card-soft) 50%, var(--bg-elevated) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite linear;
    border-radius: var(--radius-sm);
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
```

### 7.16 Motion Summary

All transitions use the global `--transition: .2s ease` token. Avoid animations that delay interaction.

|Interaction|Duration|Notes|
|---|---|---|
|Card hover lift|`--transition` (200ms)|`translateY(-3px)` + shadow intensify|
|Button hover lift|`--transition`|`translateY(-2px)`|
|Nav link hover|`--transition`|Background fill fade|
|Collapsible open/close|`--transition`|Chevron rotation + body `display` toggle|
|Modal open|150ms `ease-out`|Scale + fade in|
|Tooltip appear|100ms `ease`|Opacity fade|
|Count-up (stat cards)|800ms `ease-out`|JS counter|
|Skeleton shimmer|1500ms `linear` infinite|Background-position sweep|

> Respect `prefers-reduced-motion` — when this OS setting is active, all `transform` and `animation` transitions must be disabled or reduced to instant state changes.

---

## 8. Additional Requirements

### Audit Trail

- All changes to development plans (skill additions, status changes, proficiency updates, note edits) must be logged.
- Each audit entry records: the entity changed, the field(s) changed, the previous and new values, the user who made the change, and a UTC timestamp.
- Audit logs must be viewable by admins and by managers (scoped to their direct reports).

### Export

- Engineers can export their own development plan as a **PDF** or **CSV**.
- Managers can export the team matrix view as a **CSV**.
- Exports must reflect the current filtered and sorted state of the view at the time of export.

### Modularity & Deployment

- Each module (Start Page, My Plan, My Team, Catalog Explorer, Skill Explorer) is independently deployable.
- Feature flags or environment-level configuration should control which modules are enabled per deployment.