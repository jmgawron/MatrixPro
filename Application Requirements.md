# MatrixPro — Application Requirements

**Version 2.0 · Developer Reference — As-Built**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Concept: Skills](#2-core-concept-skills)
3. [Modules](#3-modules)
    - 3.1 [Start Page](#31-start-page)
    - 3.2 [My Plan](#32-my-plan)
    - 3.3 [My Team](#33-my-team)
    - 3.4 [Catalog Explorer](#34-catalog-explorer)
    - 3.5 [Skill Explorer](#35-skill-explorer)
    - 3.6 [Admin Panel](#36-admin-panel)
    - 3.7 [Settings](#37-settings)
    - 3.8 [Feedback System](#38-feedback-system)
    - 3.9 [Certifications](#39-certifications)
4. [Data Model](#4-data-model)
5. [Authentication & Roles](#5-authentication--roles)
6. [UI & UX Requirements](#6-ui--ux-requirements)
7. [Design System](#7-design-system)
8. [Additional Requirements](#8-additional-requirements)

---

## 1. Overview

MatrixPro is a corporate web application designed for TAC Engineers and their managers to collaboratively build, track, and manage individual skill development plans. The application provides visibility into skill development at the individual, team, and organisational level.

The application uses a FastAPI backend, a SQLite database, and a vanilla JavaScript SPA frontend with no build step. It enforces role-based access control (RBAC) across all views and actions.

---

## 2. Core Concept: Skills

Skills are the fundamental data entity across all modules.

### 2.1 Skill Catalog

- Skills are defined in a global skill catalog, organised hierarchically: **Domain → Team**.
- A skill can be associated with multiple teams (many-to-many relationship).
- Each skill record includes: name, description, icon, catalog version, and linked training resources for each proficiency level following the 3E Framework.
- Skills can be "Global" (part of the main catalog) or "Custom" (created by an engineer for their own plan).

### 2.2 Proficiency Levels — The 3E Framework

Each skill supports three ordered proficiency levels. The framework is progressive — an engineer moves from theoretical knowledge through to applied mastery.

|Level|Name|Definition|
|---|---|---|
|1|**Education**|The engineer is actively seeking learning opportunities (courses, reading, training materials). No hands-on experience yet.|
|2|**Exposure**|The engineer has completed foundational education and is seeking practical application opportunities.|
|3|**Experience**|The engineer is proficient and deepening expertise through real-world practice and applied work.|

Each proficiency level includes associated content:
- Recommended courses, certifications, reading, and external links.
- **Actions**: Suggested activities to help the engineer complete the level.

---

## 3. Modules

### 3.1 Start Page

The Start Page is the primary navigation hub and provides high-level system metrics.

#### Content & Layout
- **System Statistics Grid**: Real-time counts of engineers, teams, and skills.
- **Navigation Cards**: Role-filtered links to available modules.
- **3E Framework Explainer**: Brief overview of Education, Exposure, and Experience levels.
- **System Activity**: (Managers/Admins) Recent system-wide activity summaries.

### 3.2 My Plan

Allows an engineer to manage their personal development plan using a Kanban interface.

#### Skill Categories (Kanban Columns)
- **In Pipeline** (`planned`): Skills queued for future development.
- **In Development** (`developing`): Skills currently being worked on.
- **Proficiency** (`mastered`): Completed skills associated with the profile.

#### Features
- **Drag-and-Drop**: Move skills between columns to update status.
- **Content Management**: Track completion of catalog resources, add personal notes, and create user-specific content (overrides or additions).
- **Training Log**: Record individual training activities, certifications, or hands-on tasks.
- **Export**: Generate PDF or CSV versions of the personal plan.

### 3.3 My Team

Provides managers with an aggregated view of their direct reports' progress.

#### Team Skills Matrix
- **Matrix View**: 2D grid of team members (Y-axis) vs. team-assigned skills (X-axis).
- **Colour Coding**: Indicates current proficiency level (shades of green) or status (white for pipeline, black for missing).
- **Sticky Headers**: Essential for navigating large teams and long skill lists.
- **Bulk Assign**: Manager can assign a skill to multiple team members at once.

#### Team Insights
- **Team Activity Feed**: Real-time stream of skill updates within the team.
- **Team Stats**: Charts showing skill distribution and progress metrics using **ECharts**.

### 3.4 Catalog Explorer

A browsable tree and searchable grid of all available skills.

#### Browsing
- **Hierarchy Tree**: Collapsible sidebar showing Domain → Team structure.
- **Skill Detail**: Comprehensive view of 3E content and associated certifications.
- **Search**: Full-text search across names, descriptions, and tags.

### 3.5 Skill Explorer

Enables cross-team skill analysis and personnel search.

#### Features
- **People Search**: Find engineers across the organisation by specific skill and proficiency.
- **Cross-Team Comparison**: Select two teams to see skill overlap percentage and unique skills.
- **Import**: Add skills from other teams' requirements directly to your own plan or team members' plans.

### 3.6 Admin Panel

Dedicated module for system administrators to manage all core entities.

- **Users**: Create, update, delete users; assign roles and managers.
- **Teams**: Manage team names, icons, shifts, and domain associations.
- **Domains**: Manage organisational domains (Technical vs. Non-Technical) and icons.
- **Skills**: Create and edit catalog skills and their 3E content.
- **Feedback**: Review and manage user-submitted feedback.

### 3.7 Settings

User profile management for all roles.

- **Profile**: Update display name, surname, and email.
- **Avatar**: Selection from a curated SVG avatar catalog.
- **Security**: Password update functionality.
- **Theme**: Persistence of light/dark mode preference.

### 3.8 Feedback System

Integrated widget for users to submit feedback (bug, enhancement, missing skill, question, other). Submissions include the source module to aid in debugging/triage.

### 3.9 Certifications

A separate catalog for industry certifications, which can be linked to skills.
- **Certification Domains**: Categories like "Cloud", "Networking", "Security".
- **Certificates**: Individual certifications with icons and descriptions.

---

## 4. Data Model

### 4.1 Organisational Structure

|Entity|Fields|Notes|
|---|---|---|
|`domains`|`id`, `name`, `is_technical`, `icon`, `created_at`|Top level hierarchy|
|`teams`|`id`, `name`, `domain_id`, `shift`, `icon`, `created_at`|Belongs to a domain|
|`users`|`id`, `name`, `surname`, `email`, `password_hash`, `role`, `avatar`, `team_id`, `manager_id`, `created_at`|`role`: `engineer`, `manager`, `admin`|

### 4.2 Skill Catalog

|Entity|Fields|Notes|
|---|---|---|
|`skills`|`id`, `name`, `description`, `icon`, `is_archived`, `is_custom`, `owner_id`, `catalog_version`, `updated_at`, `created_at`|Soft-delete via `is_archived`|
|`skill_level_content`|`id`, `skill_id`, `level`, `type`, `title`, `description`, `url`, `position`, `created_at`|`type`: `course`, `certification`, `reading`, `link`, `action`|
|`skill_teams`|`skill_id`, `team_id`|M2M Join|
|`tags`|`id`, `name`|Global tags|
|`skill_tags`|`skill_id`, `tag_id`|M2M Join|

### 4.3 Development Plans & Progress

|Entity|Fields|Notes|
|---|---|---|
|`development_plans`|`id`, `engineer_id`, `created_at`|One per engineer|
|`plan_skills`|`id`, `plan_id`, `skill_id`, `status`, `proficiency_level`, `notes`, `skill_version_at_add`, `added_at`, `updated_at`|`status`: `developing`, `planned`, `mastered`|
|`user_content_completions`|`id`, `user_id`, `plan_skill_id`, `content_id`, `completed`, `completed_at`, `notes`|Catalog content progress|
|`user_content_overrides`|`id`, `user_id`, `plan_skill_id`, `content_id`, `override_description`, `is_active`|Hide or modify catalog content per user|
|`user_level_content`|`id`, `user_id`, `plan_skill_id`, `skill_id`, `level`, `type`, `title`, `description`, `url`, `position`, `completed`|Personal resources added by engineer|
|`hidden_catalog_content`|`id`, `user_id`, `plan_skill_id`, `content_id`, `hidden_at`|Tracks hidden catalog items|
|`plan_skill_training_log`|`id`, `plan_skill_id`, `title`, `type`, `completed_at`, `notes`|Ad-hoc training entries|

### 4.4 Catalog Support

|Entity|Fields|Notes|
|---|---|---|
|`certification_domains`|`id`, `name`, `description`, `icon`, `created_at`|Cert categories|
|`certificates`|`id`, `name`, `description`, `certification_domain_id`, `icon`, `created_at`|Individual certs|
|`skill_certificates`|`skill_id`, `certificate_id`|M2M Join|
|`feedback`|`id`, `user_id`, `feedback_type`, `source_module`, `message`, `created_at`|User feedback|
|`audit_log`|`id`, `entity_type`, `entity_id`, `changed_by`, `changed_at`, `field`, `old_value`, `new_value`|Change tracking|

### 4.5 Relationships

```
Domain 1──* Team 1──* User
Team *──* Skill (via SkillTeam)
Skill 1──* SkillLevelContent
Skill 1──* PlanSkill

User 1──1 DevelopmentPlan 1──* PlanSkill
PlanSkill 1──* PlanSkillTrainingLog
PlanSkill 1──* UserContentCompletion
PlanSkill 1──* UserLevelContent

CertificationDomain 1──* Certificate *──* Skill
```

---

## 5. Authentication & Roles

Permissions are strictly enforced server-side via FastAPI dependencies.

|Role|Permissions|
|---|---|
|**Engineer**|Manage own plan; browse catalog; use skill explorer; submit feedback; manage own settings.|
|**Manager**|All Engineer permissions; view/edit plans of direct reports; view team matrix and stats; export team data.|
|**Admin**|All Manager permissions; full CRUD on users, teams, domains, skills, certifications; review all feedback; view global audit logs.|

---

## 6. UI & UX Requirements

- **No Build Step**: Pure ES modules, vanilla JS, and CSS.
- **External Dependencies**:
    - **Quill**: Used for rich text editing in notes and descriptions.
    - **ECharts**: Used for team and system analytics.
- **Responsive**: Optimised for desktop (min 1280px).
- **Accessibility**: Support for `prefers-reduced-motion`; high-contrast themes.
- **Async Handling**: Skeleton loaders (not spinners) for all data-fetching states.

---

## 7. Design System

**Sherlock / GenAI-Wireless** — a dark-first, glassmorphism-accented system (~7,260 lines of CSS in `style.css`).

### 7.1 Theming

Default is dark mode. Theme toggle switches `data-theme="light"` on `<body>`.

```css
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
    --radius-sm:       6px;
    --radius-md:       10px;
    --radius-lg:       14px;
    --shadow-lg:       0 16px 44px rgba(0,0,0,.4);
}

[data-theme="light"] {
    --bg-page:         #eef3f9;
    --bg-page-overlay: #e5edf7;
    --text-primary:    #0f172a;
    --border-strong:   #b7c7dd;
}
```

### 7.2 Proficiency & Status Chips

Status indicators use the **triage chip** pattern (semi-transparent background + matching border).

|Status|Class|Text|
|---|---|---|
|Education (1)|`chip-education`|Green|
|Exposure (2)|`chip-exposure`|Cyan|
|Experience (3)|`chip-experience`|Purple|
|Planned|`chip-pipeline`|Amber|
|Developing|`chip-developing`|Green|
|Mastered|`chip-proficiency`|Green|

### 7.3 Team Matrix Colours

|Status|Background|
|---|---|
|Not in Plan|`var(--bg-elevated)`|
|Planned|`var(--bg-card-soft)` + amber tint|
|Education|Light Green|
|Exposure|Medium Green|
|Experience|Dark Green|

---

## 8. Additional Requirements

### Audit Trail
All write operations to development plans and the skill catalog are recorded in `audit_log`. Entries include field-level diffs (`old_value` vs `new_value`) to allow full history reconstruction.

### Export
- **Plan PDF/CSV**: Full personal development plan content.
- **Matrix CSV**: Current team skills grid.
- **Skills Overview PDF**: Summary of the global skill catalog.
- **Change Logs PDF**: Exportable audit trail for specific teams or individuals.

### Technical Constraints
- Skill deletion must be a soft-archive if the skill is used in any active plan.
- Catalog updates do not auto-sync to existing plans; versioning allows engineers to see when their plan-skill is stale.
- JWT tokens are stored in `localStorage` and valid for 24 hours.
