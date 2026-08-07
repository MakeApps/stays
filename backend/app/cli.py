"""Flask CLI commands."""

from __future__ import annotations

import secrets

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

    @app.cli.command("purge-tokens")
    def purge_tokens() -> None:
        """Delete expired refresh tokens."""
        removed = AuthService(app.config["SETTINGS"]).purge_expired()
        db.session.commit()
        click.echo(f"Removed {removed} expired refresh tokens.")

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
