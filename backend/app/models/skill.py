import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class SkillLevelContentType(str, enum.Enum):
    course = "course"
    certification = "certification"
    reading = "reading"
    link = "link"
    action = "action"


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    is_orphaned = Column(Boolean, default=False, nullable=False)
    is_custom = Column(Boolean, default=False, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    catalog_version = Column(Integer, default=1, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    skill_teams = relationship("SkillTeam", back_populates="skill")
    skill_tags = relationship("SkillTag", back_populates="skill")
    level_content = relationship("SkillLevelContent", back_populates="skill")
    plan_skills = relationship("PlanSkill", back_populates="skill")
    skill_certificates = relationship("SkillCertificate", back_populates="skill")
    skill_categories = relationship(
        "SkillCategoryAssignment",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class SkillCategory(Base):
    """
    Classification bucket for skills (Foundational, Core, Advanced, AI & Future Skills).

    Stored as DB rows (not a Python enum) so admins can add/rename categories in the
    future without a code change. ``slug`` is a stable machine identifier; ``name`` is
    the human-facing label; ``sort_order`` controls display order in UI groupings.
    """

    __tablename__ = "skill_categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    skill_assignments = relationship(
        "SkillCategoryAssignment",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class SkillCategoryAssignment(Base):
    """M2M join: a skill may belong to multiple categories simultaneously."""

    __tablename__ = "skill_category_assignments"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    category_id = Column(Integer, ForeignKey("skill_categories.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_categories")
    category = relationship("SkillCategory", back_populates="skill_assignments")


class SkillTeam(Base):
    __tablename__ = "skill_teams"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), primary_key=True)
    # owner | consumer — extensible for contributor, reviewer (string slug, not enum)
    role = Column(String(32), nullable=False, default="owner", server_default="owner")

    skill = relationship("Skill", back_populates="skill_teams")
    team = relationship("Team", back_populates="skill_teams")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)

    skill_tags = relationship("SkillTag", back_populates="tag")


class SkillTag(Base):
    __tablename__ = "skill_tags"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_tags")
    tag = relationship("Tag", back_populates="skill_tags")


class SkillLevelContent(Base):
    __tablename__ = "skill_level_content"

    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    level = Column(Integer, nullable=False)
    type = Column(Enum(SkillLevelContentType), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    url = Column(String, nullable=True)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    skill = relationship("Skill", back_populates="level_content")
