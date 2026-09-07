"""Bookings, and the per-night rows that make double-booking impossible.

``booking_nights`` is the centrepiece of this schema. One row per occupied
night, with ``(condo_id, night_date)`` as the primary key. Two consequences:

* **Double-booking is prevented by the database, not by application logic.** A
  conflicting insert violates the primary key and the service maps that to a
  409. No ``SELECT … FOR UPDATE``, no advisory locks, and no window in which
  two concurrent requests can both pass an availability check.
* **Occupancy and accrual revenue become GROUP BY queries** over a table that
  is already indexed by date, instead of interval arithmetic in Python.

Each night carries its share of the booking total, and those shares are built
with ``money.split_evenly`` so they sum back to the total exactly. That is what
makes revenue for a stay crossing a month boundary split correctly.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import (
    BigInteger,
    Date,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    GUID,
    AuditMixin,
    Base,
    OrganisationScopedMixin,
    SoftDeleteMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.condo import Condo


class BookingStatus(str, enum.Enum):
    BOOKED = "booked"
    PENDING = "pending"
    MAINTENANCE = "maintenance"
    CANCELLED = "cancelled"


class PricingModeColumn(str, enum.Enum):
    NIGHTLY = "nightly"
    TOTAL = "total"


class Booking(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "bookings"

    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="RESTRICT"), nullable=False
    )

    guest_name: Mapped[str] = mapped_column(String(160), nullable=False)
    guest_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Half-open interval: the guest occupies check_in but not check_out, so a
    # checkout and a checkin on the same day do not collide.
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[BookingStatus] = mapped_column(
        Enum(
            BookingStatus,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=BookingStatus.BOOKED,
    )

    # ---- money, all satang ----
    pricing_mode: Mapped[PricingModeColumn] = mapped_column(
        Enum(
            PricingModeColumn,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=PricingModeColumn.NIGHTLY,
    )
    night_rate: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    subtotal: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    discount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    cleaning_fee: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    other_charges: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    # Percentage, not money — 7.00 means 7%. Stored per booking because the
    # design's form exposes it as an editable field.
    tax_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    received: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # selectin, not lazy: the booking list and calendar both render the condo
    # name, and a lazy load there is the classic N+1 on those screens.
    condo_ref: Mapped[Condo] = relationship("Condo", lazy="selectin")

    nights_rows: Mapped[list[BookingNight]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        # Drives the calendar feed: one range scan per visible month.
        Index("ix_bookings_condo_dates", "condo_id", "check_in", "check_out"),
        Index("ix_bookings_check_in", "check_in"),
        Index("ix_bookings_deleted_status", "deleted_at", "status"),
        Index("ix_bookings_guest_name", "guest_name"),
    )

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    @property
    def balance(self) -> int:
        return self.total - self.received

    @property
    def payment_status(self) -> str:
        """Mirrors the design's ``payOf()`` (lines 2008–2013)."""
        if self.status is BookingStatus.MAINTENANCE:
            return "blocked"
        if self.received >= self.total and self.total > 0:
            return "paid"
        if self.received > 0:
            return "partial"
        return "pending"

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Booking {self.guest_name} {self.check_in}->{self.check_out}>"


class BookingNight(Base):
    """One row per occupied night. The composite primary key is the constraint
    that makes overlapping bookings impossible."""

    __tablename__ = "booking_nights"

    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="CASCADE"), primary_key=True
    )
    night_date: Mapped[date] = mapped_column(Date, primary_key=True)

    booking_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    # This night's share of the booking total. Shares across a stay sum exactly
    # to the total, so month-boundary revenue splits without leaking satang.
    revenue_share: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    booking: Mapped[Booking] = relationship(back_populates="nights_rows")

    __table_args__ = (
        # Reporting reads by date across all units; the PK covers per-condo.
        Index("ix_booking_nights_date", "night_date"),
        Index("ix_booking_nights_booking", "booking_id"),
    )
