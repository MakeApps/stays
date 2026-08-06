"""Authentication service: sign-in, refresh rotation, sign-out."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import structlog
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select

from app.auth.tokens import (
    generate_refresh_token,
    hash_refresh_token,
    mint_access_token,
)
from app.common.errors import AuthenticationError, InvalidCredentialsError
from app.config import Settings
from app.extensions import db, password_hasher
from app.models.base import utcnow, uuid7
from app.models.user import RefreshToken, Role, User

log = structlog.get_logger("app.auth")

# Verifying this when the email is unknown keeps sign-in timing flat, so the
# endpoint cannot be used to enumerate which addresses have accounts.
_DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$"
    "c29tZXNhbHRzb21lc2FsdA$Yn9dGZ7yZ8mQx1kXK0mF5R3lQ8xJ4pXbTn1oZ0aVvVE"
)


@dataclass(frozen=True, slots=True)
class IssuedSession:
    user: User
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime
    remember: bool


class AuthService:
    def __init__(self, settings: Settings) -> None:
        self._s = settings

    # ---------- sign in ----------
    def authenticate(self, email: str, password: str) -> User:
        normalised = email.strip().lower()
        user = db.session.scalar(
            select(User).where(User.email == normalised, User.deleted_at.is_(None))
        )

        if user is None:
            self._waste_time()
            raise InvalidCredentialsError()

        try:
            password_hasher.verify(user.password_hash, password)
        except (VerifyMismatchError, InvalidHashError) as exc:
            raise InvalidCredentialsError() from exc

        if not user.is_active:
            raise AuthenticationError("This account has been deactivated.")

        # Transparent upgrade when the Argon2 cost parameters change.
        if password_hasher.check_needs_rehash(user.password_hash):
            user.password_hash = password_hasher.hash(password)

        user.last_login_at = utcnow()
        return user

    def _waste_time(self) -> None:
        try:
            password_hasher.verify(_DUMMY_HASH, "not-the-password")
        except Exception:  # noqa: BLE001 - the point is the elapsed time
            pass

    # ---------- issue ----------
    def issue_session(
        self,
        user: User,
        *,
        remember: bool,
        user_agent: str | None = None,
        ip: str | None = None,
    ) -> IssuedSession:
        access, access_exp = mint_access_token(
            user_id=user.id,
            role=user.role,
            secret=self._s.JWT_SECRET,
            algorithm=self._s.JWT_ALGORITHM,
            ttl_minutes=self._s.ACCESS_TOKEN_TTL_MIN,
        )
        raw, hashed = generate_refresh_token()
        expires = utcnow() + timedelta(days=self._s.REFRESH_TOKEN_TTL_DAYS)

        db.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hashed,
                family_id=uuid7(),
                issued_at=utcnow(),
                expires_at=expires,
                user_agent=(user_agent or "")[:255] or None,
                ip=(ip or "")[:45] or None,
            )
        )
        return IssuedSession(
            user=user,
            access_token=access,
            access_expires_at=access_exp,
            refresh_token=raw,
            refresh_expires_at=expires,
            remember=remember,
        )

    # ---------- refresh ----------
    def rotate(
        self, raw_token: str, *, user_agent: str | None = None, ip: str | None = None
    ) -> IssuedSession:
        """Exchange a refresh token for a new pair, invalidating the old one.

        Reuse detection: presenting a token that has already been rotated means
        it leaked, so the entire family is revoked and the user must sign in
        again. This is why the frontend's refresh call must be single-flight —
        six parallel refreshes would look exactly like theft.
        """
        hashed = hash_refresh_token(raw_token)
        record = db.session.scalar(select(RefreshToken).where(RefreshToken.token_hash == hashed))

        if record is None:
            raise AuthenticationError("That session is no longer valid.")

        if record.rotated_to is not None or record.revoked_at is not None:
            self._revoke_family(record.family_id)
            log.warning(
                "refresh_token_reuse_detected",
                family_id=str(record.family_id),
                user_id=str(record.user_id),
            )
            raise AuthenticationError("That session was already used. Sign in again.")

        if record.expires_at <= utcnow():
            raise AuthenticationError("Your session expired. Sign in again.")

        user = db.session.get(User, record.user_id)
        if user is None or user.deleted_at is not None or not user.is_active:
            raise AuthenticationError("This account is no longer active.")

        access, access_exp = mint_access_token(
            user_id=user.id,
            role=user.role,
            secret=self._s.JWT_SECRET,
            algorithm=self._s.JWT_ALGORITHM,
            ttl_minutes=self._s.ACCESS_TOKEN_TTL_MIN,
        )
        new_raw, new_hash = generate_refresh_token()
        successor = RefreshToken(
            user_id=user.id,
            token_hash=new_hash,
            # Same family, so a later replay of any ancestor kills the chain.
            family_id=record.family_id,
            issued_at=utcnow(),
            expires_at=record.expires_at,
            user_agent=(user_agent or "")[:255] or None,
            ip=(ip or "")[:45] or None,
        )
        db.session.add(successor)
        db.session.flush()

        record.rotated_to = successor.id
        record.revoked_at = utcnow()

        return IssuedSession(
            user=user,
            access_token=access,
            access_expires_at=access_exp,
            refresh_token=new_raw,
            refresh_expires_at=record.expires_at,
            # Preserved from the original grant: rotation must not silently
            # extend a session the user chose not to persist.
            remember=(record.expires_at - record.issued_at)
            > timedelta(days=1),
        )

    # ---------- sign out ----------
    def revoke(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        record = db.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        )
        if record is not None:
            self._revoke_family(record.family_id)

    def _revoke_family(self, family_id: uuid.UUID) -> None:
        now = utcnow()
        for token in db.session.scalars(
            select(RefreshToken).where(
                RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None)
            )
        ):
            token.revoked_at = now

    def purge_expired(self) -> int:
        """Housekeeping for the CLI — expired rows have no further use."""
        rows = list(
            db.session.scalars(select(RefreshToken).where(RefreshToken.expires_at < utcnow()))
        )
        for row in rows:
            db.session.delete(row)
        return len(rows)

    # ---------- bootstrap ----------
    def create_user(
        self, *, email: str, password: str, full_name: str, role: Role = Role.ADMIN
    ) -> User:
        user = User(
            email=email.strip().lower(),
            password_hash=password_hasher.hash(password),
            full_name=full_name.strip(),
            role=role,
        )
        db.session.add(user)
        return user
