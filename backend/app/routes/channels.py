"""Channel endpoints, plus the one unauthenticated route in the feature.

Everything here needs ``channel:read`` or ``channel:write`` except
:func:`calendar_feed`, which is public **by necessity**: Airbnb's calendar
fetcher holds no credentials of ours and cannot be made to. Its guard is a
32-byte token in the path, and the fact that the document it serves carries
dates and nothing else — no guest, no amount, no note. A leaked feed URL
discloses that a unit is occupied, which is already visible to anyone looking
at the listing.
"""

from __future__ import annotations

import uuid
from typing import Any

from flask import Blueprint, Response, jsonify
from pydantic import BaseModel, ConfigDict, Field

from app.auth.decorators import public, require_permission
from app.auth.permissions import CHANNEL_READ, CHANNEL_WRITE
from app.channels.base import ChannelCapability
from app.channels.registry import adapter_for
from app.common.api import no_content, parse_body, parse_query
from app.common.crypto import CredentialUnreadableError
from app.common.errors import NotFoundError
from app.config import get_settings
from app.extensions import db, limiter
from app.models.channel import (
    Channel,
    ChannelConnection,
    ChannelListing,
    ChannelSyncLog,
    ConnectionStatus,
)
from app.services.channel_service import ChannelService

bp = Blueprint("channels", __name__)


def _service() -> ChannelService:
    return ChannelService(db.session)


# ---------------------------------------------------------------------------
# serialisation
# ---------------------------------------------------------------------------


def _capability_report(channel: Channel) -> dict[str, bool]:
    """What this channel's *current transport* can actually do.

    The UI renders this rather than assuming. Over iCal, pricing and webhooks
    come back False and the dashboard says "not supported" instead of showing a
    tick it has not earned — and when the partner adapter lands, the same
    screen lights up with no change here.
    """
    adapter = adapter_for(channel)
    return {capability.value: adapter.supports(capability) for capability in ChannelCapability}


def _serialise_connection(record: ChannelConnection) -> dict[str, Any]:
    adapter = adapter_for(record.channel)
    return {
        "id": str(record.id),
        "channel": record.channel.value,
        "transport": adapter.transport,
        "status": record.status.value,
        "account_label": record.account_label,
        "connected_at": record.connected_at.isoformat() + "Z" if record.connected_at else None,
        "last_error": record.last_error,
        "capabilities": _capability_report(record.channel),
    }


def _feed_url(listing: ChannelListing) -> str | None:
    """The URL to paste into Airbnb. None when the token cannot be read.

    Built from PUBLIC_BASE_URL rather than the incoming request: Airbnb fetches
    this from the open internet, and a request that arrived through a proxy
    cannot be trusted to say what the outside world calls us.
    """
    settings = get_settings()
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    try:
        token = listing.export_token
    except CredentialUnreadableError:
        return None
    if not base or not token:
        return None
    return f"{base}{settings.API_PREFIX}/channels/feed/{token}.ics"


def _serialise_listing(listing: ChannelListing) -> dict[str, Any]:
    try:
        import_url: str | None = listing.import_url
        readable = True
    except CredentialUnreadableError:
        import_url, readable = None, False

    return {
        "id": str(listing.id),
        "channel": listing.connection.channel.value,
        "condo": {
            "id": str(listing.condo_ref.id),
            "code": listing.condo_ref.code,
            "name": listing.condo_ref.name,
        },
        "external_listing_id": listing.external_listing_id,
        "external_label": listing.external_label,
        # Returned so the screen can show what is configured. It is a
        # credential, so it is only ever sent to someone holding channel:read
        # inside the owning organisation.
        "import_url": import_url,
        "credentials_readable": readable,
        "feed_url": _feed_url(listing),
        "status": listing.status.value,
        "last_synced_at": (
            listing.last_synced_at.isoformat() + "Z" if listing.last_synced_at else None
        ),
        "last_success_at": (
            listing.last_success_at.isoformat() + "Z" if listing.last_success_at else None
        ),
        "last_error": listing.last_error,
        "consecutive_failures": listing.consecutive_failures,
        "next_attempt_at": (
            listing.next_attempt_at.isoformat() + "Z" if listing.next_attempt_at else None
        ),
    }


def _serialise_log(row: ChannelSyncLog) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "listing_id": str(row.listing_id) if row.listing_id else None,
        "condo_label": row.condo_label,
        "sync_type": row.sync_type.value,
        "direction": row.direction.value,
        "status": row.status.value,
        "message": row.message,
        "reference": row.reference,
        "retry_count": row.retry_count,
        "created": row.items_created,
        "updated": row.items_updated,
        "cancelled": row.items_cancelled,
        "skipped": row.items_skipped,
        "duration_ms": row.duration_ms,
        "when": row.created_at.isoformat() + "Z",
    }


# ---------------------------------------------------------------------------
# payloads
# ---------------------------------------------------------------------------


class ConnectPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    channel: Channel = Channel.AIRBNB
    account_label: str | None = Field(default=None, max_length=160)


class MapListingPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    channel: Channel = Channel.AIRBNB
    condo_id: uuid.UUID
    #: Airbnb's per-listing export link. Optional only so a listing can be
    #: mapped before the host has fetched it.
    import_url: str | None = Field(default=None, max_length=1024)
    external_listing_id: str | None = Field(default=None, max_length=64)
    external_label: str | None = Field(default=None, max_length=255)


class LogQuery(BaseModel):
    listing_id: uuid.UUID | None = None
    limit: int = Field(default=50, ge=1, le=200)


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------


@bp.get("")
@require_permission(CHANNEL_READ)
def overview() -> Any:
    """Everything the Channels screen and the dashboard card need, in one call."""
    service = _service()
    connections = service.connections()
    listings = service.listings()
    return jsonify(
        {
            "connections": [_serialise_connection(c) for c in connections],
            "listings": [_serialise_listing(item) for item in listings],
            "available_channels": [
                {
                    "channel": channel.value,
                    "transport": adapter_for(channel).transport,
                    "capabilities": _capability_report(channel),
                    "connected": any(
                        c.channel is channel and c.status is ConnectionStatus.CONNECTED
                        for c in connections
                    ),
                }
                for channel in Channel
            ],
        }
    )


@bp.post("/connect")
@require_permission(CHANNEL_WRITE)
def connect() -> Any:
    payload = parse_body(ConnectPayload)
    record = _service().connect(payload.channel, account_label=payload.account_label)
    db.session.commit()
    return jsonify(_serialise_connection(record)), 201


@bp.post("/disconnect")
@require_permission(CHANNEL_WRITE)
def disconnect() -> Any:
    payload = parse_body(ConnectPayload)
    record = _service().disconnect(payload.channel)
    db.session.commit()
    return jsonify(_serialise_connection(record)), 200


@bp.post("/listings")
@require_permission(CHANNEL_WRITE)
def map_listing() -> Any:
    payload = parse_body(MapListingPayload)
    listing = _service().map_listing(
        channel=payload.channel,
        condo_id=payload.condo_id,
        import_url=payload.import_url,
        external_listing_id=payload.external_listing_id,
        external_label=payload.external_label,
    )
    db.session.commit()
    return jsonify(_serialise_listing(listing)), 201


@bp.delete("/listings/<uuid:listing_id>")
@require_permission(CHANNEL_WRITE)
def unmap_listing(listing_id: uuid.UUID) -> Any:
    _service().unmap_listing(listing_id)
    db.session.commit()
    return no_content()


@bp.post("/listings/<uuid:listing_id>/sync")
@require_permission(CHANNEL_WRITE)
@limiter.limit("20 per minute")
def sync_now(listing_id: uuid.UUID) -> Any:
    """Brief §7's "Sync Now", and §9's "Retry" — the same operation.

    Rate limited well below anything a person can click, because each call is
    an outbound HTTP request to Airbnb and a hot retry loop is how an
    integration earns a rate limit of its own.
    """
    service = _service()
    listing = service.get_listing(listing_id)
    outcome = service.sync_listing(listing)
    db.session.commit()
    return jsonify(
        {
            "listing": _serialise_listing(listing),
            "outcome": {
                "status": outcome.status.value,
                "created": outcome.created,
                "updated": outcome.updated,
                "cancelled": outcome.cancelled,
                "skipped": outcome.skipped,
                "conflicts": outcome.conflicts,
                "message": outcome.summary(),
            },
        }
    )


@bp.get("/logs")
@require_permission(CHANNEL_READ)
def logs() -> Any:
    params = parse_query(LogQuery)
    rows = _service().logs(listing_id=params.listing_id, limit=params.limit)
    return jsonify({"items": [_serialise_log(row) for row in rows]})


@bp.get("/feed/<token>.ics")
@public
@limiter.limit("60 per minute")
def calendar_feed(token: str) -> Any:
    """The outbound calendar a channel polls.

    Unauthenticated by necessity — see the module docstring. Two things keep it
    safe, and both are deliberate:

    * the token is the only way in, and it is 32 random bytes;
    * :meth:`ChannelService.calendar_for_token` re-establishes the owning
      organisation's scope before reading any booking, because an
      unauthenticated request has no ambient scope and the tenancy filter
      treats "no scope" as *unfiltered*, not as *denied*.

    A bad token gets a 404 rather than a 403: whether a token exists is itself
    information, and there is nobody to tell apart from a scanner.
    """
    result = _service().calendar_for_token(token)
    if result is None:
        raise NotFoundError("No calendar here.")

    _, body = result
    response = Response(body, mimetype="text/calendar; charset=utf-8")
    response.headers["Content-Disposition"] = 'inline; filename="localshouts.ics"'
    # Channels poll this every few hours; a short cache spares us a hit per
    # poller without letting a booking stay invisible for long.
    response.headers["Cache-Control"] = "public, max-age=300"
    return response
