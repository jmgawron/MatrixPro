from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.org import Domain, Team
from app.models.plan import PlanSkill
from app.models.skill import Skill, SkillLevelContent, SkillTag, SkillTeam, Tag
from app.models.user import User, UserRole
from app.schemas.skill import (
    SkillCreate,
    SkillLevelContentCreate,
    SkillLevelContentResponse,
    SkillResponse,
    SkillUpdate,
    TagResponse,
    TeamInfo,
)

router = APIRouter(prefix="/api/skills", tags=["skills"])


def _eager_load_skill(db: Session, skill_id: int) -> Optional[Skill]:
    return (
        db.query(Skill)
        .options(
            selectinload(Skill.skill_tags).selectinload(SkillTag.tag),
            selectinload(Skill.skill_teams).selectinload(SkillTeam.team),
        )
        .filter(Skill.id == skill_id)
        .first()
    )


def _to_skill_response(skill: Skill) -> SkillResponse:
    return SkillResponse(
        id=skill.id,
        name=skill.name,
        description=skill.description,
        domain_id=skill.domain_id,
        is_future=skill.is_future,
        is_archived=skill.is_archived,
        catalog_version=skill.catalog_version,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
        tags=[TagResponse.model_validate(st.tag) for st in skill.skill_tags],
        teams=[TeamInfo(id=st.team.id, name=st.team.name) for st in skill.skill_teams],
    )


@router.get("/", response_model=list[SkillResponse])
def list_skills(
    search: Optional[str] = Query(None),
    domain_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    is_future: Optional[bool] = Query(None),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Skill).options(
        selectinload(Skill.skill_tags).selectinload(SkillTag.tag),
        selectinload(Skill.skill_teams).selectinload(SkillTeam.team),
    )

    if not include_archived:
        query = query.filter(Skill.is_archived == False)  # noqa: E712

    if domain_id is not None:
        query = query.filter(Skill.domain_id == domain_id)

    if is_future is not None:
        query = query.filter(Skill.is_future == is_future)

    if team_id is not None:
        query = query.join(SkillTeam, Skill.id == SkillTeam.skill_id).filter(
            SkillTeam.team_id == team_id
        )

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
    if not db.query(Domain).filter(Domain.id == data.domain_id).first():
        raise HTTPException(status_code=404, detail="Domain not found")

    for tid in data.team_ids:
        if not db.query(Team).filter(Team.id == tid).first():
            raise HTTPException(status_code=400, detail=f"Team {tid} not found")

    skill = Skill(
        name=data.name,
        description=data.description,
        domain_id=data.domain_id,
        is_future=data.is_future,
        is_archived=False,
        catalog_version=1,
        created_at=datetime.utcnow(),
    )
    db.add(skill)
    db.flush()

    for tid in data.team_ids:
        db.add(SkillTeam(skill_id=skill.id, team_id=tid))

    for tag_name in data.tag_names:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if not tag:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        db.add(SkillTag(skill_id=skill.id, tag_id=tag.id))

    db.commit()

    loaded = _eager_load_skill(db, skill.id)
    return _to_skill_response(loaded)


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

    updated = False

    if data.name is not None:
        skill.name = data.name
        updated = True

    if data.description is not None:
        skill.description = data.description
        updated = True

    if data.is_future is not None:
        skill.is_future = data.is_future
        updated = True

    if data.is_archived is not None:
        skill.is_archived = data.is_archived
        updated = True

    if data.team_ids is not None:
        for tid in data.team_ids:
            if not db.query(Team).filter(Team.id == tid).first():
                raise HTTPException(status_code=400, detail=f"Team {tid} not found")
        db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
        for tid in data.team_ids:
            db.add(SkillTeam(skill_id=skill_id, team_id=tid))
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

    if updated:
        skill.catalog_version += 1
        skill.updated_at = datetime.utcnow()

    db.commit()

    loaded = _eager_load_skill(db, skill_id)
    return _to_skill_response(loaded)


@router.delete("/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = require_role(UserRole.admin),
):
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    in_plan = db.query(PlanSkill).filter(PlanSkill.skill_id == skill_id).first()

    if in_plan:
        skill.is_archived = True
        skill.catalog_version += 1
        skill.updated_at = datetime.utcnow()
        db.commit()
        return {"detail": "Skill archived"}
    else:
        db.query(SkillTag).filter(SkillTag.skill_id == skill_id).delete()
        db.query(SkillTeam).filter(SkillTeam.skill_id == skill_id).delete()
        db.query(SkillLevelContent).filter(
            SkillLevelContent.skill_id == skill_id
        ).delete()
        db.delete(skill)
        db.commit()
        return {"detail": "Skill deleted"}


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

    if data.level not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Level must be 1, 2, or 3")

    content = SkillLevelContent(
        skill_id=skill_id,
        level=data.level,
        type=data.type,
        title=data.title,
        description=data.description,
        url=data.url,
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

    return query.order_by(SkillLevelContent.level, SkillLevelContent.id).all()
