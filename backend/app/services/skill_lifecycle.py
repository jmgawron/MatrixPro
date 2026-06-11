"""Skill delete-fork, duplicate, and catalog content → personal item conversion."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.catalog import SkillCertificate
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
    SkillCategoryAssignment,
    SkillLevelContent,
    SkillTag,
    SkillTeam,
)
from app.models.user import User
from app.services.notifications import notify_skill_event
from app.services.skill_ownership import (
    ROLE_OWNER,
    active_catalog_skill_name_exists,
)


def _copy_skill_associations(
    db: Session,
    source_skill: Skill,
    target_skill_id: int,
) -> dict[int, int]:
    """Copy categories, tags, certs, level content. Returns old_content_id → new_content_id."""
    for sca in (
        db.query(SkillCategoryAssignment)
        .filter(SkillCategoryAssignment.skill_id == source_skill.id)
        .all()
    ):
        db.add(
            SkillCategoryAssignment(
                skill_id=target_skill_id, category_id=sca.category_id
            )
        )

    for st in db.query(SkillTag).filter(SkillTag.skill_id == source_skill.id).all():
        db.add(SkillTag(skill_id=target_skill_id, tag_id=st.tag_id))

    for sc in (
        db.query(SkillCertificate)
        .filter(SkillCertificate.skill_id == source_skill.id)
        .all()
    ):
        db.add(
            SkillCertificate(skill_id=target_skill_id, certificate_id=sc.certificate_id)
        )

    content_map: dict[int, int] = {}
    for item in (
        db.query(SkillLevelContent)
        .filter(SkillLevelContent.skill_id == source_skill.id)
        .order_by(SkillLevelContent.level, SkillLevelContent.position)
        .all()
    ):
        clone = SkillLevelContent(
            skill_id=target_skill_id,
            level=item.level,
            type=item.type,
            title=item.title,
            description=item.description,
            url=item.url,
            position=item.position,
            created_at=item.created_at or datetime.utcnow(),
        )
        db.add(clone)
        db.flush()
        content_map[item.id] = clone.id
    return content_map


def _migrate_plan_skill_refs(
    db: Session,
    engineer_id: int,
    plan_skill_id: int,
    content_map: dict[int, int],
    new_skill_id: int,
) -> None:
    for old_cid, new_cid in content_map.items():
        for comp in (
            db.query(UserContentCompletion)
            .filter(
                UserContentCompletion.user_id == engineer_id,
                UserContentCompletion.plan_skill_id == plan_skill_id,
                UserContentCompletion.content_id == old_cid,
            )
            .all()
        ):
            comp.content_id = new_cid

        for hid in (
            db.query(HiddenCatalogContent)
            .filter(
                HiddenCatalogContent.user_id == engineer_id,
                HiddenCatalogContent.plan_skill_id == plan_skill_id,
                HiddenCatalogContent.content_id == old_cid,
            )
            .all()
        ):
            hid.content_id = new_cid

        for ovr in (
            db.query(UserContentOverride)
            .filter(
                UserContentOverride.user_id == engineer_id,
                UserContentOverride.plan_skill_id == plan_skill_id,
                UserContentOverride.content_id == old_cid,
            )
            .all()
        ):
            ovr.content_id = new_cid

        for order in (
            db.query(UserCatalogDisplayOrder)
            .filter(
                UserCatalogDisplayOrder.user_id == engineer_id,
                UserCatalogDisplayOrder.plan_skill_id == plan_skill_id,
                UserCatalogDisplayOrder.content_id == old_cid,
            )
            .all()
        ):
            order.content_id = new_cid

    for ulc in (
        db.query(UserLevelContent)
        .filter(
            UserLevelContent.user_id == engineer_id,
            UserLevelContent.plan_skill_id == plan_skill_id,
        )
        .all()
    ):
        ulc.skill_id = new_skill_id


def fork_catalog_plan_skills_for_detached_teams(
    db: Session,
    source_skill: Skill,
    detached_team_ids: set[int],
) -> int:
    """
    When a team loses owner/consumer access to a catalog skill, engineers on that
    team who still have the skill in their plan receive a personal fork.
    """
    if source_skill.is_custom or not detached_team_ids:
        return 0

    catalog_skill_id = source_skill.id
    forks_created = 0

    for team_id in detached_team_ids:
        member_ids = [
            row[0]
            for row in db.query(User.id).filter(User.team_id == team_id).all()
        ]
        if not member_ids:
            continue

        plans = (
            db.query(DevelopmentPlan)
            .filter(DevelopmentPlan.engineer_id.in_(member_ids))
            .all()
        )
        for plan in plans:
            plan_skill = (
                db.query(PlanSkill)
                .filter(
                    PlanSkill.plan_id == plan.id,
                    PlanSkill.skill_id == catalog_skill_id,
                )
                .first()
            )
            if plan_skill is None:
                continue
            fork_skill_for_engineer(db, source_skill, plan.engineer_id, plan_skill)
            forks_created += 1

    return forks_created


def fork_skill_for_engineer(
    db: Session,
    source_skill: Skill,
    engineer_id: int,
    plan_skill: PlanSkill,
) -> Skill:
    """Create per-engineer personal copy and repoint plan_skill."""
    fork = Skill(
        name=source_skill.name,
        description=source_skill.description,
        icon=source_skill.icon or "personal",
        is_archived=False,
        is_orphaned=False,
        is_custom=True,
        owner_id=engineer_id,
        catalog_version=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(fork)
    db.flush()

    content_map = _copy_skill_associations(db, source_skill, fork.id)
    _migrate_plan_skill_refs(db, engineer_id, plan_skill.id, content_map, fork.id)
    plan_skill.skill_id = fork.id
    plan_skill.updated_at = datetime.utcnow()
    return fork


def delete_catalog_skill_with_forks(
    db: Session,
    skill: Skill,
    actor_id: int,
) -> dict:
    """
    Remove catalog skill; fork per engineer with plan reference.
    Returns summary dict for API response.
    """
    if skill.is_custom:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Cannot delete personal skills via catalog delete")

    plan_rows = (
        db.query(PlanSkill, DevelopmentPlan)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(PlanSkill.skill_id == skill.id)
        .all()
    )

    forks_created = 0
    for plan_skill, plan in plan_rows:
        fork_skill_for_engineer(db, skill, plan.engineer_id, plan_skill)
        forks_created += 1

    db.flush()

    skill_name = skill.name
    skill_id = skill.id

    notify_skill_event(
        db,
        skill,
        "skill_deleted",
        f'Catalog skill removed: "{skill_name}"',
        body="Affected engineers retain a personal copy in their development plan.",
        payload={"forks_created": forks_created},
        exclude_user_id=actor_id,
    )

    db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete(
        synchronize_session=False
    )
    db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete(
        synchronize_session=False
    )
    db.query(SkillCertificate).filter(SkillCertificate.skill_id == skill_id).delete(
        synchronize_session=False
    )
    db.query(SkillCategoryAssignment).filter(
        SkillCategoryAssignment.skill_id == skill_id
    ).delete(synchronize_session=False)
    db.query(SkillLevelContent).filter(SkillLevelContent.skill_id == skill_id).delete(
        synchronize_session=False
    )
    db.query(Skill).filter(Skill.id == skill_id).delete(synchronize_session=False)

    return {
        "detail": "Skill deleted from catalog",
        "engineers_forked": forks_created,
        "skill_name": skill_name,
    }


def delete_preview(db: Session, skill_id: int) -> dict:
    from app.models.plan import PlanSkillTrainingLog

    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Skill not found")

    plan_skill_ids = [
        ps.id for ps in db.query(PlanSkill.id).filter(PlanSkill.skill_id == skill_id).all()
    ]
    engineer_count = (
        db.query(DevelopmentPlan.engineer_id)
        .join(PlanSkill, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(PlanSkill.skill_id == skill_id)
        .distinct()
        .count()
    )
    log_count = 0
    if plan_skill_ids:
        log_count = (
            db.query(PlanSkillTrainingLog)
            .filter(PlanSkillTrainingLog.plan_skill_id.in_(plan_skill_ids))
            .count()
        )
    return {
        "skill_id": skill_id,
        "skill_name": skill.name,
        "engineers_affected": engineer_count,
        "plan_skills_affected": len(plan_skill_ids),
        "training_logs_preserved": log_count,
    }


def convert_catalog_content_to_personal(
    db: Session,
    content: SkillLevelContent,
    actor_id: int,
) -> int:
    """
    When catalog content is deleted, convert to UserLevelContent for affected engineers.
    Returns count of personal items created.
    """
    skill_id = content.skill_id
    plan_skills = (
        db.query(PlanSkill, DevelopmentPlan)
        .join(DevelopmentPlan, PlanSkill.plan_id == DevelopmentPlan.id)
        .filter(PlanSkill.skill_id == skill_id)
        .all()
    )

    created = 0
    ctype = content.type.value if hasattr(content.type, "value") else str(content.type)

    for plan_skill, plan in plan_skills:
        engineer_id = plan.engineer_id
        hidden = (
            db.query(HiddenCatalogContent)
            .filter(
                HiddenCatalogContent.user_id == engineer_id,
                HiddenCatalogContent.plan_skill_id == plan_skill.id,
                HiddenCatalogContent.content_id == content.id,
            )
            .first()
        )
        completion = (
            db.query(UserContentCompletion)
            .filter(
                UserContentCompletion.user_id == engineer_id,
                UserContentCompletion.plan_skill_id == plan_skill.id,
                UserContentCompletion.content_id == content.id,
            )
            .first()
        )
        override = (
            db.query(UserContentOverride)
            .filter(
                UserContentOverride.user_id == engineer_id,
                UserContentOverride.plan_skill_id == plan_skill.id,
                UserContentOverride.content_id == content.id,
                UserContentOverride.is_active.is_(True),
            )
            .first()
        )

        if hidden and not completion and not override:
            db.query(HiddenCatalogContent).filter(
                HiddenCatalogContent.id == hidden.id
            ).delete(synchronize_session=False)
            continue

        desc = content.description
        if override and override.override_description:
            desc = override.override_description
        url = content.url
        if override and override.override_url is not None:
            url = override.override_url
        item_type = ctype
        if override and override.override_type:
            item_type = override.override_type

        max_pos = (
            db.query(UserLevelContent.position)
            .filter(
                UserLevelContent.plan_skill_id == plan_skill.id,
                UserLevelContent.level == content.level,
            )
            .order_by(UserLevelContent.position.desc())
            .first()
        )
        position = (max_pos[0] if max_pos else 1000) + 10

        ulc = UserLevelContent(
            user_id=engineer_id,
            plan_skill_id=plan_skill.id,
            skill_id=skill_id,
            level=content.level,
            type=content.type,
            title=content.title,
            description=desc,
            description_format="legacy_html",
            url=url,
            position=position,
            completed=bool(completion and completion.completed),
            completed_at=completion.completed_at if completion else None,
            is_private=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(ulc)
        created += 1

        if completion:
            db.delete(completion)
        if override:
            db.delete(override)
        if hidden:
            db.delete(hidden)
        db.query(UserCatalogDisplayOrder).filter(
            UserCatalogDisplayOrder.user_id == engineer_id,
            UserCatalogDisplayOrder.plan_skill_id == plan_skill.id,
            UserCatalogDisplayOrder.content_id == content.id,
        ).delete(synchronize_session=False)

    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill and created:
        notify_skill_event(
            db,
            skill,
            "content_removed",
            f'Catalog item removed: "{content.title}"',
            body="Converted to personal items for affected engineers.",
            payload={"content_title": content.title, "items_created": created},
            exclude_user_id=actor_id,
        )

    return created


def duplicate_skill(
    db: Session,
    source_skill: Skill,
    manager: User,
) -> Skill:
    from app.models.org import Team

    if manager.team_id is None:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail="Manager must belong to a team to duplicate a skill",
        )

    team = db.query(Team).filter(Team.id == manager.team_id).first()
    team_name = team.name if team else "Team"
    base_name = f"{source_skill.name} (Duplicated for {team_name})"
    new_name = base_name
    suffix = 2
    while active_catalog_skill_name_exists(db, new_name):
        new_name = f"{base_name} {suffix}"
        suffix += 1

    clone = Skill(
        name=new_name,
        description=source_skill.description,
        icon=source_skill.icon,
        is_archived=False,
        is_orphaned=False,
        is_custom=False,
        owner_id=None,
        catalog_version=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(clone)
    db.flush()

    _copy_skill_associations(db, source_skill, clone.id)
    db.add(
        SkillTeam(
            skill_id=clone.id,
            team_id=manager.team_id,
            role=ROLE_OWNER,
        )
    )

    notify_skill_event(
        db,
        source_skill,
        "skill_duplicated",
        f'New skill created: "{new_name}"',
        body=f"Duplicated from \"{source_skill.name}\".",
        payload={"source_skill_id": source_skill.id, "new_skill_id": clone.id},
        exclude_user_id=manager.id,
    )

    return clone
