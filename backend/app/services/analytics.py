"""Revenue, expenses, occupancy and profit.

Every figure here is computed in SQL, not by loading rows and summing in
Python. The prototype could afford the latter with 9 units; at several hundred
it would be a multi-megabyte payload and a frozen request.

Revenue is **accrual**: a booking's amount is spread across its nights via
``booking_nights.revenue_share``, so a stay from 28 Aug to 4 Sep contributes to
both months in the right proportion. That is the whole reason those rows carry
a share rather than the calendar just being derived on the fly.
"""

from __future__ import annotations

import uuid
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingNight, BookingStatus
from app.models.condo import Condo
from app.models.expense import Expense, ExpenseCategory, ExpenseStatus
from app.services.lease import lease_cost_between, lease_costs_for

# Statuses whose nights represent sellable occupancy. A maintenance block holds
# the dates but is not revenue, and is excluded from occupancy percentages so a
# unit under repair does not read as "fully booked".
REVENUE_STATUSES = (BookingStatus.BOOKED, BookingStatus.PENDING)

# Statuses that make a unit unavailable. Wider than REVENUE_STATUSES: a
# maintenance block earns nothing but you still cannot sell the night, so
# "condos available today" has to count it as taken.
OCCUPYING_STATUSES = (
    BookingStatus.BOOKED,
    BookingStatus.PENDING,
    BookingStatus.MAINTENANCE,
)


def month_bounds(anchor: date) -> tuple[date, date]:
    """First day of the month, and the first day of the next — half-open."""
    start = anchor.replace(day=1)
    _, days = monthrange(anchor.year, anchor.month)
    return start, start + timedelta(days=days)


def previous_months(anchor: date, count: int) -> list[tuple[date, date]]:
    """The last `count` month windows ending with the anchor's month."""
    windows: list[tuple[date, date]] = []
    cursor = anchor.replace(day=1)
    for _ in range(count):
        windows.append(month_bounds(cursor))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    return list(reversed(windows))


@dataclass(frozen=True, slots=True)
class DayCell:
    """One night, as the calendar needs to draw and summarise it.

    ``occupied`` and ``booked`` differ deliberately. A maintenance block takes
    the unit — you cannot sell that night — but it is not sellable occupancy,
    and counting it as such makes a building under repair read as fully
    booked. Availability uses ``occupied``; occupancy uses ``booked``.
    """

    day: date
    bookings: int
    occupied: int
    booked: int
    revenue: int


@dataclass(frozen=True, slots=True)
class CondoFinance:
    condo_id: uuid.UUID
    bookings: int
    nights: int
    available_nights: int
    revenue: int
    expenses: int
    #: What we owe the unit's owner for this window, prorated by day. A real
    #: cost of running the unit, so it sits in `net` beside operating spend.
    lease_cost: int = 0

    @property
    def net(self) -> int:
        """Revenue less what the unit costs to hold and to run.

        The refundable deposit is deliberately absent. It is capital lodged
        with the owner and expected back, so charging it here would report a
        loss the month a unit is taken on and a windfall the month it is
        handed back — see app.services.lease.
        """
        return self.revenue - self.lease_cost - self.expenses

    @property
    def total_costs(self) -> int:
        return self.lease_cost + self.expenses

    @property
    def occupancy_pct(self) -> int:
        total = self.nights + self.available_nights
        return round(self.nights / total * 100) if total else 0


class AnalyticsService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- building blocks ----------
    def _live_expenses(self) -> Select[tuple[Expense]]:
        return select(Expense).where(
            Expense.deleted_at.is_(None), Expense.status != ExpenseStatus.CANCELLED
        )

    def revenue_between(self, start: date, end: date, *, condo_id: uuid.UUID | None = None) -> int:
        """Accrued revenue for nights falling inside [start, end)."""
        stmt = (
            select(func.coalesce(func.sum(BookingNight.revenue_share), 0))
            .join(Booking, Booking.id == BookingNight.booking_id)
            .where(
                BookingNight.night_date >= start,
                BookingNight.night_date < end,
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
            )
        )
        if condo_id is not None:
            stmt = stmt.where(BookingNight.condo_id == condo_id)
        return int(self.session.scalar(stmt) or 0)

    def expenses_between(self, start: date, end: date, *, condo_id: uuid.UUID | None = None) -> int:
        stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.spent_on >= start,
            Expense.spent_on < end,
            Expense.deleted_at.is_(None),
            Expense.status != ExpenseStatus.CANCELLED,
        )
        if condo_id is not None:
            stmt = stmt.where(Expense.condo_id == condo_id)
        return int(self.session.scalar(stmt) or 0)

    def nights_between(self, start: date, end: date, *, condo_id: uuid.UUID | None = None) -> int:
        stmt = (
            select(func.count())
            .select_from(BookingNight)
            .join(Booking, Booking.id == BookingNight.booking_id)
            .where(
                BookingNight.night_date >= start,
                BookingNight.night_date < end,
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
            )
        )
        if condo_id is not None:
            stmt = stmt.where(BookingNight.condo_id == condo_id)
        return int(self.session.scalar(stmt) or 0)

    def outstanding(self) -> tuple[int, int]:
        """Unpaid balance across live bookings, and how many owe something."""
        row = self.session.execute(
            select(
                func.coalesce(func.sum(Booking.total - Booking.received), 0),
                func.count(),
            ).where(
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
                Booking.received < Booking.total,
            )
        ).one()
        return int(row[0] or 0), int(row[1] or 0)

    # ---------- rollups ----------
    def per_condo(self, start: date, end: date) -> dict[uuid.UUID, CondoFinance]:
        """One row per condo for the window — three queries, not three per unit."""
        span_nights = (end - start).days

        revenue_rows = self.session.execute(
            select(
                BookingNight.condo_id,
                func.coalesce(func.sum(BookingNight.revenue_share), 0),
                func.count(),
            )
            .join(Booking, Booking.id == BookingNight.booking_id)
            .where(
                BookingNight.night_date >= start,
                BookingNight.night_date < end,
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
            )
            .group_by(BookingNight.condo_id)
        ).all()

        booking_rows = self.session.execute(
            select(Booking.condo_id, func.count(func.distinct(Booking.id)))
            .where(
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
                Booking.check_in < end,
                Booking.check_out > start,
            )
            .group_by(Booking.condo_id)
        ).all()

        expense_rows = self.session.execute(
            select(Expense.condo_id, func.coalesce(func.sum(Expense.amount), 0))
            .where(
                Expense.spent_on >= start,
                Expense.spent_on < end,
                Expense.deleted_at.is_(None),
                Expense.status != ExpenseStatus.CANCELLED,
            )
            .group_by(Expense.condo_id)
        ).all()

        revenue = {r[0]: (int(r[1]), int(r[2])) for r in revenue_rows}
        counts = {r[0]: int(r[1]) for r in booking_rows}
        spend = {r[0]: int(r[1]) for r in expense_rows}

        # Whole rows, not just ids: the lease charge is prorated against each
        # condo's own term, so the dates and the monthly amount are needed.
        condos = list(self.session.scalars(select(Condo).where(Condo.deleted_at.is_(None))))
        lease = lease_costs_for(condos, start, end)

        result: dict[uuid.UUID, CondoFinance] = {}
        for condo in condos:
            condo_id = condo.id
            earned, nights = revenue.get(condo_id, (0, 0))
            result[condo_id] = CondoFinance(
                condo_id=condo_id,
                bookings=counts.get(condo_id, 0),
                nights=nights,
                available_nights=max(0, span_nights - nights),
                revenue=earned,
                expenses=spend.get(condo_id, 0),
                lease_cost=lease.get(condo_id, 0),
            )
        return result

    def lease_costs_between(self, start: date, end: date) -> int:
        """Total lease commitment across the portfolio for the window."""
        condos = self.session.scalars(select(Condo).where(Condo.deleted_at.is_(None)))
        return sum(lease_cost_between(c, start, end) for c in condos)

    def daily_breakdown(
        self, start: date, end: date, *, condo_id: uuid.UUID | None = None
    ) -> dict[date, DayCell]:
        """Per-night bookings, occupied units and accrued revenue.

        Two grouped queries for the whole window rather than one per day. The
        mobile calendar draws a cell per day and summarises whichever is
        tapped, so a per-day round trip would be thirty-one of them.

        Occupancy counts maintenance, revenue does not — a blocked unit is
        unavailable but earns nothing, and conflating the two would either
        oversell the calendar or overstate the income.
        """
        # Joined to Condo as well, so a night belonging to a removed unit is
        # not counted against a portfolio that no longer contains it — which
        # is how occupancy could exceed 100%.
        def _per_night(statuses: tuple[BookingStatus, ...]) -> list[Any]:
            return self.session.execute(
                select(
                    BookingNight.night_date,
                    func.count(func.distinct(BookingNight.booking_id)),
                    func.count(func.distinct(BookingNight.condo_id)),
                )
                .join(Booking, Booking.id == BookingNight.booking_id)
                .join(Condo, Condo.id == BookingNight.condo_id)
                .where(
                    BookingNight.night_date >= start,
                    BookingNight.night_date < end,
                    Booking.deleted_at.is_(None),
                    Condo.deleted_at.is_(None),
                    # A unit flagged out of service is excluded from the whole
                    # availability calculation, so it must not appear here
                    # either. Callers subtract `occupied` from a condo count
                    # that already excludes it — counting it in both places
                    # takes the same unit away twice and under-reports how many
                    # are free.
                    Condo.is_maintenance.is_(False),
                    Booking.status.in_(statuses),
                    *([BookingNight.condo_id == condo_id] if condo_id else []),
                )
                .group_by(BookingNight.night_date)
            ).all()

        occupancy_rows = _per_night(OCCUPYING_STATUSES)
        booked_rows = _per_night(REVENUE_STATUSES)

        revenue_rows = self.session.execute(
            select(
                BookingNight.night_date,
                func.coalesce(func.sum(BookingNight.revenue_share), 0),
            )
            .join(Booking, Booking.id == BookingNight.booking_id)
            .join(Condo, Condo.id == BookingNight.condo_id)
            .where(
                BookingNight.night_date >= start,
                BookingNight.night_date < end,
                Booking.deleted_at.is_(None),
                Condo.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
                *([BookingNight.condo_id == condo_id] if condo_id else []),
            )
            .group_by(BookingNight.night_date)
        ).all()

        earned = {r[0]: int(r[1]) for r in revenue_rows}
        booked = {r[0]: int(r[2]) for r in booked_rows}
        days = set(earned) | set(booked) | {r[0] for r in occupancy_rows}
        occupancy = {r[0]: (int(r[1]), int(r[2])) for r in occupancy_rows}

        return {
            day: DayCell(
                day=day,
                bookings=occupancy.get(day, (0, 0))[0],
                occupied=occupancy.get(day, (0, 0))[1],
                booked=booked.get(day, 0),
                revenue=earned.get(day, 0),
            )
            for day in days
        }

    def expenses_by_category(self, start: date, end: date) -> list[tuple[str, str, int]]:
        """(category name, tone, total) ordered by spend, for the donut."""
        rows = self.session.execute(
            select(
                ExpenseCategory.name,
                ExpenseCategory.tone,
                func.coalesce(func.sum(Expense.amount), 0).label("total"),
            )
            .join(Expense, Expense.category_id == ExpenseCategory.id)
            .where(
                Expense.spent_on >= start,
                Expense.spent_on < end,
                Expense.deleted_at.is_(None),
                Expense.status != ExpenseStatus.CANCELLED,
            )
            .group_by(ExpenseCategory.id, ExpenseCategory.name, ExpenseCategory.tone)
            .order_by(func.sum(Expense.amount).desc())
        ).all()
        return [(r[0], r[1], int(r[2])) for r in rows]

    def daily_revenue(self, start: date, end: date) -> dict[date, int]:
        """Accrued revenue per night — the dashboard's income-by-day chart."""
        rows = self.session.execute(
            select(
                BookingNight.night_date,
                func.coalesce(func.sum(BookingNight.revenue_share), 0),
            )
            .join(Booking, Booking.id == BookingNight.booking_id)
            .where(
                BookingNight.night_date >= start,
                BookingNight.night_date < end,
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
            )
            .group_by(BookingNight.night_date)
        ).all()
        return {r[0]: int(r[1]) for r in rows}

    def monthly_series(self, months: list[tuple[date, date]]) -> list[tuple[int, int, int]]:
        """(revenue, expenses, lease cost) per month window, for the trends.

        Lease is returned alongside rather than folded into expenses: the
        charts plot operating spend, and a fixed monthly commitment moving that
        bar would hide whether running costs themselves are drifting.
        """
        return [
            (
                self.revenue_between(start, end),
                self.expenses_between(start, end),
                self.lease_costs_between(start, end),
            )
            for start, end in months
        ]
