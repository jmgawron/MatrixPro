"""Import all models so Base.metadata discovers them for create_all."""

from app.models.org import Domain, Team  # noqa: F401
from app.models.user import User, UserRole  # noqa: F401
from app.models.skill import (  # noqa: F401
    Skill,
    SkillTeam,
    Tag,
    SkillTag,
    SkillLevelContent,
    SkillLevelContentType,
)
from app.models.catalog import (  # noqa: F401
    CertificationDomain,
    Certificate,
    SkillCertificate,
)
from app.models.plan import (  # noqa: F401
    DevelopmentPlan,
    PlanSkill,
    PlanSkillStatus,
    PlanSkillTrainingLog,
    UserContentCompletion,
    UserContentOverride,
    UserLevelContent,
    HiddenCatalogContent,
)
from app.models.audit import AuditLog  # noqa: F401
from app.models.feedback import Feedback, FeedbackType  # noqa: F401
