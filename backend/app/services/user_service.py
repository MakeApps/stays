"""User accounts, as seen from inside one organisation.

Only an admin reaches any of this. Accounts created here get
:attr:`Role.MANAGER` — everything except administering other accounts — and
the role is never chosen in the UI, because the product does not expose roles
yet. Keeping it in the matrix rather than granting everything means the day
roles do appear, this is a matrix edit rather than a retrofit.

An account is global but its *membership* is not, and every read here is a
question about the current organisation: who works here, is this address one of
ours, is this the last admin left. Removing someone therefore revokes their
membership rather than deleting the account — they may well work for a second
organisation that has nothing to do with this one.

The guards below all protect one thing: an admin cannot remove their own way
back in. Every other mistake here is recoverable by editing a row; locking
the last administrator out of a running system is not.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.common import activity
from app.common.current_org import get_current_org_id
from app.common.errors import DuplicateError, NotFoundError, ValidationError
from app.extensions import password_hasher
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.base import utcnow
from app.models.organisation import OrganisationMember
from app.models.user import RefreshToken, Role, User

#: Short enough not to be annoying, long enough to survive a guess. The
#: production boot guard applies a stricter rule to the seeded admin.
MIN_PASSWORD_LENGTH = 8


def normalise_email(value: str) -> str:
    return value.strip().lower()


class UserService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- reads ----------
    @property
    def organisation_id(self) -> uuid.UUID:
        """The organisation these questions are being asked about.

        ``users`` is deliberately not organisation-scoped -- an account is one
        person across every tenant they work for -- so the filter that the rest
        of the schema gets for free has to be joined in by hand here.
        """
        org_id = get_current_org_id()
        if org_id is None:  # pragma: no cover - require_auth sets this
            raise RuntimeError("User administration needs an organisation in scope.")
        return org_id

    def base_query(self) -> Select[tuple[User]]:
        """Members of the current organisation, and nobody else."""
        return (
            select(User)
            .join(OrganisationMember, OrganisationMember.user_id == User.id)
            .where(
                User.deleted_at.is_(None),
                OrganisationMember.organisation_id == self.organisation_id,
                OrganisationMember.deleted_at.is_(None),
            )
        )

    def search(self, q: str | None = None) -> Select[tuple[User]]:
        stmt = self.base_query()
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(User.full_name.like(like) | User.email.like(like))
        return stmt.order_by(User.full_name)

    def get(self, user_id: uuid.UUID) -> User:
        user = self.session.scalars(
            self.base_query().where(User.id == user_id)
        ).one_or_none()
        if user is None:
            raise NotFoundError("That user does not exist.")
        return user

    def find_by_email(self, email: str) -> User | None:
        """Any live account with this address, in any organisation.

        Global on purpose: the address is the login identity, so it has to be
        unique across the system even though membership is not.
        """
        return self.session.scalars(
            select(User).where(
                User.email == normalise_email(email), User.deleted_at.is_(None)
            )
        ).first()

    def email_taken(self, email: str, *, exclude_id: uuid.UUID | None = None) -> bool:
        """Among live rows only, across every organisation.

        A hard UNIQUE would burn an address permanently once its owner is
        removed, which is the wrong trade for a team of a dozen people.
        """
        user = self.find_by_email(email)
        if user is None:
            return False
        return exclude_id is None or user.id != exclude_id

    def is_member(self, user_id: uuid.UUID) -> bool:
        return self.membership(user_id) is not None

    def membership(self, user_id: uuid.UUID) -> OrganisationMember | None:
        return self.session.scalars(
            select(OrganisationMember).where(
                OrganisationMember.organisation_id == self.organisation_id,
                OrganisationMember.user_id == user_id,
                OrganisationMember.deleted_at.is_(None),
            )
        ).first()

    def memberships(self) -> list[OrganisationMember]:
        """Every live membership in this organisation, for bulk role lookups."""
        return list(
            self.session.scalars(
                select(OrganisationMember).where(
                    OrganisationMember.organisation_id == self.organisation_id,
                    OrganisationMember.deleted_at.is_(None),
                )
            )
        )

    def role_of(self, user_id: uuid.UUID) -> Role | None:
        member = self.membership(user_id)
        return member.role if member is not None else None

    def _live_admins(self, *, exclude_id: uuid.UUID | None = None) -> int:
        """Admins of *this* organisation whose accounts still work.

        Counting globally would let the last admin of one portfolio be removed
        because an unrelated one still has theirs.
        """
        stmt = (
            select(func.count())
            .select_from(OrganisationMember)
            .join(User, User.id == OrganisationMember.user_id)
            .where(
                OrganisationMember.organisation_id == self.organisation_id,
                OrganisationMember.role == Role.ADMIN,
                OrganisationMember.deleted_at.is_(None),
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
        if exclude_id is not None:
            stmt = stmt.where(OrganisationMember.user_id != exclude_id)
        return int(self.session.scalar(stmt) or 0)

    # ---------- writes ----------
    def create(self, *, email: str, full_name: str, password: str) -> User:
        """Add somebody to this organisation, creating the account if needed.

        An address that already has an account elsewhere is *invited* rather
        than rejected: the same person legitimately works for two
        organisations, and refusing would make that impossible while telling
        them nothing useful. Their existing password stands untouched — this
        must not become a way to overwrite the credentials of an account you do
        not control.
        """
        address = normalise_email(email)
        existing = self.find_by_email(address)

        if existing is not None:
            if self.is_member(existing.id):
                raise DuplicateError(
                    "They are already in this organisation.",
                    details={"fields": {"email": ["Already a member here."]}},
                )
            self.session.add(
                OrganisationMember(
                    organisation_id=self.organisation_id,
                    user_id=existing.id,
                    role=Role.MANAGER,
                )
            )
            self.session.flush()
            activity.record(
                ActivityAction.CREATED,
                ActivityEntity.USER,
                entity_id=existing.id,
                entity_label=existing.full_name,
                meta={
                    "summary": f"{existing.full_name} joined",
                    "existing_account": True,
                },
            )
            return existing

        self._assert_password_ok(password)
        user = User(
            email=address,
            full_name=full_name.strip(),
            password_hash=password_hasher.hash(password),
            is_active=True,
        )
        self.session.add(user)
        self.session.flush()
        self.session.add(
            OrganisationMember(
                organisation_id=self.organisation_id, user_id=user.id, role=Role.MANAGER
            )
        )
        self.session.flush()

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.USER,
            entity_id=user.id,
            entity_label=user.full_name,
            # The password is never logged, not even its length.
            meta={"summary": f"{user.full_name} · {user.email}"},
        )
        return user

    def update(
        self,
        user_id: uuid.UUID,
        *,
        actor_id: uuid.UUID | None,
        full_name: str | None = None,
        email: str | None = None,
        password: str | None = None,
        is_active: bool | None = None,
    ) -> User:
        user = self.get(user_id)
        changed: list[str] = []

        if full_name is not None and full_name.strip() != user.full_name:
            user.full_name = full_name.strip()
            changed.append("name")

        if email is not None:
            address = normalise_email(email)
            if address != user.email:
                if self.email_taken(address, exclude_id=user.id):
                    raise DuplicateError(
                        "Someone already uses that email address.",
                        details={"fields": {"email": ["That address is already in use."]}},
                    )
                user.email = address
                changed.append("email")

        if password:
            self._assert_password_ok(password)
            user.password_hash = password_hasher.hash(password)
            changed.append("password")
            # Every existing session for this account dies with the old
            # password. A reset that leaves the old sessions alive is not a
            # reset, and this is the only lever an admin has over a device
            # they cannot reach.
            self._revoke_sessions(user)

        if is_active is not None and is_active != user.is_active:
            if not is_active:
                self._assert_can_stand_down(user, actor_id)
            user.is_active = is_active
            changed.append("active" if is_active else "suspended")

        self.session.flush()

        if changed:
            activity.record(
                ActivityAction.UPDATED,
                ActivityEntity.USER,
                entity_id=user.id,
                entity_label=user.full_name,
                meta={
                    "summary": f"{user.full_name} · {', '.join(changed)}",
                    "changed": changed,
                },
            )
        return user

    def delete(self, user_id: uuid.UUID, *, actor_id: uuid.UUID | None) -> None:
        """Remove somebody from this organisation.

        The membership is revoked; the account is not. They may work for
        another organisation entirely, and deleting the row here would sign
        them out of somewhere this admin has no authority over. An account with
        no memberships left simply has nowhere to sign in to.
        """
        user = self.get(user_id)
        self._assert_can_stand_down(user, actor_id)

        member = self.membership(user_id)
        if member is not None:
            member.soft_delete()
        # Only the sessions pointed at *this* organisation: their session in
        # another one is none of this organisation's business.
        self._revoke_sessions(user, organisation_id=self.organisation_id)
        self.session.flush()

        activity.record(
            ActivityAction.DELETED,
            ActivityEntity.USER,
            entity_id=user.id,
            entity_label=user.full_name,
            meta={"summary": f"{user.full_name} removed"},
        )

    # ---------- guards ----------
    def _assert_password_ok(self, password: str) -> None:
        if len(password) < MIN_PASSWORD_LENGTH:
            raise ValidationError(
                f"Use at least {MIN_PASSWORD_LENGTH} characters.",
                details={
                    "fields": {
                        "password": [f"At least {MIN_PASSWORD_LENGTH} characters."]
                    }
                },
            )

    def _assert_can_stand_down(self, user: User, actor_id: uuid.UUID | None) -> None:
        """Refuse anything that would lock the system's owner out of it."""
        if actor_id is not None and user.id == actor_id:
            raise ValidationError(
                "You cannot remove or suspend your own account.",
                details={"fields": {"is_active": ["Ask another admin to do this."]}},
            )
        if self.role_of(user.id) is Role.ADMIN and self._live_admins(exclude_id=user.id) == 0:
            raise ValidationError(
                "That is the only administrator left in this organisation.",
                details={
                    "fields": {
                        "is_active": ["Promote another admin before removing this one."]
                    }
                },
            )

    def _revoke_sessions(
        self, user: User, *, organisation_id: uuid.UUID | None = None
    ) -> None:
        """Kill this user's sessions, optionally only those in one organisation.

        A password reset takes every session; being removed from one
        organisation takes only the sessions acting in it.
        """
        stmt = select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        )
        if organisation_id is not None:
            stmt = stmt.where(RefreshToken.organisation_id == organisation_id)

        now = utcnow()
        for token in self.session.scalars(stmt):
            token.revoked_at = now
