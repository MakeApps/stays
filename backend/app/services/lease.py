"""Lease commitments and the refundable deposits held against them.

The business shape this encodes: we take a unit from its owner on a long-term
lease, pay a monthly amount plus a refundable deposit, and re-let it nightly.
So a condo has two money flows that behave completely differently.

**The monthly lease is a cost.** It is what the unit is spending to exist that
month, and it belongs in profit next to operating expenses::

    net = booking revenue - lease cost - operating expenses

**The deposit is not.** It is our capital, sitting with the owner, expected
back when we leave. Putting it in expenses would report a ฿50,000 loss in the
month a unit was taken on and a ฿50,000 profit in the month it was handed
back, both of which are fiction. It is tracked as a separate balance and is
never subtracted from anything.

Both the lease status and the deposit status are *derived*, in the same spirit
as ``derive_unit_status``. A stored ``deposit_status`` column would be a second
source of truth beside the refund ledger, free to drift into claiming
"Refunded" with no refund behind it.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.condo import Condo, DepositTransaction

LeaseStatus = Literal["none", "active", "expiring_soon", "expired"]
DepositStatus = Literal["none", "held", "partially_refunded", "refunded"]

#: How far ahead a lease end reads as "expiring soon". Two months is enough
#: notice to renegotiate or to stop taking bookings that would outlive it.
EXPIRING_SOON_DAYS = 60


# --------------------------------------------------------------- lease term
def days_remaining(condo: Condo, *, today: date | None = None) -> int | None:
    """Days until the lease ends. Negative once it has. None if no lease."""
    if condo.lease_end_date is None:
        return None
    return (condo.lease_end_date - (today or date.today())).days


def lease_status(condo: Condo, *, today: date | None = None) -> LeaseStatus:
    """Where the lease sits relative to today.

    Expiry is a fact to report, never an action: nothing here deletes a condo
    or cancels its bookings. A lapsed lease with guests still in the unit is
    exactly the situation somebody needs to be told about, not tidied away.
    """
    remaining = days_remaining(condo, today=today)
    if remaining is None:
        return "none"
    if remaining < 0:
        return "expired"
    return "expiring_soon" if remaining <= EXPIRING_SOON_DAYS else "active"


def lease_cost_between(condo: Condo, start: date, end: date) -> int:
    """The lease charge, in satang, for the half-open window ``[start, end)``.

    Prorated by day against the window, so a lease that begins on the 20th
    carries roughly a third of the month rather than all of it or none of it.
    This mirrors how booking revenue accrues per night: a month is only ever
    charged for the portion of it we actually held the unit.
    """
    if not condo.monthly_lease_amount or condo.lease_start_date is None:
        return 0

    # The lease end date is the last day we hold the unit, so the exclusive
    # bound is the day after it.
    lease_from = max(start, condo.lease_start_date)
    lease_to = min(end, condo.lease_end_date + timedelta(days=1)) if condo.lease_end_date else end

    covered = (lease_to - lease_from).days
    if covered <= 0:
        return 0

    span = (end - start).days
    if span <= 0:
        return 0
    if covered >= span:
        return condo.monthly_lease_amount

    # Integer arithmetic throughout — satang never touch a float.
    return condo.monthly_lease_amount * covered // span


def lease_costs_for(
    condos: Iterable[Condo], start: date, end: date
) -> dict[uuid.UUID, int]:
    """Per-condo lease cost for a window, keyed by id."""
    return {condo.id: lease_cost_between(condo, start, end) for condo in condos}


# ------------------------------------------------------------- the deposit
@dataclass(frozen=True, slots=True)
class DepositState:
    """What the deposit ledger says about one condo."""

    original: int
    refunded: int
    deducted: int

    @property
    def outstanding(self) -> int:
        """Still sitting with the owner — the capital we expect to recover."""
        return max(0, self.original - self.refunded - self.deducted)

    @property
    def status(self) -> DepositStatus:
        if self.original <= 0:
            return "none"
        if self.refunded == 0 and self.deducted == 0:
            return "held"
        return "refunded" if self.outstanding == 0 else "partially_refunded"


def deposit_state(
    condo: Condo, movements: Sequence[DepositTransaction] | None = None
) -> DepositState:
    rows = condo.deposit_movements if movements is None else movements
    return DepositState(
        original=condo.security_deposit,
        refunded=sum(m.refunded_amount for m in rows),
        deducted=sum(m.deducted_amount for m in rows),
    )


def deposit_states(session: Session, condos: Sequence[Condo]) -> dict[uuid.UUID, DepositState]:
    """One query for a whole page rather than one per condo."""
    if not condos:
        return {}

    ids = [c.id for c in condos]
    rows = session.execute(
        select(
            DepositTransaction.condo_id,
            DepositTransaction.refunded_amount,
            DepositTransaction.deducted_amount,
        ).where(DepositTransaction.condo_id.in_(ids))
    ).all()

    totals: dict[uuid.UUID, list[int]] = {cid: [0, 0] for cid in ids}
    for condo_id, refunded, deducted in rows:
        totals[condo_id][0] += int(refunded)
        totals[condo_id][1] += int(deducted)

    return {
        condo.id: DepositState(
            original=condo.security_deposit,
            refunded=totals[condo.id][0],
            deducted=totals[condo.id][1],
        )
        for condo in condos
    }


def total_held(session: Session) -> tuple[int, int]:
    """Capital tied up across the portfolio, and how many units hold one.

    The dashboard's "Refundable deposits" figure. Counts only units with
    something still outstanding — a fully recovered deposit is money back in
    the business, not money held.
    """
    condos = list(session.scalars(select(Condo).where(Condo.deleted_at.is_(None))))
    states = deposit_states(session, condos)
    outstanding = [s.outstanding for s in states.values() if s.outstanding > 0]
    return sum(outstanding), len(outstanding)
