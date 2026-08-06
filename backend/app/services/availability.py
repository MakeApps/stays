"""Unit status derivation.

Status is **derived, never stored** — the prototype's ``unitStatus()`` computes
it from today's date against that condo's bookings:

    maintenance  a maintenance booking spans today
    occupied     any booking spans today
    reserved     any booking starts later
    available    otherwise

Phase 1 has no bookings table yet, so only the explicit maintenance flag can
fire. The signature already takes the booking spans it will need, so Phase 2
supplies real data without changing any call site.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date

UnitStatus = str  # "available" | "occupied" | "reserved" | "maintenance"


@dataclass(frozen=True, slots=True)
class Span:
    """A half-open stay: occupies ``check_in`` up to but excluding ``check_out``."""

    condo_id: uuid.UUID
    check_in: date
    check_out: date
    is_maintenance: bool = False

    def covers(self, day: date) -> bool:
        return self.check_in <= day < self.check_out

    def overlaps(self, other_in: date, other_out: date) -> bool:
        """The rule from the design: ``newIn < existing.out && newOut > existing.in``.

        Half-open, so a check-out and a check-in on the same day do **not**
        collide — that boundary is the most commonly broken case in booking
        systems and it has its own test.
        """
        return other_in < self.check_out and other_out > self.check_in


def derive_unit_status(
    *,
    is_maintenance_flagged: bool,
    spans: list[Span],
    today: date,
) -> UnitStatus:
    if is_maintenance_flagged:
        return "maintenance"
    if any(s.is_maintenance and s.covers(today) for s in spans):
        return "maintenance"
    if any(not s.is_maintenance and s.covers(today) for s in spans):
        return "occupied"
    if any(s.check_in > today for s in spans):
        return "reserved"
    return "available"
