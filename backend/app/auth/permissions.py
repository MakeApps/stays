"""Capability matrix.

Phase 1 only creates Admin accounts, but every endpoint declares the capability
it needs from day one. That declaration is also what the route-coverage test
asserts against: any non-public endpoint without a capability fails the build,
so authorisation cannot be forgotten on a new route.

Capabilities, not roles, are checked at call sites. Adding a fifth role later
is then a matrix edit rather than a search-and-replace across controllers.
"""

from __future__ import annotations

from typing import Final

from app.models.user import Role

# ---- capability vocabulary ----
CONDO_READ: Final = "condo:read"
CONDO_WRITE: Final = "condo:write"
CONDO_DELETE: Final = "condo:delete"

BOOKING_READ: Final = "booking:read"
BOOKING_WRITE: Final = "booking:write"
BOOKING_DELETE: Final = "booking:delete"

EXPENSE_READ: Final = "expense:read"
EXPENSE_WRITE: Final = "expense:write"
EXPENSE_DELETE: Final = "expense:delete"

INCOME_READ: Final = "income:read"
INCOME_EXPORT: Final = "income:export"

CALENDAR_READ: Final = "calendar:read"
CALENDAR_WRITE: Final = "calendar:write"

DASHBOARD_READ: Final = "dashboard:read"
ACTIVITY_READ: Final = "activity:read"

USER_READ: Final = "user:read"
USER_WRITE: Final = "user:write"

ALL_CAPABILITIES: Final[frozenset[str]] = frozenset(
    {
        CONDO_READ,
        CONDO_WRITE,
        CONDO_DELETE,
        BOOKING_READ,
        BOOKING_WRITE,
        BOOKING_DELETE,
        EXPENSE_READ,
        EXPENSE_WRITE,
        EXPENSE_DELETE,
        INCOME_READ,
        INCOME_EXPORT,
        CALENDAR_READ,
        CALENDAR_WRITE,
        DASHBOARD_READ,
        ACTIVITY_READ,
        USER_READ,
        USER_WRITE,
    }
)

# What the Users screen creates. Everything except administering accounts:
# nobody hits a permission wall doing the job, and the one power that can lock
# the owner out of their own system stays with the admin.
#
# Deliberately not _STAFF, which excludes condo deletion and income export and
# still allows listing users — a different intent, kept intact rather than
# quietly redefined under a role that already had a documented meaning.
_MANAGER: Final[frozenset[str]] = frozenset(ALL_CAPABILITIES - {USER_READ, USER_WRITE})

# A cleaner needs to know which unit to turn over and when — and nothing about
# money. That exclusion is enforced server-side, not merely hidden in the nav.
_CLEANER: Final[frozenset[str]] = frozenset(
    {CONDO_READ, CALENDAR_READ, BOOKING_READ}
)

_ACCOUNTANT: Final[frozenset[str]] = frozenset(
    {
        CONDO_READ,
        BOOKING_READ,
        CALENDAR_READ,
        EXPENSE_READ,
        EXPENSE_WRITE,
        EXPENSE_DELETE,
        INCOME_READ,
        INCOME_EXPORT,
        DASHBOARD_READ,
        ACTIVITY_READ,
    }
)

_STAFF: Final[frozenset[str]] = frozenset(
    ALL_CAPABILITIES - {CONDO_DELETE, INCOME_EXPORT, USER_WRITE}
)

MATRIX: Final[dict[Role, frozenset[str]]] = {
    Role.ADMIN: ALL_CAPABILITIES,
    Role.MANAGER: _MANAGER,
    Role.STAFF: _STAFF,
    Role.ACCOUNTANT: _ACCOUNTANT,
    Role.CLEANER: _CLEANER,
}


def capabilities_for(role: Role) -> frozenset[str]:
    return MATRIX.get(role, frozenset())


def can(role: Role, capability: str) -> bool:
    if capability not in ALL_CAPABILITIES:
        # A typo'd capability must never silently grant access.
        raise ValueError(f"Unknown capability: {capability!r}")
    return capability in capabilities_for(role)
