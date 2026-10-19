"""Money handling.

Every monetary value is stored as an integer number of **minor units** —
satang for baht, paise for rupees. Floats are never used: ``0.1 + 0.2``
problems in a system that reports net profit are not acceptable, and repeated
float arithmetic across nightly proration would drift.

The API boundary speaks **major units**, because that is what the design's
inputs show ("Night rate (฿)", placeholder ``1500``). Conversion happens here
and nowhere else.

Which currency an amount is *in* is a fact about the organisation, chosen in
Settings, and nothing here converts between currencies: an organisation keeps
its books in one of them, and the symbol in front of a figure says which.
Every supported currency has 100 minor units, which is what lets
``MINOR_UNITS`` stay a single constant. Adding one that does not (JPY, KWD)
would mean carrying the exponent per organisation, and is deliberately not
supported until it is.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from app.common.current_org import get_current_org_id

MINOR_UNITS = 100  # satang per baht, paise per rupee


@dataclass(frozen=True, slots=True)
class Currency:
    code: str  # ISO 4217
    symbol: str
    name: str
    minor_name: str


CURRENCIES: dict[str, Currency] = {
    c.code: c
    for c in (
        Currency("THB", "฿", "Thai baht", "satang"),
        Currency("INR", "₹", "Indian rupee", "paise"),
    )
}

DEFAULT_CURRENCY = "THB"


def is_supported(code: str | None) -> bool:
    return code is not None and code.upper() in CURRENCIES


def currency_for(code: str | None) -> Currency:
    """The registry entry for a code, or the default when it is blank or unknown.

    Lenient on purpose: this sits under every label the API renders, and a
    row carrying a code the registry no longer knows must not take every
    screen down with it. The strict check belongs where a code is *chosen*,
    which is ``OrganisationService.set_currency``.
    """
    if code:
        found = CURRENCIES.get(code.upper())
        if found is not None:
            return found
    return CURRENCIES[DEFAULT_CURRENCY]


def current_currency() -> Currency:
    """The currency of the organisation being acted in.

    Resolved from the same context variable that scopes every query, so a
    label rendered inside a request, a CLI command or a seed comes out in that
    organisation's currency without anything being passed down. Outside any
    scope — a unit test, a migration — it is the default.

    The lookup is an identity-map hit in a request (``require_auth`` has
    already loaded the organisation) and a primary-key read otherwise. It runs
    with autoflush off because formatting a label must never be the thing
    that flushes a half-built row.
    """
    org_id = get_current_org_id()
    if org_id is None:
        return currency_for(None)

    from flask import has_app_context

    if not has_app_context():
        return currency_for(None)

    from app.extensions import db
    from app.models.organisation import Organisation

    with db.session.no_autoflush:
        organisation = db.session.get(Organisation, org_id)
    return currency_for(organisation.currency if organisation is not None else None)


def to_minor(value: Decimal | int | float | str | None) -> int:
    """Major units → minor units, half-up at the minor-unit boundary."""
    if value is None or value == "":
        return 0
    try:
        amount = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError(f"{value!r} is not a valid amount") from exc
    return int((amount * MINOR_UNITS).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def to_major(minor: int | None) -> Decimal:
    """Minor units → major units, exact."""
    return (Decimal(minor or 0) / MINOR_UNITS).quantize(Decimal("0.01"))


def format_money(minor: int | None, currency: Currency | str | None = None) -> str:
    """Render the way the design does: ``฿1,800`` — grouped, no decimals.

    Mirrors the prototype's ``money()`` helper, which rounds to whole units.

    ``currency`` defaults to the acting organisation's. Pass one explicitly
    only where there is no organisation to ask — a unit test, or a figure
    about a tenant other than the one in scope.

    The sign leads: ``-฿25,000``, not ``฿-25,000``. Interpolating a negative
    straight after the symbol puts the minus inside the amount, which reads as
    a typo at a glance. Negatives became routine once lease costs entered
    profit — a unit between guests genuinely loses money that month.
    """
    if isinstance(currency, Currency):
        chosen = currency
    elif currency is not None:
        chosen = currency_for(currency)
    else:
        chosen = current_currency()

    major = to_major(minor).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    sign = "-" if major < 0 else ""
    return f"{sign}{chosen.symbol}{abs(major):,}"


def split_evenly(total_minor: int, parts: int) -> list[int]:
    """Split an amount into ``parts`` whole minor units that sum **exactly** to it.

    Used for accrual revenue: a booking's amount spreads across its nights, and
    the remainder is distributed one minor unit at a time across the earliest
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
