"""Flask CLI commands."""

from __future__ import annotations

import secrets
from contextlib import suppress

import click
from flask import Flask
from sqlalchemy import select

from app.auth.service import AuthService
from app.common.current_org import scoped_to
from app.common.current_user import acting_as
from app.extensions import db
from app.models.organisation import Organisation
from app.models.user import Role, User


def _ensure_organisation(user: User, default_name: str) -> Organisation:
    """Make sure the bootstrap admin is an admin of something.

    Joins the first existing organisation rather than making a second one:
    running create-admin twice on a live system should not quietly split it
    into two tenants.
    """
    from app.models.organisation import OrganisationMember
    from app.services.organisation_service import OrganisationService

    service = OrganisationService(db.session)
    organisation = db.session.scalars(
        select(Organisation)
        .where(Organisation.deleted_at.is_(None))
        .order_by(Organisation.created_at)
    ).first()

    if organisation is None:
        with acting_as(user.id):
            organisation = service.create(name=default_name, owner=user)
        return organisation

    member = service.membership(organisation.id, user.id)
    if member is None:
        db.session.add(
            OrganisationMember(
                organisation_id=organisation.id, user_id=user.id, role=Role.ADMIN
            )
        )
        db.session.flush()
    elif member.role is not Role.ADMIN:
        member.role = Role.ADMIN
    return organisation


def _resolve_organisation(name: str | None = None) -> Organisation:
    """Which organisation a CLI command acts on.

    The commands below all write tenant-owned rows, and the CLI has no session
    to infer one from. Named explicitly with --org, otherwise the only
    organisation there is; ambiguity is refused rather than guessed, because
    seeding demo data into the wrong customer's account is not recoverable by
    editing a row.
    """
    stmt = select(Organisation).where(Organisation.deleted_at.is_(None))
    if name:
        stmt = stmt.where(Organisation.name == name)
    organisations = list(db.session.scalars(stmt.order_by(Organisation.created_at)))

    if not organisations:
        raise click.ClickException(
            f"No organisation named {name!r}."
            if name
            else "No organisation exists. Run create-admin first."
        )
    if len(organisations) > 1 and not name:
        names = ", ".join(o.name for o in organisations)
        raise click.ClickException(f"Several organisations exist; pass --org. Found: {names}")
    return organisations[0]


def register_cli(app: Flask) -> None:
    @app.cli.command("create-admin")
    @click.option("--email", default=None, help="Defaults to ADMIN_EMAIL from the environment.")
    @click.option(
        "--password", default=None, help="Defaults to ADMIN_PASSWORD; generated if unset."
    )
    @click.option("--name", default=None, help="Defaults to ADMIN_NAME.")
    def create_admin(email: str | None, password: str | None, name: str | None) -> None:
        """Create or update the bootstrap Admin. There is no public signup.

        Also ensures there is an organisation for them to be an admin *of*:
        without a membership the account can authenticate and then has nowhere
        to go, which is a confusing way to bootstrap an empty system.
        """
        s = app.config["SETTINGS"]
        email = (email or s.ADMIN_EMAIL).strip().lower()
        name = name or s.ADMIN_NAME
        generated = False

        if not password:
            password = s.ADMIN_PASSWORD
        if not password:
            password = secrets.token_urlsafe(16)
            generated = True

        existing = db.session.scalar(select(User).where(User.email == email))
        if existing is not None:
            from app.extensions import password_hasher

            existing.password_hash = password_hasher.hash(password)
            existing.full_name = name
            existing.is_active = True
            existing.deleted_at = None
            user = existing
            click.echo(f"Updated existing admin {email}")
        else:
            service = AuthService(s)
            user = service.create_user(email=email, password=password, full_name=name)
            db.session.flush()
            # Attribute the row to itself rather than leaving created_by null.
            with acting_as(user.id):
                user.created_by = user.id
                user.updated_by = user.id
            click.echo(f"Created admin {email}")

        organisation = _ensure_organisation(user, s.DEFAULT_ORGANISATION_NAME)
        db.session.commit()
        click.echo(f"Admin of organisation: {organisation.name}")

        if generated:
            click.echo("")
            click.secho(f"  Generated password: {password}", fg="yellow", bold=True)
            click.echo("  Store it now — it is not recoverable.")
            click.echo("")

    @app.cli.command("seed-lookups")
    @click.option("--org", default=None, help="Organisation name; required if there are several.")
    def seed_lookups_cmd(org: str | None) -> None:
        """Load the design's expense categories and payment methods."""
        from app.seeds.lookups import seed_lookups

        organisation = _resolve_organisation(org)
        categories, methods = seed_lookups(organisation.id)
        click.echo(
            f"Seeded {categories} categories and {methods} payment methods "
            f"into {organisation.name}."
        )

    @app.cli.command("seed-demo")
    @click.option("--force", is_flag=True, help="Seed even if condos already exist.")
    @click.option("--org", default=None, help="Organisation name; required if there are several.")
    def seed_demo(force: bool, org: str | None) -> None:
        """Load the nine condos from the approved design."""
        from app.seeds.demo import seed_condos
        from app.seeds.demo_activity import seed_activity
        from app.seeds.lookups import seed_lookups

        organisation = _resolve_organisation(org)
        click.echo(f"Seeding into {organisation.name}.")
        seed_lookups(organisation.id)

        with scoped_to(organisation.id):
            created = seed_condos(force=force)
            if created < 0:
                click.echo("Condos already present — pass --force to seed anyway.")
            else:
                click.echo(f"Seeded {created} condos.")

            bookings, expenses = seed_activity(force=force)
            if bookings < 0:
                click.echo("Bookings/expenses already present — pass --force to seed anyway.")
            else:
                click.echo(f"Seeded {bookings} bookings and {expenses} expenses.")

    @app.cli.command("reset-data")
    @click.option("--yes", is_flag=True, help="Skip the confirmation prompt.")
    @click.option("--org", default=None, help="Organisation name; required if there are several.")
    def reset_data(yes: bool, org: str | None) -> None:
        """Delete all condos, bookings, expenses and activity.

        Keeps user accounts and the expense category / payment method lookups.
        Those are not demo data: the lookups are reference data the expense form
        depends on, and deleting the users would lock you out of the app.

        Confined to one organisation. The read filter does not apply to bulk
        deletes, so every statement below names the organisation explicitly --
        without that this command would empty every tenant on the box.
        """
        from sqlalchemy import func, select

        from app.models.activity_log import ActivityLog
        from app.models.booking import Booking, BookingNight
        from app.models.condo import Condo, CondoImage
        from app.models.expense import Expense

        organisation = _resolve_organisation(org)
        with scoped_to(organisation.id):
            counts = {
                "condos": db.session.scalar(select(func.count()).select_from(Condo)) or 0,
                "bookings": db.session.scalar(select(func.count()).select_from(Booking)) or 0,
                "expenses": db.session.scalar(select(func.count()).select_from(Expense)) or 0,
            }
        storage = app.extensions["storage"]
        org_bookings = select(Booking.id).where(Booking.organisation_id == organisation.id)
        org_condos = select(Condo.id).where(Condo.organisation_id == organisation.id)

        # CondoImage has no organisation of its own, so it is reached through
        # the condo that does. Collecting keys unfiltered would have queued
        # another tenant's photos for deletion from disk.
        keys = [
            k
            for k in (
                *db.session.scalars(
                    select(CondoImage.storage_key).where(CondoImage.condo_id.in_(org_condos))
                ),
                *db.session.scalars(
                    select(Expense.receipt_key).where(
                        Expense.receipt_key.isnot(None),
                        Expense.organisation_id == organisation.id,
                    )
                ),
            )
            if k
        ]

        # Counted from the rows that reference them rather than from the
        # directory: the storage directory is shared between organisations, so
        # what is on disk says nothing about what belongs to this one.
        if not any(counts.values()) and not keys:
            click.echo("Nothing to remove - already clean.")
            return

        parts = [f"{n} {label}" for label, n in counts.items() if n]
        if keys:
            parts.append(f"{len(keys)} uploaded files")
        summary = ", ".join(parts) or "nothing"
        if not yes and not click.confirm(f"Permanently delete {summary}?"):
            click.echo("Cancelled.")
            return

        # Children first: booking_nights and images have FKs into what follows.
        db.session.query(BookingNight).filter(
            BookingNight.booking_id.in_(org_bookings)
        ).delete(synchronize_session=False)
        db.session.query(Booking).filter(
            Booking.organisation_id == organisation.id
        ).delete(synchronize_session=False)
        db.session.query(Expense).filter(
            Expense.organisation_id == organisation.id
        ).delete(synchronize_session=False)
        db.session.query(CondoImage).filter(
            CondoImage.condo_id.in_(org_condos)
        ).delete(synchronize_session=False)
        db.session.query(Condo).filter(
            Condo.organisation_id == organisation.id
        ).delete(synchronize_session=False)
        db.session.query(ActivityLog).filter(
            ActivityLog.organisation_id == organisation.id
        ).delete(synchronize_session=False)
        db.session.commit()

        # Only after the rows are gone: an orphaned file costs pennies, a
        # missing one breaks a page that still references it.
        removed_files = 0
        for key in keys:
            with suppress(Exception):
                # A file that is already gone is not a failure; the row it
                # belonged to has been deleted either way.
                storage.delete(key)
                removed_files += 1

        # The blanket sweep of the storage directory that used to live here is
        # gone. It was safe when there was one tenant and "anything left on
        # disk is an orphan" was true; with several organisations sharing the
        # directory it would delete another customer's photos. Files are keyed,
        # not foldered, per organisation, so an orphan left by a row removed
        # outside the app now has to be cleaned up deliberately.

        click.echo(f"Removed {summary} from {organisation.name}.")
        click.echo("Kept: user accounts, expense categories, payment methods.")

    @app.cli.command("purge-tokens")
    def purge_tokens() -> None:
        """Delete expired refresh tokens."""
        removed = AuthService(app.config["SETTINGS"]).purge_expired()
        db.session.commit()
        click.echo(f"Removed {removed} expired refresh tokens.")

    @app.cli.command("lease-check")
    def lease_check() -> None:
        """Log a "Lease expired" entry for any lease that has lapsed.

        Expiry is a date passing, not a user action, so nothing in a request
        can notice it. The status itself is derived and always current on every
        screen; this only writes the *audit* entry, and needs a scheduler to
        run it — a daily cron or Task Scheduler job.

        Safe to run repeatedly: it skips condos already logged as expired, so a
        missed day catches up rather than double-logging.
        """
        from datetime import date

        from app.common import activity
        from app.models.activity_log import ActivityAction, ActivityEntity, ActivityLog
        from app.models.condo import Condo

        today = date.today()
        already = set(
            db.session.scalars(
                select(ActivityLog.entity_id).where(
                    ActivityLog.entity_type == ActivityEntity.LEASE,
                    ActivityLog.action == ActivityAction.EXPIRED,
                )
            )
        )
        lapsed = db.session.scalars(
            select(Condo).where(
                Condo.deleted_at.is_(None),
                Condo.lease_end_date.is_not(None),
                Condo.lease_end_date < today,
            )
        )

        logged = 0
        for condo in lapsed:
            if condo.id in already:
                continue
            end = condo.lease_end_date
            activity.record(
                ActivityAction.EXPIRED,
                ActivityEntity.LEASE,
                entity_id=condo.id,
                entity_label=condo.name,
                meta={
                    "summary": (
                        f"{condo.name}'s lease ended on "
                        f"{end.strftime('%d %b %Y') if end else 'an unknown date'}"
                    ),
                    "lease_end_date": end,
                },
            )
            logged += 1

        db.session.commit()
        # Nothing is deleted or cancelled: an expired lease with guests still
        # in the unit is a decision for a person, not a cleanup job.
        click.echo(f"Logged {logged} newly expired lease(s).")

    @app.cli.command("routes-audit")
    def routes_audit() -> None:
        """List every route and the capability it declares."""
        from app.auth.decorators import describe_route

        rows: list[tuple[str, str, str]] = []
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: str(r)):
            view = app.view_functions[rule.endpoint]
            methods = ",".join(sorted((rule.methods or set()) - {"HEAD", "OPTIONS"}))
            rows.append((methods, str(rule), describe_route(view) or "MISSING"))

        width = max(len(r[1]) for r in rows) if rows else 10
        for methods, path, capability in rows:
            colour = "red" if capability == "MISSING" else None
            click.secho(f"{methods:<8} {path:<{width}}  {capability}", fg=colour)
