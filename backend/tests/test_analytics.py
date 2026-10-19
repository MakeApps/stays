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


def make_booking(
    condo: Condo, check_in: str, check_out: str, total: int, *, received: int = 0
) -> Any:
    booking = BookingService(db.session).create(
        condo_id=condo.id,
        guest_name="Guest",
        check_in=D(check_in),
        check_out=D(check_out),
        mode=PricingMode.TOTAL,
        total_manual=total,
        received=received,
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


class TestGrossIncome:
    """All-time money received before any deduction: the one figure not windowed."""

    def test_counts_what_was_paid_and_nothing_else(
        self, analytics: AnalyticsService, condo: Condo, session: Any
    ) -> None:
        # Paid in full, part-paid, unpaid, and a cancelled stay that was paid.
        make_booking(condo, "2026-08-01", "2026-08-05", to_minor(4000), received=to_minor(4000))
        make_booking(condo, "2026-09-10", "2026-09-12", to_minor(1500), received=to_minor(500))
        make_booking(condo, "2026-09-20", "2026-09-22", to_minor(2000))
        cancelled = make_booking(
            condo, "2026-10-01", "2026-10-03", to_minor(9999), received=to_minor(9999)
        )
        cancelled.status = BookingStatus.CANCELLED
        session.commit()

        # 4,000 plus the 500 actually paid; the 1,000 still owed and the
        # untouched 2,000 are outstanding, not income.
        assert analytics.received_total() == (to_minor(4500), 2)

    def test_the_income_screen_shows_it_gross(
        self, auth_client: Any, condo: Condo, lookups: Any, session: Any
    ) -> None:
        make_booking(condo, "2026-08-01", "2026-08-05", to_minor(4000), received=to_minor(4000))
        category, method = lookups
        ExpenseService(session).create(
            condo_id=condo.id,
            category_id=category.id,
            method_id=method.id,
            spent_on=D("2026-08-02"),
            amount=to_minor(700),
            description="Not deducted from the total",
        )
        session.commit()

        kpis = auth_client.get("/api/v1/income/summary").get_json()["kpis"]
        assert kpis["total"] == "฿4,000"
        assert kpis["total_bookings"] == 1
        # Gross profit is the total less every expense, and nothing else:
        # no lease cost comes off it.
        assert kpis["total_expenses"] == "฿700"
        assert kpis["gross_profit"] == "฿3,300"
        assert kpis["gross_profit_negative"] is False

    def test_gross_profit_goes_negative_honestly(
        self, auth_client: Any, condo: Condo, lookups: Any, session: Any
    ) -> None:
        make_booking(condo, "2026-08-01", "2026-08-05", to_minor(4000), received=to_minor(1000))
        category, method = lookups
        service = ExpenseService(session)
        service.create(
            condo_id=condo.id, category_id=category.id, method_id=method.id,
            spent_on=D("2026-08-02"), amount=to_minor(2500), description="Repair",
        )
        service.create(
            condo_id=condo.id, category_id=category.id, method_id=method.id,
            spent_on=D("2026-08-03"), amount=to_minor(9999), description="Voided",
            status=ExpenseStatus.CANCELLED,
        )
        session.commit()

        kpis = auth_client.get("/api/v1/income/summary").get_json()["kpis"]
        # 1,000 received, 2,500 spent; the cancelled bill and the 3,000 still
        # owed by the guest are both out of it.
        assert kpis["gross_profit"] == "-฿1,500"
        assert kpis["gross_profit_negative"] is True


class TestExpenseListTotals:
    """The list carries the total of the whole selection, not of the page."""

    def _spend(self, session: Any, condo: Condo, lookups: Any, amount: int, **kw: Any) -> None:
        category, method = lookups
        ExpenseService(session).create(
            condo_id=condo.id,
            category_id=category.id,
            method_id=method.id,
            spent_on=D("2026-08-05"),
            amount=to_minor(amount),
            description="Bill",
            **kw,
        )
        session.commit()

    def test_the_total_spans_every_page(
        self, auth_client: Any, condo: Condo, lookups: Any, session: Any
    ) -> None:
        for amount in (100, 200, 300):
            self._spend(session, condo, lookups, amount)

        body = auth_client.get("/api/v1/expenses?per_page=1").get_json()
        assert len(body["items"]) == 1
        assert body["totals"] == {"amount": "600.00", "label": "฿600", "count": 3}

    def test_cancelled_rows_are_listed_but_not_counted(
        self, auth_client: Any, condo: Condo, lookups: Any, session: Any
    ) -> None:
        self._spend(session, condo, lookups, 1000)
        self._spend(session, condo, lookups, 9999, status=ExpenseStatus.CANCELLED)

        body = auth_client.get("/api/v1/expenses").get_json()
        assert len(body["items"]) == 2
        assert body["totals"] == {"amount": "1000.00", "label": "฿1,000", "count": 1}

        # Filtered to the cancelled ones, the list is honest about summing nothing.
        only_cancelled = auth_client.get("/api/v1/expenses?status=cancelled").get_json()
        assert len(only_cancelled["items"]) == 1
        assert only_cancelled["totals"]["count"] == 0
        assert only_cancelled["totals"]["label"] == "฿0"

    def test_the_total_follows_the_filters(
        self, auth_client: Any, condo: Condo, lookups: Any, session: Any
    ) -> None:
        other = Condo(code="B-2", name="Other", night_rate=to_minor(1000))
        session.add(other)
        session.commit()
        self._spend(session, condo, lookups, 500)
        self._spend(session, other, lookups, 2000)

        mine = auth_client.get(f"/api/v1/expenses?condo_id={condo.id}").get_json()
        assert mine["totals"] == {"amount": "500.00", "label": "฿500", "count": 1}
        everything = auth_client.get("/api/v1/expenses").get_json()
        assert everything["totals"]["label"] == "฿2,500"


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
