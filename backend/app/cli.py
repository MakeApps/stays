"""Flask CLI commands."""

from __future__ import annotations

import secrets
from contextlib import suppress

import click
from flask import Flask
from sqlalchemy import select

from app.auth.service import AuthService
from app.common.current_user import acting_as
from app.extensions import db
from app.models.user import Role, User


def register_cli(app: Flask) -> None:
    @app.cli.command("create-admin")
    @click.option("--email", default=None, help="Defaults to ADMIN_EMAIL from the environment.")
    @click.option(
        "--password", default=None, help="Defaults to ADMIN_PASSWORD; generated if unset."
    )
    @click.option("--name", default=None, help="Defaults to ADMIN_NAME.")
    def create_admin(email: str | None, password: str | None, name: str | None) -> None:
        """Create or update the bootstrap Admin. There is no public signup."""
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
            existing.role = Role.ADMIN
            existing.is_active = True
            existing.deleted_at = None
            db.session.commit()
            click.echo(f"Updated existing admin {email}")
        else:
            service = AuthService(s)
            user = service.create_user(
                email=email, password=password, full_name=name, role=Role.ADMIN
            )
            db.session.flush()
            # Attribute the row to itself rather than leaving created_by null.
            with acting_as(user.id):
                user.created_by = user.id
                user.updated_by = user.id
            db.session.commit()
            click.echo(f"Created admin {email}")

        if generated:
            click.echo("")
            click.secho(f"  Generated password: {password}", fg="yellow", bold=True)
            click.echo("  Store it now — it is not recoverable.")
            click.echo("")

    @app.cli.command("seed-lookups")
    def seed_lookups_cmd() -> None:
        """Load the design's expense categories and payment methods."""
        from app.seeds.lookups import seed_lookups

        categories, methods = seed_lookups()
        click.echo(f"Seeded {categories} categories and {methods} payment methods.")

    @app.cli.command("seed-demo")
    @click.option("--force", is_flag=True, help="Seed even if condos already exist.")
    def seed_demo(force: bool) -> None:
        """Load the nine condos from the approved design."""
        from app.seeds.demo import seed_condos
        from app.seeds.demo_activity import seed_activity
        from app.seeds.lookups import seed_lookups

        seed_lookups()
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
    def reset_data(yes: bool) -> None:
        """Delete all condos, bookings, expenses and activity.

        Keeps user accounts and the expense category / payment method lookups.
        Those are not demo data: the lookups are reference data the expense form
        depends on, and deleting the users would lock you out of the app.
        """
        from sqlalchemy import func, select

        from app.models.activity_log import ActivityLog
        from app.models.booking import Booking, BookingNight
        from app.models.condo import Condo, CondoImage
        from app.models.expense import Expense

        counts = {
            "condos": db.session.scalar(select(func.count()).select_from(Condo)) or 0,
            "bookings": db.session.scalar(select(func.count()).select_from(Booking)) or 0,
            "expenses": db.session.scalar(select(func.count()).select_from(Expense)) or 0,
        }
        settings = app.config["SETTINGS"]
        local_root = settings.STORAGE_LOCAL_DIR
        stray_files = (
            sum(1 for p in local_root.rglob("*") if p.is_file())
            if settings.STORAGE_BACKEND == "local" and local_root.exists()
            else 0
        )

        # Files are counted separately: rows removed outside the app leave
        # orphans behind, and "the database is empty" must not mean "there is
        # nothing to clean up".
        if not any(counts.values()) and not stray_files:
            click.echo("Nothing to remove - already clean.")
            return

        parts = [f"{n} {label}" for label, n in counts.items() if n]
        if stray_files:
            parts.append(f"{stray_files} uploaded files")
        summary = ", ".join(parts) or "nothing"
        if not yes and not click.confirm(f"Permanently delete {summary}?"):
            click.echo("Cancelled.")
            return

        storage = app.extensions["storage"]
        keys = [
            k
            for k in (
                *db.session.scalars(select(CondoImage.storage_key)),
                *db.session.scalars(
                    select(Expense.receipt_key).where(Expense.receipt_key.isnot(None))
                ),
            )
            if k
        ]

        # Children first: booking_nights and images have FKs into what follows.
        db.session.query(BookingNight).delete()
        db.session.query(Booking).delete()
        db.session.query(Expense).delete()
        db.session.query(CondoImage).delete()
        db.session.query(Condo).delete()
        db.session.query(ActivityLog).delete()
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

        # After this command nothing in the database can reference a stored
        # file, so anything left on disk is an orphan - typically from rows
        # removed outside the app. Sweeping is only safe *because* every
        # referencing row has just been deleted.
        if settings.STORAGE_BACKEND == "local" and local_root.exists():
            for path in sorted(local_root.rglob("*"), reverse=True):
                if path.is_file():
                    with suppress(OSError):
                        path.unlink()
                        removed_files += 1
                elif path.is_dir():
                    with suppress(OSError):
                        path.rmdir()

        click.echo(f"Removed {summary}.")
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
