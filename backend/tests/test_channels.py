"""Channel sync: the codec, the reconciliation, and the tenant boundary.

The tests that matter most here are the ones about *not* doing something:

* an inbound reservation must never overwrite a booking we sold ourselves;
* the same feed twice must produce one booking, not two;
* the unauthenticated feed must never serve another organisation's nights.

Network is stubbed at ``app.channels.airbnb._fetch``, one layer below the
adapter, so every test still runs the real URL validation, the real iCal
parser and the real reconciliation — only the socket is replaced.
"""

from __future__ import annotations

import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.channels.airbnb import AirbnbICalAdapter
from app.channels.base import (
    ChannelCapability,
    PermanentChannelError,
    TransientChannelError,
)
from app.channels.ical import build_calendar, parse_events
from app.common.current_org import scoped_to
from app.extensions import db, password_hasher
from app.models.booking import Booking, BookingNight, BookingStatus
from app.models.channel import (
    Channel,
    ChannelListing,
    ChannelReservation,
    ChannelReservationStatus,
    ChannelSyncLog,
    ConnectionStatus,
    ListingStatus,
    SyncStatus,
)
from app.models.condo import Condo
from app.models.organisation import Organisation, OrganisationMember
from app.models.user import Role, User
from app.services.booking_service import BookingService
from app.services.channel_service import (
    BACKOFF_CAP_MINUTES,
    ChannelService,
    next_attempt_after,
)
from app.services.pricing import PricingMode
from tests.conftest import ADMIN_PASSWORD

GOOD_URL = "https://www.airbnb.com/calendar/ical/12345678.ics?s=secrettoken"


def ics(*events: tuple[str, str, str, str]) -> str:
    """A calendar shaped like Airbnb's, from ``(uid, start, end, summary)``."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
        "CALSCALE:GREGORIAN",
    ]
    for uid, start, end, summary in events:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTART;VALUE=DATE:{start}",
            f"DTEND;VALUE=DATE:{end}",
            f"SUMMARY:{summary}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


@pytest.fixture()
def feed(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Control what Airbnb "returns", without a socket."""

    class Feed:
        body = ics()

        def set(self, *events: tuple[str, str, str, str]) -> None:
            self.body = ics(*events)

        def raises(self, exc: Exception) -> None:
            self.body = exc  # type: ignore[assignment]

    holder = Feed()

    def fake_fetch(url: str, *, timeout: int) -> str:
        if isinstance(holder.body, Exception):
            raise holder.body
        return holder.body

    monkeypatch.setattr("app.channels.airbnb._fetch", fake_fetch)
    return holder


@pytest.fixture()
def condo(session: Any, scoped: Organisation) -> Condo:
    unit = Condo(code="A-1204", name="Ashton Asoke 1204", night_rate=180_000)
    session.add(unit)
    session.commit()
    return unit


@pytest.fixture()
def service(session: Any) -> ChannelService:
    return ChannelService(session)


@pytest.fixture()
def listing(session: Any, service: ChannelService, condo: Condo) -> ChannelListing:
    row = service.map_listing(
        channel=Channel.AIRBNB, condo_id=condo.id, import_url=GOOD_URL
    )
    session.commit()
    return row


def bookings_for(session: Any, condo: Condo) -> list[Booking]:
    return list(
        session.scalars(
            db.select(Booking)
            .where(Booking.condo_id == condo.id, Booking.deleted_at.is_(None))
            .order_by(Booking.check_in)
        )
    )


def nights_for(session: Any, condo: Condo) -> int:
    return len(
        list(session.scalars(db.select(BookingNight).where(BookingNight.condo_id == condo.id)))
    )


# ---------------------------------------------------------------------------
class TestCodec:
    """The iCal reader and writer, with no database in sight."""

    def test_dtend_is_exclusive_and_matches_check_out(self) -> None:
        # 10th to 13th is three nights: 10, 11, 12. The guest is not there on
        # the 13th, which is exactly what Booking.check_out means.
        event = parse_events(ics(("u", "20260910", "20260913", "Reserved")))[0]
        assert event.start == date(2026, 9, 10)
        assert event.end == date(2026, 9, 13)
        assert (event.end - event.start).days == 3

    def test_folded_lines_are_rejoined(self) -> None:
        raw = (
            "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:u\r\n"
            "DTSTART;VALUE=DATE:20260910\r\nDTEND;VALUE=DATE:20260911\r\n"
            "SUMMARY:A very long summary that the exporter chose to wrap acr\r\n"
            " oss two physical lines\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        assert "across two physical lines" in (parse_events(raw)[0].summary or "")

    def test_escaped_text_round_trips(self) -> None:
        # A comma is escaped in iCal; unescaping it wrongly corrupts the name.
        written = build_calendar(
            parse_events(ics(("u", "20260910", "20260911", "Smith\\, Jane"))),
            name="Test",
        )
        assert parse_events(written)[0].summary == "Smith, Jane"

    def test_output_is_crlf_and_folded_to_75_octets(self) -> None:
        # Thai names make multi-byte folding reachable rather than theoretical.
        out = build_calendar(
            parse_events(ics(("u", "20260910", "20260911", "Reserved"))),
            name="เดอะ เบส สุขุมวิท ทาวเวอร์ เอ, a name long enough to need folding",
        )
        assert "\n" not in out.replace("\r\n", "")
        assert max(len(line.encode()) for line in out.split("\r\n")) <= 75
        # Folding must not corrupt the characters it wraps: unfolding the
        # calendar name has to give back exactly what went in.
        assert "เดอะ เบส สุขุมวิท ทาวเวอร์ เอ" in out.replace("\r\n ", "")
        assert parse_events(out)[0].summary == "Reserved"

    def test_missing_dtend_defaults_to_one_night(self) -> None:
        raw = (
            "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:u\r\n"
            "DTSTART;VALUE=DATE:20260910\r\nSUMMARY:Blocked\r\n"
            "END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
        assert parse_events(raw)[0].end == date(2026, 9, 11)

    def test_a_non_calendar_body_is_not_silently_empty(self) -> None:
        # A login page returning 200 must not read as "no reservations", which
        # would cancel every booking on the listing.
        with pytest.raises(Exception, match="not an iCalendar"):
            parse_events("<html><body>Sign in</body></html>")


# ---------------------------------------------------------------------------
class TestUrlSafety:
    @pytest.mark.parametrize(
        "url",
        [
            "http://www.airbnb.com/calendar/ical/1.ics",  # not https
            "https://evil.example.com/calendar/ical/1.ics",  # not airbnb
            "https://169.254.169.254/latest/meta-data.ics",  # cloud metadata
            "https://airbnb.com.evil.example/x.ics",  # suffix trick
            "https://www.airbnb.com/rooms/12345",  # not a calendar
        ],
    )
    def test_hostile_or_wrong_urls_are_refused(self, url: str) -> None:
        # This is an SSRF control: the URL is typed in by a user and the server
        # is the one that fetches it.
        with pytest.raises(PermanentChannelError):
            AirbnbICalAdapter().fetch_reservations(url)

    def test_http_status_decides_permanent_versus_transient(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def raising(code: int) -> Any:
            def _open(self: Any, *args: Any, **kwargs: Any) -> Any:
                raise urllib.error.HTTPError(GOOD_URL, code, "no", {}, None)  # type: ignore[arg-type]

            return _open

        for code, expected in (
            (401, PermanentChannelError),
            (403, PermanentChannelError),
            (404, PermanentChannelError),
            (410, PermanentChannelError),
            (429, TransientChannelError),
            (500, TransientChannelError),
            (503, TransientChannelError),
        ):
            monkeypatch.setattr(urllib.request.OpenerDirector, "open", raising(code))
            with pytest.raises(expected):
                AirbnbICalAdapter().fetch_reservations(GOOD_URL)


# ---------------------------------------------------------------------------
class TestCapabilitiesAreHonest:
    def test_ical_declares_only_what_it_can_do(self) -> None:
        adapter = AirbnbICalAdapter()
        assert adapter.supports(ChannelCapability.RESERVATION_PULL)
        assert adapter.supports(ChannelCapability.AVAILABILITY_PUSH)
        # The whole point of the capability model: these are absent, and the UI
        # reads that rather than showing a tick it has not earned.
        assert not adapter.supports(ChannelCapability.PRICING_PUSH)
        assert not adapter.supports(ChannelCapability.WEBHOOKS)
        assert not adapter.supports(ChannelCapability.GUEST_DETAILS)
        assert not adapter.supports(ChannelCapability.LISTING_DISCOVERY)

    def test_the_api_reports_those_capabilities(self, auth_client: FlaskClient) -> None:
        body = auth_client.get("/api/v1/channels").get_json()
        caps = body["available_channels"][0]["capabilities"]
        assert caps["reservation_pull"] is True
        assert caps["pricing_push"] is False
        assert caps["webhooks"] is False


# ---------------------------------------------------------------------------
class TestMapping:
    def test_listing_id_is_read_out_of_the_url(self, listing: ChannelListing) -> None:
        assert listing.external_listing_id == "12345678"

    def test_a_condo_cannot_be_mapped_twice_on_one_channel(
        self, session: Any, service: ChannelService, condo: Condo, listing: ChannelListing
    ) -> None:
        with pytest.raises(Exception, match="already mapped"):
            service.map_listing(
                channel=Channel.AIRBNB,
                condo_id=condo.id,
                import_url="https://www.airbnb.com/calendar/ical/99.ics?s=t",
            )

    def test_a_listing_cannot_be_mapped_to_two_condos(
        self, session: Any, service: ChannelService, scoped: Organisation, listing: ChannelListing
    ) -> None:
        other = Condo(code="B-0101", name="Second unit")
        session.add(other)
        session.commit()
        # Brief §2: the same Airbnb listing pointing at two units would blank
        # one unit's calendar with the other's occupancy.
        with pytest.raises(Exception, match="already mapped"):
            service.map_listing(channel=Channel.AIRBNB, condo_id=other.id, import_url=GOOD_URL)

    def test_unmapping_frees_the_condo_and_keeps_the_bookings(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()
        assert len(bookings_for(session, condo)) == 1

        service.unmap_listing(listing.id)
        session.commit()

        # The nights are still held — a guest is still arriving.
        assert len(bookings_for(session, condo)) == 1
        # And the condo can be mapped again.
        again = service.map_listing(
            channel=Channel.AIRBNB, condo_id=condo.id, import_url=GOOD_URL
        )
        session.commit()
        assert again.id != listing.id


# ---------------------------------------------------------------------------
class TestInboundReconciliation:
    def test_a_reservation_becomes_a_block_not_revenue(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.created == 1
        booking = bookings_for(session, condo)[0]
        assert booking.check_in == date(2026, 9, 10)
        # Exclusive DTEND lines up with check_out, so this is three nights.
        assert booking.check_out == date(2026, 9, 13)
        assert nights_for(session, condo) == 3
        # Held, not sold: it occupies the dates and contributes nothing to
        # revenue, because the feed carried no money to attribute.
        assert booking.status is BookingStatus.MAINTENANCE
        assert booking.total == 0
        assert "Airbnb" in booking.guest_name

    def test_the_same_feed_twice_produces_one_booking(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        second = service.sync_listing(listing)
        session.commit()

        # The idempotency guarantee. A channel resends everything every poll.
        assert second.created == 0
        assert second.skipped == 1
        assert second.status is SyncStatus.SKIPPED
        assert len(bookings_for(session, condo)) == 1

    def test_moved_dates_move_the_booking(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        feed.set(("stay-1", "20260912", "20260916", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.updated == 1
        booking = bookings_for(session, condo)[0]
        assert (booking.check_in, booking.check_out) == (date(2026, 9, 12), date(2026, 9, 16))
        # The old nights must be released, or the unit stays falsely occupied.
        assert nights_for(session, condo) == 4

    def test_a_vanished_uid_is_a_cancellation(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        feed.set()  # Airbnb no longer lists it
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.cancelled == 1
        assert bookings_for(session, condo) == []
        assert nights_for(session, condo) == 0
        row = session.scalars(db.select(ChannelReservation)).one()
        assert row.status is ChannelReservationStatus.CANCELLED

    def test_a_same_day_turnover_is_not_a_conflict(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
        scoped: Organisation,
    ) -> None:
        BookingService(session).create(
            condo_id=condo.id,
            guest_name="Local guest",
            check_in=date(2026, 9, 7),
            check_out=date(2026, 9, 10),
            mode=PricingMode.NIGHTLY,
            night_rate=180_000,
        )
        session.commit()

        # Arrives the day the other leaves. Half-open intervals make this legal.
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.conflicts == 0
        assert outcome.created == 1
        assert len(bookings_for(session, condo)) == 2


# ---------------------------------------------------------------------------
class TestLocalBookingsAreNeverOverwritten:
    """The rule that protects money.

    A feed disagreeing with a booking someone was paid for is a fact for a
    human to settle, never grounds for the sync to delete it.
    """

    def test_a_collision_is_reported_not_applied(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
        scoped: Organisation,
    ) -> None:
        local = BookingService(session).create(
            condo_id=condo.id,
            guest_name="Paying guest",
            check_in=date(2026, 9, 10),
            check_out=date(2026, 9, 15),
            mode=PricingMode.NIGHTLY,
            night_rate=200_000,
            received=1_000_000,
        )
        session.commit()
        local_id, local_total = local.id, local.total

        feed.set(("stay-1", "20260912", "20260914", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.conflicts == 1
        assert outcome.created == 0

        survivor = session.get(Booking, local_id)
        assert survivor is not None
        assert survivor.deleted_at is None
        assert survivor.status is BookingStatus.BOOKED
        assert survivor.total == local_total
        assert len(bookings_for(session, condo)) == 1

        # The reservation is remembered without a booking, so the conflict is
        # visible rather than silently forgotten on the next poll.
        row = session.scalars(db.select(ChannelReservation)).one()
        assert row.booking_id is None

    def test_a_conflict_resolves_itself_once_the_dates_move(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
        scoped: Organisation,
    ) -> None:
        BookingService(session).create(
            condo_id=condo.id,
            guest_name="Paying guest",
            check_in=date(2026, 9, 10),
            check_out=date(2026, 9, 15),
            mode=PricingMode.NIGHTLY,
            night_rate=200_000,
        )
        session.commit()

        feed.set(("stay-1", "20260912", "20260914", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        # The guest rebooked elsewhere in the month; no longer a clash.
        feed.set(("stay-1", "20260920", "20260922", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.conflicts == 0
        assert len(bookings_for(session, condo)) == 2


# ---------------------------------------------------------------------------
class TestRetryAndBackoff:
    def test_backoff_doubles_then_holds_at_the_cap(self) -> None:
        anchor = datetime(2026, 1, 1, 12, 0, 0)

        def minutes(failures: int) -> int:
            return int((next_attempt_after(failures, now=anchor) - anchor).total_seconds() // 60)

        assert [minutes(n) for n in (1, 2, 3, 4, 5)] == [5, 10, 20, 40, 80]
        # A listing failing for a month must not schedule itself past the heat
        # death of the universe: 2 ** failures is capped before it is used.
        assert minutes(50) == BACKOFF_CAP_MINUTES

    def test_a_transient_failure_backs_off_and_keeps_trying(
        self, session: Any, service: ChannelService, listing: ChannelListing, feed: Any
    ) -> None:
        feed.raises(TransientChannelError("Airbnb returned 503."))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.status is SyncStatus.FAILED
        assert listing.consecutive_failures == 1
        assert listing.status is ListingStatus.ACTIVE  # still trying
        assert listing.next_attempt_at is not None

    def test_a_permanent_failure_stops_and_asks_for_a_human(
        self, session: Any, service: ChannelService, listing: ChannelListing, feed: Any
    ) -> None:
        feed.raises(PermanentChannelError("Airbnb refused the calendar link (404)."))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.status is SyncStatus.FAILED
        # Retrying a 404 every ten minutes forever is how an integration earns
        # a rate limit of its own.
        assert listing.next_attempt_at is None
        assert listing.status is ListingStatus.ERROR
        assert "404" in (listing.last_error or "")

    def test_recovery_clears_the_error(
        self, session: Any, service: ChannelService, listing: ChannelListing, feed: Any
    ) -> None:
        feed.raises(TransientChannelError("boom"))
        service.sync_listing(listing)
        session.commit()

        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        assert listing.consecutive_failures == 0
        assert listing.last_error is None
        assert listing.last_success_at is not None

    def test_retry_revives_a_listing_that_stopped_permanently(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        """What the Retry button is for.

        A permanent failure parks the listing and stops the scheduler touching
        it, so nothing but a person can bring it back. If that path did not
        restore ACTIVE and re-arm next_attempt_at, a listing would sync once on
        the retry and then go quiet forever.
        """
        feed.raises(PermanentChannelError("Airbnb refused the calendar link (404)."))
        service.sync_listing(listing)
        session.commit()
        assert listing.status is ListingStatus.ERROR
        assert service.due_listings() == []

        # The host pasted a fresh export URL and pressed Retry.
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        outcome = service.sync_listing(listing)
        session.commit()

        assert outcome.created == 1
        assert listing.status is ListingStatus.ACTIVE
        assert listing.consecutive_failures == 0
        assert listing.next_attempt_at is not None
        # The connection was marked errored alongside the listing; it has to
        # come back too, or the screen keeps saying the channel is broken.
        assert listing.connection.status is ConnectionStatus.CONNECTED
        assert listing.connection.last_error is None
        assert len(bookings_for(session, condo)) == 1

    def test_every_attempt_is_logged(
        self, session: Any, service: ChannelService, listing: ChannelListing, feed: Any
    ) -> None:
        feed.raises(TransientChannelError("boom"))
        service.sync_listing(listing)
        feed.set(("stay-1", "20260910", "20260913", "Reserved"))
        service.sync_listing(listing)
        session.commit()

        rows = list(session.scalars(db.select(ChannelSyncLog)))
        assert len(rows) == 2
        assert {r.status for r in rows} == {SyncStatus.FAILED, SyncStatus.SUCCESS}
        assert all(r.duration_ms is not None for r in rows)


# ---------------------------------------------------------------------------
class TestOutboundFeed:
    def test_local_bookings_are_published(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        scoped: Organisation,
    ) -> None:
        today = date.today()
        BookingService(session).create(
            condo_id=condo.id,
            guest_name="Local guest",
            check_in=today + timedelta(days=5),
            check_out=today + timedelta(days=8),
            mode=PricingMode.NIGHTLY,
            night_rate=180_000,
        )
        session.commit()

        result = service.calendar_for_token(listing.export_token or "")
        assert result is not None
        events = parse_events(result[1])
        assert len(events) == 1
        assert events[0].start == today + timedelta(days=5)

    def test_the_feed_discloses_no_guest_and_no_money(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        scoped: Organisation,
    ) -> None:
        today = date.today()
        BookingService(session).create(
            condo_id=condo.id,
            guest_name="Somchai Jaidee",
            guest_email="somchai@example.com",
            check_in=today + timedelta(days=3),
            check_out=today + timedelta(days=5),
            mode=PricingMode.NIGHTLY,
            night_rate=250_000,
        )
        session.commit()

        _, body = service.calendar_for_token(listing.export_token or "")  # type: ignore[misc]
        # Served without authentication, so it must carry occupancy and nothing
        # else. A leaked URL should reveal no more than the listing page does.
        assert "Somchai" not in body
        assert "somchai@example.com" not in body
        assert "250" not in body
        assert "Not available" in body

    def test_a_channels_own_reservations_are_not_echoed_back(
        self,
        session: Any,
        service: ChannelService,
        condo: Condo,
        listing: ChannelListing,
        feed: Any,
    ) -> None:
        today = date.today()
        start = today + timedelta(days=10)
        end = today + timedelta(days=13)
        feed.set(("stay-1", start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), "Reserved"))
        service.sync_listing(listing)
        session.commit()

        _, body = service.calendar_for_token(listing.export_token or "")  # type: ignore[misc]
        # Publishing Airbnb's own reservation back at Airbnb is noise at best.
        assert parse_events(body) == []


# ---------------------------------------------------------------------------
class TestTheFeedRouteIsPublicButNotLeaky:
    def test_a_valid_token_serves_a_calendar(
        self, app: Flask, session: Any, listing: ChannelListing
    ) -> None:
        anonymous = app.test_client()
        response = anonymous.get(f"/api/v1/channels/feed/{listing.export_token}.ics")
        assert response.status_code == 200
        assert response.mimetype == "text/calendar"

    def test_an_unknown_token_is_a_404(self, app: Flask, session: Any) -> None:
        anonymous = app.test_client()
        assert anonymous.get("/api/v1/channels/feed/not-a-real-token.ics").status_code == 404

    def test_one_organisations_feed_never_shows_anothers_nights(
        self, app: Flask, session: Any, organisation: Organisation, condo: Condo
    ) -> None:
        """The tenancy trap this route sits on top of.

        ``_apply_organisation_scope`` filters on the ambient organisation, and
        an unauthenticated request has none — which means *unfiltered*, not
        *denied*. Without the explicit re-scoping in ``calendar_for_token``
        this feed would serve every tenant's calendar to anyone holding one
        token.
        """
        today = date.today()

        # Ours: a booking that should appear.
        with scoped_to(organisation.id):
            BookingService(session).create(
                condo_id=condo.id,
                guest_name="Ours",
                check_in=today + timedelta(days=2),
                check_out=today + timedelta(days=4),
                mode=PricingMode.NIGHTLY,
                night_rate=100_000,
            )
            listing = ChannelService(session).map_listing(
                channel=Channel.AIRBNB, condo_id=condo.id, import_url=GOOD_URL
            )
            session.commit()
            token = listing.export_token

        # Theirs: a different tenant, a different unit, distinctive dates.
        other = Organisation(name="Other Portfolio", is_active=True)
        session.add(other)
        session.commit()
        with scoped_to(other.id):
            their_condo = Condo(code="Z-9999", name="Their unit")
            session.add(their_condo)
            session.commit()
            BookingService(session).create(
                condo_id=their_condo.id,
                guest_name="Theirs",
                check_in=today + timedelta(days=200),
                check_out=today + timedelta(days=203),
                mode=PricingMode.NIGHTLY,
                night_rate=100_000,
            )
            session.commit()

        anonymous = app.test_client()
        body = anonymous.get(f"/api/v1/channels/feed/{token}.ics").get_data(as_text=True)
        events = parse_events(body)

        assert len(events) == 1
        assert events[0].start == today + timedelta(days=2)
        assert all(e.start != today + timedelta(days=200) for e in events)


# ---------------------------------------------------------------------------
class TestPermissions:
    @pytest.fixture()
    def manager_client(
        self, app: Flask, session: Any, organisation: Organisation
    ) -> FlaskClient:
        user = User(
            email="manager@localshouts.co.th",
            password_hash=password_hasher.hash(ADMIN_PASSWORD),
            full_name="Nok Manager",
        )
        session.add(user)
        session.flush()
        session.add(
            OrganisationMember(
                organisation_id=organisation.id, user_id=user.id, role=Role.MANAGER
            )
        )
        session.commit()

        client = app.test_client()
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "manager@localshouts.co.th", "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200
        return client

    def test_a_manager_can_look_but_not_touch(self, manager_client: FlaskClient) -> None:
        # Seeing why a calendar shows a night as taken is part of the job.
        assert manager_client.get("/api/v1/channels").status_code == 200
        # Connecting a channel is not: a credential reaches outside the org.
        assert (
            manager_client.post("/api/v1/channels/connect", json={"channel": "airbnb"}).status_code
            == 403
        )

    def test_an_admin_can_connect(self, auth_client: FlaskClient) -> None:
        response = auth_client.post("/api/v1/channels/connect", json={"channel": "airbnb"})
        assert response.status_code == 201
        assert response.get_json()["status"] == "connected"

    def test_signing_out_closes_the_api_but_not_the_feed(
        self, app: Flask, session: Any, listing: ChannelListing
    ) -> None:
        anonymous = app.test_client()
        assert anonymous.get("/api/v1/channels").status_code == 401
        assert (
            anonymous.get(f"/api/v1/channels/feed/{listing.export_token}.ics").status_code == 200
        )


# ---------------------------------------------------------------------------
class TestCredentialsAtRest:
    def test_the_import_url_is_not_stored_in_the_clear(
        self, session: Any, listing: ChannelListing
    ) -> None:
        raw = session.execute(
            db.text("SELECT import_url FROM channel_listings WHERE id = :i"),
            {"i": listing.id.bytes},
        ).scalar()
        # Airbnb puts a bearer token in the query string, so this column is a
        # credential and a database dump must not hand it over.
        assert raw is not None
        assert "secrettoken" not in raw
        assert listing.import_url == GOOD_URL  # still readable through the ORM

    def test_the_feed_token_is_stored_as_a_hash_for_lookup(
        self, session: Any, listing: ChannelListing
    ) -> None:
        raw = session.execute(
            db.text("SELECT export_token, export_token_hash FROM channel_listings WHERE id = :i"),
            {"i": listing.id.bytes},
        ).one()
        assert listing.export_token is not None
        assert listing.export_token not in (raw[0] or "")
        assert len(raw[1]) == 64
