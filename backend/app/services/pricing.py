"""Booking price computation — the single source of truth for money.

A direct port of the approved design's ``calc()`` (Condo Manager.dc.html lines
2030–2042)::

    nights   = checkOut − checkIn
    nightly  : subtotal = nightRate × nights
    total    : subtotal = totalManual ; nightRate = subtotal / nights
    taxable  = subtotal − discount + cleaning + other
    tax      = taxable × taxPct / 100
    total    = taxable + tax
    balance  = total − received

Two things this module is strict about:

* **Everything is integer satang.** Floats are never used. The frontend
  recomputes the same arithmetic for live preview, but this result is what gets
  persisted — the figure the guest is quoted must be the figure stored.
* **VAT applies to cleaning and other charges**, because that is what the
  approved design does. It is an unusual enough choice to be worth stating out
  loud rather than leaving implicit in the expression.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum

from app.common.errors import ValidationError


class PricingMode(str, Enum):
    NIGHTLY = "nightly"
    TOTAL = "total"


@dataclass(frozen=True, slots=True)
class Quote:
    nights: int
    night_rate: int
    subtotal: int
    discount: int
    cleaning_fee: int
    other_charges: int
    tax_pct: Decimal
    tax: int
    total: int
    received: int
    balance: int

    @property
    def payment_status(self) -> str:
        """Derived exactly as the design's ``payOf()`` does (lines 2008–2013)."""
        if self.received >= self.total and self.total > 0:
            return "paid"
        if self.received > 0:
            return "partial"
        return "pending"

    def as_dict(self) -> dict[str, object]:
        from app.common.money import format_thb, to_major

        return {
            "nights": self.nights,
            "night_rate": str(to_major(self.night_rate)),
            "subtotal": str(to_major(self.subtotal)),
            "discount": str(to_major(self.discount)),
            "cleaning_fee": str(to_major(self.cleaning_fee)),
            "other_charges": str(to_major(self.other_charges)),
            "tax_pct": str(self.tax_pct),
            "tax": str(to_major(self.tax)),
            "total": str(to_major(self.total)),
            "received": str(to_major(self.received)),
            "balance": str(to_major(self.balance)),
            "payment_status": self.payment_status,
            # Pre-rendered so ฿ formatting cannot drift between the two apps.
            "total_label": format_thb(self.total),
            "balance_label": format_thb(self.balance),
            "night_rate_label": format_thb(self.night_rate),
        }


def nights_between(check_in: date, check_out: date) -> int:
    """Half-open: the guest occupies check-in but not check-out."""
    return (check_out - check_in).days


def quote(
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
    """Compute a booking's money. All amounts in and out are satang."""
    nights = nights_between(check_in, check_out)
    if nights < 1:
        raise ValidationError(
            "Check-out must be after check-in.",
            details={"fields": {"check_out": ["Must be at least one night after check-in."]}},
        )

    pct = Decimal(str(tax_pct))
    if pct < 0 or pct > 100:
        raise ValidationError(
            "Tax must be between 0 and 100 percent.",
            details={"fields": {"tax_pct": ["Use a value between 0 and 100."]}},
        )

    for label, value in (
        ("night_rate", night_rate),
        ("total_manual", total_manual),
        ("discount", discount),
        ("cleaning_fee", cleaning_fee),
        ("other_charges", other_charges),
        ("received", received),
    ):
        if value < 0:
            raise ValidationError(
                "Amounts cannot be negative.",
                details={"fields": {label: ["Must be zero or more."]}},
            )

    if mode is PricingMode.NIGHTLY:
        subtotal = night_rate * nights
        effective_rate = night_rate
    else:
        subtotal = total_manual
        # Display-only: the manual total stays authoritative, so deriving the
        # rate here cannot introduce rounding drift into what gets stored.
        effective_rate = _round_satang(Decimal(subtotal) / nights)

    taxable = subtotal - discount + cleaning_fee + other_charges
    if taxable < 0:
        raise ValidationError(
            "The discount is larger than the booking total.",
            details={"fields": {"discount": ["Cannot exceed the charges."]}},
        )

    tax = _round_satang(Decimal(taxable) * pct / Decimal(100))
    total = taxable + tax

    return Quote(
        nights=nights,
        night_rate=effective_rate,
        subtotal=subtotal,
        discount=discount,
        cleaning_fee=cleaning_fee,
        other_charges=other_charges,
        tax_pct=pct,
        tax=tax,
        total=total,
        received=received,
        balance=total - received,
    )


def _round_satang(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
