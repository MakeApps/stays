"""Money arithmetic.

These are the cheapest tests in the suite and they guard the most damaging
class of bug: a rounding leak that silently misstates revenue.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.common.money import (
    CURRENCIES,
    MINOR_UNITS,
    currency_for,
    format_money,
    is_supported,
    split_evenly,
    to_major,
    to_minor,
)


class TestConversion:
    @pytest.mark.parametrize(
        ("baht", "satang"),
        [
            (0, 0),
            (1, 100),
            (1800, 180_000),
            ("1500", 150_000),
            (Decimal("2450.50"), 245_050),
            ("0.01", 1),
            # Half-up at the satang boundary, not banker's rounding.
            ("0.005", 1),
            ("0.004", 0),
            (None, 0),
            ("", 0),
        ],
    )
    def test_to_minor(self, baht: object, satang: int) -> None:
        assert to_minor(baht) == satang  # type: ignore[arg-type]

    def test_round_trip(self) -> None:
        assert to_major(to_minor("2450.50")) == Decimal("2450.50")

    def test_rejects_nonsense(self) -> None:
        with pytest.raises(ValueError):
            to_minor("not-a-number")


class TestFormatting:
    @pytest.mark.parametrize(
        ("satang", "rendered"),
        [
            (180_000, "฿1,800"),
            (245_050, "฿2,451"),  # design rounds to whole baht
            (0, "฿0"),
            (5_500_000, "฿55,000"),
        ],
    )
    def test_matches_the_design(self, satang: int, rendered: str) -> None:
        # The prototype's money() renders grouped whole baht: "฿1,800". With
        # no organisation in scope the currency is the default, which is baht.
        assert format_money(satang) == rendered

    @pytest.mark.parametrize(
        ("paise", "rendered"),
        [
            (180_000, "₹1,800"),
            (245_050, "₹2,451"),
            (0, "₹0"),
            (-2_500_000, "-₹25,000"),
        ],
    )
    def test_rupees_render_the_same_way(self, paise: int, rendered: str) -> None:
        """Only the symbol differs: the grouping and rounding are the design's."""
        assert format_money(paise, "INR") == rendered
        assert format_money(paise, CURRENCIES["INR"]) == rendered

    def test_the_sign_leads_the_symbol(self) -> None:
        assert format_money(-2_500_000) == "-฿25,000"

    def test_an_unknown_code_falls_back_rather_than_failing(self) -> None:
        # A label must never take a screen down. The strict check lives where
        # a code is chosen, in OrganisationService.set_currency.
        assert format_money(100, "XXX") == "฿1"
        assert currency_for("usd").code == "THB"
        assert currency_for("inr").code == "INR"
        assert currency_for(None).code == "THB"

    def test_every_supported_currency_shares_the_minor_unit(self) -> None:
        """MINOR_UNITS is one constant, so a currency needing another cannot slip in."""
        assert set(CURRENCIES) == {"THB", "INR"}
        assert all(is_supported(code) for code in CURRENCIES)
        assert not is_supported(None)
        assert not is_supported("USD")
        assert MINOR_UNITS == 100


class TestSplitEvenly:
    def test_exact_division(self) -> None:
        assert split_evenly(1000, 4) == [250, 250, 250, 250]

    def test_remainder_goes_to_earliest_nights(self) -> None:
        # 1002 over 4 nights: two nights carry the extra satang, none is lost.
        assert split_evenly(1002, 4) == [251, 251, 250, 250]

    def test_single_night(self) -> None:
        assert split_evenly(123_456, 1) == [123_456]

    def test_negative_amount_preserves_sign_and_total(self) -> None:
        shares = split_evenly(-1002, 4)
        assert sum(shares) == -1002
        assert all(s <= 0 for s in shares)

    def test_rejects_zero_parts(self) -> None:
        with pytest.raises(ValueError):
            split_evenly(100, 0)

    @given(
        total=st.integers(min_value=0, max_value=5_000_000_00),
        nights=st.integers(min_value=1, max_value=400),
    )
    def test_shares_always_sum_to_total(self, total: int, nights: int) -> None:
        """The property that makes accrual revenue trustworthy.

        If this ever fails, monthly revenue silently disagrees with the sum of
        its bookings — the kind of discrepancy that surfaces as unexplained
        kilobaht at year end.
        """
        shares = split_evenly(total, nights)
        assert len(shares) == nights
        assert sum(shares) == total
        # Nightly amounts never differ by more than one satang.
        assert max(shares) - min(shares) <= 1
