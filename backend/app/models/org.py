import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Organisation(Base):
    __tablename__ = "organisations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    domains = relationship("Domain", back_populates="organisation")
    skill_organisations = relationship(
        "SkillOrganisation", back_populates="organisation"
    )
    campaigns = relationship("Campaign", back_populates="organisation")


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    is_technical = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organisation = relationship("Organisation", back_populates="domains")
    teams = relationship("Team", back_populates="domain")
    shifts = relationship("Shift", back_populates="domain")
    skill_domains = relationship("SkillDomain", back_populates="domain")
    campaigns = relationship("Campaign", back_populates="domain")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    domain = relationship("Domain", back_populates="teams")
    users = relationship("User", back_populates="team")
    skill_teams = relationship("SkillTeam", back_populates="team")
