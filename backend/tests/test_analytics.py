"""Revenue, expenses, occupancy and profit.

The month-boundary case is the reason this phase stores a revenue share per
night rather than deriving the calendar on the fly. If a stay spanning
28 Aug – 4 Sep landed entirely in one month, every month-over-month comparison
in the product would be wrong.
"""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from app.common.money import to_minor
from app.extensions import db
from app.models.booking import BookingStatus
from app.models.condo import Condo
from app.models.expense import ExpenseCategory, ExpenseStatus, PaymentMethod
from app.services.analytics import AnalyticsService, month_bounds, previous_months
from app.services.booking_service import BookingService
from app.services.expense_service import ExpenseService
from app.services.pricing import PricingMode

D = date.fromisoformat
AUG = month_bounds(date(2026, 8, 1))
SEP = month_bounds(date(2026, 9, 1))


@pytest.fixture()
def condo(session: Any, scoped: Any) -> Condo:
    unit = Condo(code="A-1204", name="Ashton Asoke 1204", night_rate=to_minor(1000))
    session.add(unit)
    session.commit()
    return unit


@pytest.fixture()
def lookups(session: Any, scoped: Any) -> tuple[ExpenseCategory, PaymentMethod]:
    category = ExpenseCategory(name="Electricity", tone="info", position=0)
    method = PaymentMethod(name="Cash", position=0)
    session.add_all([category, method])
    session.commit()
    return category, method


@pytest.fixture()
def analytics(session: Any) -> AnalyticsService:
    return AnalyticsService(session)


def make_booking(condo: Condo, check_in: str, check_out: str, total: int) -> Any:
    booking = BookingService(db.session).create(
        condo_id=condo.id,
        guest_name="Guest",
        check_in=D(check_in),
        check_out=D(check_out),
        mode=PricingMode.TOTAL,
        total_manual=total,
    )
    db.session.commit()
    return booking


class TestMonthBounds:
    @pytest.mark.parametrize(
        ("anchor", "start", "end"),
        [
            ("2026-08-15", "2026-08-01", "2026-09-01"),
            ("2026-02-10", "2026-02-01", "2026-03-01"),  # 28-day February
            ("2024-02-10", "2024-02-01", "2024-03-01"),  # leap February
            ("2026-12-31", "2026-12-01", "2027-01-01"),  # year rollover
        ],
    )
    def test_windows(self, anchor: str, start: str, end: str) -> None:
        got = month_bounds(D(anchor))
        assert got == (D(start), D(end))

    def test_previous_months_walks_back_correctly(self) -> None:
        windows = previous_months(D("2026-01-15"), 3)
        assert [s.isoformat() for s, _ in windows] == ["2025-11-01", "2025-12-01", "2026-01-01"]


class TestAccrualRevenue:
    def test_a_stay_inside_one_month_counts_entirely_there(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        make_booking(condo, "2026-08-10", "2026-08-15", to_minor(5000))
        assert analytics.revenue_between(*AUG) == to_minor(5000)
        assert analytics.revenue_between(*SEP) == 0

    def test_a_stay_crossing_a_month_splits_by_night(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        """28 Aug → 4 Sep is 7 nights: 4 in August, 3 in September."""
        make_booking(condo, "2026-08-28", "2026-09-04", to_minor(7000))

        august = analytics.revenue_between(*AUG)
        september = analytics.revenue_between(*SEP)

        assert august == to_minor(4000)
        assert september == to_minor(3000)
        # Nothing is lost or invented at the boundary.
        assert august + september == to_minor(7000)

    def test_an_indivisible_total_still_reconciles(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        # 1000 baht over 3 nights does not divide evenly.
        make_booking(condo, "2026-08-31", "2026-09-03", to_minor(1000))
        assert analytics.revenue_between(*AUG) + analytics.revenue_between(*SEP) == to_minor(1000)

    def test_cancelled_bookings_earn_nothing(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        service = BookingService(db.session)
        service.create(
            condo_id=condo.id,
            guest_name="Cancelled",
            check_in=D("2026-08-10"),
            check_out=D("2026-08-15"),
            mode=PricingMode.TOTAL,
            total_manual=to_minor(5000),
            status=BookingStatus.CANCELLED,
        )
        db.session.commit()
        assert analytics.revenue_between(*AUG) == 0

    def test_maintenance_blocks_but_does_not_earn(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        """A unit under repair must not read as revenue or as occupancy."""
        BookingService(db.session).create(
            condo_id=condo.id,
            guest_name="Aircon replacement",
            check_in=D("2026-08-10"),
            check_out=D("2026-08-15"),
            mode=PricingMode.TOTAL,
            total_manual=0,
            status=BookingStatus.MAINTENANCE,
        )
        db.session.commit()
        assert analytics.revenue_between(*AUG) == 0
        assert analytics.nights_between(*AUG) == 0

    def test_daily_series_matches_the_total(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        make_booking(condo, "2026-08-10", "2026-08-14", to_minor(4000))
        daily = analytics.daily_revenue(*AUG)
        assert len(daily) == 4
        assert sum(daily.values()) == to_minor(4000)
        assert D("2026-08-14") not in daily  # checkout night is not occupied


class TestExpenses:
    def test_cancelled_expenses_are_excluded(
        self, analytics: AnalyticsService, condo: Condo, lookups: Any, session: Any
    ) -> None:
        category, method = lookups
        service = ExpenseService(session)
        service.create(
            condo_id=condo.id,
            category_id=category.id,
            method_id=method.id,
            spent_on=D("2026-08-05"),
            amount=to_minor(1000),
            description="Counted",
        )
        service.create(
            condo_id=condo.id,
            category_id=category.id,
            method_id=method.id,
            spent_on=D("2026-08-06"),
            amount=to_minor(9999),
            description="Cancelled bill",
            status=ExpenseStatus.CANCELLED,
        )
        session.commit()
        assert analytics.expenses_between(*AUG) == to_minor(1000)

    def test_by_category_totals_and_ordering(
        self, analytics: AnalyticsService, condo: Condo, lookups: Any, session: Any
    ) -> None:
        category, method = lookups
        other = ExpenseCategory(name="Cleaning", tone="ok", position=1)
        session.add(other)
        session.flush()

        service = ExpenseService(session)
        service.create(
            condo_id=condo.id, category_id=category.id, method_id=method.id,
            spent_on=D("2026-08-05"), amount=to_minor(500), description="Power",
        )
        service.create(
            condo_id=condo.id, category_id=other.id, method_id=method.id,
            spent_on=D("2026-08-06"), amount=to_minor(2000), description="Turnover clean",
        )
        session.commit()

        rows = analytics.expenses_by_category(*AUG)
        assert [r[0] for r in rows] == ["Cleaning", "Electricity"]  # biggest first
        assert rows[0][2] == to_minor(2000)


class TestProfitAndOccupancy:
    def test_per_condo_rollup(
        self, analytics: AnalyticsService, condo: Condo, lookups: Any, session: Any
    ) -> None:
        category, method = lookups
        make_booking(condo, "2026-08-01", "2026-08-11", to_minor(10000))  # 10 nights
        ExpenseService(session).create(
            condo_id=condo.id, category_id=category.id, method_id=method.id,
            spent_on=D("2026-08-05"), amount=to_minor(2500), description="Power",
        )
        session.commit()

        fin = analytics.per_condo(*AUG)[condo.id]
        assert fin.bookings == 1
        assert fin.nights == 10
        assert fin.revenue == to_minor(10000)
        assert fin.expenses == to_minor(2500)
        assert fin.net == to_minor(7500)
        # 10 of August's 31 nights.
        assert fin.occupancy_pct == 32

    def test_a_condo_with_no_activity_still_appears(
        self, analytics: AnalyticsService, condo: Condo
    ) -> None:
        """Otherwise the income table silently omits idle units."""
        fin = analytics.per_condo(*AUG)[condo.id]
        assert fin.revenue == 0
        assert fin.nights == 0
        assert fin.occupancy_pct == 0

    def test_outstanding_balance(self, analytics: AnalyticsService, condo: Condo) -> None:
        service = BookingService(db.session)
        service.create(
            condo_id=condo.id,
            guest_name="Owes money",
            check_in=D("2026-08-10"),
            check_out=D("2026-08-15"),
            mode=PricingMode.TOTAL,
            total_manual=to_minor(5000),
            received=to_minor(2000),
        )
        db.session.commit()
        owed, count = analytics.outstanding()
        assert owed == to_minor(3000)
        assert count == 1
