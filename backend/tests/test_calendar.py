"""The calendar feed's summary and per-day figures.

These back the mobile month grid: a card reading "Revenue X, N booked nights,
P% occupancy" and, per tapped day, "1 booking, X revenue, N condos available".

Three rules are easy to get subtly wrong and are pinned here: the summary
describes a *month* even when a wider window is fetched, cancelled bookings
hold no dates, and a maintenance block makes a unit unavailable without
earning anything.
"""

from __future__ import annotations

from typing import Any

from flask.testing import FlaskClient


def _condo(client: FlaskClient, code: str, name: str) -> str:
    response = client.post(
        "/api/v1/condos", json={"name": name, "code": code, "night_rate": "1000"}
    )
    assert response.status_code == 201, response.get_json()
    return str(response.get_json()["id"])


def _book(
    client: FlaskClient,
    condo_id: str,
    check_in: str,
    check_out: str,
    *,
    guest: str = "Cal Guest",
    status: str = "booked",
    total: str = "10000",
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/bookings",
        json={
            "condo_id": condo_id,
            "guest_name": guest,
            "check_in": check_in,
            "check_out": check_out,
            "mode": "total",
            "total_manual": total,
            # Explicit zero so the per-night figures below are plain division.
            # The default 7% VAT is correct behaviour but turns every expected
            # value into an arithmetic puzzle.
            "tax_pct": "0",
            "status": status,
        },
    )
    assert response.status_code == 201, response.get_json()
    body: dict[str, Any] = response.get_json()
    return body


def _calendar(client: FlaskClient, **params: str) -> dict[str, Any]:
    query = "&".join(f"{k}={v}" for k, v in params.items())
    response = client.get(f"/api/v1/bookings/calendar?{query}")
    assert response.status_code == 200, response.get_json()
    body: dict[str, Any] = response.get_json()
    return body


class TestDailyFigures:
    def test_a_night_reports_its_accrued_share_not_the_whole_total(
        self, auth_client: FlaskClient
    ) -> None:
        """A 5-night ฿10,000 stay is ฿2,000 a night, not ฿10,000 on day one."""
        condo_id = _condo(auth_client, "CAL-1", "Calendar Unit")
        _book(auth_client, condo_id, "2026-03-10", "2026-03-15", total="10000")

        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")
        by_date = {d["date"]: d for d in body["days"]}

        assert by_date["2026-03-10"]["revenue_label"] == "฿2,000"
        assert by_date["2026-03-14"]["revenue_label"] == "฿2,000"
        # Checkout day: the guest has gone, the night is not theirs.
        assert by_date["2026-03-15"]["revenue_label"] == "฿0"

    def test_every_day_of_the_window_is_present(self, auth_client: FlaskClient) -> None:
        """Zero-filled, so the grid never has to guess at a missing key."""
        _condo(auth_client, "CAL-2", "Quiet Unit")
        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")

        assert len(body["days"]) == 31
        assert body["days"][0]["date"] == "2026-03-01"
        assert body["days"][-1]["date"] == "2026-03-31"
        assert all(d["revenue_label"] == "฿0" for d in body["days"])

    def test_available_counts_down_as_units_are_taken(
        self, auth_client: FlaskClient
    ) -> None:
        first = _condo(auth_client, "CAL-3", "Unit One")
        _condo(auth_client, "CAL-4", "Unit Two")
        _book(auth_client, first, "2026-03-10", "2026-03-12")

        by_date = {d["date"]: d for d in _calendar(
            auth_client, start="2026-03-01", end="2026-04-01"
        )["days"]}

        assert by_date["2026-03-10"]["occupied"] == 1
        assert by_date["2026-03-10"]["available"] == 1
        assert by_date["2026-03-09"]["available"] == 2

    def test_maintenance_is_unavailable_but_not_occupancy(
        self, auth_client: FlaskClient
    ) -> None:
        """A blocked night cannot be sold, and is not a sold night either.

        Counting it toward occupancy makes a building under repair read as
        fully booked — the same distinction CondoFinance.occupancy_pct draws.
        """
        condo_id = _condo(auth_client, "CAL-14", "Repair Unit")
        _book(
            auth_client, condo_id, "2026-03-01", "2026-03-31",
            guest="Repairs", status="maintenance", total="0",
        )

        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")
        by_date = {d["date"]: d for d in body["days"]}

        assert by_date["2026-03-10"]["available"] == 0
        assert body["summary"]["occupancy_pct"] == 0
        assert body["summary"]["booked_nights"] == 0

    def test_a_unit_flagged_out_of_service_is_not_offered(
        self, auth_client: FlaskClient
    ) -> None:
        """is_maintenance is a deliberate takedown; it has no bookings to
        derive from, so availability has to read the flag itself."""
        auth_client.post(
            "/api/v1/condos",
            json={"name": "Down", "code": "CAL-15", "is_maintenance": True},
        )
        _condo(auth_client, "CAL-16", "Working Unit")

        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")
        assert body["days"][0]["available"] == 1

    def test_a_flagged_unit_holding_a_booking_is_only_removed_once(
        self, auth_client: FlaskClient
    ) -> None:
        """Flagged *and* booked is one unit gone, not two.

        Availability subtracts occupied units from a count that already
        excludes flagged ones, so counting a flagged unit's nights as occupied
        removes it twice and under-reports how many are free.
        """
        _condo(auth_client, "CAL-18", "Free One")
        _condo(auth_client, "CAL-19", "Free Two")
        taken = _condo(auth_client, "CAL-20", "Taken And Flagged")
        _book(auth_client, taken, "2026-03-10", "2026-03-12")
        auth_client.patch(f"/api/v1/condos/{taken}", json={"is_maintenance": True})

        by_date = {d["date"]: d for d in _calendar(
            auth_client, start="2026-03-01", end="2026-04-01"
        )["days"]}

        # The other two are free on both nights, flagged unit or not.
        assert by_date["2026-03-10"]["available"] == 2
        assert by_date["2026-03-09"]["available"] == 2

    def test_occupancy_never_exceeds_one_hundred(self, auth_client: FlaskClient) -> None:
        condo_id = _condo(auth_client, "CAL-17", "Full Unit")
        _book(auth_client, condo_id, "2026-03-01", "2026-04-01")

        summary = _calendar(auth_client, start="2026-03-01", end="2026-04-01")["summary"]
        assert summary["occupancy_pct"] == 100

    def test_maintenance_takes_a_unit_without_earning(
        self, auth_client: FlaskClient
    ) -> None:
        """Unavailable and unpaid are different things, and both are true here.

        Counting maintenance as revenue would inflate income; ignoring it for
        availability would offer a night that cannot be sold.
        """
        condo_id = _condo(auth_client, "CAL-5", "Blocked Unit")
        _book(
            auth_client, condo_id, "2026-03-10", "2026-03-12",
            guest="Repairs", status="maintenance", total="5000",
        )

        by_date = {d["date"]: d for d in _calendar(
            auth_client, start="2026-03-01", end="2026-04-01"
        )["days"]}

        assert by_date["2026-03-10"]["available"] == 0
        assert by_date["2026-03-10"]["occupied"] == 1
        assert by_date["2026-03-10"]["revenue_label"] == "฿0"

    def test_a_cancelled_stay_releases_its_dates(self, auth_client: FlaskClient) -> None:
        condo_id = _condo(auth_client, "CAL-6", "Freed Unit")
        booking = _book(auth_client, condo_id, "2026-03-10", "2026-03-12")
        auth_client.patch(f"/api/v1/bookings/{booking['id']}", json={"status": "cancelled"})

        by_date = {d["date"]: d for d in _calendar(
            auth_client, start="2026-03-01", end="2026-04-01"
        )["days"]}

        assert by_date["2026-03-10"]["available"] == 1
        assert by_date["2026-03-10"]["occupied"] == 0
        assert by_date["2026-03-10"]["revenue_label"] == "฿0"


class TestMonthSummary:
    def test_occupancy_is_nights_over_sellable_nights(
        self, auth_client: FlaskClient
    ) -> None:
        condo_id = _condo(auth_client, "CAL-7", "Busy Unit")
        _book(auth_client, condo_id, "2026-03-01", "2026-03-11")  # 10 of 31

        summary = _calendar(auth_client, start="2026-03-01", end="2026-04-01")["summary"]

        assert summary["booked_nights"] == 10
        assert summary["condos"] == 1
        assert summary["occupancy_pct"] == round(10 / 31 * 100)

    def test_cancelled_bookings_are_not_counted(self, auth_client: FlaskClient) -> None:
        """The feed returns them so a released date can be drawn; the count
        must not, or the header reports stays that are not happening."""
        condo_id = _condo(auth_client, "CAL-8", "Mixed Unit")
        _book(auth_client, condo_id, "2026-03-02", "2026-03-04", guest="Real")
        cancelled = _book(auth_client, condo_id, "2026-03-20", "2026-03-22", guest="Gone")
        auth_client.patch(f"/api/v1/bookings/{cancelled['id']}", json={"status": "cancelled"})

        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")

        assert body["summary"]["bookings"] == 1
        # Still delivered, so the calendar can show the date as free again.
        assert len(body["events"]) == 2

    def test_the_summary_describes_the_month_not_the_fetched_window(
        self, auth_client: FlaskClient
    ) -> None:
        """The mobile grid fetches six whole weeks so its leading and trailing
        cells hold real data. Summarising the fetch window would fold slices of
        two neighbouring months into March and divide occupancy by 42."""
        condo_id = _condo(auth_client, "CAL-9", "Edge Unit")
        _book(auth_client, condo_id, "2026-02-24", "2026-02-27", guest="February")
        _book(auth_client, condo_id, "2026-03-10", "2026-03-13", guest="March")

        body = _calendar(
            auth_client, start="2026-02-22", end="2026-04-05", month="2026-03-01"
        )

        assert body["summary"]["bookings"] == 1
        assert body["summary"]["booked_nights"] == 3
        assert body["summary"]["occupancy_pct"] == round(3 / 31 * 100)
        # The February stay is still delivered, so its cells can be drawn.
        assert {e["guest_name"] for e in body["events"]} == {"February", "March"}

    def test_the_window_defines_the_summary_when_no_month_is_given(
        self, auth_client: FlaskClient
    ) -> None:
        """Desktop sends no month, and its window already is the month."""
        condo_id = _condo(auth_client, "CAL-10", "Plain Unit")
        _book(auth_client, condo_id, "2026-03-05", "2026-03-08")

        summary = _calendar(auth_client, start="2026-03-01", end="2026-04-01")["summary"]
        assert summary["booked_nights"] == 3


class TestPayload:
    def test_resources_carry_a_cover_for_the_mobile_booking_card(
        self, auth_client: FlaskClient
    ) -> None:
        _condo(auth_client, "CAL-11", "Photo Unit")
        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")

        assert body["resources"][0]["cover_url"] is None
        assert set(body["resources"][0]) == {"id", "code", "name", "cover_url"}

    def test_events_carry_a_formatted_total(self, auth_client: FlaskClient) -> None:
        condo_id = _condo(auth_client, "CAL-12", "Priced Unit")
        _book(auth_client, condo_id, "2026-03-10", "2026-03-12", total="7500")

        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")
        assert body["events"][0]["total_label"] == "฿7,500"

    def test_the_feed_stays_a_single_round_trip(self, auth_client: FlaskClient) -> None:
        """Everything the grid draws arrives together, or the phone pays for
        a waterfall on the screen most likely to be on a slow connection."""
        _condo(auth_client, "CAL-13", "Any Unit")
        body = _calendar(auth_client, start="2026-03-01", end="2026-04-01")

        assert set(body) == {"range", "summary", "days", "resources", "events"}
