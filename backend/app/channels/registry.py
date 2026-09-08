"""Which adapter serves which channel.

One indirection, so that adding Booking.com is a line here plus a new module,
and so that the day the Airbnb partner application is approved the swap is
``AirbnbICalAdapter`` to ``AirbnbApiAdapter`` in one place. Nothing above this
layer names a transport.
"""

from __future__ import annotations

from app.channels.airbnb import AirbnbICalAdapter
from app.channels.base import ChannelAdapter
from app.models.channel import Channel


def adapter_for(channel: Channel, *, timeout: int | None = None) -> ChannelAdapter:
    """The adapter currently serving ``channel``.

    ``timeout`` comes from settings at the call site rather than being read
    here, so the adapters stay free of Flask and stay unit-testable.
    """
    if channel is Channel.AIRBNB:
        return AirbnbICalAdapter(timeout=timeout or 20)
    raise ValueError(f"No adapter for channel {channel!r}")


def transport_name(channel: Channel) -> str:
    """What to call the current transport in the UI, e.g. "iCal"."""
    return adapter_for(channel).transport
