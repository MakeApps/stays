"""Unit-status derivation and the overlap rule.

The overlap matrix below is written now, before bookings exist, because the
rule is the load-bearing invariant of the whole product: get it wrong and the
system either double-books a unit or refuses a legitimate same-day turnover.
"""

from __future__ import annotations

import uuid
from datetime import date

import pytest

from app.services.availability import Span, derive_unit_status

CONDO = uuid.uuid4()
TODAY = date(2026, 8, 6)


def span(check_in: str, check_out: str, *, maintenance: bool = False) -> Span:
    return Span(
        condo_id=CONDO,
        check_in=date.fromisoformat(check_in),
        check_out=date.fromisoformat(check_out),
        is_maintenance=maintenance,
    )


class TestOverlap:
    @pytest.mark.parametrize(
        ("existing_in", "existing_out", "new_in", "new_out", "collides", "why"),
        [
            ("2026-08-10", "2026-08-15", "2026-08-01", "2026-08-05", False, "entirely before"),
            ("2026-08-10", "2026-08-15", "2026-08-20", "2026-08-25", False, "entirely after"),
            # The case most systems get wrong. One guest checks out on the 10th,
            # the next checks in on the 10th. That is a normal turnover day.
            ("2026-08-05", "2026-08-10", "2026-08-10", "2026-08-14", False, "checkout == checkin"),
            ("2026-08-10", "2026-08-15", "2026-08-05", "2026-08-10", False, "checkin == checkout"),
            ("2026-08-10", "2026-08-15", "2026-08-11", "2026-08-14", True, "contained"),
            ("2026-08-10", "2026-08-15", "2026-08-05", "2026-08-20", True, "contains"),
            ("2026-08-10", "2026-08-15", "2026-08-10", "2026-08-15", True, "identical"),
            ("2026-08-10", "2026-08-15", "2026-08-08", "2026-08-12", True, "overlaps start"),
            ("2026-08-10", "2026-08-15", "2026-08-13", "2026-08-18", True, "overlaps end"),
            ("2026-08-10", "2026-08-11", "2026-08-10", "2026-08-11", True, "same single night"),
            ("2026-08-10", "2026-08-15", "2026-08-14", "2026-08-15", True, "last night only"),
        ],
    )
    def test_matrix(
        self,
        existing_in: str,
        existing_out: str,
        new_in: str,
        new_out: str,
        collides: bool,
        why: str,
    ) -> None:
        existing = span(existing_in, existing_out)
        assert (
            existing.overlaps(date.fromisoformat(new_in), date.fromisoformat(new_out))
            is collides
        ), why

    def test_is_symmetric(self) -> None:
        a, b = span("2026-08-10", "2026-08-15"), span("2026-08-12", "2026-08-18")
        assert a.overlaps(b.check_in, b.check_out)
        assert b.overlaps(a.check_in, a.check_out)


class TestCovers:
    def test_includes_check_in_excludes_check_out(self) -> None:
        s = span("2026-08-05", "2026-08-10")
        assert s.covers(date(2026, 8, 5))       # arrival day is occupied
        assert s.covers(date(2026, 8, 9))       # last night
        assert not s.covers(date(2026, 8, 10))  # departure day is free
        assert not s.covers(date(2026, 8, 4))


class TestDeriveUnitStatus:
    def test_explicit_flag_wins(self) -> None:
        assert (
            derive_unit_status(
                is_maintenance_flagged=True,
                spans=[span("2026-08-01", "2026-08-30")],
                today=TODAY,
            )
            == "maintenance"
        )

    def test_maintenance_booking_beats_occupancy(self) -> None:
        spans = [
            span("2026-08-01", "2026-08-30"),
            span("2026-08-05", "2026-08-12", maintenance=True),
        ]
        assert (
            derive_unit_status(is_maintenance_flagged=False, spans=spans, today=TODAY)
            == "maintenance"
        )

    def test_occupied_when_a_stay_spans_today(self) -> None:
        assert (
            derive_unit_status(
                is_maintenance_flagged=False,
                spans=[span("2026-08-01", "2026-08-09")],
                today=TODAY,
            )
            == "occupied"
        )

    def test_reserved_when_only_future_stays(self) -> None:
        assert (
            derive_unit_status(
                is_maintenance_flagged=False,
                spans=[span("2026-08-20", "2026-08-25")],
                today=TODAY,
            )
            == "reserved"
        )

    def test_available_with_no_stays(self) -> None:
        assert (
            derive_unit_status(is_maintenance_flagged=False, spans=[], today=TODAY)
            == "available"
        )

    def test_past_stays_do_not_reserve(self) -> None:
        assert (
            derive_unit_status(
                is_maintenance_flagged=False,
                spans=[span("2026-07-01", "2026-07-09")],
                today=TODAY,
            )
            == "available"
        )

    def test_departure_today_frees_the_unit(self) -> None:
        # Guest leaves this morning and nobody else is booked: available today.
        assert (
            derive_unit_status(
                is_maintenance_flagged=False,
                spans=[span("2026-08-01", "2026-08-06")],
                today=TODAY,
            )
            == "available"
        )
