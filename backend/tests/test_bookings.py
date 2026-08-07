"""Booking overlap and the double-booking guarantee.

These run against the real engine because the guarantee *is* a database
constraint — the composite primary key on ``booking_nights``. Asserting it
against SQLite would prove something else entirely.
"""

from __future__ import annotations

import threading
from datetime import date
from typing import Any

import pytest
from flask import Flask
from sqlalchemy import func, select

from app.common.errors import BookingConflictError
from app.common.money import to_minor
from app.extensions import db
from app.models.booking import Booking, BookingNight, BookingStatus
from app.models.condo import Condo
from app.services.booking_service import BookingService
from app.services.pricing import PricingMode

D = date.fromisoformat


@pytest.fixture()
def condo(session: Any) -> Condo:
    unit = Condo(code="A-1204", name="Ashton Asoke 1204", night_rate=to_minor(1800))
    session.add(unit)
    session.commit()
    return unit


@pytest.fixture()
def service(session: Any) -> BookingService:
    return BookingService(session)


def book(
    service: BookingService,
    condo: Condo,
    check_in: str,
    check_out: str,
    *,
    guest: str = "Sarah Chen",
    status: BookingStatus = BookingStatus.BOOKED,
) -> Booking:
    booking = service.create(
        condo_id=condo.id,
        guest_name=guest,
        check_in=D(check_in),
        check_out=D(check_out),
        mode=PricingMode.NIGHTLY,
        night_rate=to_minor(1800),
        status=status,
    )
    db.session.commit()
    return booking


class TestOverlapMatrix:
    """Every relative position of two intervals, against the real constraint."""

    @pytest.mark.parametrize(
        ("new_in", "new_out", "collides", "why"),
        [
            ("2026-08-01", "2026-08-05", False, "entirely before"),
            ("2026-08-20", "2026-08-25", False, "entirely after"),
            # The case most booking systems get wrong.
            ("2026-08-15", "2026-08-18", False, "checkin on the existing checkout day"),
            ("2026-08-05", "2026-08-10", False, "checkout on the existing checkin day"),
            ("2026-08-11", "2026-08-14", True, "contained"),
            ("2026-08-05", "2026-08-20", True, "contains"),
            ("2026-08-10", "2026-08-15", True, "identical"),
            ("2026-08-08", "2026-08-12", True, "overlaps the start"),
            ("2026-08-13", "2026-08-18", True, "overlaps the end"),
            ("2026-08-14", "2026-08-15", True, "the final night only"),
            ("2026-08-10", "2026-08-11", True, "the first night only"),
        ],
    )
    def test_against_the_database(
        self,
        service: BookingService,
        condo: Condo,
        new_in: str,
        new_out: str,
        collides: bool,
        why: str,
    ) -> None:
        book(service, condo, "2026-08-10", "2026-08-15", guest="Existing guest")

        if collides:
            with pytest.raises(BookingConflictError):
                book(service, condo, new_in, new_out, guest="Newcomer")
        else:
            created = book(service, condo, new_in, new_out, guest="Newcomer")
            assert created.id is not None, why

    def test_same_day_turnover_is_allowed(self, service: BookingService, condo: Condo) -> None:
        """One guest leaves on the 10th, the next arrives on the 10th.

        A normal turnover day. Refusing it would block legitimate business, and
        it is the single most commonly broken case in booking systems.
        """
        book(service, condo, "2026-08-05", "2026-08-10", guest="Departing")
        arriving = book(service, condo, "2026-08-10", "2026-08-14", guest="Arriving")
        assert arriving.check_in == D("2026-08-10")

    def test_a_different_condo_never_collides(
        self, service: BookingService, condo: Condo, session: Any
    ) -> None:
        other = Condo(code="R-1502", name="Rhythm Ekkamai 1502", night_rate=to_minor(2100))
        session.add(other)
        session.commit()

        book(service, condo, "2026-08-10", "2026-08-15")
        second = service.create(
            condo_id=other.id,
            guest_name="Marco Fenn",
            check_in=D("2026-08-10"),
            check_out=D("2026-08-15"),
            mode=PricingMode.NIGHTLY,
            night_rate=to_minor(2100),
        )
        db.session.commit()
        assert second.id is not None


class TestConflictReporting:
    def test_names_the_blocking_booking(self, service: BookingService, condo: Condo) -> None:
        book(service, condo, "2026-08-10", "2026-08-15", guest="Sarah Chen")
        with pytest.raises(BookingConflictError) as caught:
            book(service, condo, "2026-08-12", "2026-08-18", guest="Newcomer")

        error = caught.value
        assert "Sarah Chen" in error.message
        assert error.details["conflict"]["guest_name"] == "Sarah Chen"
        assert error.details["conflict"]["check_in"] == "2026-08-10"

    def test_find_conflict_matches_the_constraint(
        self, service: BookingService, condo: Condo
    ) -> None:
        existing = book(service, condo, "2026-08-10", "2026-08-15")
        assert service.find_conflict(condo.id, D("2026-08-12"), D("2026-08-14")) is not None
        assert service.find_conflict(condo.id, D("2026-08-15"), D("2026-08-18")) is None
        # Excluding itself is what lets a booking be edited in place.
        assert (
            service.find_conflict(
                condo.id, D("2026-08-10"), D("2026-08-15"), exclude_id=existing.id
            )
            is None
        )


class TestNightRows:
    def test_one_row_per_night_excluding_checkout(
        self, service: BookingService, condo: Condo, session: Any
    ) -> None:
        booking = book(service, condo, "2026-08-10", "2026-08-15")
        rows = list(
            session.scalars(select(BookingNight).where(BookingNight.booking_id == booking.id))
        )
        assert len(rows) == 5
        assert min(r.night_date for r in rows) == D("2026-08-10")
        assert max(r.night_date for r in rows) == D("2026-08-14")  # checkout night not held

    def test_revenue_shares_sum_to_the_total(
        self, service: BookingService, condo: Condo, session: Any
    ) -> None:
        """Accrual revenue must not leak satang across a stay."""
        booking = service.create(
            condo_id=condo.id,
            guest_name="Odd Total",
            check_in=D("2026-08-10"),
            check_out=D("2026-08-13"),
            mode=PricingMode.TOTAL,
            total_manual=to_minor(1000),  # 1000 / 3 does not divide evenly
        )
        db.session.commit()
        total_shares = session.scalar(
            select(func.sum(BookingNight.revenue_share)).where(
                BookingNight.booking_id == booking.id
            )
        )
        assert total_shares == booking.total == to_minor(1000)

    def test_cancelled_bookings_release_their_dates(
        self, service: BookingService, condo: Condo
    ) -> None:
        book(service, condo, "2026-08-10", "2026-08-15", status=BookingStatus.CANCELLED)
        # Same dates must remain bookable.
        assert book(service, condo, "2026-08-10", "2026-08-15", guest="Real guest") is not None

    def test_maintenance_blocks_the_dates(self, service: BookingService, condo: Condo) -> None:
        book(service, condo, "2026-08-10", "2026-08-15", status=BookingStatus.MAINTENANCE)
        with pytest.raises(BookingConflictError):
            book(service, condo, "2026-08-12", "2026-08-14", guest="Blocked")

    def test_deleting_releases_the_dates(self, service: BookingService, condo: Condo) -> None:
        booking = book(service, condo, "2026-08-10", "2026-08-15")
        service.delete(booking.id)
        db.session.commit()
        assert book(service, condo, "2026-08-10", "2026-08-15", guest="Next guest") is not None


class TestUpdate:
    def test_shortening_a_stay_does_not_collide_with_itself(
        self, service: BookingService, condo: Condo, session: Any
    ) -> None:
        """The old nights must be released before the new ones are claimed."""
        booking = book(service, condo, "2026-08-10", "2026-08-20")
        service.update(booking.id, check_out=D("2026-08-15"))
        db.session.commit()

        rows = session.scalar(
            select(func.count())
            .select_from(BookingNight)
            .where(BookingNight.booking_id == booking.id)
        )
        assert rows == 5

    def test_moving_onto_occupied_dates_is_refused(
        self, service: BookingService, condo: Condo
    ) -> None:
        book(service, condo, "2026-08-01", "2026-08-05", guest="First")
        movable = book(service, condo, "2026-08-10", "2026-08-15", guest="Second")
        with pytest.raises(BookingConflictError):
            service.update(movable.id, check_in=D("2026-08-02"), check_out=D("2026-08-06"))


@pytest.mark.concurrency
class TestConcurrency:
    def test_simultaneous_requests_yield_exactly_one_booking(
        self, app: Flask, condo: Condo
    ) -> None:
        """Two threads, same condo, same dates, separate connections.

        This is the test the whole booking_nights design exists for. A
        check-then-act availability query would let both through; the primary
        key cannot.
        """
        condo_id = condo.id
        outcomes: list[str] = []
        lock = threading.Lock()
        barrier = threading.Barrier(2)

        def attempt(index: int) -> None:
            with app.app_context():
                svc = BookingService(db.session)
                barrier.wait(timeout=10)
                try:
                    svc.create(
                        condo_id=condo_id,
                        guest_name=f"Racer {index}",
                        check_in=D("2026-09-01"),
                        check_out=D("2026-09-05"),
                        mode=PricingMode.NIGHTLY,
                        night_rate=to_minor(1800),
                    )
                    db.session.commit()
                    result = "created"
                except BookingConflictError:
                    db.session.rollback()
                    result = "conflict"
                except Exception as exc:
                    db.session.rollback()
                    result = f"error:{type(exc).__name__}"
                finally:
                    db.session.remove()
                with lock:
                    outcomes.append(result)

        threads = [threading.Thread(target=attempt, args=(i,)) for i in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        assert outcomes.count("created") == 1, f"expected exactly one winner, got {outcomes}"
        assert outcomes.count("conflict") == 1, f"expected exactly one loser, got {outcomes}"

        with app.app_context():
            live = db.session.scalar(
                select(func.count())
                .select_from(Booking)
                .where(Booking.condo_id == condo_id, Booking.deleted_at.is_(None))
            )
            assert live == 1
