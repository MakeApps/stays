"""Capability matrix.

The assertions that matter are the *negative* ones: a Cleaner must not reach
financial data, and that has to be true server-side rather than merely hidden
from the navigation.
"""

from __future__ import annotations

import pytest

from app.auth import permissions as perms
from app.auth.permissions import ALL_CAPABILITIES, can, capabilities_for
from app.models.user import Role


class TestMatrix:
    def test_every_role_is_covered(self) -> None:
        for role in Role:
            assert role in perms.MATRIX, f"{role} has no capability set"

    def test_admin_has_everything(self) -> None:
        assert capabilities_for(Role.ADMIN) == ALL_CAPABILITIES

    def test_no_role_claims_an_unknown_capability(self) -> None:
        for role, caps in perms.MATRIX.items():
            unknown = caps - ALL_CAPABILITIES
            assert not unknown, f"{role} claims unknown capabilities: {unknown}"

    def test_unknown_capability_raises_rather_than_denying(self) -> None:
        # A silent False would let a typo'd capability read as "denied" and
        # quietly disable a feature instead of failing loudly.
        with pytest.raises(ValueError):
            can(Role.ADMIN, "condo:teleport")


class TestCleanerIsWalledOffFromMoney:
    @pytest.mark.parametrize(
        "capability",
        [
            perms.EXPENSE_READ,
            perms.EXPENSE_WRITE,
            perms.EXPENSE_DELETE,
            perms.INCOME_READ,
            perms.INCOME_EXPORT,
            perms.DASHBOARD_READ,
        ],
    )
    def test_cannot_touch_financials(self, capability: str) -> None:
        assert not can(Role.CLEANER, capability)

    @pytest.mark.parametrize(
        "capability", [perms.CONDO_READ, perms.CALENDAR_READ, perms.BOOKING_READ]
    )
    def test_can_see_the_schedule(self, capability: str) -> None:
        assert can(Role.CLEANER, capability)

    def test_writes_nothing(self) -> None:
        writes = {c for c in ALL_CAPABILITIES if c.endswith((":write", ":delete", ":export"))}
        assert not (capabilities_for(Role.CLEANER) & writes)


class TestAccountant:
    def test_owns_expenses_and_income(self) -> None:
        for capability in (
            perms.EXPENSE_WRITE,
            perms.EXPENSE_DELETE,
            perms.INCOME_READ,
            perms.INCOME_EXPORT,
        ):
            assert can(Role.ACCOUNTANT, capability)

    def test_cannot_change_bookings_or_condos(self) -> None:
        for capability in (perms.BOOKING_WRITE, perms.CONDO_WRITE, perms.CONDO_DELETE):
            assert not can(Role.ACCOUNTANT, capability)


class TestStaff:
    def test_runs_operations(self) -> None:
        for capability in (perms.BOOKING_WRITE, perms.CONDO_WRITE, perms.EXPENSE_WRITE):
            assert can(Role.STAFF, capability)

    def test_withheld_from_destructive_and_export(self) -> None:
        for capability in (perms.CONDO_DELETE, perms.INCOME_EXPORT, perms.USER_WRITE):
            assert not can(Role.STAFF, capability)
