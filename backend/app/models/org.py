from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_technical = Column(Boolean, default=True, nullable=False)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teams = relationship("Team", back_populates="domain")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    shift = Column(Integer, nullable=False)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    domain = relationship("Domain", back_populates="teams")
    users = relationship("User", back_populates="team")
    skill_teams = relationship("SkillTeam", back_populates="team")
