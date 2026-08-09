"""Money handling.

Every monetary value is stored as an integer number of **satang** (THB minor
units). Floats are never used: ``0.1 + 0.2`` problems in a system that reports
net profit are not acceptable, and repeated float arithmetic across nightly
proration would drift.

The API boundary speaks **baht**, because that is what the design's inputs
show ("Night rate (฿)", placeholder ``1500``). Conversion happens here and
nowhere else.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

MINOR_UNITS = 100  # satang per baht


def to_minor(value: Decimal | int | float | str | None) -> int:
    """Baht → satang, half-up at the satang boundary."""
    if value is None or value == "":
        return 0
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"{value!r} is not a valid amount") from exc
    return int((amount * MINOR_UNITS).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_major(minor: int | None) -> Decimal:
    """Satang → baht, exact."""
    return (Decimal(minor or 0) / MINOR_UNITS).quantize(Decimal("0.01"))


def format_thb(minor: int | None) -> str:
    """Render the way the design does: ``฿1,800`` — grouped, no decimals.

    Mirrors the prototype's ``money()`` helper, which rounds to whole baht.

    The sign leads: ``-฿25,000``, not ``฿-25,000``. Interpolating a negative
    straight after the symbol puts the minus inside the amount, which reads as
    a typo at a glance. Negatives became routine once lease costs entered
    profit — a unit between guests genuinely loses money that month.
    """
    baht = to_major(minor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    sign = "-" if baht < 0 else ""
    return f"{sign}฿{abs(baht):,}"


def split_evenly(total_minor: int, parts: int) -> list[int]:
    """Split an amount into ``parts`` whole satang that sum **exactly** to it.

    Used for accrual revenue: a booking's amount spreads across its nights, and
    the remainder is distributed one satang at a time across the earliest
    nights rather than being rounded away. ``sum(result) == total_minor`` is a
    property test, because a rounding leak here shows up as unexplained
    kilobaht in the annual figures.
    """
    if parts <= 0:
        raise ValueError("parts must be positive")

    negative = total_minor < 0
    magnitude = abs(total_minor)
    base, remainder = divmod(magnitude, parts)
    shares = [base + (1 if i < remainder else 0) for i in range(parts)]
    return [-s for s in shares] if negative else shares
