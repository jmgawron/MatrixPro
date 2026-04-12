from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# M2M association tables
# ---------------------------------------------------------------------------


class SkillOrganisation(Base):
    __tablename__ = "skill_organisations"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_organisations")
    organisation = relationship("Organisation", back_populates="skill_organisations")


class SkillDomain(Base):
    __tablename__ = "skill_domains"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_domains")
    domain = relationship("Domain", back_populates="skill_domains")


class SkillShift(Base):
    __tablename__ = "skill_shifts"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_shifts")
    shift = relationship("Shift", back_populates="skill_shifts")


class SkillCertificate(Base):
    __tablename__ = "skill_certificates"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_certificates")
    certificate = relationship("Certificate", back_populates="skill_certificates")


class SkillCampaign(Base):
    __tablename__ = "skill_campaigns"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_campaigns")
    campaign = relationship("Campaign", back_populates="skill_campaigns")


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    domain = relationship("Domain", back_populates="shifts")
    skill_shifts = relationship("SkillShift", back_populates="shift")


class CertificationDomain(Base):
    __tablename__ = "certification_domains"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    certificates = relationship("Certificate", back_populates="certification_domain")


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    certification_domain_id = Column(
        Integer, ForeignKey("certification_domains.id"), nullable=False
    )
    created_at = Column(DateTime, default=datetime.utcnow)

    certification_domain = relationship(
        "CertificationDomain", back_populates="certificates"
    )
    skill_certificates = relationship("SkillCertificate", back_populates="certificate")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_mandatory = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    organisation = relationship("Organisation", back_populates="campaigns")
    domain = relationship("Domain", back_populates="campaigns")
    skill_campaigns = relationship("SkillCampaign", back_populates="campaign")
