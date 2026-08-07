"""Dashboard, global search and CSV export."""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from datetime import date, timedelta
from typing import Any, Literal

from flask import Blueprint, Response, jsonify, stream_with_context
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select

from app.auth.decorators import require_permission
from app.auth.permissions import (
    ACTIVITY_READ,
    BOOKING_READ,
    DASHBOARD_READ,
    INCOME_EXPORT,
)
from app.common import activity as activity_helper
from app.common.api import parse_query
from app.common.money import format_thb, to_major
from app.extensions import db
from app.models.activity_log import ActivityLog
from app.models.booking import Booking, BookingStatus
from app.models.condo import Condo
from app.models.expense import Expense, ExpenseCategory, PaymentMethod
from app.services.analytics import REVENUE_STATUSES, AnalyticsService, month_bounds
from app.services.availability import Span, derive_unit_status

bp = Blueprint("dashboard", __name__)


class DashboardQuery(BaseModel):
    month: date | None = None


class SearchQuery(BaseModel):
    q: str = Field(min_length=1, max_length=120)
    limit: int = Field(default=5, ge=1, le=20)


class ExportQuery(BaseModel):
    kind: Literal["bookings", "expenses", "income"] = "bookings"
    start: date | None = None
    end: date | None = None


def _analytics() -> AnalyticsService:
    return AnalyticsService(db.session)


def _unit_statuses(today: date) -> dict[str, int]:
    """Derived status counts for every live condo.

    Two queries for the whole portfolio: the condos, and the bookings that
    touch today or later. Deriving per unit would be N+1 on the busiest screen.
    """
    condos = list(db.session.scalars(select(Condo).where(Condo.deleted_at.is_(None))))
    bookings = list(
        db.session.scalars(
            select(Booking).where(
                Booking.deleted_at.is_(None),
                Booking.status != BookingStatus.CANCELLED,
                Booking.check_out > today,
            )
        )
    )

    spans: dict[Any, list[Span]] = {}
    for booking in bookings:
        spans.setdefault(booking.condo_id, []).append(
            Span(
                condo_id=booking.condo_id,
                check_in=booking.check_in,
                check_out=booking.check_out,
                is_maintenance=booking.status is BookingStatus.MAINTENANCE,
            )
        )

    counts = {"available": 0, "occupied": 0, "reserved": 0, "maintenance": 0}
    for condo in condos:
        status = derive_unit_status(
            is_maintenance_flagged=condo.is_maintenance,
            spans=spans.get(condo.id, []),
            today=today,
        )
        counts[status] += 1
    counts["total"] = len(condos)
    return counts


@bp.get("")
@require_permission(DASHBOARD_READ)
def dashboard() -> Any:
    params = parse_query(DashboardQuery)
    anchor = params.month or date.today()
    start, end = month_bounds(anchor)
    today = date.today()
    analytics = _analytics()

    statuses = _unit_statuses(today)
    occupied = statuses["occupied"]
    total = statuses["total"]

    revenue_month = analytics.revenue_between(start, end)
    expenses_month = analytics.expenses_between(start, end)
    revenue_today = analytics.revenue_between(today, today + timedelta(days=1))
    owed, owed_count = analytics.outstanding()

    horizon = today + timedelta(days=7)
    check_ins = db.session.scalar(
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.deleted_at.is_(None),
            Booking.status.in_(REVENUE_STATUSES),
            Booking.check_in >= today,
            Booking.check_in <= horizon,
        )
    ) or 0
    check_outs = db.session.scalar(
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.deleted_at.is_(None),
            Booking.status.in_(REVENUE_STATUSES),
            Booking.check_out > today,
            Booking.check_out <= horizon,
        )
    ) or 0

    # Income-by-day for the month, zero-filled so the chart has a bar per day.
    daily = analytics.daily_revenue(start, end)
    span = (end - start).days
    series = []
    for offset in range(span):
        day = start + timedelta(days=offset)
        amount = daily.get(day, 0)
        series.append(
            {
                "date": day.isoformat(),
                "amount": str(to_major(amount)),
                "label": format_thb(amount),
                "is_today": day == today,
            }
        )
    best = max(series, key=lambda d: float(d["amount"])) if series else None

    upcoming = list(
        db.session.scalars(
            select(Booking)
            .where(
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
                Booking.check_in >= today,
            )
            .order_by(Booking.check_in)
            .limit(5)
        )
    )

    recent = list(
        db.session.scalars(
            select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(6)
        )
    )

    nights = analytics.nights_between(start, end)

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "today": today.isoformat(),
            "kpis": {
                "total_condos": total,
                "occupied": occupied,
                "vacant": statuses["available"] + statuses["reserved"],
                "maintenance": statuses["maintenance"],
                "occupancy_pct": round(occupied / total * 100) if total else 0,
                "revenue_today": format_thb(revenue_today),
                "revenue_month": format_thb(revenue_month),
                "expenses_month": format_thb(expenses_month),
                "net_month": format_thb(revenue_month - expenses_month),
                "check_ins_7d": int(check_ins),
                "check_outs_7d": int(check_outs),
                "outstanding": format_thb(owed),
                "outstanding_count": owed_count,
                "booked_nights": nights,
                "avg_per_day": format_thb(revenue_month // span if span else 0),
                "best_day": best["date"] if best else None,
                "best_day_label": best["label"] if best else format_thb(0),
            },
            "occupancy": {
                "occupied": occupied,
                "vacant": statuses["available"] + statuses["reserved"],
                "maintenance": statuses["maintenance"],
            },
            "income_by_day": series,
            "upcoming": [
                {
                    "id": str(b.id),
                    "guest_name": b.guest_name,
                    "condo_name": b.condo_ref.name,
                    "condo_code": b.condo_ref.code,
                    "check_in": b.check_in.isoformat(),
                    "check_out": b.check_out.isoformat(),
                    "nights": b.nights,
                    "total_label": format_thb(b.total),
                    "payment_status": b.payment_status,
                }
                for b in upcoming
            ],
            "activity": [activity_helper.render(a) for a in recent],
        }
    ), 200


@bp.get("/search")
@require_permission(BOOKING_READ)
def global_search() -> Any:
    """Cross-entity search for the topbar.

    Deliberately three narrow queries rather than a UNION: each returns its own
    shape, and the result groups are rendered separately anyway.
    """
    params = parse_query(SearchQuery)
    like = f"%{params.q.strip()}%"
    limit = params.limit

    condos = list(
        db.session.scalars(
            select(Condo)
            .where(
                Condo.deleted_at.is_(None),
                or_(Condo.name.like(like), Condo.code.like(like), Condo.address.like(like)),
            )
            .order_by(Condo.name)
            .limit(limit)
        )
    )
    bookings = list(
        db.session.scalars(
            select(Booking)
            .where(
                Booking.deleted_at.is_(None),
                or_(Booking.guest_name.like(like), Booking.guest_email.like(like)),
            )
            .order_by(Booking.check_in.desc())
            .limit(limit)
        )
    )
    expenses = list(
        db.session.scalars(
            select(Expense)
            .where(
                Expense.deleted_at.is_(None),
                or_(
                    Expense.description.like(like),
                    Expense.vendor.like(like),
                    Expense.reference.like(like),
                ),
            )
            .order_by(Expense.spent_on.desc())
            .limit(limit)
        )
    )

    return jsonify(
        {
            "query": params.q,
            "condos": [
                {"id": str(c.id), "title": c.name, "subtitle": c.code, "href": f"/condos/{c.id}"}
                for c in condos
            ],
            "bookings": [
                {
                    "id": str(b.id),
                    "title": b.guest_name,
                    "subtitle": f"{b.condo_ref.name} · {b.check_in.isoformat()}",
                    "href": f"/bookings?booking={b.id}",
                }
                for b in bookings
            ],
            "expenses": [
                {
                    "id": str(e.id),
                    "title": e.description,
                    "subtitle": f"{e.category.name} · {format_thb(e.amount)}",
                    "href": f"/expenses?tab=list&edit={e.id}",
                }
                for e in expenses
            ],
        }
    ), 200


@bp.get("/export")
@require_permission(INCOME_EXPORT)
def export_csv() -> Any:
    """Streaming CSV.

    Rows are fetched as plain tuples up front, not ORM entities: the response
    body is generated lazily and by then Flask-SQLAlchemy has already torn down
    the session, so touching a relationship inside the generator fails. Explicit
    columns with a join also avoid the N+1 that `booking.condo_ref` would cause.

    Written with a UTF-8 BOM because Excel otherwise renders Thai vendor names
    and the baht sign as mojibake.
    """
    params = parse_query(ExportQuery)
    today = date.today()
    start = params.start or month_bounds(today)[0]
    end = params.end or month_bounds(today)[1]

    header: list[str]
    rows: list[list[Any]]

    if params.kind == "bookings":
        header = [
            "Check-in", "Check-out", "Nights", "Guest", "Condo", "Code",
            "Status", "Payment", "Total (THB)", "Received (THB)", "Balance (THB)",
        ]
        records = db.session.execute(
            select(
                Booking.check_in, Booking.check_out, Booking.guest_name,
                Condo.name, Condo.code, Booking.status,
                Booking.total, Booking.received,
            )
            .join(Condo, Condo.id == Booking.condo_id)
            .where(
                Booking.deleted_at.is_(None),
                Booking.check_in < end,
                Booking.check_out > start,
            )
            .order_by(Booking.check_in)
        ).all()
        rows = [
            [
                r[0].isoformat(), r[1].isoformat(), (r[1] - r[0]).days, r[2], r[3], r[4],
                r[5].value,
                "paid" if r[7] >= r[6] and r[6] > 0 else "partial" if r[7] > 0 else "pending",
                to_major(r[6]), to_major(r[7]), to_major(r[6] - r[7]),
            ]
            for r in records
        ]

    elif params.kind == "expenses":
        header = [
            "Date", "Condo", "Code", "Category", "Description", "Vendor",
            "Reference", "Method", "Status", "Amount (THB)",
        ]
        records = db.session.execute(
            select(
                Expense.spent_on, Condo.name, Condo.code, ExpenseCategory.name,
                Expense.description, Expense.vendor, Expense.reference,
                PaymentMethod.name, Expense.status, Expense.amount,
            )
            .join(Condo, Condo.id == Expense.condo_id)
            .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id)
            .join(PaymentMethod, PaymentMethod.id == Expense.method_id)
            .where(
                Expense.deleted_at.is_(None),
                Expense.spent_on >= start,
                Expense.spent_on < end,
            )
            .order_by(Expense.spent_on)
        ).all()
        rows = [
            [
                r[0].isoformat(), r[1], r[2], r[3], r[4], r[5] or "", r[6] or "",
                r[7], r[8].value, to_major(r[9]),
            ]
            for r in records
        ]

    else:  # income — one row per condo
        header = [
            "Condo", "Code", "Bookings", "Booked nights", "Revenue (THB)",
            "Expenses (THB)", "Net profit (THB)", "Occupancy %",
        ]
        finances = _analytics().per_condo(start, end)
        condos = {
            c.id: c
            for c in db.session.scalars(select(Condo).where(Condo.deleted_at.is_(None)))
        }
        rows = [
            [
                condos[cid].name, condos[cid].code, fin.bookings, fin.nights,
                to_major(fin.revenue), to_major(fin.expenses), to_major(fin.net),
                fin.occupancy_pct,
            ]
            for cid, fin in finances.items()
            if cid in condos
        ]

    def generate() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\r\n")
        # BOM first: without it Excel reads the file as the system codepage and
        # Thai vendor names arrive as mojibake.
        yield "﻿"
        for record in [header, *rows]:
            writer.writerow(record)
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    filename = f"localshouts-{params.kind}-{start.isoformat()}-to-{end.isoformat()}.csv"
    return Response(
        stream_with_context(generate()),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@bp.get("/activity")
@require_permission(ACTIVITY_READ)
def activity_feed() -> Any:
    entries = list(
        db.session.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(30))
    )
    return jsonify({"items": [activity_helper.render(e) for e in entries]}), 200

