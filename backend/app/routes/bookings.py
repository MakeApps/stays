"""Booking endpoints."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from flask import Blueprint, jsonify
from sqlalchemy import or_, select

from app.auth.decorators import require_permission
from app.auth.permissions import (
    BOOKING_DELETE,
    BOOKING_READ,
    BOOKING_WRITE,
    CALENDAR_READ,
)
from app.common.api import parse_body, parse_query
from app.common.money import to_minor
from app.common.pagination import PageParams, apply_sort, paginate
from app.extensions import db
from app.models.booking import Booking, BookingStatus
from app.models.condo import Condo
from app.schemas.booking import (
    AvailabilityQuery,
    BookingCreate,
    BookingListQuery,
    BookingOut,
    BookingUpdate,
    CalendarQuery,
    QuoteRequest,
)
from app.services.booking_service import BookingService
from app.services.pricing import PricingMode

bp = Blueprint("bookings", __name__)

SORTABLE = {
    "check_in": Booking.check_in,
    "check_out": Booking.check_out,
    "guest_name": Booking.guest_name,
    "total": Booking.total,
    "created_at": Booking.created_at,
}


def _service() -> BookingService:
    return BookingService(db.session)


def _serialise(booking: Booking) -> dict[str, Any]:
    condo = booking.condo_ref
    return BookingOut.from_model(
        booking, condo_name=condo.name, condo_code=condo.code
    ).model_dump(mode="json")


@bp.get("")
@require_permission(BOOKING_READ)
def list_bookings() -> Any:
    params = parse_query(BookingListQuery)
    page_params = PageParams(
        page=params.page, per_page=params.per_page, sort=params.sort, order=params.order
    )

    stmt = select(Booking).where(Booking.deleted_at.is_(None))

    if params.condo_id:
        stmt = stmt.where(Booking.condo_id == params.condo_id)
    if params.status != "all":
        stmt = stmt.where(Booking.status == BookingStatus(params.status))
    if params.q:
        like = f"%{params.q.strip()}%"
        stmt = stmt.where(
            or_(Booking.guest_name.like(like), Booking.guest_email.like(like))
        )
    if params.start:
        stmt = stmt.where(Booking.check_out > params.start)
    if params.end:
        stmt = stmt.where(Booking.check_in < params.end)

    stmt = apply_sort(stmt, page_params, allowed=SORTABLE, default="check_in")
    page = paginate(db.session, stmt, page_params)

    items = [_serialise(b) for b in page.items]
    # Payment status is derived, so it cannot be a SQL filter without
    # duplicating the rule; filtering here keeps one definition of it.
    if params.payment_status != "all":
        items = [i for i in items if i["payment_status"] == params.payment_status]

    body = page.envelope(lambda b: b)
    body["items"] = items
    return jsonify(body), 200


@bp.post("")
@require_permission(BOOKING_WRITE)
def create_booking() -> Any:
    payload = parse_body(BookingCreate)
    booking = _service().create(**payload.to_service_kwargs())  # type: ignore[arg-type]
    db.session.commit()
    db.session.refresh(booking)
    return jsonify(_serialise(booking)), 201


@bp.get("/<uuid:booking_id>")
@require_permission(BOOKING_READ)
def get_booking(booking_id: uuid.UUID) -> Any:
    return jsonify(_serialise(_service().get(booking_id))), 200


@bp.patch("/<uuid:booking_id>")
@require_permission(BOOKING_WRITE)
def update_booking(booking_id: uuid.UUID) -> Any:
    payload = parse_body(BookingUpdate)
    booking = _service().update(booking_id, **payload.to_service_changes())
    db.session.commit()
    db.session.refresh(booking)
    return jsonify(_serialise(booking)), 200


@bp.delete("/<uuid:booking_id>")
@require_permission(BOOKING_DELETE)
def delete_booking(booking_id: uuid.UUID) -> Any:
    _service().delete(booking_id)
    db.session.commit()
    return "", 204


@bp.post("/quote")
@require_permission(BOOKING_READ)
def quote_booking() -> Any:
    """Server-side pricing preview.

    The form recomputes the same arithmetic locally for instant feedback, but
    this is the authority — the number quoted here is the number stored.
    """
    payload = parse_body(QuoteRequest)
    result = _service().price(
        check_in=payload.check_in,
        check_out=payload.check_out,
        mode=PricingMode(payload.mode),
        night_rate=to_minor(payload.night_rate),
        total_manual=to_minor(payload.total_manual),
        discount=to_minor(payload.discount),
        cleaning_fee=to_minor(payload.cleaning_fee),
        other_charges=to_minor(payload.other_charges),
        tax_pct=payload.tax_pct,
        received=to_minor(payload.received),
    )
    return jsonify(result.as_dict()), 200


@bp.get("/availability")
@require_permission(BOOKING_READ)
def check_availability() -> Any:
    """Advisory pre-flight for the booking form's conflict banner.

    Catches a booking someone else made since the page loaded. The binding
    guarantee is still the database constraint on save.
    """
    params = parse_query(AvailabilityQuery)
    conflict = _service().find_conflict(
        params.condo_id,
        params.check_in,
        params.check_out,
        exclude_id=params.exclude_booking_id,
    )
    if conflict is None:
        return jsonify({"available": True, "conflict": None}), 200

    return jsonify(
        {
            "available": False,
            "conflict": {
                "booking_id": str(conflict.id),
                "guest_name": conflict.guest_name,
                "check_in": conflict.check_in.isoformat(),
                "check_out": conflict.check_out.isoformat(),
            },
        }
    ), 200


@bp.get("/calendar")
@require_permission(CALENDAR_READ)
def calendar() -> Any:
    """Bookings overlapping a window, plus the condo rows to draw them against."""
    params = parse_query(CalendarQuery)
    end = params.end or (params.start + timedelta(days=31))

    condos_stmt = select(Condo).where(Condo.deleted_at.is_(None)).order_by(Condo.name)
    if params.condo_id:
        condos_stmt = condos_stmt.where(Condo.id == params.condo_id)
    condos = list(db.session.scalars(condos_stmt))

    bookings = _service().calendar_feed(params.start, end, condo_id=params.condo_id)

    return jsonify(
        {
            "range": {"start": params.start.isoformat(), "end": end.isoformat()},
            "resources": [
                {"id": str(c.id), "code": c.code, "name": c.name} for c in condos
            ],
            "events": [
                {
                    "id": str(b.id),
                    "condo_id": str(b.condo_id),
                    "guest_name": b.guest_name,
                    "check_in": b.check_in.isoformat(),
                    "check_out": b.check_out.isoformat(),
                    "nights": b.nights,
                    "status": b.status.value,
                    "payment_status": b.payment_status,
                }
                for b in bookings
            ],
        }
    ), 200

