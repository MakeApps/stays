"""Model package.

Every model is imported here so that ``Base.metadata`` is fully populated
before Alembic autogenerate runs. A model that is only imported lazily is a
model Alembic will happily propose dropping.
"""

from app.models.activity_log import ActivityAction, ActivityEntity, ActivityLog
from app.models.base import (
    GUID,
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
    utcnow,
    uuid7,
)
from app.models.booking import Booking, BookingNight, BookingStatus, PricingModeColumn
from app.models.condo import Condo, CondoImage, PropertyType
from app.models.expense import (
    Expense,
    ExpenseCategory,
    ExpenseStatus,
    PaymentMethod,
)
from app.models.user import RefreshToken, Role, User

__all__ = [
    "GUID",
    "ActivityAction",
    "ActivityEntity",
    "ActivityLog",
    "AuditMixin",
    "Base",
    "Booking",
    "BookingNight",
    "BookingStatus",
    "Condo",
    "CondoImage",
    "Expense",
    "ExpenseCategory",
    "ExpenseStatus",
    "PaymentMethod",
    "PricingModeColumn",
    "PropertyType",
    "RefreshToken",
    "Role",
    "SoftDeleteMixin",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "User",
    "utcnow",
    "uuid7",
]
