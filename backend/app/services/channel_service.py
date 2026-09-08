"""Connecting channels, mapping listings, and reconciling what they tell us.

The reconciliation in :meth:`ChannelService.sync_listing` is the part worth
reading carefully. A channel hands back its *entire* current picture on every
poll, never a delta, so the algorithm is a set comparison against
``channel_reservations``:

* a UID we have not seen becomes a booking;
* a UID whose fingerprint is unchanged is skipped without touching anything;
* a UID whose dates moved updates the booking;
* a UID that has **disappeared** is a cancellation.

Three rules hold this together, and each one exists because the alternative
loses somebody's money:

1. **A local booking is never overwritten.** If an inbound reservation collides
   with dates we already sold ourselves, the import records a conflict and
   leaves both alone. Deleting a paid booking because a calendar feed implied
   it should not exist is the worst thing this feature could do.
2. **Imported stays land blocked, not booked.** An iCal feed carries no money
   and no guest, so an imported row holds the nights (keeping the unit
   unsellable) while staying out of revenue — ``MAINTENANCE`` is in
   ``OCCUPYING_STATUSES`` but not in ``REVENUE_STATUSES``. A person fills in
   the real figures and flips it.
3. **We never echo a channel's own reservations back to it.** The outbound feed
   excludes bookings that came from the listing it is being published to.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select

from app.channels.base import (
    BlockedSpan,
    ChannelCapability,
    ExternalReservation,
    PermanentChannelError,
    TransientChannelError,
)
from app.channels.registry import adapter_for
from app.common import activity
from app.common.crypto import (
    CredentialUnreadableError,
    new_token,
    token_fingerprint,
)
from app.common.current_org import scoped_to
from app.common.errors import (
    BookingConflictError,
    DuplicateError,
    NotFoundError,
    ValidationError,
)
from app.config import Settings, get_settings
from app.extensions import db
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.base import utcnow
from app.models.booking import Booking, BookingStatus
from app.models.channel import (
    Channel,
    ChannelConnection,
    ChannelListing,
    ChannelReservation,
    ChannelReservationStatus,
    ChannelSyncLog,
    ConnectionStatus,
    ListingStatus,
    SyncDirection,
    SyncStatus,
    SyncType,
)
from app.models.condo import Condo
from app.services.analytics import OCCUPYING_STATUSES
from app.services.booking_service import BookingService
from app.services.pricing import PricingMode

#: Backoff for a listing that keeps failing: 5, 10, 20, 40, 80, 160, 320
#: minutes, then held at six hours. Long enough that a channel outage does not
#: turn into a hammering, short enough that a blip self-heals within the hour.
BACKOFF_BASE_MINUTES = 5
BACKOFF_CAP_MINUTES = 360

#: Written into an imported booking so the screen says why the money is zero.
IMPORT_NOTE = (
    "Imported from {channel} over {transport}. That feed carries dates only — "
    "no guest details and no amount — so this is held as a block. Fill in the "
    "real figures and change the status to confirm it."
)


def next_attempt_after(failures: int, *, now: datetime | None = None) -> datetime:
    """Exponential backoff, capped. ``failures`` is the count *including* the
    one that just happened, so the first retry is one base interval away."""
    exponent = max(failures - 1, 0)
    # Cap the exponent before shifting: 2 ** 10_000 is a real hazard once a
    # listing has been failing for a month.
    minutes = min(BACKOFF_BASE_MINUTES * (2 ** min(exponent, 16)), BACKOFF_CAP_MINUTES)
    return (now or utcnow()) + timedelta(minutes=minutes)


@dataclass(frozen=True, slots=True)
class SyncOutcome:
    status: SyncStatus
    created: int = 0
    updated: int = 0
    cancelled: int = 0
    skipped: int = 0
    #: Reservations that could not be applied because our own booking holds
    #: those nights. Counted separately from failures: the sync worked, the
    #: calendars simply disagree and a person has to settle it.
    conflicts: int = 0
    message: str | None = None

    @property
    def changed(self) -> bool:
        return bool(self.created or self.updated or self.cancelled)

    def summary(self) -> str:
        if self.message:
            return self.message
        if not self.changed and not self.conflicts:
            return f"No changes ({self.skipped} unchanged)."
        parts = []
        for count, word in (
            (self.created, "imported"),
            (self.updated, "updated"),
            (self.cancelled, "cancelled"),
            (self.conflicts, "in conflict"),
        ):
            if count:
                parts.append(f"{count} {word}")
        return ", ".join(parts) + "."


class ChannelService:
    def __init__(self, session=db.session, settings: Settings | None = None) -> None:  # type: ignore[no-untyped-def]
        self.session = session
        self.settings = settings or get_settings()

    # ------------------------------------------------------------------
    # connections
    # ------------------------------------------------------------------
    def connection(self, channel: Channel) -> ChannelConnection | None:
        record: ChannelConnection | None = self.session.scalars(
            select(ChannelConnection).where(ChannelConnection.channel == channel)
        ).one_or_none()
        return record

    def connections(self) -> list[ChannelConnection]:
        return list(
            self.session.scalars(select(ChannelConnection).order_by(ChannelConnection.channel))
        )

    def connect(self, channel: Channel, *, account_label: str | None = None) -> ChannelConnection:
        """Open (or reopen) a channel for this organisation.

        Over iCal there is nothing to authenticate — the secret lives in each
        listing's URL — so this is bookkeeping that gives the listings something
        to hang from and the UI something to show a status for.
        """
        record = self.connection(channel)
        if record is None:
            record = ChannelConnection(channel=channel)
            self.session.add(record)

        record.status = ConnectionStatus.CONNECTED
        record.account_label = (account_label or "").strip() or None
        record.connected_at = utcnow()
        record.last_error = None
        self.session.flush()

        activity.record(
            ActivityAction.CONNECTED,
            ActivityEntity.CHANNEL,
            entity_id=record.id,
            entity_label=channel.value,
            meta={"summary": f"{channel.value.title()} connected"},
        )
        return record

    def disconnect(self, channel: Channel) -> ChannelConnection:
        """Stop syncing, keeping the mappings and the history.

        Listings are paused rather than unmapped, so reconnecting does not mean
        re-pasting every URL. Credentials are cleared, because a disconnected
        connection holding live tokens is a credential nobody is watching.
        """
        record = self.connection(channel)
        if record is None:
            raise NotFoundError("That channel is not connected.")

        record.status = ConnectionStatus.DISCONNECTED
        record.credentials = None
        record.credentials_expires_at = None
        for listing in record.listings:
            if listing.deleted_at is None:
                listing.status = ListingStatus.PAUSED
                listing.next_attempt_at = None
        self.session.flush()

        activity.record(
            ActivityAction.DISCONNECTED,
            ActivityEntity.CHANNEL,
            entity_id=record.id,
            entity_label=channel.value,
            meta={"summary": f"{channel.value.title()} disconnected"},
        )
        return record

    # ------------------------------------------------------------------
    # listing mapping
    # ------------------------------------------------------------------
    def listings(self, *, channel: Channel | None = None) -> list[ChannelListing]:
        stmt = select(ChannelListing).where(ChannelListing.deleted_at.is_(None))
        if channel is not None:
            stmt = stmt.join(ChannelConnection).where(ChannelConnection.channel == channel)
        return list(self.session.scalars(stmt.order_by(ChannelListing.created_at)))

    def get_listing(self, listing_id: uuid.UUID) -> ChannelListing:
        listing: ChannelListing | None = self.session.scalars(
            select(ChannelListing).where(
                ChannelListing.id == listing_id, ChannelListing.deleted_at.is_(None)
            )
        ).one_or_none()
        if listing is None:
            raise NotFoundError("That mapping does not exist.")
        return listing

    def map_listing(
        self,
        *,
        channel: Channel,
        condo_id: uuid.UUID,
        import_url: str | None,
        external_listing_id: str | None = None,
        external_label: str | None = None,
    ) -> ChannelListing:
        """Point one channel listing at one condo.

        Brief §2's "one listing must not map to several units" is enforced here
        rather than by a UNIQUE index, over live rows only — see the note on
        :class:`~app.models.channel.ChannelListing`.
        """
        condo = self.session.get(Condo, condo_id)
        if condo is None or condo.deleted_at is not None:
            raise ValidationError(
                "That condo does not exist.",
                details={"fields": {"condo_id": ["Choose an existing condo."]}},
            )

        adapter = adapter_for(channel, timeout=self.settings.CHANNEL_FETCH_TIMEOUT_SEC)
        url = (import_url or "").strip() or None
        if url is not None:
            # Rejects a non-Airbnb host outright, which is the SSRF guard as
            # much as a typo guard. Raises PermanentChannelError; surface it as
            # a field error rather than a 500.
            try:
                from app.channels.airbnb import validate_import_url

                url = validate_import_url(url)
            except PermanentChannelError as exc:
                raise ValidationError(
                    str(exc), details={"fields": {"import_url": [str(exc)]}}
                ) from exc

        listing_id = (external_listing_id or "").strip()
        if not listing_id and url:
            from app.channels.airbnb import parse_listing_id

            listing_id = parse_listing_id(url) or ""
        if not listing_id:
            raise ValidationError(
                "A listing id is needed.",
                details={
                    "fields": {
                        "external_listing_id": [
                            "Paste the calendar URL, or type the listing id from it."
                        ]
                    }
                },
            )

        connection = self.connection(channel) or self.connect(channel)

        clash = self.session.scalars(
            select(ChannelListing).where(
                ChannelListing.connection_id == connection.id,
                ChannelListing.condo_id == condo_id,
                ChannelListing.deleted_at.is_(None),
            )
        ).first()
        if clash is not None:
            raise DuplicateError(f"{condo.name} is already mapped to a {channel.value} listing.")

        clash = self.session.scalars(
            select(ChannelListing).where(
                ChannelListing.connection_id == connection.id,
                ChannelListing.external_listing_id == listing_id,
                ChannelListing.deleted_at.is_(None),
            )
        ).first()
        if clash is not None:
            raise DuplicateError(
                f"Listing {listing_id} is already mapped to {clash.condo_ref.name}. "
                "Unmap it there first."
            )

        token = new_token()
        listing = ChannelListing(
            connection_id=connection.id,
            condo_id=condo_id,
            external_listing_id=listing_id,
            external_label=(external_label or "").strip() or None,
            import_url=url,
            export_token=token,
            export_token_hash=token_fingerprint(token),
            status=ListingStatus.ACTIVE,
            # Due immediately, so mapping is followed by a first sync without
            # waiting for the next scheduled tick.
            next_attempt_at=utcnow(),
        )
        self.session.add(listing)
        self.session.flush()

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.CHANNEL,
            entity_id=listing.id,
            entity_label=condo.name,
            meta={
                "summary": f"{condo.name} mapped to {channel.value} listing {listing_id}",
                "capabilities": sorted(c.value for c in adapter.capabilities),
            },
        )
        return listing

    def unmap_listing(self, listing_id: uuid.UUID) -> ChannelListing:
        """Stop syncing a unit, leaving its imported bookings in place.

        The bookings stay because they hold real nights that a cleaner may be
        rostered against; removing them silently would free dates the guest is
        still arriving for. They become ordinary manual blocks.
        """
        listing = self.get_listing(listing_id)
        label = listing.condo_ref.name
        listing.soft_delete()
        listing.status = ListingStatus.PAUSED
        listing.next_attempt_at = None
        # The token stops resolving the moment the row is soft-deleted; blanking
        # the hash means a re-map cannot collide on the unique index either.
        listing.export_token = None
        listing.export_token_hash = None
        self.session.flush()

        activity.record(
            ActivityAction.DELETED,
            ActivityEntity.CHANNEL,
            entity_id=listing.id,
            entity_label=label,
            meta={"summary": f"{label} unmapped · imported bookings kept as blocks"},
        )
        return listing

    # ------------------------------------------------------------------
    # inbound: channel -> us
    # ------------------------------------------------------------------
    def due_listings(
        self, *, now: datetime | None = None, limit: int = 200
    ) -> list[ChannelListing]:
        """Live, active listings whose next attempt has come round.

        Deliberately unscoped by organisation: the sync command runs across
        every tenant, and each listing is then processed inside its own scope.
        """
        moment = now or utcnow()
        stmt = (
            select(ChannelListing)
            .join(ChannelConnection)
            .where(
                ChannelListing.deleted_at.is_(None),
                ChannelListing.status == ListingStatus.ACTIVE,
                ChannelConnection.status == ConnectionStatus.CONNECTED,
                ChannelListing.next_attempt_at.is_not(None),
                ChannelListing.next_attempt_at <= moment,
            )
            .order_by(ChannelListing.next_attempt_at)
            .limit(limit)
            .execution_options(include_all_organisations=True)
        )
        return list(self.session.scalars(stmt))

    def sync_listing(self, listing: ChannelListing, *, now: datetime | None = None) -> SyncOutcome:
        """Pull the channel's picture of this listing and reconcile it.

        Always runs inside the listing's own organisation, whoever called it:
        the sync command has no session and therefore no ambient scope, and an
        unscoped write here would land another tenant's booking.
        """
        with scoped_to(listing.organisation_id):
            return self._sync_listing(listing, now=now)

    def _sync_listing(self, listing: ChannelListing, *, now: datetime | None) -> SyncOutcome:
        started = now or utcnow()
        channel = listing.connection.channel
        adapter = adapter_for(channel, timeout=self.settings.CHANNEL_FETCH_TIMEOUT_SEC)

        if not adapter.supports(ChannelCapability.RESERVATION_PULL):
            return self._finish(
                listing,
                SyncOutcome(SyncStatus.SKIPPED, message="This transport cannot read reservations."),
                started=started,
                sync_type=SyncType.RESERVATION,
                direction=SyncDirection.INBOUND,
            )

        try:
            url = listing.import_url
        except CredentialUnreadableError:
            return self._fail(
                listing,
                "The saved calendar URL could not be decrypted. Re-enter it.",
                permanent=True,
                started=started,
            )

        if not url:
            return self._finish(
                listing,
                SyncOutcome(SyncStatus.SKIPPED, message="No calendar URL is set for this listing."),
                started=started,
                sync_type=SyncType.RESERVATION,
                direction=SyncDirection.INBOUND,
            )

        try:
            remote = adapter.fetch_reservations(url)
        except PermanentChannelError as exc:
            return self._fail(listing, str(exc), permanent=True, started=started)
        except TransientChannelError as exc:
            return self._fail(listing, str(exc), permanent=False, started=started)

        outcome = self._reconcile(listing, remote, now=started)
        return self._finish(
            listing,
            outcome,
            started=started,
            sync_type=SyncType.RESERVATION,
            direction=SyncDirection.INBOUND,
        )

    def _reconcile(
        self, listing: ChannelListing, remote: list[ExternalReservation], *, now: datetime
    ) -> SyncOutcome:
        bookings = BookingService(self.session)
        known = {
            row.external_reservation_id: row
            for row in self.session.scalars(
                select(ChannelReservation).where(ChannelReservation.listing_id == listing.id)
            )
        }

        created = updated = cancelled = skipped = conflicts = 0
        seen: set[str] = set()

        for entry in remote:
            seen.add(entry.uid)
            fingerprint = entry.fingerprint()
            row = known.get(entry.uid)

            if row is None:
                booking, clash = self._create_booking(bookings, listing, entry)
                self.session.add(
                    ChannelReservation(
                        listing_id=listing.id,
                        booking_id=booking.id if booking else None,
                        external_reservation_id=entry.uid,
                        status=ChannelReservationStatus.ACTIVE,
                        check_in=entry.check_in,
                        check_out=entry.check_out,
                        summary=(entry.summary or "")[:255] or None,
                        guest_count=entry.guest_count,
                        payload_hash=fingerprint,
                        first_seen_at=now,
                        last_seen_at=now,
                    )
                )
                if clash:
                    conflicts += 1
                else:
                    created += 1
                continue

            row.last_seen_at = now
            unchanged = (
                row.payload_hash == fingerprint
                and row.status is ChannelReservationStatus.ACTIVE
                and row.booking_id is not None
            )
            if unchanged:
                skipped += 1
                continue

            changed, clash = self._apply_change(bookings, listing, row, entry)
            row.payload_hash = fingerprint
            row.check_in = entry.check_in
            row.check_out = entry.check_out
            row.summary = (entry.summary or "")[:255] or None
            row.status = ChannelReservationStatus.ACTIVE
            if clash:
                conflicts += 1
            elif changed:
                updated += 1
            else:
                skipped += 1

        # Anything the channel no longer lists has been cancelled there.
        for uid, row in known.items():
            if uid in seen or row.status is ChannelReservationStatus.CANCELLED:
                continue
            if row.booking_id is not None:
                booking = self.session.get(Booking, row.booking_id)
                if booking is not None and booking.deleted_at is None:
                    bookings.delete(booking.id)
            row.status = ChannelReservationStatus.CANCELLED
            row.booking_id = None
            row.last_seen_at = now
            cancelled += 1

        return SyncOutcome(
            status=SyncStatus.SUCCESS if (created or updated or cancelled) else SyncStatus.SKIPPED,
            created=created,
            updated=updated,
            cancelled=cancelled,
            skipped=skipped,
            conflicts=conflicts,
        )

    def _create_booking(
        self, bookings: BookingService, listing: ChannelListing, entry: ExternalReservation
    ) -> tuple[Booking | None, bool]:
        """Materialise one reservation, or report that our own booking holds it.

        Returns ``(booking, clashed)``. A clash is not an error: both calendars
        are internally consistent and a person has to decide which is right.

        The savepoint is load-bearing. ``BookingService.create`` flushes the
        booking row *before* claiming its nights, and the savepoint inside
        ``_claim_nights`` rolls back only the nights. An API caller never
        notices, because a conflict aborts the whole request — but this loop
        catches the error and carries on, so without a savepoint of its own the
        commit at the end of the sync would persist a phantom booking that
        holds no nights and shows up on the calendar anyway.
        """
        channel = listing.connection.channel
        transport = adapter_for(channel).transport
        try:
            with self.session.begin_nested():
                booking = bookings.create(
                    condo_id=listing.condo_id,
                    guest_name=_guest_label(channel, entry),
                    check_in=entry.check_in,
                    check_out=entry.check_out,
                    mode=PricingMode.NIGHTLY,
                    # Held, not sold: occupies the nights, contributes no revenue.
                    status=BookingStatus.MAINTENANCE,
                    night_rate=0,
                    notes=IMPORT_NOTE.format(
                        channel=channel.value.title(), transport=transport
                    )
                    + f"\nReference: {entry.uid}",
                )
        except BookingConflictError:
            return None, True
        except ValidationError:
            # Almost always the lease-end guard: the channel is selling nights
            # past the date our lease lets us sell. Real, and a person's call.
            return None, True
        return booking, False

    def _apply_change(
        self,
        bookings: BookingService,
        listing: ChannelListing,
        row: ChannelReservation,
        entry: ExternalReservation,
    ) -> tuple[bool, bool]:
        """Move an existing imported booking onto its new dates."""
        if row.booking_id is None:
            # Previously conflicted; try again now that dates have moved.
            booking, clash = self._create_booking(bookings, listing, entry)
            if booking is not None:
                row.booking_id = booking.id
            return booking is not None, clash

        booking = self.session.get(Booking, row.booking_id)
        if booking is None or booking.deleted_at is not None:
            booking, clash = self._create_booking(bookings, listing, entry)
            row.booking_id = booking.id if booking else None
            return booking is not None, clash

        if booking.check_in == entry.check_in and booking.check_out == entry.check_out:
            return False, False

        try:
            # Same reason as _create_booking: update mutates the booking in the
            # session before re-claiming its nights, so a conflict leaves it
            # dirty with the new dates. Without the savepoint the commit at the
            # end of the sync would write dates the nights do not back.
            with self.session.begin_nested():
                bookings.update(booking.id, check_in=entry.check_in, check_out=entry.check_out)
        except (BookingConflictError, ValidationError):
            return False, True
        return True, False

    # ------------------------------------------------------------------
    # outbound: us -> channel
    # ------------------------------------------------------------------
    def listing_by_token(self, token: str) -> ChannelListing | None:
        """Resolve a feed token. Unauthenticated callers reach this."""
        if not token:
            return None
        listing: ChannelListing | None = self.session.scalars(
            select(ChannelListing)
            .where(
                ChannelListing.export_token_hash == token_fingerprint(token),
                ChannelListing.deleted_at.is_(None),
            )
            # No session, so no ambient organisation — the lookup has to be able
            # to cross tenants to find the row at all. What keeps this safe is
            # that the token is 32 random bytes and everything read *after* this
            # happens inside the listing's own scope; see calendar_for_token.
            .execution_options(include_all_organisations=True)
        ).one_or_none()
        return listing

    def outbound_spans(
        self, listing: ChannelListing, *, today: date | None = None
    ) -> list[BlockedSpan]:
        """Our occupancy for this unit, as the channel should see it.

        Excludes anything imported from this same listing. Publishing a
        channel's own reservations back to it is at best noise and at worst
        reads as a conflicting double block.
        """
        start = today or utcnow().date()
        end = start + timedelta(days=self.settings.CHANNEL_FEED_HORIZON_DAYS)

        imported = select(ChannelReservation.booking_id).where(
            ChannelReservation.listing_id == listing.id,
            ChannelReservation.booking_id.is_not(None),
        )
        rows = self.session.scalars(
            select(Booking)
            .where(
                Booking.condo_id == listing.condo_id,
                Booking.deleted_at.is_(None),
                Booking.status.in_(OCCUPYING_STATUSES),
                Booking.check_out > start,
                Booking.check_in < end,
                Booking.id.not_in(imported),
            )
            .order_by(Booking.check_in)
        )
        return [
            BlockedSpan(
                uid=f"{booking.id}@localshouts-stays",
                check_in=booking.check_in,
                check_out=booking.check_out,
                # No guest name and no amount: this feed is served without
                # authentication, so it discloses occupancy and nothing else.
                label="Not available",
            )
            for booking in rows
        ]

    def calendar_for_token(self, token: str) -> tuple[ChannelListing, str] | None:
        """The published .ics for a feed token, or None if it resolves to nothing.

        The scope switch below is load-bearing. ``_apply_organisation_scope``
        filters on the ambient organisation, and an unauthenticated request has
        none — which means *no filtering at all*, not "deny". Without this
        block the booking query would happily read every tenant's calendar.
        """
        listing = self.listing_by_token(token)
        if listing is None:
            return None

        with scoped_to(listing.organisation_id):
            adapter = adapter_for(listing.connection.channel)
            spans = self.outbound_spans(listing)
            label = f"{listing.condo_ref.code} · {listing.condo_ref.name}"
            return listing, adapter.render_availability(spans, label=label)

    # ------------------------------------------------------------------
    # logging and retry bookkeeping
    # ------------------------------------------------------------------
    def _fail(
        self, listing: ChannelListing, message: str, *, permanent: bool, started: datetime
    ) -> SyncOutcome:
        listing.consecutive_failures += 1
        listing.last_error = message
        if permanent:
            # Retrying something that will never succeed is how an integration
            # gets an account rate-limited. Stop, and ask for a human.
            listing.status = ListingStatus.ERROR
            listing.next_attempt_at = None
            listing.connection.status = ConnectionStatus.ERROR
            listing.connection.last_error = message
        else:
            listing.next_attempt_at = next_attempt_after(listing.consecutive_failures, now=started)

        return self._finish(
            listing,
            SyncOutcome(SyncStatus.FAILED, message=message),
            started=started,
            sync_type=SyncType.RESERVATION,
            direction=SyncDirection.INBOUND,
            reset_failures=False,
        )

    def _finish(
        self,
        listing: ChannelListing,
        outcome: SyncOutcome,
        *,
        started: datetime,
        sync_type: SyncType,
        direction: SyncDirection,
        reset_failures: bool = True,
    ) -> SyncOutcome:
        finished = utcnow()
        listing.last_synced_at = finished

        if reset_failures:
            listing.consecutive_failures = 0
            listing.last_error = None
            listing.last_success_at = finished
            listing.next_attempt_at = finished + timedelta(
                minutes=self.settings.CHANNEL_SYNC_INTERVAL_MINUTES
            )
            if listing.status is ListingStatus.ERROR:
                listing.status = ListingStatus.ACTIVE
            if listing.connection.status is ConnectionStatus.ERROR:
                listing.connection.status = ConnectionStatus.CONNECTED
                listing.connection.last_error = None

        self.session.add(
            ChannelSyncLog(
                organisation_id=listing.organisation_id,
                connection_id=listing.connection_id,
                listing_id=listing.id,
                condo_label=listing.condo_ref.name if listing.condo_ref else None,
                sync_type=sync_type,
                direction=direction,
                status=outcome.status,
                message=outcome.summary(),
                reference=listing.external_listing_id,
                retry_count=listing.consecutive_failures,
                items_created=outcome.created,
                items_updated=outcome.updated,
                items_cancelled=outcome.cancelled,
                items_skipped=outcome.skipped,
                started_at=started,
                finished_at=finished,
                duration_ms=max(int((finished - started).total_seconds() * 1000), 0),
            )
        )

        # One activity row per *interesting* run. A quiet poll every ten
        # minutes writing "nothing happened" would bury the rest of the feed.
        if outcome.changed or outcome.conflicts or outcome.status is SyncStatus.FAILED:
            activity.record(
                ActivityAction.SYNCED,
                ActivityEntity.CHANNEL,
                entity_id=listing.id,
                entity_label=listing.condo_ref.name if listing.condo_ref else None,
                meta={
                    "summary": (
                        f"{listing.connection.channel.value.title()} · "
                        f"{listing.condo_ref.name if listing.condo_ref else 'listing'} · "
                        f"{outcome.summary()}"
                    ),
                    "status": outcome.status.value,
                },
                organisation_id=listing.organisation_id,
            )
        return outcome

    def logs(
        self, *, listing_id: uuid.UUID | None = None, limit: int = 50
    ) -> list[ChannelSyncLog]:
        stmt = select(ChannelSyncLog).order_by(ChannelSyncLog.created_at.desc()).limit(limit)
        if listing_id is not None:
            stmt = stmt.where(ChannelSyncLog.listing_id == listing_id)
        return list(self.session.scalars(stmt))


def _guest_label(channel: Channel, entry: ExternalReservation) -> str:
    """What to show on the calendar for a stay we know nothing about.

    Names the channel first, so a glance at the booking list says where the
    night came from. Truncated to the column width rather than risking a
    database-side error on a long summary.
    """
    if entry.guest_name:
        return f"{channel.value.title()} · {entry.guest_name}"[:160]
    descriptor = (entry.summary or "").strip() or ("Blocked" if entry.is_block else "Reserved")
    return f"{channel.value.title()} · {descriptor}"[:160]
