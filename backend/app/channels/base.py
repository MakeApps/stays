"""What a channel can do, and the vocabulary every adapter speaks.

The point of this module is :class:`ChannelCapability`. Airbnb over iCal can
pull reservations and publish availability, and can do *nothing at all* about
pricing, guest identity, webhooks or listing discovery. Airbnb over the partner
REST API can do all of it. Rather than hard-coding "pricing is broken" into the
UI, each adapter declares what it supports and the rest of the system asks.

That is what lets the dashboard say "Pricing — not supported over iCal" instead
of showing a green tick it has not earned, and what lets the same screen light
up unchanged when the partner adapter lands.

Adapters deal in plain dates and strings, never in ORM objects, so they can be
tested against a fixture file with no database at all.
"""

from __future__ import annotations

import enum
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

from app.models.channel import Channel


class ChannelCapability(str, enum.Enum):
    #: Read reservations out of the channel.
    RESERVATION_PULL = "reservation_pull"
    #: Publish our occupancy so the channel stops selling those nights.
    AVAILABILITY_PUSH = "availability_push"
    #: Read the channel's own blocks, as distinct from its reservations.
    AVAILABILITY_PULL = "availability_pull"
    #: Send rates, minimum stay, cleaning fee. Brief §5.
    PRICING_PUSH = "pricing_push"
    #: The channel calls us on change instead of us polling. Brief §6.
    WEBHOOKS = "webhooks"
    #: Guest name, contact details, party size, amount. Brief §4.
    GUEST_DETAILS = "guest_details"
    #: Enumerate the account's listings instead of being told one at a time.
    LISTING_DISCOVERY = "listing_discovery"


class ChannelError(Exception):
    """Base for anything an adapter could not do."""


class TransientChannelError(ChannelError):
    """Worth trying again later: a timeout, a 5xx, a rate limit, a dropped
    connection. The caller backs off rather than disconnecting anything."""


class PermanentChannelError(ChannelError):
    """Will not fix itself: a 404, a revoked token, a URL that is not a
    calendar. The caller stops retrying and asks a person to reconnect,
    because retrying a permanent failure every ten minutes forever is how an
    integration gets an account rate-limited."""


@dataclass(frozen=True, slots=True)
class ExternalReservation:
    """One stay as the channel describes it.

    ``check_out`` is **exclusive**, matching both ``Booking.check_out`` and
    iCal's DTEND, so a checkout and a checkin on the same day do not collide.

    Everything below ``summary`` is ``None`` over iCal. The fields exist so the
    partner adapter has somewhere to put them without a schema change.
    """

    uid: str
    check_in: date
    check_out: date
    summary: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_count: int | None = None
    #: Total in minor units, where the transport supplies one. Never over iCal.
    amount: int | None = None
    #: True when the channel says these nights are unavailable without saying a
    #: guest is in them — a host block or a maintenance day.
    is_block: bool = False

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    def fingerprint(self) -> str:
        """Hash of everything that would change what we store.

        A channel re-sends every reservation on every poll. Comparing this
        against the stored ``payload_hash`` is what turns the second poll into
        a no-op instead of a write.
        """
        parts = [
            self.uid,
            self.check_in.isoformat(),
            self.check_out.isoformat(),
            self.summary or "",
            self.guest_name or "",
            self.guest_email or "",
            self.guest_phone or "",
            "" if self.guest_count is None else str(self.guest_count),
            "" if self.amount is None else str(self.amount),
            "block" if self.is_block else "stay",
        ]
        return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class BlockedSpan:
    """One occupied range on our side, on its way out to the channel.

    Carries no guest name, no amount and no note — deliberately. The outbound
    feed is served without authentication, so it must disclose nothing beyond
    the fact that a unit is taken.
    """

    uid: str
    check_in: date
    check_out: date
    label: str = "Not available"


class ChannelAdapter(ABC):
    """One transport for one channel.

    Two adapters are foreseen for Airbnb: the iCal one built here, and a REST
    one once the partner application is approved. They differ in capabilities,
    not in interface, so ``ChannelService`` never branches on which is in play —
    it asks :meth:`supports` and skips what cannot be done.
    """

    channel: Channel
    #: Transport name for logs and the UI, e.g. "iCal" or "Partner API".
    transport: str
    capabilities: frozenset[ChannelCapability]

    def supports(self, capability: ChannelCapability) -> bool:
        return capability in self.capabilities

    @abstractmethod
    def fetch_reservations(self, import_url: str) -> list[ExternalReservation]:
        """Everything the channel currently believes about this listing.

        The full current state, not a delta: reconciliation is the caller's
        job, and a UID absent from this list is what a cancellation looks like.

        Raises :class:`TransientChannelError` or :class:`PermanentChannelError`.
        """

    @abstractmethod
    def render_availability(self, spans: list[BlockedSpan], *, label: str) -> str:
        """Serialise our occupancy into whatever the channel consumes."""
