"""Import all models so Base.metadata discovers them for create_all."""

from app.models.org import Organisation, Domain, Team  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from app.models.skill import (  # noqa: F401
    Skill,
    SkillTeam,
    Tag,
    SkillTag,
    SkillLevelContent,
    SkillLevelContentType,
)
from app.models.plan import (  # noqa: F401
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
)
from app.models.audit import AuditLog  # noqa: F401
