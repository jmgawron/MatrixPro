import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.skill import SkillLevelContentType


class PlanSkillStatus(str, enum.Enum):
    in_development = "in_development"
    in_pipeline = "in_pipeline"
    proficiency = "proficiency"


class DevelopmentPlan(Base):
    __tablename__ = "development_plans"

    id = Column(Integer, primary_key=True, index=True)
    engineer_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    engineer = relationship("User", back_populates="development_plan")
    skills = relationship("PlanSkill", back_populates="plan")


class PlanSkill(Base):
    __tablename__ = "plan_skills"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("development_plans.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    status = Column(
        Enum(PlanSkillStatus), nullable=False, default=PlanSkillStatus.in_pipeline
    )
    proficiency_level = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    skill_version_at_add = Column(Integer, nullable=False, default=1)
    added_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("DevelopmentPlan", back_populates="skills")
    skill = relationship("Skill", back_populates="plan_skills")
    training_log = relationship("PlanSkillTrainingLog", back_populates="plan_skill")


class PlanSkillTrainingLog(Base):
    __tablename__ = "plan_skill_training_log"

    id = Column(Integer, primary_key=True, index=True)
    plan_skill_id = Column(Integer, ForeignKey("plan_skills.id"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(Enum(SkillLevelContentType), nullable=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    plan_skill = relationship("PlanSkill", back_populates="training_log")
