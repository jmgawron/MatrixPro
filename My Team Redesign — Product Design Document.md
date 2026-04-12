# Product Design Document: "My Team" Module Redesign

## 1. Executive Summary
The "My Team" module in MatrixPro is currently a static, matrix-only view that lacks the analytical depth required for effective engineering management. This redesign transforms the module from a simple spreadsheet-style grid into a comprehensive Management Command Center. 

The goal is to provide managers with a three-tier navigation experience: high-level KPIs (Overview), a dense data grid (Enhanced Matrix), and individual performance insights (Engineer Drill-down). By integrating skill gap analysis, automated stagnation alerts, and direct skill assignment, managers can move from observing data to actively driving team development. The design remains faithful to the Sherlock/GenAI-Wireless design system, utilizing dark-first glassmorphism and vanilla JS to ensure performance and consistency.

---

## 2. Feature List

### A. Dashboard & Analytics (Tier 1)
*   **KPI Scorecards**: Four top-level metrics (Team Coverage %, Critical Gaps, Active Developments, and 30-day Completions) with trend indicators.
*   **Team Skill Radar**: A radial chart comparing current team proficiency against a target "Team Gold Standard" for their specific domain.
*   **Recent Activity Feed**: A scrollable log of recent training completions, status changes, and new skills added across the team.

### B. Enhanced Matrix View (Tier 2)
*   **Multi-Dimensional Filtering**: Advanced search by skill name, domain, tags, and status.
*   **Dynamic Column Sorting**: Sort the matrix by proficiency level or alphabetical name to identify subject matter experts (SMEs).
*   **Bulk Skill Assignment**: A checkbox-based workflow to assign a specific skill or a set of skills to multiple engineers simultaneously.
*   **Stagnation Highlighting**: Visual indicators (subtle pulsing border) for skills that haven't seen an update in over 90 days.

### C. Engineer Drill-down (Tier 3)
*   **Individual Profile Overlay**: A slide-out panel showing an engineer's specific progress, skill distribution (Education vs. Experience), and training log history.
*   **Skill Gap Visualization**: A bar chart showing "Current vs. Target" levels for their assigned development plan.
*   **Manager Notes & Feedback**: A dedicated area for managers to leave private or shared comments on specific plan items.

### D. Governance & Reporting
*   **Smart Alerts**: A persistent notification bar for missing critical skills or overdue certifications.
*   **Time-Range Reporting**: Generate CSV/PDF reports based on specific date ranges (Quarterly/Monthly progress).
*   **Skill Import**: Capability to "Copy Plan" from one top-performer to a new hire for rapid onboarding.

---

## 3. UX/UI Concept

### Layout Structure
The page uses a **Tabbed Navigation** pattern within the content area to separate the three views:
1.  **Summary** (Dashboard)
2.  **Matrix** (Heatmap)
3.  **Analysis** (Gap & Trends)

### Screen 1: The Summary Dashboard
*   **Hero Section**: Standard MatrixPro gradient header with "Team Overview" title.
*   **Stat Grid**: Four `stat-block` elements using glassmorphism.
*   **Charts Row**: 
    *   Left (60%): `team-radar-chart` showing domain coverage.
    *   Right (40%): `activity-feed-card` with a list of `activity-item` components (Avatar + Action + Timestamp).

### Screen 2: The Enhanced Matrix
*   **Control Bar**: A sticky bar below the tabs containing:
    *   Multi-select `skill-filter` (Domain/Tag/Level).
    *   `search-input` for finding specific engineers or skills.
    *   `bulk-action-btn` which toggles checkboxes on the engineer rows.
*   **The Grid**: Uses the existing sticky-header logic but adds:
    *   **Row Actions**: Hovering an engineer name reveals a "View Profile" icon.
    *   **Cell Context Menu**: Right-clicking a cell allows "Quick Status Change" or "View Training Log".

### Component: Engineer Profile Slide-out
*   **Behavior**: Triggered by clicking an engineer's name in the Matrix or Summary.
*   **UI**: A right-side panel (`.slide-panel`) with:
    *   **Header**: Name, Role, Team, and "Navigate to Full Plan" link.
    *   **Body**: 
        *   `mini-radar-chart`: Individual vs. Team average.
        *   `progress-list`: Vertical list of skills with progress bars.
        *   `training-timeline`: Vertical list of the last 5 logs.

---

## 4. Data Model Overview

### Existing Models Used:
*   `User`: To fetch direct reports (manager_id) and team members.
*   `Team`: For team metadata and domain context.
*   `Skill`: For catalog definitions and versions.
*   `PlanSkill`: The core source for proficiency levels and status.
*   `PlanSkillTrainingLog`: For the activity feed and timeline.

### New Logic/Virtual Entities:
*   **SkillGap**: A calculated state comparing `PlanSkill.proficiency_level` against a `TargetLevel` (currently default to Level 3).
*   **StagnationFlag**: A boolean derived from `PlanSkill.updated_at < (NOW - 90 Days)`.
*   **TeamGoldStandard**: A virtual template (defined by domain) used to calculate team coverage %.

---

## 5. Key Workflows

### Workflow 1: Identifying and Closing a Skill Gap
1.  Manager opens **Summary** tab and sees "Critical Gaps" KPI is high.
2.  Clicks "Critical Gaps" to navigate to the **Analysis** tab.
3.  Analysis view shows a list of required skills with 0% coverage.
4.  Manager selects a skill (e.g., "BGP Advanced Troubleshooting").
5.  Manager selects "Assign to Engineers" and chooses Bob and Dave.
6.  System creates `PlanSkill` entries in `in_pipeline` status for both; Audit log records the assignment.

### Workflow 2: Investigating Stagnation
1.  Manager notices a pulsing amber border on Bob's "Python Automation" cell in the **Matrix**.
2.  Manager clicks the cell to open the **Engineer Profile Slide-out**.
3.  Manager reviews the **Training Timeline** and sees no logs since January.
4.  Manager adds a "Manager Note" asking for an update; system sends a notification to Bob.

---

## 6. Advanced Recommendations

1.  **AI Insights**: Integrate a "Manager Co-Pilot" that suggests which engineer is best suited for a new skill based on their existing overlap with similar skills.
2.  **Learning Path Integration**: Link specific `SkillLevelContent` directly to the "Assign Skill" workflow so engineers get a "Ready to Start" kit immediately.
3.  **Peer Recognition**: Allow SMEs (Level 3) to "Endorse" logs from Level 1/2 engineers, appearing in the manager's activity feed.
4.  **Radar Normalization**: Ensure radar charts handle varying skill counts per domain gracefully to avoid "jagged" visualizations that are hard to read.

---

## 7. Implementation Prompt (Self-Contained)

**Task**: Redesign the "My Team" module in MatrixPro from a matrix-only view into a three-tab dashboard (Summary, Matrix, Analysis).

**Context**:
- **Framework**: Vanilla JS (ES Modules), No build step.
- **Design System**: Sherlock/GenAI-Wireless (Dark-first, CSS variables: `--bg-page`, `--accent`, `--bg-card`, etc.).
- **Charting**: Use Apache ECharts v6.0 via CDN.
- **API**: Use existing `api.js` for `GET /api/teams/matrix` and `GET /api/plans/{id}`.

**Technical Requirements**:
1.  **Layout**: 
    - Replace the current `mountMyTeam` content with a tabbed container (Tabs: Summary, Matrix, Analysis).
    - Implement a `Summary` tab with four KPI cards (`stat-block`) and two columns: a Team Radar Chart and a Recent Activity Feed.
    - Preserve and enhance the current Matrix in the `Matrix` tab, adding a sticky filter/search bar.
    - Create an `Analysis` tab that lists skills with the lowest coverage % in the team.

2.  **Components**:
    - **Engineer Slide-out**: Create a side-panel component that displays an engineer's profile, a mini-radar chart, and their last 5 training logs. Trigger this when clicking names in the Matrix.
    - **Skill Assignment Modal**: Create a `showModal` workflow that allows managers to select one or more skills from the catalog and assign them to one or more team members. This should call `POST /api/plans/{id}/skills` in a loop or as a bulk operation.
    - **Activity Feed**: Fetch the last 20 `PlanSkillTrainingLog` entries for all team members and display them in a scrollable list.

3.  **Visuals**:
    - Use `echarts.init(el, 'dark')` for all charts.
    - Implement a subtle pulsing animation for "Stagnant" cells (PlanSkill updated > 90 days ago).
    - Ensure all loading states use `skeleton.js` (renderSkeleton('card') or 'table').

4.  **State Management**:
    - Use `Store.set('activeTeamTab', tabName)` to persist tab selection across refreshes.
    - Ensure filtering in the Matrix tab updates the team stats in the Summary tab reactively.

5.  **Constraints**:
    - Do not break the existing Admin team-selector functionality.
    - Maintain existing RBAC (managers see direct reports, admins use `team_id`).
    - All date formatting must use the project's standard UTC helpers.
