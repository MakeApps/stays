"""Booking pricing.

Cases are checked against the approved design's own seed data, so the figures
here are the ones a user would have seen in the prototype. Pure functions, no
database — these run in milliseconds and guard the arithmetic that every other
money figure in the product derives from.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.common.errors import ValidationError
from app.common.money import to_minor
from app.services.pricing import PricingMode, nights_between, quote

B = to_minor  # baht -> satang, for readability below


class TestNights:
    @pytest.mark.parametrize(
        ("check_in", "check_out", "expected"),
        [
            ("2026-08-01", "2026-08-09", 8),
            ("2026-08-01", "2026-08-02", 1),
            ("2026-08-28", "2026-09-04", 7),  # crosses a month boundary
            ("2026-02-27", "2026-03-02", 3),  # non-leap February
            ("2024-02-27", "2024-03-02", 4),  # leap February
            ("2026-12-30", "2027-01-02", 3),  # crosses a year
        ],
    )
    def test_counts(self, check_in: str, check_out: str, expected: int) -> None:
        got = nights_between(date.fromisoformat(check_in), date.fromisoformat(check_out))
        assert got == expected


class TestNightlyMode:
    def test_matches_the_design_seed(self) -> None:
        """Sarah Chen: Ashton Asoke 1204, 1–9 Aug, ฿14,400 total.

        8 nights at ฿1,800 — the prototype's booking id 1.
        """
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 9),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1800),
            received=B(14400),
        )
        assert q.nights == 8
        assert q.subtotal == B(14400)
        assert q.total == B(14400)
        assert q.balance == 0
        assert q.payment_status == "paid"

    def test_full_stack_of_charges(self) -> None:
        q = quote(
            check_in=date(2026, 8, 15),
            check_out=date(2026, 8, 20),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1500),
            discount=B(500),
            cleaning_fee=B(500),
            other_charges=B(200),
            tax_pct=Decimal("7"),
            received=B(3000),
        )
        # 5 x 1500 = 7500; 7500 - 500 + 500 + 200 = 7700; VAT 7% = 539
        assert q.subtotal == B(7500)
        assert q.tax == B(539)
        assert q.total == B(8239)
        assert q.balance == B(5239)
        assert q.payment_status == "partial"

    def test_vat_applies_to_cleaning_and_other(self) -> None:
        """Unusual, but it is what the approved design does."""
        without = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1000),
            tax_pct=10,
        )
        with_fees = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1000),
            cleaning_fee=B(500),
            tax_pct=10,
        )
        assert without.tax == B(100)
        assert with_fees.tax == B(150)  # taxed on 1500, not 1000


class TestTotalMode:
    def test_derives_the_night_rate(self) -> None:
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 5),
            mode=PricingMode.TOTAL,
            total_manual=B(6000),
        )
        assert q.subtotal == B(6000)
        assert q.night_rate == B(1500)

    def test_manual_total_stays_authoritative_when_it_does_not_divide(self) -> None:
        """The derived rate is display-only, so no rounding drift reaches the total.

        1000 over 3 nights is 333.33 per night; recomputing 3 x 333.33 would
        lose a satang. The stored total must remain exactly what was entered.
        """
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 4),
            mode=PricingMode.TOTAL,
            total_manual=B(1000),
        )
        assert q.subtotal == B(1000)
        assert q.total == B(1000)
        assert q.night_rate == 33333  # 333.33 baht, rounded for display only

    def test_night_rate_is_ignored_in_total_mode(self) -> None:
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 3),
            mode=PricingMode.TOTAL,
            total_manual=B(5000),
            night_rate=B(999999),
        )
        assert q.total == B(5000)


class TestRounding:
    def test_tax_rounds_half_up_at_the_satang(self) -> None:
        # 1 satang taxed at 50% = 0.5 satang -> 1
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=1,
            tax_pct=50,
        )
        assert q.tax == 1
        assert q.total == 2

    def test_seven_percent_of_an_odd_amount(self) -> None:
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=B("1234.56"),
            tax_pct=Decimal("7"),
        )
        # 123456 satang * 0.07 = 8641.92 -> 8642
        assert q.tax == 8642
        assert q.total == 132098


class TestPaymentStatus:
    @pytest.mark.parametrize(
        ("received", "expected"),
        [(0, "pending"), (1, "partial"), (B(999), "partial"), (B(1000), "paid"), (B(2000), "paid")],
    )
    def test_derivation(self, received: int, expected: str) -> None:
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1000),
            received=received,
        )
        assert q.payment_status == expected

    def test_overpayment_gives_a_negative_balance(self) -> None:
        q = quote(
            check_in=date(2026, 8, 1),
            check_out=date(2026, 8, 2),
            mode=PricingMode.NIGHTLY,
            night_rate=B(1000),
            received=B(1500),
        )
        assert q.balance == B(-500)


class TestValidation:
    def test_zero_nights_is_refused(self) -> None:
        with pytest.raises(ValidationError):
            quote(
                check_in=date(2026, 8, 5),
                check_out=date(2026, 8, 5),
                mode=PricingMode.NIGHTLY,
                night_rate=B(1000),
            )

    def test_reversed_dates_are_refused(self) -> None:
        with pytest.raises(ValidationError):
            quote(
                check_in=date(2026, 8, 9),
                check_out=date(2026, 8, 1),
                mode=PricingMode.NIGHTLY,
                night_rate=B(1000),
            )

    def test_negative_amounts_are_refused(self) -> None:
        with pytest.raises(ValidationError):
            quote(
                check_in=date(2026, 8, 1),
                check_out=date(2026, 8, 2),
                mode=PricingMode.NIGHTLY,
                night_rate=-1,
            )

    def test_discount_larger_than_the_charges_is_refused(self) -> None:
        # Otherwise the guest is owed money by arithmetic accident.
        with pytest.raises(ValidationError):
            quote(
                check_in=date(2026, 8, 1),
                check_out=date(2026, 8, 2),
                mode=PricingMode.NIGHTLY,
                night_rate=B(1000),
                discount=B(2000),
            )

    @pytest.mark.parametrize("pct", [-1, 101])
    def test_tax_outside_zero_to_one_hundred_is_refused(self, pct: int) -> None:
        with pytest.raises(ValidationError):
            quote(
                check_in=date(2026, 8, 1),
                check_out=date(2026, 8, 2),
                mode=PricingMode.NIGHTLY,
                night_rate=B(1000),
                tax_pct=pct,
            )


class TestProperties:
    @given(
        rate=st.integers(min_value=0, max_value=10_000_00),
        nights=st.integers(min_value=1, max_value=365),
        cleaning=st.integers(min_value=0, max_value=5_000_00),
        other=st.integers(min_value=0, max_value=5_000_00),
        pct=st.integers(min_value=0, max_value=100),
    )
    def test_total_always_reconciles(
        self, rate: int, nights: int, cleaning: int, other: int, pct: int
    ) -> None:
        """total must always equal taxable + tax, with no float drift."""
        q = quote(
            check_in=date(2026, 1, 1),
            check_out=date(2026, 1, 1) + timedelta(days=nights),
            mode=PricingMode.NIGHTLY,
            night_rate=rate,
            cleaning_fee=cleaning,
            other_charges=other,
            tax_pct=pct,
        )
        taxable = q.subtotal - q.discount + q.cleaning_fee + q.other_charges
        assert q.total == taxable + q.tax
        assert isinstance(q.total, int)
        assert q.balance == q.total - q.received
