from datetime import datetime

from sqlalchemy import (
    Column,
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


class SkillCertificate(Base):
    __tablename__ = "skill_certificates"

    skill_id = Column(Integer, ForeignKey("skills.id"), primary_key=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"), primary_key=True)

    skill = relationship("Skill", back_populates="skill_certificates")
    certificate = relationship("Certificate", back_populates="skill_certificates")


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------


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
