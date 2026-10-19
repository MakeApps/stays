"""Organisations: creating them, and who belongs to which.

The tenant boundary itself is enforced a layer down, by the query filter in
``models.base``. What lives here is everything that has to reach *across* it —
listing the organisations an account can act in, adding somebody to one, and
creating a new one — which is exactly why these are the only queries in the
application that are allowed to run unscoped.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common import activity
from app.common.errors import NotFoundError, ValidationError
from app.common.money import CURRENCIES, DEFAULT_CURRENCY, currency_for, is_supported
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.organisation import Organisation, OrganisationMember
from app.models.user import Role, User
from app.seeds.lookups import seed_lookups

MIN_NAME_LENGTH = 2
MAX_NAME_LENGTH = 160


class OrganisationService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- reads ----------
    def get(self, organisation_id: uuid.UUID) -> Organisation:
        org = self.session.get(Organisation, organisation_id)
        if org is None or org.deleted_at is not None:
            raise NotFoundError("That organisation does not exist.")
        return org

    def membership(
        self, organisation_id: uuid.UUID, user_id: uuid.UUID
    ) -> OrganisationMember | None:
        return self.session.scalar(
            select(OrganisationMember).where(
                OrganisationMember.organisation_id == organisation_id,
                OrganisationMember.user_id == user_id,
                OrganisationMember.deleted_at.is_(None),
            )
        )

    def members(self, organisation_id: uuid.UUID) -> list[OrganisationMember]:
        return list(
            self.session.scalars(
                select(OrganisationMember).where(
                    OrganisationMember.organisation_id == organisation_id,
                    OrganisationMember.deleted_at.is_(None),
                )
            )
        )

    def live_admins(self, organisation_id: uuid.UUID, *, exclude_user: uuid.UUID | None = None):
        """Admins of one organisation whose accounts are still usable.

        Per organisation, because "the last administrator" is a question about
        one tenant. Counting globally would let the last admin of one portfolio
        be removed because a different portfolio still has one.
        """
        stmt = (
            select(OrganisationMember)
            .join(User, User.id == OrganisationMember.user_id)
            .where(
                OrganisationMember.organisation_id == organisation_id,
                OrganisationMember.role == Role.ADMIN,
                OrganisationMember.deleted_at.is_(None),
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
        if exclude_user is not None:
            stmt = stmt.where(OrganisationMember.user_id != exclude_user)
        return list(self.session.scalars(stmt))

    # ---------- writes ----------
    def create(
        self, *, name: str, owner: User, currency: str | None = None
    ) -> Organisation:
        """Stand up a new organisation with its creator as its admin.

        Seeded with its own categories and payment methods, so the expense form
        works on the very first visit rather than presenting empty pickers.

        The currency is settled here rather than left to the default because
        it is far cheaper to choose it before the first rate is typed than to
        relabel a portfolio after: nothing converts amounts, so a condo priced
        in rupees under a baht sign is a figure that is simply wrong.
        """
        cleaned = self._clean_name(name)
        code = self._clean_currency(currency) if currency else DEFAULT_CURRENCY

        organisation = Organisation(name=cleaned, is_active=True, currency=code)
        self.session.add(organisation)
        # Flushed before anything references it: the membership and the seeded
        # lookups both need a real id.
        self.session.flush()

        self.session.add(
            OrganisationMember(
                organisation_id=organisation.id, user_id=owner.id, role=Role.ADMIN
            )
        )
        seed_lookups(organisation.id, commit=False)

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.ORGANISATION,
            entity_id=organisation.id,
            entity_label=organisation.name,
            actor_id=owner.id,
            actor_name=owner.full_name,
            organisation_id=organisation.id,
            meta={"summary": f"{organisation.name} created"},
        )
        return organisation

    def rename(self, organisation: Organisation, name: str) -> Organisation:
        cleaned = self._clean_name(name)
        if cleaned != organisation.name:
            organisation.name = cleaned
            activity.record(
                ActivityAction.UPDATED,
                ActivityEntity.ORGANISATION,
                entity_id=organisation.id,
                entity_label=cleaned,
                meta={"summary": f"Renamed to {cleaned}"},
            )
        return organisation

    def set_currency(self, organisation: Organisation, code: str) -> Organisation:
        """Change the currency the books are kept in.

        A relabel, not a conversion. Every stored amount stays exactly as it
        is and only the symbol in front of it changes, so this is the right
        call for "we set this up in baht by mistake" and the wrong one for
        "we moved the business to India" — that is a new organisation.

        Summaries already written to the activity feed keep the symbol they
        were written with. They are a record of what was said at the time,
        and rewriting history to match a setting is what makes a feed
        untrustworthy.
        """
        cleaned = self._clean_currency(code)
        if cleaned != organisation.currency:
            organisation.currency = cleaned
            chosen = currency_for(cleaned)
            activity.record(
                ActivityAction.UPDATED,
                ActivityEntity.ORGANISATION,
                entity_id=organisation.id,
                entity_label=organisation.name,
                meta={"summary": f"Currency set to {chosen.name} ({chosen.symbol})"},
            )
        return organisation

    def add_member(
        self, organisation_id: uuid.UUID, user: User, *, role: Role = Role.MANAGER
    ) -> OrganisationMember:
        """Idempotent: adding an existing member returns the membership."""
        existing = self.membership(organisation_id, user.id)
        if existing is not None:
            return existing

        member = OrganisationMember(
            organisation_id=organisation_id, user_id=user.id, role=role
        )
        self.session.add(member)
        self.session.flush()
        return member

    def remove_member(self, member: OrganisationMember) -> None:
        member.soft_delete()

    # ---------- guards ----------
    def _clean_name(self, name: str) -> str:
        cleaned = name.strip()
        if len(cleaned) < MIN_NAME_LENGTH:
            raise ValidationError(
                "Give the organisation a name.",
                details={"fields": {"name": [f"At least {MIN_NAME_LENGTH} characters."]}},
            )
        if len(cleaned) > MAX_NAME_LENGTH:
            raise ValidationError(
                "That name is too long.",
                details={"fields": {"name": [f"At most {MAX_NAME_LENGTH} characters."]}},
            )
        return cleaned

    def _clean_currency(self, code: str) -> str:
        cleaned = code.strip().upper()
        if not is_supported(cleaned):
            raise ValidationError(
                "That currency is not supported.",
                details={
                    "fields": {"currency": [f"Choose one of {', '.join(CURRENCIES)}."]}
                },
            )
        return cleaned
