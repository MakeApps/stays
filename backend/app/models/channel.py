"""Channel connections, listing mappings, imported reservations, and the sync trail.

Named ``channel_*`` rather than ``airbnb_*``. Airbnb is the first channel and
the only one implemented, but every table carries a ``channel`` discriminator so
Booking.com or Agoda is a new adapter plus an enum value rather than four more
near-identical tables. The enum columns are ``native_enum=False`` VARCHARs, so
adding a channel needs no migration — the same reasoning as ``Role``.

Two things worth knowing before reading further:

* **``external_reservation_id`` is the idempotency key.** A channel re-sends the
  same reservation on every poll, so the unique index on
  ``(listing_id, external_reservation_id)`` is what makes a repeated feed a
  no-op instead of a duplicate booking.
* **Nothing here stores money or guest identity.** An iCal feed carries dates
  and a status label and nothing else, so an imported stay lands as a *blocked*
  booking holding the dates, and a person attaches the real figures. See
  :mod:`app.services.channel_service`.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.crypto import SecretText
from app.models.base import (
    GUID,
    AuditMixin,
    Base,
    OrganisationScopedMixin,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.condo import Condo


class Channel(str, enum.Enum):
    AIRBNB = "airbnb"


class ConnectionStatus(str, enum.Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    #: Reached but refused us — expired credentials, a revoked feed URL, a 404.
    #: Distinct from disconnected, which is a deliberate act by a person.
    ERROR = "error"


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    #: Mapped but deliberately not syncing.
    PAUSED = "paused"
    ERROR = "error"


class SyncType(str, enum.Enum):
    AVAILABILITY = "availability"
    RESERVATION = "reservation"
    #: No transport implements this yet; iCal has no pricing mechanism at all.
    #: Present so the log and the dashboard can say so explicitly.
    PRICING = "pricing"


class SyncDirection(str, enum.Enum):
    #: Channel to LocalShouts.
    INBOUND = "inbound"
    #: LocalShouts to channel.
    OUTBOUND = "outbound"


class SyncStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    #: Ran, found nothing to do. Kept rather than dropped so "last sync" is
    #: honest about having happened.
    SKIPPED = "skipped"


class ChannelReservationStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"


def _enum_column(enum_type: type[enum.Enum], length: int) -> Enum:
    """Every enum here stores its value as a VARCHAR, never a native ENUM.

    Matches the rest of the schema, and means a new channel or sync type is a
    code change rather than a migration.
    """
    return Enum(
        enum_type,
        values_callable=lambda e: [m.value for m in e],
        native_enum=False,
        length=length,
    )


class ChannelConnection(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin):
    """One organisation's link to one channel.

    Not soft-deletable: disconnecting sets ``status`` and clears the
    credentials, which keeps the sync history attached to something. A deleted
    row would orphan every log line explaining why it was disconnected.
    """

    __tablename__ = "channel_connections"

    channel: Mapped[Channel] = mapped_column(_enum_column(Channel, 32), nullable=False)
    status: Mapped[ConnectionStatus] = mapped_column(
        _enum_column(ConnectionStatus, 20),
        nullable=False,
        default=ConnectionStatus.DISCONNECTED,
    )

    #: What the host calls this account, for when one organisation eventually
    #: holds two Airbnb accounts. Cosmetic today.
    account_label: Mapped[str | None] = mapped_column(String(160), nullable=True)

    #: Null over iCal, which authenticates nothing — the secret lives in each
    #: listing's URL instead. This is where partner OAuth tokens will go.
    credentials: Mapped[str | None] = mapped_column(SecretText, nullable=True)
    credentials_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    connected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    listings: Mapped[list[ChannelListing]] = relationship(
        back_populates="connection", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index(
            "uq_channel_connections_organisation_id_channel",
            "organisation_id",
            "channel",
            unique=True,
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ChannelConnection {self.channel.value} {self.status.value}>"


class ChannelListing(
    Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin, SoftDeleteMixin
):
    """One channel listing mapped to one condo.

    Brief §2 asks that a listing never map to two units. That is enforced in
    ``ChannelService``, over live rows only, rather than by a UNIQUE index —
    the same call this schema already makes for condo codes and user emails,
    and for the same reason: MySQL has no partial index, so a hard constraint
    would keep a listing unusable forever once it had been unmapped.

    Retry state lives here rather than in a queue: ``consecutive_failures``
    drives ``next_attempt_at``, and the sync command only picks up listings that
    are due. That is the whole of brief §9's backoff, with no broker.
    """

    __tablename__ = "channel_listings"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False
    )
    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="RESTRICT"), nullable=False
    )

    #: The channel's own identifier, e.g. an Airbnb listing id. Parsed out of
    #: the iCal URL where it can be, typed by hand where it cannot.
    external_listing_id: Mapped[str] = mapped_column(String(64), nullable=False)
    external_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    #: The channel's .ics export, which we poll. Encrypted: Airbnb puts a
    #: bearer token in its query string, so this column is a credential.
    import_url: Mapped[str | None] = mapped_column(SecretText, nullable=True)

    #: Our .ics, which the channel polls. Held encrypted so a database read is
    #: not enough to subscribe to a unit's occupancy, with a hash beside it
    #: because SecretText ciphertext is non-deterministic and cannot be queried.
    export_token: Mapped[str | None] = mapped_column(SecretText, nullable=True)
    export_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[ListingStatus] = mapped_column(
        _enum_column(ListingStatus, 20), nullable=False, default=ListingStatus.ACTIVE
    )

    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    #: Distinct from last_synced_at: an attempt that failed still counts as an
    #: attempt, and "last succeeded four days ago" is the number that matters.
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    connection: Mapped[ChannelConnection] = relationship(back_populates="listings")
    condo_ref: Mapped[Condo] = relationship("Condo", lazy="selectin")

    __table_args__ = (
        # Not unique — see the class docstring. Uniqueness among live rows is a
        # service-layer rule.
        Index("ix_channel_listings_connection_condo", "connection_id", "condo_id"),
        Index("ix_channel_listings_external", "connection_id", "external_listing_id"),
        # This one *is* unique: a token is generated, never reused, and is the
        # lookup key for an unauthenticated route, so a collision would serve
        # the wrong tenant's calendar.
        Index("uq_channel_listings_export_token_hash", "export_token_hash", unique=True),
        # The sync command's work query: live, active, due.
        Index("ix_channel_listings_due", "deleted_at", "status", "next_attempt_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ChannelListing {self.external_listing_id} -> {self.condo_id}>"


class ChannelReservation(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, TimestampMixin):
    """A reservation the channel told us about, and the booking it produced.

    ``TimestampMixin`` rather than ``AuditMixin``: these rows are written by the
    sync worker, which has no acting user, and a table of NULL ``created_by``
    would only pretend otherwise.

    ``payload_hash`` is what makes a poll cheap. A channel re-sends every
    reservation every time; if the hash is unchanged there is nothing to do and
    the booking is not touched at all.
    """

    __tablename__ = "channel_reservations"

    listing_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("channel_listings.id", ondelete="CASCADE"), nullable=False
    )
    #: Null when the reservation is known but no booking could be made for it —
    #: the dates collided with a local booking, and a person has to decide.
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True
    )

    #: The channel's identifier for the stay — the iCal UID. The idempotency
    #: key for the whole feature.
    external_reservation_id: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[ChannelReservationStatus] = mapped_column(
        _enum_column(ChannelReservationStatus, 20),
        nullable=False,
        default=ChannelReservationStatus.ACTIVE,
    )

    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    #: Exclusive, matching ``Booking.check_out`` and iCal's own DTEND.
    check_out: Mapped[date] = mapped_column(Date, nullable=False)

    #: The raw SUMMARY line ("Reserved", "Airbnb (Not available)"). Kept
    #: verbatim because it is the only description the feed gives.
    summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    #: Set only where a transport actually supplies it. iCal never does.
    guest_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    listing: Mapped[ChannelListing] = relationship()

    __table_args__ = (
        # The idempotency guarantee, enforced by the database rather than by
        # remembering to check.
        Index(
            "uq_channel_reservations_listing_id_external_reservation_id",
            "listing_id",
            "external_reservation_id",
            unique=True,
        ),
        Index("ix_channel_reservations_booking", "booking_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ChannelReservation {self.external_reservation_id} {self.check_in}>"


class ChannelSyncLog(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, TimestampMixin):
    """One attempt, successful or not. Brief §8.

    Rows survive their listing (``SET NULL``), because the most interesting log
    line is often the one explaining why something was disconnected.
    """

    __tablename__ = "channel_sync_logs"

    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("channel_connections.id", ondelete="SET NULL"), nullable=True
    )
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("channel_listings.id", ondelete="SET NULL"), nullable=True
    )
    #: Denormalised so a log line still says which unit it was about after the
    #: mapping is gone.
    condo_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    sync_type: Mapped[SyncType] = mapped_column(_enum_column(SyncType, 20), nullable=False)
    direction: Mapped[SyncDirection] = mapped_column(
        _enum_column(SyncDirection, 16), nullable=False
    )
    status: Mapped[SyncStatus] = mapped_column(_enum_column(SyncStatus, 16), nullable=False)

    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The request or event identifier the channel gave us, for support.
    reference: Mapped[str | None] = mapped_column(String(128), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    #: What actually changed. Without these, a screen full of "SUCCESS" says
    #: nothing about whether the integration is doing anything.
    items_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    items_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    items_cancelled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    items_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        # The admin log screen: newest first, within one organisation.
        Index("ix_channel_sync_logs_org_created", "organisation_id", "created_at"),
        Index("ix_channel_sync_logs_listing_created", "listing_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<ChannelSyncLog {self.sync_type.value} "
            f"{self.direction.value} {self.status.value}>"
        )
