"""Users, roles and refresh tokens.

Phase 1 ships a single Admin, but the role column and the capability matrix in
``app.auth.permissions`` are in place from the start. Retrofitting authorisation
after every endpoint exists is the expensive version of this.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin


class Role(str, enum.Enum):
    ADMIN = "admin"
    STAFF = "staff"
    CLEANER = "cleaner"
    ACCOUNTANT = "accountant"


class User(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    # Argon2id hashes are ~100 chars; 255 leaves room for parameter changes.
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[Role] = mapped_column(
        Enum(Role, values_callable=lambda e: [m.value for m in e], native_enum=False, length=20),
        nullable=False,
        default=Role.ADMIN,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        # Partial indexes do not exist in MySQL/MariaDB, so uniqueness of email
        # among *live* rows is enforced in the service layer rather than here —
        # a plain UNIQUE(email) would make an address unusable forever once a
        # user is soft-deleted.
        Index("ix_users_email", "email"),
        Index("ix_users_role_active", "role", "is_active"),
        Index("ix_users_deleted_at", "deleted_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.email} role={self.role.value}>"


class RefreshToken(Base, UUIDPrimaryKeyMixin):
    """One row per issued refresh token, storing only a hash.

    Rotation on every use plus reuse detection: if a token that has already
    been rotated is presented again, the whole family is revoked, because that
    pattern means the token leaked.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # SHA-256 hex of the opaque token. Storing the raw token would make a
    # database read equivalent to a session hijack.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    # Ties rotated descendants together so reuse revokes the whole chain.
    family_id: Mapped[uuid.UUID] = mapped_column(GUID, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rotated_to: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")

    __table_args__ = (
        Index("uq_refresh_tokens_token_hash", "token_hash", unique=True),
        Index("ix_refresh_tokens_user_expires", "user_id", "expires_at"),
        Index("ix_refresh_tokens_family_id", "family_id"),
    )

    @property
    def is_active(self) -> bool:
        from app.models.base import utcnow

        return self.revoked_at is None and self.expires_at > utcnow()
