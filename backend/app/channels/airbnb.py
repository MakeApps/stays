"""Airbnb over iCal.

Airbnb has no public API. Access is partner-only, behind an application that
requires an already-shipped product, a data security review and an API quality
review, and the endpoint documentation is not public. So this adapter uses the
one integration path Airbnb offers every host with no approval at all: the
per-listing iCal export URL, and the matching import URL that Airbnb polls.

What that buys, honestly:

* reservations and host blocks, as dates — enough to stop a double booking;
* our occupancy pushed back, so Airbnb stops selling nights we have sold.

What it cannot buy, at any amount of effort, because the format does not carry
it: guest names, contact details, party size, money, pricing rules, or an event
push. Those are declared absent in :attr:`AirbnbICalAdapter.capabilities` rather
than faked, and the UI reads that declaration.

Propagation is not instant in either direction — Airbnb re-reads an imported
calendar every few hours. The database's ``booking_nights`` primary key, not
this adapter, is what actually makes double-booking impossible.
"""

from __future__ import annotations

import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

from app.channels.base import (
    BlockedSpan,
    ChannelAdapter,
    ChannelCapability,
    ExternalReservation,
    PermanentChannelError,
    TransientChannelError,
)
from app.channels.ical import ICalError, VEvent, build_calendar, parse_events
from app.models.channel import Channel

#: Only Airbnb's own domains may be fetched. This is an SSRF control, not
#: tidiness: the import URL is typed in by a user, and without this the server
#: would happily GET http://169.254.169.254/ or anything else on the private
#: network and hand back the body.
_ALLOWED_HOST = re.compile(r"^(?:[a-z0-9-]+\.)*airbnb\.[a-z]{2,3}(?:\.[a-z]{2,3})?$", re.I)

#: https://www.airbnb.com/calendar/ical/12345678.ics?s=<token>
_LISTING_ID = re.compile(r"/calendar/ical/(\d+)\.ics", re.I)

#: A response larger than this is not a calendar for one condo; refusing to
#: buffer it keeps a hostile or broken endpoint from exhausting memory.
_MAX_BYTES = 4 * 1024 * 1024

_USER_AGENT = "LocalShoutsStays/1.0 (+channel-sync)"

#: Airbnb writes host blocks as "Airbnb (Not available)" and guest stays as
#: "Reserved". The distinction is cosmetic for availability — both occupy the
#: nights — but it is worth reporting accurately.
_BLOCK_HINTS = ("not available", "blocked", "unavailable")


def validate_import_url(url: str) -> str:
    """Accept only an https Airbnb calendar URL.

    Raises :class:`PermanentChannelError`, because a URL that is wrong now will
    be just as wrong in ten minutes and must not enter the retry loop.
    """
    candidate = (url or "").strip()
    if not candidate:
        raise PermanentChannelError("No calendar URL was given.")

    parsed = urllib.parse.urlparse(candidate)
    if parsed.scheme.lower() != "https":
        raise PermanentChannelError("The calendar URL must start with https://.")
    if not parsed.hostname or not _ALLOWED_HOST.match(parsed.hostname):
        raise PermanentChannelError(
            "That URL is not on airbnb.com. Copy the export link from the "
            "listing's calendar, under Availability > Sync calendars."
        )
    if ".ics" not in parsed.path.lower():
        raise PermanentChannelError("An Airbnb calendar link ends in .ics.")
    return candidate


def parse_listing_id(url: str) -> str | None:
    """The Airbnb listing id embedded in an export URL, when there is one."""
    match = _LISTING_ID.search(url or "")
    return match.group(1) if match else None


class _SameSiteRedirects(urllib.request.HTTPRedirectHandler):
    """Re-check the host on every hop.

    Following redirects blindly reopens the SSRF hole that
    :func:`validate_import_url` closes — an allowed URL that 302s to an internal
    address is the standard bypass.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        host = urllib.parse.urlparse(newurl).hostname
        if not host or not _ALLOWED_HOST.match(host):
            raise PermanentChannelError("The calendar URL redirected off airbnb.com.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _fetch(url: str, *, timeout: int) -> str:
    request = urllib.request.Request(  # noqa: S310 - scheme and host validated above
        url, headers={"User-Agent": _USER_AGENT, "Accept": "text/calendar, */*"}
    )
    opener = urllib.request.build_opener(_SameSiteRedirects)
    try:
        with opener.open(request, timeout=timeout) as response:
            body: bytes = response.read(_MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        # 404/410 mean the host regenerated or removed the link; 401/403 mean
        # it was revoked. None of those improve by retrying.
        if exc.code in (401, 403, 404, 410):
            raise PermanentChannelError(
                f"Airbnb refused the calendar link ({exc.code}). Copy a fresh "
                "export URL from the listing and reconnect."
            ) from exc
        raise TransientChannelError(f"Airbnb returned {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise TransientChannelError(f"Could not reach Airbnb: {exc.reason}") from exc
    except TimeoutError as exc:
        raise TransientChannelError("Airbnb did not respond in time.") from exc

    if len(body) > _MAX_BYTES:
        raise PermanentChannelError("That calendar is implausibly large.")
    return body.decode("utf-8", errors="replace")


def _is_block(summary: str | None) -> bool:
    text = (summary or "").lower()
    return any(hint in text for hint in _BLOCK_HINTS)


class AirbnbICalAdapter(ChannelAdapter):
    channel = Channel.AIRBNB
    transport = "iCal"
    #: Everything Airbnb's calendar format can carry, and nothing more. The
    #: absentees — pricing, webhooks, guest details, listing discovery — are
    #: not oversights; see the module docstring.
    capabilities = frozenset(
        {
            ChannelCapability.RESERVATION_PULL,
            ChannelCapability.AVAILABILITY_PULL,
            ChannelCapability.AVAILABILITY_PUSH,
        }
    )

    def __init__(self, *, timeout: int = 20) -> None:
        self.timeout = timeout

    def fetch_reservations(self, import_url: str) -> list[ExternalReservation]:
        url = validate_import_url(import_url)
        raw = _fetch(url, timeout=self.timeout)
        try:
            events = parse_events(raw)
        except ICalError as exc:
            raise PermanentChannelError(
                "That URL did not return a calendar. Check it is the export "
                "link and not the listing page."
            ) from exc

        return [
            ExternalReservation(
                uid=event.uid,
                check_in=event.start,
                check_out=event.end,
                summary=event.summary,
                is_block=_is_block(event.summary),
            )
            for event in events
        ]

    def render_availability(self, spans: list[BlockedSpan], *, label: str) -> str:
        return build_calendar(
            [
                VEvent(uid=span.uid, start=span.check_in, end=span.check_out, summary=span.label)
                for span in spans
            ],
            name=label,
        )

    @staticmethod
    def suggest_listing_id(import_url: str, fallback: str) -> str:
        """Airbnb puts the listing id in the URL, so it need not be typed."""
        return parse_listing_id(import_url) or fallback

    @staticmethod
    def horizon(today: date, days: int) -> date:
        """Airbnb reads roughly a year of an imported calendar; publishing far
        beyond that is bytes nobody reads on every poll."""
        return date.fromordinal(today.toordinal() + days)
