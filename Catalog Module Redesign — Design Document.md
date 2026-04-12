# MatrixPro Catalog Module Redesign — Design Document

## 1. Overview
The MatrixPro Catalog Module Redesign transforms the existing flat skill catalog into a multi-dimensional taxonomy. This redesign introduces a granular organizational hierarchy (Organizations, Domains, Teams, Shifts), a standalone Certification system, and a Training Campaign framework. By decoupling skills from a single domain and moving to a many-to-many (M2M) assignment model, MatrixPro will support cross-functional skill tracking and mandatory training alignment across the Cisco TAC, PS, CMS, and CSS organizations.

## 2. Data Model

### 2.1 Core Entities
| Table | Column | Type | Constraints |
|-------|--------|------|-------------|
| organisations | id | Integer | Primary Key, Autoincrement |
| | name | String(50) | Unique, Not Null (TAC, PS, CMS, CSS) |
| | created_at | DateTime | Default: UTC Now |
| domains | id | Integer | Primary Key, Autoincrement |
| | name | String(100) | Not Null |
| | organisation_id | Integer | FK(organisations.id), Not Null |
| | is_technical | Boolean | Default: True |
| | created_at | DateTime | Default: UTC Now |
| shifts | id | Integer | Primary Key, Autoincrement |
| | name | String(50) | Not Null (Shift1, Shift2, Shift3, Shift4) |
| | domain_id | Integer | FK(domains.id), Not Null |
| | created_at | DateTime | Default: UTC Now |
| certification_domains | id | Integer | Primary Key, Autoincrement |
| | name | String(100) | Not Null (e.g. CCNA, CCNP Security) |
| | description | Text | Nullable |
| | created_at | DateTime | Default: UTC Now |
| certificates | id | Integer | Primary Key, Autoincrement |
| | name | String(100) | Not Null |
| | description | Text | Nullable |
| | certification_domain_id | Integer | FK(certification_domains.id), Not Null |
| | created_at | DateTime | Default: UTC Now |
| campaigns | id | Integer | Primary Key, Autoincrement |
| | name | String(100) | Not Null |
| | description | Text | Nullable |
| | organisation_id | Integer | FK(organisations.id), Not Null |
| | domain_id | Integer | FK(domains.id), Not Null |
| | start_date | Date | Not Null |
| | end_date | Date | Not Null |
| | is_mandatory | Boolean | Default: False |
| | created_at | DateTime | Default: UTC Now |

### 2.2 Updated Skill Entity
| Table | Column | Type | Constraints |
|-------|--------|------|-------------|
| skills | id | Integer | Primary Key, Autoincrement |
| | name | String(100) | Not Null |
| | description | Text | Not Null |
| | is_future | Boolean | Default: False |
| | is_archived | Boolean | Default: False |
| | catalog_version | Integer | Default: 1 |
| | updated_at | DateTime | Default: UTC Now |
| | created_at | DateTime | Default: UTC Now |

### 2.3 Assignment (M2M) Tables
| Table | Column | Type | Constraints |
|-------|--------|------|-------------|
| skill_organisations | skill_id | Integer | FK(skills.id), PK |
| | organisation_id | Integer | FK(organisations.id), PK |
| skill_domains | skill_id | Integer | FK(skills.id), PK |
| | domain_id | Integer | FK(domains.id), PK |
| skill_shifts | skill_id | Integer | FK(skills.id), PK |
| | shift_id | Integer | FK(shifts.id), PK |
| skill_certificates | skill_id | Integer | FK(skills.id), PK |
| | certificate_id | Integer | FK(certificates.id), PK |
| skill_campaigns | skill_id | Integer | FK(skills.id), PK |
| | campaign_id | Integer | FK(campaigns.id), PK |

## 3. API Endpoints

### 3.1 Catalog Navigation (Public/Auth)
```python
GET /api/catalog/org-tree
Auth: JWT (Any)
Response: List[OrgNode] { id, name, domains: List[DomainNode] { id, name, teams: List[TeamNode], shifts: List[ShiftNode] } }

GET /api/catalog/cert-tree
Auth: JWT (Any)
Response: List[CertDomainNode] { id, name, certificates: List[CertNode] { id, name } }

GET /api/catalog/campaign-tree
Auth: JWT (Any)
Response: List[OrgNode] { id, name, domains: List[DomainNode] { id, name, campaigns: List[CampaignNode] { id, name, is_mandatory } } }

GET /api/catalog/skills
Auth: JWT (Any)
Params: org_id, domain_id, team_id, shift_id, cert_id, campaign_id, search, include_archived
Response: List[SkillOut]
```

### 3.2 Shifts Admin
```python
GET /api/shifts/
POST /api/shifts/ { name, domain_id }
PUT /api/shifts/{id} { name, domain_id }
DELETE /api/shifts/{id}
Auth: JWT (Admin)
```

### 3.3 Certification Admin
```python
GET /api/certification-domains/
POST /api/certification-domains/ { name, description }
PUT /api/certification-domains/{id} { name, description }
DELETE /api/certification-domains/{id}

GET /api/certificates/
POST /api/certificates/ { name, description, certification_domain_id }
PUT /api/certificates/{id} { name, description, certification_domain_id }
DELETE /api/certificates/{id}
Auth: JWT (Admin)
```

### 3.4 Campaigns Admin
```python
GET /api/campaigns/
POST /api/campaigns/ { name, description, organisation_id, domain_id, start_date, end_date, is_mandatory }
PUT /api/campaigns/{id} { name, description, organisation_id, domain_id, start_date, end_date, is_mandatory }
DELETE /api/campaigns/{id}
Auth: JWT (Admin)
```

### 3.5 Skill Assignment Matrix
```python
POST /api/skills/{id}/assignments
Auth: JWT (Admin)
Request: {
    organisation_ids: List[int],
    domain_ids: List[int],
    team_ids: List[int],
    shift_ids: List[int],
    certificate_ids: List[int],
    campaign_ids: List[int]
}
Response: { status: "success" }
```

## 4. Frontend — Catalog Page (`#/catalog`)

### 4.1 Layout Breakdown
- **Tab Bar**: Organization, Certification, Non-Technical, Campaigns.
- **Sidebar (Left)**: Contextual Tree Navigation based on active tab.
- **Main Area (Right)**:
    - **Header**: Search bar, Archive toggle, Filter breadcrumbs.
    - **Grid**: Responsive skill cards (Sherlock Glassmorphism style).
- **Detail Modal**: Skill description, tags, and "Assigned To" section showing all metadata (Orgs, Domains, Teams, Shifts, Certs, Campaigns).

### 4.2 Tab Behavior
1. **Organization Tab**: Tree: Org (TAC/PS/CMS/CSS) > Domain > Team > Shift. Filtering by Org shows all skills in that org. Drill-down narrows the set.
2. **Certification Tab**: Tree: Cert Domain (CCNA, CCNP) > Certificate. Shows skills mapped to specific certifications.
3. **Non-Technical Tab**: Tree: Domains where `is_technical=false` (e.g., Soft Skills, Leadership).
4. **Campaign Tab**: Tree: Org > Domain > Campaign. Mandatory campaigns feature a red "Required" badge on the tree node and skill cards.

## 5. Frontend — Catalog Admin Page (`#/admin/catalog`)

### 5.1 Sections
- **Domains Management**: Table with inline editing for Orgs/Technical toggle.
- **Teams & Shifts**: Filterable list by Domain. Shifts restricted to TAC domains.
- **Certification Registry**: CRUD for Domains and specific Certificates.
- **Campaign Manager**: Date-picker integration, mandatory toggle, and domain scoping.
- **Assignment Matrix**:
    - Select Skill from dropdown/search.
    - Multi-select checkboxes/tags for all 6 metadata categories.
    - Save button to update all M2M relationships at once.

## 6. Seed Data Plan

### 6.1 Organizations
- TAC, PS, CMS, CSS.

### 6.2 Domains
- TAC: Wireless (Technical), Security (Technical), Soft Skills (Non-Technical).
- PS: PS General (Technical).
- CMS: CMS General (Technical).
- CSS: CSS General (Technical).

### 6.3 Shifts (TAC Only)
- Wireless: Shift1, Shift2, Shift3, Shift4.
- Security: Shift1, Shift2, Shift3, Shift4.

### 6.4 Certification Domains & Certificates
- **CCNA**: CCNA R&S.
- **CCNP Enterprise**: ENCOR, ENARSI.
- **CCNP Security**: SCOR, SVPN.
- **DevNet Associate**: DevNet Assoc.
- **DevNet Professional**: DEVCOR.
- **CyberOps**: CyberOps Assoc.

### 6.5 Campaigns
- **Q3 Wireless Security Patching**: Mandatory, TAC/Wireless.
- **FY26 Soft Skills Initiative**: Optional, TAC/Soft Skills.

## 7. Breaking Changes & Migration

### 7.1 Schema Changes
- **DROP `skills.domain_id`**: Skills are no longer tied to a single domain. This requires moving existing data to the `skill_domains` M2M table.
- **NEW `skill_organisations`**: Mandatory for skill visibility in the new catalog. Existing skills must be assigned to at least "TAC" during migration.
- **NEW `shifts`**: TAC-specific hierarchy level.

### 7.2 Migration Note
The implementation strategy uses a "Drop and Re-seed" approach. All existing `matrixpro.db` data will be cleared and recreated using the updated `app/seed.py` logic to ensure structural integrity across new M2M relationships.

## 8. Phased Implementation Plan

### Phase 1: Data Model
- Create new tables and M2M join tables.
- Remove `domain_id` from Skill model.
- Update `app/seed.py` with the complete taxonomy.
- **Acceptance**: DB schema matches design; `python -m app.seed` completes without errors.

### Phase 2: Backend APIs
- Implement CRUD routers for Shifts, Certs, and Campaigns.
- Develop tree-building logic for `/api/catalog/` endpoints.
- Update Skill routers to handle bulk M2M assignments.
- **Acceptance**: All endpoints return valid JSON; RBAC prevents non-admin modifications.

### Phase 3: Catalog UI Redesign
- Implement the 4-tab layout on `#/catalog`.
- Build the dynamic sidebar tree navigation component.
- Update skill cards and detail modals to display new assignment metadata.
- **Acceptance**: Tree navigation filters skill grid correctly across all tabs.

### Phase 4: Catalog Admin Page
- Create `#/admin/catalog` route.
- Build CRUD forms for all taxonomy entities.
- Implement the Skill Assignment Matrix for bulk metadata management.
- **Acceptance**: Admin can create a new cert and assign it to an existing skill via UI.

### Phase 5: Certificates and Campaigns Integration
- Add "Mandatory" visual indicators for campaigns.
- Implement date-range filtering for the Campaign tab.
- Finalize bidirectional cert-skill browsing.
- **Acceptance**: User can see mandatory campaign dates and required skills.

### Phase 6: Polish and Verification
- Add skeleton loaders to all new async sections.
- Ensure 1280px responsiveness.
- Verify archive/restore logic with M2M filters.
- **Acceptance**: System passes full UAT against spec requirements.