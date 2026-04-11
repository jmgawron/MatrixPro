import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    engineer = "engineer"
    manager = "manager"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    surname = Column(String, nullable=False, default="")
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.engineer)
    avatar = Column(String, nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="users")
    manager = relationship(
        "User",
        remote_side="User.id",
        back_populates="reports",
        foreign_keys=[manager_id],
    )
    reports = relationship(
        "User", back_populates="manager", foreign_keys="User.manager_id"
    )
    development_plan = relationship(
        "DevelopmentPlan", back_populates="engineer", uselist=False
    )
    audit_logs = relationship(
        "AuditLog", back_populates="changed_by_user", foreign_keys="AuditLog.changed_by"
    )
