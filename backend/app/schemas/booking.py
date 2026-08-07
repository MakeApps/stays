"""Booking request/response schemas."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.common.money import format_thb, to_major, to_minor
from app.models.booking import Booking, BookingStatus, PricingModeColumn
from app.services.pricing import PricingMode

Baht = Annotated[Decimal, Field(ge=0, le=Decimal("99999999"))]
Mode = Literal["nightly", "total"]


class BookingBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    condo_id: uuid.UUID
    guest_name: str = Field(min_length=1, max_length=160)
    guest_phone: str | None = Field(default=None, max_length=40)
    guest_email: str | None = Field(default=None, max_length=255)

    check_in: date
    check_out: date

    mode: Mode = "nightly"
    night_rate: Baht = Decimal(0)
    total_manual: Baht = Decimal(0)
    discount: Baht = Decimal(0)
    cleaning_fee: Baht = Decimal(0)
    other_charges: Baht = Decimal(0)
    tax_pct: Decimal = Field(default=Decimal("7"), ge=0, le=100)
    received: Baht = Decimal(0)

    status: Literal["booked", "pending", "maintenance", "cancelled"] = "booked"
    notes: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _at_least_one_night(self) -> BookingBase:
        if self.check_out <= self.check_in:
            raise ValueError("check_out must be after check_in")
        return self

    def to_service_kwargs(self) -> dict[str, object]:
        return {
            "condo_id": self.condo_id,
            "guest_name": self.guest_name,
            "guest_phone": self.guest_phone,
            "guest_email": self.guest_email,
            "check_in": self.check_in,
            "check_out": self.check_out,
            "mode": PricingMode(self.mode),
            "status": BookingStatus(self.status),
            "night_rate": to_minor(self.night_rate),
            "total_manual": to_minor(self.total_manual),
            "discount": to_minor(self.discount),
            "cleaning_fee": to_minor(self.cleaning_fee),
            "other_charges": to_minor(self.other_charges),
            "tax_pct": self.tax_pct,
            "received": to_minor(self.received),
            "notes": self.notes,
        }


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    """Partial update. Any money or date change re-prices server-side."""

    model_config = ConfigDict(str_strip_whitespace=True)

    condo_id: uuid.UUID | None = None
    guest_name: str | None = Field(default=None, min_length=1, max_length=160)
    guest_phone: str | None = Field(default=None, max_length=40)
    guest_email: str | None = Field(default=None, max_length=255)
    check_in: date | None = None
    check_out: date | None = None
    mode: Mode | None = None
    night_rate: Baht | None = None
    total_manual: Baht | None = None
    discount: Baht | None = None
    cleaning_fee: Baht | None = None
    other_charges: Baht | None = None
    tax_pct: Decimal | None = Field(default=None, ge=0, le=100)
    received: Baht | None = None
    status: Literal["booked", "pending", "maintenance", "cancelled"] | None = None
    notes: str | None = Field(default=None, max_length=5000)

    def to_service_changes(self) -> dict[str, object]:
        data = self.model_dump(exclude_unset=True)
        changes: dict[str, object] = {}
        for field in (
            "condo_id",
            "guest_name",
            "guest_phone",
            "guest_email",
            "check_in",
            "check_out",
            "notes",
        ):
            if field in data:
                changes[field] = data[field]
        if "status" in data and data["status"] is not None:
            changes["status"] = BookingStatus(data["status"])
        if "mode" in data and data["mode"] is not None:
            changes["mode"] = PricingMode(data["mode"])
        if "tax_pct" in data and data["tax_pct"] is not None:
            changes["tax_pct"] = data["tax_pct"]
        for field in (
            "night_rate",
            "total_manual",
            "discount",
            "cleaning_fee",
            "other_charges",
            "received",
        ):
            if field in data and data[field] is not None:
                changes[field] = to_minor(data[field])
        return changes


class QuoteRequest(BaseModel):
    """Server-side pricing preview — the frontend's live totals are checked
    against this so the quoted figure is the stored figure."""

    check_in: date
    check_out: date
    mode: Mode = "nightly"
    night_rate: Baht = Decimal(0)
    total_manual: Baht = Decimal(0)
    discount: Baht = Decimal(0)
    cleaning_fee: Baht = Decimal(0)
    other_charges: Baht = Decimal(0)
    tax_pct: Decimal = Field(default=Decimal("7"), ge=0, le=100)
    received: Baht = Decimal(0)


class AvailabilityQuery(BaseModel):
    condo_id: uuid.UUID
    check_in: date
    check_out: date
    exclude_booking_id: uuid.UUID | None = None


class BookingListQuery(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    condo_id: uuid.UUID | None = None
    status: Literal["all", "booked", "pending", "maintenance", "cancelled"] = "all"
    payment_status: Literal["all", "paid", "partial", "pending"] = "all"
    start: date | None = None
    end: date | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=100)
    sort: str | None = None
    order: Literal["asc", "desc"] = "asc"


class BookingOut(BaseModel):
    id: uuid.UUID
    condo_id: uuid.UUID
    condo_name: str
    condo_code: str

    guest_name: str
    guest_phone: str | None
    guest_email: str | None

    check_in: date
    check_out: date
    nights: int

    status: str
    payment_status: str
    pricing_mode: str

    night_rate: Decimal
    subtotal: Decimal
    discount: Decimal
    cleaning_fee: Decimal
    other_charges: Decimal
    tax_pct: Decimal
    tax: Decimal
    total: Decimal
    received: Decimal
    balance: Decimal

    notes: str | None

    total_label: str
    balance_label: str
    night_rate_label: str

    @staticmethod
    def from_model(booking: Booking, *, condo_name: str, condo_code: str) -> BookingOut:
        return BookingOut(
            id=booking.id,
            condo_id=booking.condo_id,
            condo_name=condo_name,
            condo_code=condo_code,
            guest_name=booking.guest_name,
            guest_phone=booking.guest_phone,
            guest_email=booking.guest_email,
            check_in=booking.check_in,
            check_out=booking.check_out,
            nights=booking.nights,
            status=booking.status.value,
            payment_status=booking.payment_status,
            pricing_mode=(
                "nightly" if booking.pricing_mode is PricingModeColumn.NIGHTLY else "total"
            ),
            night_rate=to_major(booking.night_rate),
            subtotal=to_major(booking.subtotal),
            discount=to_major(booking.discount),
            cleaning_fee=to_major(booking.cleaning_fee),
            other_charges=to_major(booking.other_charges),
            tax_pct=Decimal(str(booking.tax_pct)),
            tax=to_major(booking.tax),
            total=to_major(booking.total),
            received=to_major(booking.received),
            balance=to_major(booking.balance),
            notes=booking.notes,
            total_label=format_thb(booking.total),
            balance_label=format_thb(booking.balance),
            night_rate_label=format_thb(booking.night_rate),
        )


class CalendarQuery(BaseModel):
    """Window for the timeline. `end` defaults to a month after `start`."""

    start: date
    end: date | None = None
    condo_id: uuid.UUID | None = None
