"""Booking business logic."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError

from app.common import activity
from app.common.errors import BookingConflictError, NotFoundError, ValidationError
from app.common.money import format_thb, split_evenly
from app.extensions import db
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.booking import Booking, BookingNight, BookingStatus, PricingModeColumn
from app.models.condo import Condo
from app.services.pricing import PricingMode, Quote, quote

# A cancelled booking releases its dates; every other status holds them.
# En dash, matching how the design renders date spans ("1–9 Aug").
DASH = "–"

OCCUPYING_STATUSES = (
    BookingStatus.BOOKED,
    BookingStatus.PENDING,
    BookingStatus.MAINTENANCE,
)


def _assert_within_lease(condo: Condo, check_out: date) -> None:
    """A stay cannot outlive the lease that lets us sell the unit.

    We hold these condos on a long-term lease from their owners, so a booking
    running past the lease end is a night we have no right to sell. Checked on
    ``check_out``, which is the day the guest leaves: a lease ending on 31 Dec
    permits a checkout on 31 Dec but not a night spent in it.

    Only enforced when a lease end is on file. Units with no lease recorded
    keep behaving exactly as they did before this existed.
    """
    if condo.lease_end_date is None or check_out <= condo.lease_end_date:
        return
    raise ValidationError(
        "Booking exceeds lease period",
        details={
            "fields": {
                "check_out": [
                    f"{condo.name}'s lease ends on "
                    f"{condo.lease_end_date.strftime('%d %b %Y')}."
                ]
            },
            "lease_end_date": condo.lease_end_date.isoformat(),
            "condo_id": str(condo.id),
        },
    )


class BookingService:
    def __init__(self, session=db.session) -> None:  # type: ignore[no-untyped-def]
        self.session = session

    # ---------- reads ----------
    def get(self, booking_id: uuid.UUID) -> Booking:
        booking = self.session.scalars(
            select(Booking).where(Booking.id == booking_id, Booking.deleted_at.is_(None))
        ).one_or_none()
        if booking is None:
            raise NotFoundError("That booking does not exist.")
        return booking

    def find_conflict(
        self,
        condo_id: uuid.UUID,
        check_in: date,
        check_out: date,
        *,
        exclude_id: uuid.UUID | None = None,
    ) -> Booking | None:
        """The design's rule (lines 2043–2048): ``newIn < out && newOut > in``.

        Half-open, so a checkout and a checkin on the same day do not collide.
        This is an advisory pre-flight for nicer errors — the authoritative
        guarantee is the booking_nights primary key.
        """
        stmt = select(Booking).where(
            Booking.condo_id == condo_id,
            Booking.deleted_at.is_(None),
            Booking.status.in_(OCCUPYING_STATUSES),
            and_(Booking.check_in < check_out, Booking.check_out > check_in),
        )
        if exclude_id is not None:
            stmt = stmt.where(Booking.id != exclude_id)
        return self.session.scalars(stmt).first()

    def calendar_feed(
        self, start: date, end: date, *, condo_id: uuid.UUID | None = None
    ) -> list[Booking]:
        stmt = select(Booking).where(
            Booking.deleted_at.is_(None),
            # Overlaps the window, same half-open rule.
            and_(Booking.check_in < end, Booking.check_out > start),
        )
        if condo_id is not None:
            stmt = stmt.where(Booking.condo_id == condo_id)
        return list(self.session.scalars(stmt.order_by(Booking.check_in)))

    # ---------- pricing ----------
    def price(
        self,
        *,
        check_in: date,
        check_out: date,
        mode: PricingMode,
        night_rate: int = 0,
        total_manual: int = 0,
        discount: int = 0,
        cleaning_fee: int = 0,
        other_charges: int = 0,
        tax_pct: Decimal | str | int = 0,
        received: int = 0,
    ) -> Quote:
        return quote(
            check_in=check_in,
            check_out=check_out,
            mode=mode,
            night_rate=night_rate,
            total_manual=total_manual,
            discount=discount,
            cleaning_fee=cleaning_fee,
            other_charges=other_charges,
            tax_pct=tax_pct,
            received=received,
        )

    # ---------- writes ----------
    def create(
        self,
        *,
        condo_id: uuid.UUID,
        guest_name: str,
        check_in: date,
        check_out: date,
        mode: PricingMode,
        status: BookingStatus = BookingStatus.BOOKED,
        guest_phone: str | None = None,
        guest_email: str | None = None,
        night_rate: int = 0,
        total_manual: int = 0,
        discount: int = 0,
        cleaning_fee: int = 0,
        other_charges: int = 0,
        tax_pct: Decimal | str | int = 0,
        received: int = 0,
        notes: str | None = None,
    ) -> Booking:
        condo = self.session.get(Condo, condo_id)
        if condo is None or condo.deleted_at is not None:
            raise ValidationError(
                "That condo does not exist.",
                details={"fields": {"condo_id": ["Choose an existing condo."]}},
            )
        _assert_within_lease(condo, check_out)

        q = self.price(
            check_in=check_in,
            check_out=check_out,
            mode=mode,
            night_rate=night_rate,
            total_manual=total_manual,
            discount=discount,
            cleaning_fee=cleaning_fee,
            other_charges=other_charges,
            tax_pct=tax_pct,
            received=received,
        )

        booking = Booking(
            condo_id=condo_id,
            guest_name=guest_name.strip(),
            guest_phone=(guest_phone or "").strip() or None,
            guest_email=(guest_email or "").strip() or None,
            check_in=check_in,
            check_out=check_out,
            status=status,
            pricing_mode=(
                PricingModeColumn.NIGHTLY
                if mode is PricingMode.NIGHTLY
                else PricingModeColumn.TOTAL
            ),
            night_rate=q.night_rate,
            subtotal=q.subtotal,
            discount=q.discount,
            cleaning_fee=q.cleaning_fee,
            other_charges=q.other_charges,
            tax_pct=q.tax_pct,
            tax=q.tax,
            total=q.total,
            received=q.received,
            notes=(notes or "").strip() or None,
        )
        self.session.add(booking)
        self.session.flush()

        self._claim_nights(booking, q)

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.BOOKING,
            entity_id=booking.id,
            entity_label=booking.guest_name,
            meta={
                "summary": (
                    f"{booking.guest_name} · {_span(check_in, check_out)} · {condo.name}"
                ),
                "total": format_thb(q.total),
            },
        )
        return booking

    def update(self, booking_id: uuid.UUID, **changes: object) -> Booking:
        booking = self.get(booking_id)
        check_in = changes.get("check_in", booking.check_in)
        check_out = changes.get("check_out", booking.check_out)

        # Checked against the destination condo, which a move may have changed,
        # and before anything is written.
        target_id = changes.get("condo_id", booking.condo_id)
        target = self.session.get(Condo, target_id)
        if target is not None:
            _assert_within_lease(target, check_out)  # type: ignore[arg-type]

        for field in (
            "guest_name",
            "guest_phone",
            "guest_email",
            "notes",
            "status",
            "condo_id",
            "check_in",
            "check_out",
        ):
            if field in changes:
                setattr(booking, field, changes[field])

        mode = changes.get(
            "mode",
            PricingMode.NIGHTLY
            if booking.pricing_mode is PricingModeColumn.NIGHTLY
            else PricingMode.TOTAL,
        )
        q = self.price(
            check_in=check_in,  # type: ignore[arg-type]
            check_out=check_out,  # type: ignore[arg-type]
            mode=mode,  # type: ignore[arg-type]
            night_rate=int(changes.get("night_rate", booking.night_rate)),  # type: ignore[arg-type]
            total_manual=int(changes.get("total_manual", booking.subtotal)),  # type: ignore[arg-type]
            discount=int(changes.get("discount", booking.discount)),  # type: ignore[arg-type]
            cleaning_fee=int(changes.get("cleaning_fee", booking.cleaning_fee)),  # type: ignore[arg-type]
            other_charges=int(changes.get("other_charges", booking.other_charges)),  # type: ignore[arg-type]
            tax_pct=changes.get("tax_pct", booking.tax_pct),  # type: ignore[arg-type]
            received=int(changes.get("received", booking.received)),  # type: ignore[arg-type]
        )

        booking.pricing_mode = (
            PricingModeColumn.NIGHTLY if mode is PricingMode.NIGHTLY else PricingModeColumn.TOTAL
        )
        booking.night_rate = q.night_rate
        booking.subtotal = q.subtotal
        booking.discount = q.discount
        booking.cleaning_fee = q.cleaning_fee
        booking.other_charges = q.other_charges
        booking.tax_pct = q.tax_pct
        booking.tax = q.tax
        booking.total = q.total
        booking.received = q.received

        # Release the old nights before claiming the new ones, or a booking
        # could not even be shortened without colliding with itself.
        self._release_nights(booking)
        self.session.flush()
        self._claim_nights(booking, q)

        activity.record(
            ActivityAction.UPDATED,
            ActivityEntity.BOOKING,
            entity_id=booking.id,
            entity_label=booking.guest_name,
            meta={"summary": f"{booking.guest_name} updated", "total": format_thb(q.total)},
        )
        return booking

    def delete(self, booking_id: uuid.UUID) -> None:
        booking = self.get(booking_id)
        self._release_nights(booking)
        booking.soft_delete()
        activity.record(
            ActivityAction.DELETED,
            ActivityEntity.BOOKING,
            entity_id=booking.id,
            entity_label=booking.guest_name,
            meta={"summary": f"{booking.guest_name} removed · dates are open again"},
        )

    # ---------- night bookkeeping ----------
    def _claim_nights(self, booking: Booking, q: Quote) -> None:
        """Insert one row per night. The primary key is the concurrency guard.

        A racing request that already claimed one of these nights makes this
        insert fail on the key, which is what converts a check-then-act race
        into a deterministic 409.
        """
        if booking.status not in OCCUPYING_STATUSES:
            return

        nights = [booking.check_in + timedelta(days=i) for i in range(booking.nights)]
        # Shares sum exactly to the total, so a stay crossing a month boundary
        # splits without leaking satang.
        shares = split_evenly(q.total, len(nights))

        try:
            with self.session.begin_nested():
                self.session.add_all(
                    [
                        BookingNight(
                            condo_id=booking.condo_id,
                            night_date=night,
                            booking_id=booking.id,
                            revenue_share=share,
                        )
                        for night, share in zip(nights, shares, strict=True)
                    ]
                )
                self.session.flush()
        except IntegrityError as exc:
            # The savepoint rolled back, so the session is still usable and we
            # can look up who holds the dates to build a useful message.
            other = self.find_conflict(
                booking.condo_id, booking.check_in, booking.check_out, exclude_id=booking.id
            )
            condo = self.session.get(Condo, booking.condo_id)
            name = condo.name if condo else "That condo"
            if other is not None:
                message = (
                    f"{name} is already booked {other.check_in.isoformat()} → "
                    f"{other.check_out.isoformat()} for {other.guest_name}. "
                    "Pick other dates or another unit."
                )
                details = {
                    "conflict": {
                        "booking_id": str(other.id),
                        "guest_name": other.guest_name,
                        "check_in": other.check_in.isoformat(),
                        "check_out": other.check_out.isoformat(),
                    }
                }
            else:
                message = f"{name} was just booked for those dates."
                details = {}
            raise BookingConflictError(message, details=details) from exc

    def _release_nights(self, booking: Booking) -> None:
        for row in self.session.scalars(
            select(BookingNight).where(BookingNight.booking_id == booking.id)
        ):
            self.session.delete(row)


def _span(check_in: date, check_out: date) -> str:
    """"1–9 Aug" style, without the glibc-only %-d that Windows rejects."""
    if check_in.month == check_out.month and check_in.year == check_out.year:
        return f"{check_in.day}{DASH}{check_out.day} {check_in:%b}"
    return f"{check_in.day} {check_in:%b} {DASH} {check_out.day} {check_out:%b}"
