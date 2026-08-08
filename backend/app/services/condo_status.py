"""Derived unit status for a set of condos.

Status is never stored — it falls out of today's date against that unit's
bookings. Computing it needs the bookings, so it lives here rather than on
``CondoService``, which would otherwise import the booking model and create a
cycle.

Deliberately batch-shaped: one query for every condo on screen, not one per
condo. The grid renders up to a hundred units, and per-unit derivation is the
classic N+1.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus
from app.services.availability import Span, derive_unit_status


def spans_for(
    session: Session, condo_ids: Iterable[uuid.UUID], *, today: date
) -> dict[uuid.UUID, list[Span]]:
    """Bookings that still matter for status: anything not yet ended.

    A stay that finished last week cannot make a unit occupied or reserved, so
    filtering on ``check_out > today`` keeps the scan small as history grows.
    """
    ids = list(condo_ids)
    if not ids:
        return {}

    rows = session.scalars(
        select(Booking).where(
            Booking.condo_id.in_(ids),
            Booking.deleted_at.is_(None),
            Booking.status != BookingStatus.CANCELLED,
            Booking.check_out > today,
        )
    )

    spans: dict[uuid.UUID, list[Span]] = {}
    for booking in rows:
        spans.setdefault(booking.condo_id, []).append(
            Span(
                condo_id=booking.condo_id,
                check_in=booking.check_in,
                check_out=booking.check_out,
                is_maintenance=booking.status is BookingStatus.MAINTENANCE,
            )
        )
    return spans


def status_map(
    session: Session,
    condos: Iterable[tuple[uuid.UUID, bool]],
    *,
    today: date | None = None,
) -> dict[uuid.UUID, str]:
    """`(condo_id, is_maintenance_flagged)` pairs → derived status."""
    when = today or date.today()
    pairs = list(condos)
    spans = spans_for(session, (cid for cid, _ in pairs), today=when)
    return {
        cid: derive_unit_status(
            is_maintenance_flagged=flagged,
            spans=spans.get(cid, []),
            today=when,
        )
        for cid, flagged in pairs
    }
