"""User accounts.

Only an admin reaches any of this. Accounts created here get
:attr:`Role.MANAGER` — everything except administering other accounts — and
the role is never chosen in the UI, because the product does not expose roles
yet. Keeping it in the matrix rather than granting everything means the day
roles do appear, this is a matrix edit rather than a retrofit.

The guards below all protect one thing: an admin cannot remove their own way
back in. Every other mistake here is recoverable by editing a row; locking
the last administrator out of a running system is not.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.common import activity
from app.common.errors import DuplicateError, NotFoundError, ValidationError
from app.extensions import password_hasher
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.base import utcnow
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
    def base_query(self) -> Select[tuple[User]]:
        return select(User).where(User.deleted_at.is_(None))

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

    def email_taken(self, email: str, *, exclude_id: uuid.UUID | None = None) -> bool:
        """Among live rows only.

        A hard UNIQUE would burn an address permanently once its owner is
        removed, which is the wrong trade for a team of a dozen people.
        """
        stmt = self.base_query().where(User.email == normalise_email(email))
        if exclude_id is not None:
            stmt = stmt.where(User.id != exclude_id)
        return self.session.scalars(stmt).first() is not None

    def _live_admins(self, *, exclude_id: uuid.UUID | None = None) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(
                User.deleted_at.is_(None),
                User.is_active.is_(True),
                User.role == Role.ADMIN,
            )
        )
        if exclude_id is not None:
            stmt = stmt.where(User.id != exclude_id)
        return int(self.session.scalar(stmt) or 0)

    # ---------- writes ----------
    def create(self, *, email: str, full_name: str, password: str) -> User:
        address = normalise_email(email)
        if self.email_taken(address):
            raise DuplicateError(
                "Someone already uses that email address.",
                details={"fields": {"email": ["That address is already in use."]}},
            )
        self._assert_password_ok(password)

        user = User(
            email=address,
            full_name=full_name.strip(),
            password_hash=password_hasher.hash(password),
            role=Role.MANAGER,
            is_active=True,
        )
        self.session.add(user)
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
        user = self.get(user_id)
        self._assert_can_stand_down(user, actor_id)

        user.deleted_at = utcnow()
        user.is_active = False
        # Removing the row without the sessions would leave a deleted account
        # signed in until its access token expired.
        self._revoke_sessions(user)
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
        if user.role is Role.ADMIN and self._live_admins(exclude_id=user.id) == 0:
            raise ValidationError(
                "That is the only administrator left.",
                details={
                    "fields": {
                        "is_active": ["Promote another admin before removing this one."]
                    }
                },
            )

    def _revoke_sessions(self, user: User) -> None:
        now = utcnow()
        for token in self.session.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
            )
        ):
            token.revoked_at = now
