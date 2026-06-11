from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, exists, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.catalog import SkillCertificate
from app.models.org import Domain, Team
from app.models.plan import (
    DevelopmentPlan,
    HiddenCatalogContent,
    PlanSkill,
    UserCatalogDisplayOrder,
    UserContentCompletion,
    UserContentOverride,
    UserLevelContent,
)
from app.models.skill import (
    Skill,
    SkillCategory,
    SkillCategoryAssignment,
    SkillLevelContent,
    SkillTag,
    SkillTeam,
    Tag,
)
from app.models.user import User, UserRole
from app.schemas.catalog import SkillAssignmentRequest
from app.schemas.skill import (
    CategoryInfo,
    CategoryResponse,
    CertificateInfo,
    CompareResponse,
    CompareSkillInfo,
    CompareTeamResult,
    DuplicateWarningResponse,
    ExplorerContentMatch,
    ExplorerContentOption,
    ExplorerContentOptionsResponse,
    ExplorerEngineerResult,
    ExplorerLevelProgress,
    ExplorerResponse,
    ExplorerSkillProgress,
    ReorderRequest,
    SkillCreate,
    SkillLevelContentCreate,
    SkillLevelContentResponse,
    SkillLevelContentUpdate,
    SkillResponse,
    SkillUpdate,
    TagResponse,
    TeamInfo,
)
from app.services.notifications import notify_skill_event
from app.services.skill_lifecycle import (
    convert_catalog_content_to_personal,
    delete_catalog_skill_with_forks,
    delete_preview,
    duplicate_skill,
)
from app.services.skill_ownership import (
    ROLE_CONSUMER,
    ROLE_OWNER,
    active_catalog_skill_name_exists,
    check_manager_owner_team_access,
    fuzzy_duplicate_warnings,
    manager_skill_access,
    manager_accessible_team_ids,
    require_owner_or_admin,
    resolve_manager_consumer_team_ids,
    resolve_manager_owner_team_ids,
    skill_consumer_team_ids,
    skill_owner_team_ids,
    sync_skill_team_roles,
)

router = APIRouter(prefix="/api/skills", tags=["skills"])


def _skill_eager_options():
    return [
        selectinload(Skill.skill_tags).selectinload(SkillTag.tag),
        selectinload(Skill.skill_teams).selectinload(SkillTeam.team),
        selectinload(Skill.skill_certificates).selectinload(
            SkillCertificate.certificate
        ),
        selectinload(Skill.skill_categories).selectinload(
            SkillCategoryAssignment.category
        ),
    ]


def _eager_load_skill(db: Session, skill_id: int) -> Optional[Skill]:
    return (
        db.query(Skill)
        .options(*_skill_eager_options())
        .filter(Skill.id == skill_id)
        .first()
    )


def _to_skill_response(skill: Skill, duplicate_warnings: list[str] | None = None) -> SkillResponse:
    owner_teams = [
        TeamInfo(id=st.team.id, name=st.team.name, shift=st.team.shift)
        for st in skill.skill_teams
        if getattr(st, "role", ROLE_OWNER) == ROLE_OWNER
    ]
    consumer_teams = [
        TeamInfo(id=st.team.id, name=st.team.name, shift=st.team.shift)
        for st in skill.skill_teams
        if getattr(st, "role", ROLE_OWNER) == ROLE_CONSUMER
    ]
    all_teams = owner_teams + consumer_teams
    return SkillResponse(
        id=skill.id,
        name=skill.name,
        description=skill.description,
        icon=skill.icon,
        is_archived=skill.is_archived,
        is_orphaned=getattr(skill, "is_orphaned", False),
        is_custom=bool(skill.is_custom),
        catalog_version=skill.catalog_version,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=[TagResponse.model_validate(st.tag) for st in skill.skill_tags],
        teams=all_teams,
        owner_teams=owner_teams,
        consumer_teams=consumer_teams,
        certificates=[
            CertificateInfo(
                id=sc.certificate.id, name=sc.certificate.name, icon=sc.certificate.icon
            )
            for sc in skill.skill_certificates
        ],
        categories=[
            CategoryInfo(
                id=sca.category.id,
                slug=sca.category.slug,
                name=sca.category.name,
                sort_order=sca.category.sort_order,
            )
            for sca in skill.skill_categories
        ],
        duplicate_warnings=duplicate_warnings or [],
    )


def _sync_certificate_m2m(db: Session, skill_id: int, certificate_ids: list[int]):
    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete()
    for cid in certificate_ids:
        db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))


def _sync_category_m2m(db: Session, skill_id: int, category_ids: list[int]):
    db.query(SkillCategoryAssignment).filter(
        SkillCategoryAssignment.skill_id == skill_id
    ).delete()
    for cat_id in category_ids:
        if not db.query(SkillCategory).filter(SkillCategory.id == cat_id).first():
            raise HTTPException(
                status_code=400, detail=f"Category {cat_id} not found"
            )
        db.add(SkillCategoryAssignment(skill_id=skill_id, category_id=cat_id))


def _check_manager_skill_edit_access(current_user: User, skill_id: int, db: Session):
    """Managers may edit skills where they have owner-team access (owner wins over consumer)."""
    access = manager_skill_access(db, current_user, skill_id)
    if access in ("admin", "owner"):
        return
    if access == "consumer":
        raise HTTPException(
            status_code=403,
            detail="Consumer managers may only manage consumer team associations",
        )
    raise HTTPException(status_code=403, detail="Not authorized to edit this skill")


def _check_manager_team_access(current_user: User, team_ids: list[int], db: Session):
    check_manager_owner_team_access(current_user, team_ids, db)


def _resolve_owner_ids_from_payload(
    data_owner: list[int] | None,
    data_team_ids: list[int] | None,
) -> list[int]:
    if data_owner is not None:
        return list(data_owner)
    if data_team_ids is not None:
        return list(data_team_ids)
    return []


@router.get("/", response_model=list[SkillResponse])
def list_skills(
    search: Optional[str] = Query(None),
    team_id: Optional[int] = Query(None),
    domain_id: Optional[int] = Query(None),
    include_archived: bool = Query(False),
    cert_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Skill).options(*_skill_eager_options())

    # Exclude custom (own) skills from catalog listing
    query = query.filter(Skill.is_custom == False)  # noqa: E712

    if not include_archived:
        query = query.filter(Skill.is_archived == False)  # noqa: E712

    if team_id is not None:
        # Match owner or consumer association — engineers browse consumer skills too.
        query = (
            query.join(SkillTeam, Skill.id == SkillTeam.skill_id)
            .filter(SkillTeam.team_id == team_id)
            .distinct()
        )

    if domain_id is not None:
        domain = db.query(Domain).filter(Domain.id == domain_id).first()
        if domain and not domain.is_technical:
            # Non-technical domains: return skills with no team assignments
            assigned_skill_ids = db.query(SkillTeam.skill_id).distinct()
            query = query.filter(Skill.id.notin_(assigned_skill_ids))
        else:
            query = (
                query.join(SkillTeam, Skill.id == SkillTeam.skill_id)
                .join(Team, SkillTeam.team_id == Team.id)
                .filter(Team.domain_id == domain_id)
            )

    if cert_id is not None:
        query = query.join(
            SkillCertificate, Skill.id == SkillCertificate.skill_id
        ).filter(SkillCertificate.certificate_id == cert_id)

    if category_id is not None:
        query = query.join(
            SkillCategoryAssignment, Skill.id == SkillCategoryAssignment.skill_id
        ).filter(SkillCategoryAssignment.category_id == category_id)

    if search:
        search_term = f"%{search.lower()}%"
        from sqlalchemy import or_, select

        tag_skill_ids = (
            select(SkillTag.skill_id)
            .join(Tag, SkillTag.tag_id == Tag.id)
            .where(Tag.name.ilike(search_term))
        )
        query = query.filter(
            or_(
                Skill.name.ilike(search_term),
                Skill.description.ilike(search_term),
                Skill.id.in_(tag_skill_ids),
            )
        )

    skills = query.all()
    return [_to_skill_response(s) for s in skills]


@router.post("/", response_model=SkillResponse)
def create_skill(
    data: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    owner_ids = _resolve_owner_ids_from_payload(data.owner_team_ids, data.team_ids)
    consumer_ids = list(data.consumer_team_ids or [])

    if data.is_non_technical:
        ntech_team_ids = [
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        ]
        if not ntech_team_ids:
            raise HTTPException(
                status_code=400,
                detail="Non-Technical team (NTECH-GEN) not found in catalog",
            )
        if owner_ids:
            invalid = [tid for tid in owner_ids if tid not in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Non-technical skill must only be assigned to NTECH-GEN "
                        f"teams; invalid team_ids: {invalid}"
                    ),
                )
        else:
            owner_ids = ntech_team_ids

    if not owner_ids:
        raise HTTPException(status_code=400, detail="At least one owner team is required")

    _check_manager_team_access(current_user, owner_ids, db)

    all_team_ids = set(owner_ids) | set(consumer_ids)
    if all_team_ids:
        found_ids = {
            t.id for t in db.query(Team).filter(Team.id.in_(all_team_ids)).all()
        }
        missing = [tid for tid in all_team_ids if tid not in found_ids]
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Team(s) not found: {missing}"
            )

    if active_catalog_skill_name_exists(db, data.name.strip()):
        raise HTTPException(status_code=400, detail="Skill name must be unique in catalog")

    skill = Skill(
        name=data.name.strip(),
        description=data.description,
        icon=data.icon,
        is_archived=False,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

    sync_skill_team_roles(db, skill.id, owner_ids, consumer_ids)

    for tag_name in data.tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        db.add(SkillTag(skill_id=skill.id, tag_id=tag.id))

    _sync_certificate_m2m(db, skill.id, data.certificate_ids)
    category_ids = [] if data.is_non_technical else data.category_ids
    _sync_category_m2m(db, skill.id, category_ids)

    notify_skill_event(
        db,
        skill,
        "skill_created",
        f'New catalog skill: "{skill.name}"',
        exclude_user_id=current_user.id,
    )

    db.commit()

    loaded = _eager_load_skill(db, skill.id)
    warnings = fuzzy_duplicate_warnings(db, skill.name, exclude_skill_id=skill.id)
    return _to_skill_response(loaded, duplicate_warnings=warnings)


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(SkillCategory)
        .order_by(SkillCategory.sort_order, SkillCategory.name)
        .all()
    )


@router.get("/ntech-teams")
def list_ntech_teams(
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    teams = (
        db.query(Team)
        .filter(Team.name.like("TAC-NTECH-GEN-%"))
        .order_by(Team.name)
        .all()
    )
    return [
        {"id": t.id, "name": t.name, "shift": t.shift}
        for t in teams
    ]


_FOCUS_TO_LEVEL = {"education": 1, "exposure": 2, "experience": 3}
_LEVEL_TO_FOCUS = {1: "Education", 2: "Exposure", 3: "Experience"}


def _parse_csv_ints(value: Optional[str]) -> list[int]:
    if not value:
        return []
    out: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out


def _development_focus_label(
    focus_area: Optional[str],
    proficiency_level: Optional[int],
    status: str,
) -> Optional[str]:
    if status == "mastered":
        return None
    if focus_area:
        return focus_area.strip().capitalize()
    if proficiency_level in _LEVEL_TO_FOCUS:
        return _LEVEL_TO_FOCUS[proficiency_level]
    return None


def _level_pct(completed: int, total: int) -> int:
    if total <= 0:
        return 0
    return round(100 * completed / total)


def _compute_explorer_progress_batch(
    db: Session,
    rows: list[tuple[PlanSkill, Skill, User, Team]],
) -> dict[int, ExplorerSkillProgress]:
    if not rows:
        return {}

    plan_skill_ids = [ps.id for ps, _, _, _ in rows]
    skill_ids = list({skill.id for _, skill, _, _ in rows})
    user_ids = list({user.id for _, _, user, _ in rows})

    catalog_by_skill: dict[int, list[SkillLevelContent]] = {}
    if skill_ids:
        for item in (
            db.query(SkillLevelContent)
            .filter(SkillLevelContent.skill_id.in_(skill_ids))
            .all()
        ):
            catalog_by_skill.setdefault(item.skill_id, []).append(item)

    hidden_set = {
        (h.user_id, h.plan_skill_id, h.content_id)
        for h in db.query(HiddenCatalogContent).filter(
            HiddenCatalogContent.plan_skill_id.in_(plan_skill_ids),
            HiddenCatalogContent.user_id.in_(user_ids),
        )
    }

    completion_set = {
        (c.user_id, c.plan_skill_id, c.content_id)
        for c in db.query(UserContentCompletion).filter(
            UserContentCompletion.plan_skill_id.in_(plan_skill_ids),
            UserContentCompletion.user_id.in_(user_ids),
            UserContentCompletion.completed.is_(True),
        )
    }

    user_content_by_key: dict[tuple[int, int], list] = {}
    for ui in (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.plan_skill_id.in_(plan_skill_ids),
            UserLevelContent.user_id.in_(user_ids),
            UserLevelContent.is_private.is_(False),
        )
        .all()
    ):
        user_content_by_key.setdefault((ui.user_id, ui.plan_skill_id), []).append(ui)

    progress_map: dict[int, ExplorerSkillProgress] = {}
    for plan_skill, skill, user, _team in rows:
        level_stats = {1: [0, 0], 2: [0, 0], 3: [0, 0]}

        for item in catalog_by_skill.get(skill.id, []):
            if (user.id, plan_skill.id, item.id) in hidden_set:
                continue
            lvl = item.level if item.level in _LEVEL_TO_FOCUS else 1
            level_stats[lvl][1] += 1
            if (user.id, plan_skill.id, item.id) in completion_set:
                level_stats[lvl][0] += 1

        for ui in user_content_by_key.get((user.id, plan_skill.id), []):
            lvl = ui.level if ui.level in _LEVEL_TO_FOCUS else 1
            level_stats[lvl][1] += 1
            if ui.completed:
                level_stats[lvl][0] += 1

        levels = [
            ExplorerLevelProgress(
                level=lvl,
                level_label=_LEVEL_TO_FOCUS[lvl],
                completed=level_stats[lvl][0],
                total=level_stats[lvl][1],
                pct=_level_pct(level_stats[lvl][0], level_stats[lvl][1]),
            )
            for lvl in (1, 2, 3)
        ]

        total_items = sum(t for _, t in level_stats.values())
        completed_items = sum(c for c, _ in level_stats.values())
        if plan_skill.status.value == "mastered":
            completion_pct = 100
        else:
            completion_pct = _level_pct(completed_items, total_items)

        progress_map[plan_skill.id] = ExplorerSkillProgress(
            completed_items=completed_items,
            total_items=total_items,
            completion_pct=completion_pct,
            levels=levels,
        )

    return progress_map


@router.get("/explorer/content", response_model=ExplorerContentOptionsResponse)
def explorer_content_options(
    skill_ids: str = Query(..., description="Comma-separated skill IDs"),
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    ids = _parse_csv_ints(skill_ids)
    if not ids:
        raise HTTPException(status_code=400, detail="At least one skill_id is required")

    rows = (
        db.query(SkillLevelContent, Skill)
        .join(Skill, SkillLevelContent.skill_id == Skill.id)
        .filter(
            SkillLevelContent.skill_id.in_(ids),
            Skill.is_archived.is_(False),
        )
        .order_by(Skill.name, SkillLevelContent.level, SkillLevelContent.position)
        .all()
    )

    return ExplorerContentOptionsResponse(
        options=[
            ExplorerContentOption(
                id=content.id,
                skill_id=skill.id,
                skill_name=skill.name,
                level=content.level,
                level_label=_LEVEL_TO_FOCUS.get(content.level, "Content"),
                title=content.title,
                type=content.type.value if hasattr(content.type, "value") else str(content.type),
            )
            for content, skill in rows
        ]
    )


@router.get("/explorer", response_model=ExplorerResponse)
def explorer_search(
    q: Optional[str] = Query(None),
    skill_ids: Optional[str] = Query(None, description="Comma-separated skill IDs"),
    team_id: Optional[int] = Query(None),
    team_ids: Optional[str] = Query(None, description="Comma-separated team IDs"),
    domain_ids: Optional[str] = Query(None, description="Comma-separated domain IDs"),
    status: Optional[str] = Query(None),
    focus: Optional[str] = Query(
        None, description="Comma-separated focus areas: education, exposure, experience"
    ),
    shift: Optional[str] = Query(None, description="Comma-separated shift numbers"),
    content_ids: Optional[str] = Query(None, description="Comma-separated catalog content IDs"),
    content_completed: Optional[bool] = Query(
        None, description="When content_ids set: true=completed, false=not completed"
    ),
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    query = (
        db.query(PlanSkill, Skill, User, Team)
        .join(Skill, PlanSkill.skill_id == Skill.id)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .join(User, DevelopmentPlan.engineer_id == User.id)
        .outerjoin(Team, User.team_id == Team.id)
        .filter(Skill.is_archived.is_(False))
    )

    parsed_skill_ids = _parse_csv_ints(skill_ids)
    if parsed_skill_ids:
        query = query.filter(Skill.id.in_(parsed_skill_ids))
    elif q:
        query = query.filter(Skill.name.ilike(f"%{q}%"))

    if team_id_list := _parse_csv_ints(team_ids):
        query = query.filter(User.team_id.in_(team_id_list))
    elif team_id is not None:
        query = query.filter(User.team_id == team_id)

    domain_id_list = _parse_csv_ints(domain_ids)
    if domain_id_list:
        query = query.filter(Team.domain_id.in_(domain_id_list))

    if status is not None:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if len(status_list) == 1:
            query = query.filter(PlanSkill.status == status_list[0])
        elif status_list:
            query = query.filter(PlanSkill.status.in_(status_list))

    if focus:
        areas = [a.strip().lower() for a in focus.split(",") if a.strip()]
        focus_conds = []
        for area in areas:
            focus_conds.append(PlanSkill.focus_area == area)
            if area in _FOCUS_TO_LEVEL:
                level = _FOCUS_TO_LEVEL[area]
                focus_conds.append(
                    and_(
                        or_(PlanSkill.focus_area.is_(None), PlanSkill.focus_area == ""),
                        PlanSkill.proficiency_level == level,
                    )
                )
        if focus_conds:
            query = query.filter(or_(*focus_conds))

    shift_nums = _parse_csv_ints(shift)
    if shift_nums:
        query = query.filter(Team.shift.in_(shift_nums))

    content_id_list = _parse_csv_ints(content_ids)
    if content_id_list and content_completed is not None:
        for cid in content_id_list:
            completion_exists = exists().where(
                and_(
                    UserContentCompletion.user_id == User.id,
                    UserContentCompletion.plan_skill_id == PlanSkill.id,
                    UserContentCompletion.content_id == cid,
                    UserContentCompletion.completed.is_(True),
                )
            )
            if content_completed:
                query = query.filter(completion_exists)
            else:
                query = query.filter(~completion_exists)

    query = query.order_by(Skill.name, User.name)
    rows = query.all()

    progress_map = _compute_explorer_progress_batch(db, rows)

    content_titles: dict[int, tuple[str, int]] = {}
    if content_id_list:
        for content in (
            db.query(SkillLevelContent)
            .filter(SkillLevelContent.id.in_(content_id_list))
            .all()
        ):
            content_titles[content.id] = (content.title, content.level)

    completion_map: dict[tuple[int, int], dict[int, bool]] = {}
    if content_id_list and rows:
        plan_skill_ids = [ps.id for ps, _, _, _ in rows]
        user_ids = [u.id for _, _, u, _ in rows]
        completions = (
            db.query(UserContentCompletion)
            .filter(
                UserContentCompletion.plan_skill_id.in_(plan_skill_ids),
                UserContentCompletion.user_id.in_(user_ids),
                UserContentCompletion.content_id.in_(content_id_list),
            )
            .all()
        )
        for comp in completions:
            key = (comp.user_id, comp.plan_skill_id)
            completion_map.setdefault(key, {})[comp.content_id] = bool(comp.completed)

    results: list[ExplorerEngineerResult] = []
    for plan_skill, skill, user, team in rows:
        content_matches: list[ExplorerContentMatch] = []
        if content_id_list:
            key = (user.id, plan_skill.id)
            comp_by_content = completion_map.get(key, {})
            for cid in content_id_list:
                title, level = content_titles.get(cid, (f"Item #{cid}", 0))
                content_matches.append(
                    ExplorerContentMatch(
                        content_id=cid,
                        title=title,
                        level=level,
                        level_label=_LEVEL_TO_FOCUS.get(level, "Content"),
                        completed=comp_by_content.get(cid, False),
                    )
                )

        results.append(
            ExplorerEngineerResult(
                engineer_id=user.id,
                engineer_name=user.name,
                team_id=team.id if team else None,
                team_name=team.name if team else None,
                shift=team.shift if team else None,
                skill_id=skill.id,
                skill_name=skill.name,
                status=plan_skill.status.value,
                proficiency_level=plan_skill.proficiency_level,
                development_focus=_development_focus_label(
                    plan_skill.focus_area,
                    plan_skill.proficiency_level,
                    plan_skill.status.value,
                ),
                progress=progress_map.get(plan_skill.id),
                content_matches=content_matches,
            )
        )

    return ExplorerResponse(results=results, total=len(results))


@router.get("/compare", response_model=CompareResponse)
def compare_teams(
    team_a: Optional[int] = Query(None),
    team_b: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if team_a is None or team_b is None:
        raise HTTPException(
            status_code=400, detail="Both team_a and team_b are required"
        )

    team_a_obj = db.query(Team).filter(Team.id == team_a).first()
    if team_a_obj is None:
        raise HTTPException(status_code=404, detail=f"Team {team_a} not found")

    team_b_obj = db.query(Team).filter(Team.id == team_b).first()
    if team_b_obj is None:
        raise HTTPException(status_code=404, detail=f"Team {team_b} not found")

    skills_a = (
        db.query(Skill)
        .join(SkillTeam, Skill.id == SkillTeam.skill_id)
        .filter(SkillTeam.team_id == team_a, Skill.is_archived == False)  # noqa: E712
        .all()
    )

    skills_b = (
        db.query(Skill)
        .join(SkillTeam, Skill.id == SkillTeam.skill_id)
        .filter(SkillTeam.team_id == team_b, Skill.is_archived == False)  # noqa: E712
        .all()
    )

    ids_a = {s.id for s in skills_a}
    ids_b = {s.id for s in skills_b}
    overlap_ids = ids_a & ids_b
    union_count = len(ids_a | ids_b)
    overlap_count = len(overlap_ids)
    overlap_percent = (
        round((overlap_count / union_count) * 100, 1) if union_count > 0 else 0.0
    )

    return CompareResponse(
        team_a=CompareTeamResult(
            team_id=team_a_obj.id,
            team_name=team_a_obj.name,
            skills=[
                CompareSkillInfo(id=s.id, name=s.name, is_overlap=s.id in overlap_ids)
                for s in skills_a
            ],
        ),
        team_b=CompareTeamResult(
            team_id=team_b_obj.id,
            team_name=team_b_obj.name,
            skills=[
                CompareSkillInfo(id=s.id, name=s.name, is_overlap=s.id in overlap_ids)
                for s in skills_b
            ],
        ),
        overlap_count=overlap_count,
        overlap_percent=overlap_percent,
    )


@router.get("/duplicate-check", response_model=DuplicateWarningResponse)
def duplicate_check(
    name: str = Query(..., min_length=1),
    exclude_skill_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    return DuplicateWarningResponse(
        warnings=fuzzy_duplicate_warnings(db, name, exclude_skill_id=exclude_skill_id)
    )


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skill = _eager_load_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return _to_skill_response(skill)


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: int,
    data: SkillUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_custom:
        raise HTTPException(status_code=400, detail="Cannot edit personal skills via catalog API")

    access = manager_skill_access(db, current_user, skill_id)
    if access == "none":
        raise HTTPException(status_code=403, detail="Not authorized to edit this skill")

    if access == "consumer":
        restricted = [
            data.name,
            data.description,
            data.icon,
            data.tag_names,
            data.certificate_ids,
            data.category_ids,
            data.is_non_technical,
            data.owner_team_ids,
            data.team_ids,
        ]
        if any(v is not None for v in restricted):
            raise HTTPException(
                status_code=403,
                detail="Consumer managers may only update consumer team associations",
            )
        if data.consumer_team_ids is not None:
            consumers = resolve_manager_consumer_team_ids(
                current_user, skill_id, data.consumer_team_ids, db
            )
            owners = sorted(skill_owner_team_ids(db, skill_id))
            sync_skill_team_roles(db, skill_id, owners, consumers)
            notify_skill_event(
                db,
                skill,
                "ownership_changed",
                f'Consumer teams updated for "{skill.name}"',
                exclude_user_id=current_user.id,
            )
            db.commit()
        loaded = _eager_load_skill(db, skill_id)
        return _to_skill_response(loaded)

    updated = False

    # Handle is_non_technical reclassification BEFORE ownership processing
    if data.is_non_technical is not None:
        ntech_team_ids = [
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        ]
        if not ntech_team_ids:
            raise HTTPException(
                status_code=400,
                detail="Non-Technical team (NTECH-GEN) not found in catalog",
            )
        current_team_ids = [
            st.team_id
            for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
        ]
        current_is_ntech = any(tid in ntech_team_ids for tid in current_team_ids)

        if data.is_non_technical and not current_is_ntech:
            if data.owner_team_ids or data.team_ids:
                check_ids = data.owner_team_ids or data.team_ids or []
                invalid = [tid for tid in check_ids if tid not in ntech_team_ids]
                if invalid:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Non-technical skill must only be assigned to NTECH-GEN "
                            f"teams; invalid team_ids: {invalid}"
                        ),
                    )
            else:
                data.owner_team_ids = ntech_team_ids
        elif (not data.is_non_technical) and current_is_ntech:
            if not (data.owner_team_ids or data.team_ids):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Reclassifying to Technical requires owner_team_ids for the "
                        "new regular team assignments"
                    ),
                )
            check_ids = data.owner_team_ids or data.team_ids or []
            invalid = [tid for tid in check_ids if tid in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Technical skill cannot be assigned to NTECH-GEN teams; "
                        f"invalid team_ids: {invalid}"
                    ),
                )
        elif data.is_non_technical and current_is_ntech and (data.owner_team_ids or data.team_ids):
            check_ids = data.owner_team_ids or data.team_ids or []
            invalid = [tid for tid in check_ids if tid not in ntech_team_ids]
            if invalid:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Non-technical skill must only be assigned to NTECH-GEN "
                        f"teams; invalid team_ids: {invalid}"
                    ),
                )

        if data.is_non_technical:
            data.category_ids = []

    if data.name is not None:
        new_name = data.name.strip()
        if active_catalog_skill_name_exists(db, new_name, exclude_skill_id=skill_id):
            raise HTTPException(status_code=400, detail="Skill name must be unique in catalog")
        skill.name = new_name
        updated = True

    if data.description is not None:
        skill.description = data.description
        updated = True

    if data.icon is not None:
        skill.icon = data.icon
        updated = True

    ownership_changed = False
    if (
        data.owner_team_ids is not None
        or data.team_ids is not None
        or data.consumer_team_ids is not None
    ):
        owner_ids = sorted(skill_owner_team_ids(db, skill_id))
        consumer_ids = sorted(skill_consumer_team_ids(db, skill_id))
        if data.owner_team_ids is not None or data.team_ids is not None:
            requested = _resolve_owner_ids_from_payload(
                data.owner_team_ids, data.team_ids
            )
            if current_user.role == UserRole.admin or access == "owner":
                owner_ids = sorted(set(requested))
                if not owner_ids:
                    raise HTTPException(
                        status_code=400,
                        detail="Skill must have at least one owner team",
                    )
            else:
                owner_ids = resolve_manager_owner_team_ids(
                    current_user, skill_id, requested, db
                )
        if data.consumer_team_ids is not None:
            if current_user.role == UserRole.admin or access == "owner":
                consumer_ids = sorted(
                    set(data.consumer_team_ids) - set(owner_ids)
                )
            else:
                consumer_ids = resolve_manager_consumer_team_ids(
                    current_user, skill_id, data.consumer_team_ids, db
                )
        for tid in set(owner_ids) | set(consumer_ids):
            if not db.query(Team).filter(Team.id == tid).first():
                raise HTTPException(status_code=400, detail=f"Team {tid} not found")
        sync_skill_team_roles(db, skill_id, owner_ids, consumer_ids)
        ownership_changed = True
        updated = True

    if data.tag_names is not None:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        for tag_name in data.tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(SkillTag(skill_id=skill_id, tag_id=tag.id))
        updated = True

    if data.certificate_ids is not None:
        _sync_certificate_m2m(db, skill_id, data.certificate_ids)
        updated = True

    if data.category_ids is not None:
        ntech_team_ids = {
            t.id
            for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
        }
        current_team_ids = [
            st.team_id
            for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
        ]
        is_ntech = (
            data.is_non_technical
            if data.is_non_technical is not None
            else any(tid in ntech_team_ids for tid in current_team_ids)
        )
        _sync_category_m2m(db, skill_id, [] if is_ntech else data.category_ids)
        updated = True

    if updated:
        skill.updated_at = datetime.utcnow()
        event = "ownership_changed" if ownership_changed else "skill_updated"
        notify_skill_event(
            db,
            skill,
            event,
            f'Catalog skill updated: "{skill.name}"',
            exclude_user_id=current_user.id,
        )

    db.commit()

    loaded = _eager_load_skill(db, skill_id)
    warnings = (
        fuzzy_duplicate_warnings(db, skill.name, exclude_skill_id=skill_id)
        if data.name is not None
        else []
    )
    return _to_skill_response(loaded, duplicate_warnings=warnings)


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    require_owner_or_admin(db, current_user, skill_id)
    result = delete_catalog_skill_with_forks(db, skill, current_user.id)
    db.commit()
    return result


@router.post("/{skill_id}/duplicate", response_model=SkillResponse)
def duplicate_skill_endpoint(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = _eager_load_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_custom:
        raise HTTPException(status_code=400, detail="Cannot duplicate personal skills")

    if current_user.role == UserRole.manager and current_user.team_id is None:
        raise HTTPException(
            status_code=400,
            detail="Manager must belong to a team to duplicate skills",
        )
    clone = duplicate_skill(db, skill, current_user)
    db.commit()
    loaded = _eager_load_skill(db, clone.id)
    warnings = fuzzy_duplicate_warnings(db, clone.name, exclude_skill_id=clone.id)
    return _to_skill_response(loaded, duplicate_warnings=warnings)


@router.post("/{skill_id}/join-consumer", response_model=SkillResponse)
def join_consumer_team(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.manager),
):
    """Attach the manager's team as a consumer on a skill they do not own."""
    if current_user.team_id is None:
        raise HTTPException(
            status_code=400,
            detail="Manager must belong to a team",
        )
    skill = _eager_load_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_custom:
        raise HTTPException(status_code=400, detail="Cannot join personal skills")

    access = manager_skill_access(db, current_user, skill_id)
    if access in ("admin", "owner"):
        raise HTTPException(
            status_code=400,
            detail="Your team already owns this skill",
        )
    if access == "consumer":
        raise HTTPException(
            status_code=400,
            detail="Your team is already a consumer",
        )

    owners = sorted(skill_owner_team_ids(db, skill_id))
    consumers = sorted(
        skill_consumer_team_ids(db, skill_id) | {current_user.team_id}
    )
    sync_skill_team_roles(db, skill_id, owners, consumers)
    notify_skill_event(
        db,
        skill,
        "ownership_changed",
        f'Consumer team joined for "{skill.name}"',
        exclude_user_id=current_user.id,
    )
    db.commit()
    loaded = _eager_load_skill(db, skill_id)
    return _to_skill_response(loaded)


@router.delete("/{skill_id}/consumer-teams/{team_id}", response_model=SkillResponse)
def remove_consumer_team(
    skill_id: int,
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    """Remove a team from consumer associations on a skill."""
    skill = _eager_load_skill(db, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    if skill.is_custom:
        raise HTTPException(status_code=400, detail="Cannot update personal skills")

    access = manager_skill_access(db, current_user, skill_id)
    if access == "none":
        raise HTTPException(status_code=403, detail="Not authorized to update this skill")

    existing_consumers = skill_consumer_team_ids(db, skill_id)
    if team_id not in existing_consumers:
        raise HTTPException(
            status_code=400,
            detail="Team is not a consumer on this skill",
        )

    if current_user.role == UserRole.admin or access == "owner":
        pass
    elif access == "consumer":
        allowed = manager_accessible_team_ids(current_user, db)
        if team_id not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to remove this consumer team",
            )
    else:
        raise HTTPException(status_code=403, detail="Not authorized to remove consumer teams")

    owners = sorted(skill_owner_team_ids(db, skill_id))
    consumers = sorted(existing_consumers - {team_id})
    sync_skill_team_roles(db, skill_id, owners, consumers)
    notify_skill_event(
        db,
        skill,
        "ownership_changed",
        f'Consumer team removed from "{skill.name}"',
        exclude_user_id=current_user.id,
    )
    db.commit()
    loaded = _eager_load_skill(db, skill_id)
    return _to_skill_response(loaded)


@router.get("/{skill_id}/delete-preview")
def skill_delete_preview(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    require_owner_or_admin(db, current_user, skill_id)
    return delete_preview(db, skill_id)


@router.get("/{skill_id}/cascade-preview")
def cascade_preview(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    """Legacy alias for delete-preview."""
    require_owner_or_admin(db, current_user, skill_id)
    return delete_preview(db, skill_id)


@router.get("/{skill_id}/reclassify-preview")
def reclassify_preview(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    ntech_team_ids = {
        t.id
        for t in db.query(Team).filter(Team.name.like("TAC-NTECH-GEN-%")).all()
    }
    current_team_ids = [
        st.team_id
        for st in db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).all()
    ]
    current_is_non_technical = any(tid in ntech_team_ids for tid in current_team_ids)

    engineers_affected = (
        db.query(PlanSkill.plan_id)
        .filter(PlanSkill.skill_id == skill_id)
        .distinct()
        .count()
    )

    return {
        "skill_id": skill_id,
        "skill_name": skill.name,
        "current_is_non_technical": current_is_non_technical,
        "engineers_affected": engineers_affected,
        "current_team_count": len(current_team_ids),
    }


@router.delete("/{skill_id}/cascade")
def cascade_delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    """Legacy alias — forks personal copies then removes catalog skill."""
    return delete_skill(skill_id, db, current_user)


@router.post("/{skill_id}/assignments")
def update_skill_assignments(
    skill_id: int,
    data: SkillAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    sync_skill_team_roles(db, skill_id, data.team_ids, [])

    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete()
    for cid in data.certificate_ids:
        db.add(SkillCertificate(skill_id=skill_id, certificate_id=cid))

    if data.tag_names is not None:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        for tag_name in data.tag_names:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if not tag:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(SkillTag(skill_id=skill_id, tag_id=tag.id))

    skill.catalog_version += 1
    skill.updated_at = datetime.utcnow()

    db.commit()
    return {"status": "success"}


@router.post("/{skill_id}/content", response_model=SkillLevelContentResponse)
def add_skill_content(
    skill_id: int,
    data: SkillLevelContentCreate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    _check_manager_skill_edit_access(current_user, skill_id, db)

    if data.level not in (1, 2, 3, 4, 5):
        raise HTTPException(status_code=400, detail="Level must be between 1 and 5")

    if data.position is not None:
        position = data.position
    else:
        from sqlalchemy import func

        max_pos = (
            db.query(func.max(SkillLevelContent.position))
            .filter(
                SkillLevelContent.skill_id == skill_id,
                SkillLevelContent.level == data.level,
            )
            .scalar()
        )
        position = (max_pos or 0) + 1

    content = SkillLevelContent(
        skill_id=skill_id,
        level=data.level,
        type=data.type,
        title=data.title,
        description=data.description,
        url=data.url,
        position=position,
        created_at=datetime.utcnow(),
    )
    db.add(content)
    db.commit()
    db.refresh(content)
    return content


@router.get("/{skill_id}/content", response_model=list[SkillLevelContentResponse])
def list_skill_content(
    skill_id: int,
    level: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    query = db.query(SkillLevelContent).filter(SkillLevelContent.skill_id == skill_id)
    if level is not None:
        query = query.filter(SkillLevelContent.level == level)

    return query.order_by(
        SkillLevelContent.level, SkillLevelContent.position, SkillLevelContent.id
    ).all()


@router.put("/{skill_id}/content/reorder")
def reorder_skill_content(
    skill_id: int,
    data: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    _check_manager_skill_edit_access(current_user, skill_id, db)

    for item in data.items:
        content = (
            db.query(SkillLevelContent)
            .filter(
                SkillLevelContent.id == item.id, SkillLevelContent.skill_id == skill_id
            )
            .first()
        )
        if content is None:
            raise HTTPException(
                status_code=404, detail=f"Content item {item.id} not found"
            )
        content.position = item.position

    db.commit()
    return {"detail": "Reorder successful"}


@router.put(
    "/{skill_id}/content/{content_id}", response_model=SkillLevelContentResponse
)
def update_skill_content(
    skill_id: int,
    content_id: int,
    data: SkillLevelContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id, SkillLevelContent.skill_id == skill_id
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    _check_manager_skill_edit_access(current_user, skill_id, db)

    if data.level is not None:
        if data.level not in (1, 2, 3, 4, 5):
            raise HTTPException(status_code=400, detail="Level must be between 1 and 5")
        content.level = data.level

    if data.type is not None:
        content.type = data.type
    if data.title is not None:
        content.title = data.title
    if data.description is not None:
        content.description = data.description
    if data.url is not None:
        content.url = data.url
    if data.position is not None:
        content.position = data.position

    db.commit()
    db.refresh(content)
    return content


def _purge_catalog_content_plan_refs(db: Session, content_id: int) -> None:
    """Remove plan-side rows that FK to a catalog content item before hard-delete."""
    db.query(UserContentCompletion).filter(
        UserContentCompletion.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(UserContentOverride).filter(
        UserContentOverride.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(HiddenCatalogContent).filter(
        HiddenCatalogContent.content_id == content_id
    ).delete(synchronize_session=False)
    db.query(UserCatalogDisplayOrder).filter(
        UserCatalogDisplayOrder.content_id == content_id
    ).delete(synchronize_session=False)


@router.delete("/{skill_id}/content/{content_id}")
def delete_skill_content(
    skill_id: int,
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin, UserRole.manager),
):
    content = (
        db.query(SkillLevelContent)
        .filter(
            SkillLevelContent.id == content_id, SkillLevelContent.skill_id == skill_id
        )
        .first()
    )
    if content is None:
        raise HTTPException(status_code=404, detail="Content item not found")

    require_owner_or_admin(db, current_user, skill_id)

    convert_catalog_content_to_personal(db, content, current_user.id)
    db.delete(content)
    db.commit()
    return {"detail": "Content item deleted and converted for affected engineers"}
