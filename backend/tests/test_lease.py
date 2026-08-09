"""Lease costs, deposit accounting, and the rules that must not drift.

The central claim under test is an accounting one::

    net = revenue - lease cost - operating expenses

with the refundable deposit appearing in **none** of those terms. Getting that
wrong is not a display bug: it reports a ฿50,000 loss the month a unit is taken
on and a ฿50,000 windfall the month it is handed back, and every profit figure
in the product inherits it.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from flask.testing import FlaskClient

from app.common.money import to_minor
from app.models.condo import Condo, DepositTransaction
from app.services.analytics import CondoFinance
from app.services.lease import (
    EXPIRING_SOON_DAYS,
    DepositState,
    days_remaining,
    deposit_state,
    lease_cost_between,
    lease_status,
)

TODAY = date(2026, 8, 15)


def _condo(**kwargs: object) -> Condo:
    """A detached condo — these helpers are pure and need no database."""
    defaults = {
        "id": uuid.uuid4(),
        "code": "L-1",
        "name": "Leased Unit",
        "security_deposit": 0,
        "monthly_lease_amount": 0,
        "lease_start_date": None,
        "lease_end_date": None,
    }
    condo = Condo(**{**defaults, **kwargs})  # type: ignore[arg-type]
    return condo


class TestLeaseCost:
    def test_a_full_month_costs_the_full_monthly_amount(self) -> None:
        condo = _condo(
            monthly_lease_amount=to_minor(25000),
            lease_start_date=date(2026, 1, 1),
            lease_end_date=date(2026, 12, 31),
        )
        assert lease_cost_between(condo, date(2026, 8, 1), date(2026, 9, 1)) == to_minor(25000)

    def test_a_month_with_no_lease_recorded_costs_nothing(self) -> None:
        assert lease_cost_between(_condo(), date(2026, 8, 1), date(2026, 9, 1)) == 0

    def test_a_month_before_the_lease_starts_costs_nothing(self) -> None:
        condo = _condo(
            monthly_lease_amount=to_minor(25000),
            lease_start_date=date(2026, 9, 1),
        )
        assert lease_cost_between(condo, date(2026, 8, 1), date(2026, 9, 1)) == 0

    def test_a_month_after_the_lease_ends_costs_nothing(self) -> None:
        condo = _condo(
            monthly_lease_amount=to_minor(25000),
            lease_start_date=date(2026, 1, 1),
            lease_end_date=date(2026, 7, 31),
        )
        assert lease_cost_between(condo, date(2026, 8, 1), date(2026, 9, 1)) == 0

    def test_a_lease_starting_mid_month_is_prorated(self) -> None:
        """Starts on the 17th of a 31-day month: 15 days held, not 31."""
        condo = _condo(
            monthly_lease_amount=to_minor(31000),
            lease_start_date=date(2026, 8, 17),
        )
        cost = lease_cost_between(condo, date(2026, 8, 1), date(2026, 9, 1))
        assert cost == to_minor(31000) * 15 // 31

    def test_the_final_day_of_the_lease_is_still_charged(self) -> None:
        """A lease ending on the 31st is held *through* the 31st.

        Off-by-one here silently drops a day of cost from every unit's last
        month, which is exactly the month somebody scrutinises.
        """
        whole = _condo(
            monthly_lease_amount=to_minor(31000),
            lease_start_date=date(2026, 8, 1),
            lease_end_date=date(2026, 8, 31),
        )
        assert lease_cost_between(whole, date(2026, 8, 1), date(2026, 9, 1)) == to_minor(31000)


class TestLeaseStatus:
    def test_no_lease_on_file_is_not_expired(self) -> None:
        """Distinct states. Every condo predating this feature has no lease."""
        assert lease_status(_condo(), today=TODAY) == "none"
        assert days_remaining(_condo(), today=TODAY) is None

    def test_a_distant_end_is_active(self) -> None:
        condo = _condo(lease_end_date=TODAY + timedelta(days=EXPIRING_SOON_DAYS + 1))
        assert lease_status(condo, today=TODAY) == "active"

    def test_the_window_edge_counts_as_expiring_soon(self) -> None:
        condo = _condo(lease_end_date=TODAY + timedelta(days=EXPIRING_SOON_DAYS))
        assert lease_status(condo, today=TODAY) == "expiring_soon"

    def test_the_last_day_is_not_yet_expired(self) -> None:
        condo = _condo(lease_end_date=TODAY)
        assert lease_status(condo, today=TODAY) == "expiring_soon"
        assert days_remaining(condo, today=TODAY) == 0

    def test_yesterday_is_expired(self) -> None:
        condo = _condo(lease_end_date=TODAY - timedelta(days=1))
        assert lease_status(condo, today=TODAY) == "expired"
        assert days_remaining(condo, today=TODAY) == -1


class TestDepositState:
    def test_no_deposit_is_its_own_status(self) -> None:
        assert DepositState(original=0, refunded=0, deducted=0).status == "none"

    def test_an_untouched_deposit_is_held_in_full(self) -> None:
        state = DepositState(original=to_minor(50000), refunded=0, deducted=0)
        assert state.status == "held"
        assert state.outstanding == to_minor(50000)

    def test_a_deduction_counts_as_recovered_capital(self) -> None:
        """฿45,000 back plus ฿5,000 withheld closes out a ฿50,000 deposit.

        The withheld part is gone, not outstanding — we are never getting it.
        """
        state = DepositState(
            original=to_minor(50000), refunded=to_minor(45000), deducted=to_minor(5000)
        )
        assert state.status == "refunded"
        assert state.outstanding == 0

    def test_a_partial_recovery_leaves_the_rest_outstanding(self) -> None:
        state = DepositState(original=to_minor(50000), refunded=to_minor(20000), deducted=0)
        assert state.status == "partially_refunded"
        assert state.outstanding == to_minor(30000)

    def test_state_reads_the_ledger_not_a_stored_flag(self) -> None:
        condo = _condo(security_deposit=to_minor(50000))
        condo.deposit_movements = [
            DepositTransaction(
                condo_id=condo.id,
                original_amount=to_minor(50000),
                refunded_amount=to_minor(50000),
                deducted_amount=0,
                refund_date=TODAY,
            )
        ]
        assert deposit_state(condo).status == "refunded"


class TestProfitArithmetic:
    """The rule the whole feature exists to protect."""

    def _fin(self, **kwargs: int) -> CondoFinance:
        base = {"revenue": 0, "expenses": 0, "lease_cost": 0}
        return CondoFinance(
            condo_id=uuid.uuid4(),
            bookings=1,
            nights=10,
            available_nights=21,
            **{**base, **kwargs},  # type: ignore[arg-type]
        )

    def test_the_worked_example_from_the_brief(self) -> None:
        fin = self._fin(
            revenue=to_minor(60000), lease_cost=to_minor(25000), expenses=to_minor(8000)
        )
        assert fin.net == to_minor(27000)

    def test_lease_cost_reduces_profit(self) -> None:
        without = self._fin(revenue=to_minor(60000), expenses=to_minor(8000))
        with_lease = self._fin(
            revenue=to_minor(60000), expenses=to_minor(8000), lease_cost=to_minor(25000)
        )
        assert with_lease.net == without.net - to_minor(25000)

    def test_the_deposit_is_absent_from_the_finance_record_entirely(self) -> None:
        """There is nowhere for a deposit to leak into profit.

        CondoFinance carries no deposit field at all, which is the structural
        version of this guarantee: it cannot be added to `net` by accident
        because it is not in the object.
        """
        assert not hasattr(self._fin(), "deposit")
        assert "deposit" not in CondoFinance.__slots__


class TestDepositEndpoints:
    def _leased(self, client: FlaskClient) -> dict[str, object]:
        response = client.post(
            "/api/v1/condos",
            json={
                "name": "Leased Tower",
                "code": "LEASE-1",
                "night_rate": "2000",
                "security_deposit": "50000",
                "monthly_lease_amount": "25000",
                "lease_start_date": "2026-01-01",
                "lease_end_date": "2026-12-31",
            },
        )
        assert response.status_code == 201, response.get_json()
        body: dict[str, object] = response.get_json()
        return body

    def test_a_new_lease_round_trips_with_its_derived_state(
        self, auth_client: FlaskClient
    ) -> None:
        condo = self._leased(auth_client)
        assert condo["monthly_lease_amount"] == "25000.00"
        assert condo["deposit_status"] == "held"
        assert condo["deposit_outstanding_label"] == "฿50,000"
        assert condo["lease_status"] in ("active", "expiring_soon", "expired")

    def test_recording_a_refund_with_a_deduction(self, auth_client: FlaskClient) -> None:
        condo = self._leased(auth_client)
        response = auth_client.post(
            f"/api/v1/condos/{condo['id']}/deposit/refunds",
            json={
                "refund_date": "2026-12-31",
                "refunded_amount": "45000",
                "deducted_amount": "5000",
                "deduction_reason": "Wall repair",
            },
        )
        assert response.status_code == 201, response.get_json()
        body = response.get_json()
        assert body["status"] == "refunded"
        assert body["outstanding_label"] == "฿0"

    def test_a_partial_refund_leaves_the_balance_outstanding(
        self, auth_client: FlaskClient
    ) -> None:
        condo = self._leased(auth_client)
        auth_client.post(
            f"/api/v1/condos/{condo['id']}/deposit/refunds",
            json={"refund_date": "2026-12-31", "refunded_amount": "20000"},
        )
        ledger = auth_client.get(f"/api/v1/condos/{condo['id']}/deposit").get_json()
        assert ledger["status"] == "partially_refunded"
        assert ledger["outstanding_label"] == "฿30,000"
        assert len(ledger["movements"]) == 1

    def test_recovering_more_than_is_held_is_refused(self, auth_client: FlaskClient) -> None:
        """Over-recovery means either the deposit or the refund is wrong."""
        condo = self._leased(auth_client)
        response = auth_client.post(
            f"/api/v1/condos/{condo['id']}/deposit/refunds",
            json={"refund_date": "2026-12-31", "refunded_amount": "60000"},
        )
        assert response.status_code == 422
        assert "still held" in response.get_json()["error"]["message"]

    def test_a_deduction_needs_a_reason(self, auth_client: FlaskClient) -> None:
        condo = self._leased(auth_client)
        response = auth_client.post(
            f"/api/v1/condos/{condo['id']}/deposit/refunds",
            json={"refund_date": "2026-12-31", "deducted_amount": "5000"},
        )
        assert response.status_code == 422

    def test_a_lease_cannot_end_before_it_starts(self, auth_client: FlaskClient) -> None:
        response = auth_client.post(
            "/api/v1/condos",
            json={
                "name": "Backwards",
                "code": "BACK-1",
                "lease_start_date": "2026-12-01",
                "lease_end_date": "2026-01-01",
            },
        )
        assert response.status_code == 422

    def test_moving_one_lease_date_is_validated_against_the_stored_other(
        self, auth_client: FlaskClient
    ) -> None:
        """A PATCH sends one date; the schema alone cannot catch this."""
        condo = self._leased(auth_client)
        response = auth_client.patch(
            f"/api/v1/condos/{condo['id']}", json={"lease_end_date": "2025-01-01"}
        )
        assert response.status_code == 422


class TestBookingsRespectTheLease:
    def _leased(self, client: FlaskClient, end: str) -> str:
        response = client.post(
            "/api/v1/condos",
            json={
                "name": "Lease Bound",
                "code": "LB-1",
                "night_rate": "2000",
                "lease_start_date": "2026-01-01",
                "lease_end_date": end,
            },
        )
        assert response.status_code == 201, response.get_json()
        return str(response.get_json()["id"])

    def _book(self, client: FlaskClient, condo_id: str, check_in: str, check_out: str):
        return client.post(
            "/api/v1/bookings",
            json={
                "condo_id": condo_id,
                "guest_name": "Lease Guest",
                "check_in": check_in,
                "check_out": check_out,
                "mode": "nightly",
                "night_rate": "2000",
            },
        )

    def test_a_stay_running_past_the_lease_is_refused(self, auth_client: FlaskClient) -> None:
        condo_id = self._leased(auth_client, "2026-12-31")
        response = self._book(auth_client, condo_id, "2026-12-28", "2027-01-04")

        assert response.status_code == 422
        error = response.get_json()["error"]
        assert error["message"] == "Booking exceeds lease period"
        assert "31 Dec 2026" in error["details"]["fields"]["check_out"][0]

    def test_checking_out_on_the_lease_end_date_is_allowed(
        self, auth_client: FlaskClient
    ) -> None:
        """The lease covers the handover day, so leaving on it is fine."""
        condo_id = self._leased(auth_client, "2026-12-31")
        assert self._book(auth_client, condo_id, "2026-12-28", "2026-12-31").status_code == 201

    def test_a_condo_with_no_lease_recorded_books_exactly_as_before(
        self, auth_client: FlaskClient
    ) -> None:
        """The guard must not change behaviour for units predating leases."""
        condo = auth_client.post(
            "/api/v1/condos", json={"name": "No Lease", "code": "NL-1", "night_rate": "1000"}
        ).get_json()
        response = self._book(auth_client, str(condo["id"]), "2030-01-01", "2030-01-05")
        assert response.status_code == 201

    def test_moving_a_booking_past_the_lease_end_is_refused(
        self, auth_client: FlaskClient
    ) -> None:
        condo_id = self._leased(auth_client, "2026-12-31")
        booking = self._book(auth_client, condo_id, "2026-12-01", "2026-12-05").get_json()

        response = auth_client.patch(
            f"/api/v1/bookings/{booking['id']}",
            json={"check_in": "2026-12-29", "check_out": "2027-01-05"},
        )
        assert response.status_code == 422
        assert response.get_json()["error"]["message"] == "Booking exceeds lease period"


class TestReportedTotals:
    def test_the_dashboard_reports_deposits_beside_profit_not_inside_it(
        self, auth_client: FlaskClient
    ) -> None:
        auth_client.post(
            "/api/v1/condos",
            json={
                "name": "Capital Unit",
                "code": "CAP-1",
                "security_deposit": "50000",
                "monthly_lease_amount": "25000",
                "lease_start_date": "2020-01-01",
            },
        )
        body = auth_client.get("/api/v1/dashboard").get_json()

        assert body["kpis"]["deposits_held"] == "฿50,000"
        assert body["kpis"]["deposits_count"] == 1
        assert body["deposits"]["total_label"] == "฿50,000"
        # No revenue and no expenses, so profit is exactly the lease cost —
        # the deposit has not been subtracted anywhere.
        assert body["kpis"]["net_month"] == "-฿25,000"

    def test_the_income_screen_separates_money_held_from_earnings(
        self, auth_client: FlaskClient
    ) -> None:
        auth_client.post(
            "/api/v1/condos",
            json={"name": "Held", "code": "HELD-1", "security_deposit": "150000"},
        )
        body = auth_client.get("/api/v1/income/summary").get_json()

        assert body["money_held"]["deposits"] == "฿150,000"
        assert body["money_held"]["deposits_count"] == 1
        assert "deposit" not in body["kpis"]
