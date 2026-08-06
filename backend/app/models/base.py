"""Declarative base, UUID column type, and the audit / soft-delete mixins.

Every table in this schema uses the same identity and bookkeeping story:

* **UUIDv7 primary keys stored as ``BINARY(16)``.** Neither MySQL 8.0 nor
  MariaDB 10.4 has a native UUID type, so the choice is ``CHAR(36)`` (36 bytes,
  human readable) or ``BINARY(16)`` (16 bytes). Binary wins on index size, and
  UUIDv7 is time-ordered, so inserts land at the right-hand edge of the B-tree
  instead of scattering random pages the way UUIDv4 does. That combination is
  what keeps this schema viable from 4 condos to thousands.
* **Audit columns** stamped by a session listener, not by hand in each service.
* **Soft delete** via ``deleted_at``; repositories filter it by default.
"""

from __future__ import annotations

import secrets
import time
import uuid
from datetime import UTC, datetime
from typing import Any, Self

from sqlalchemy import BINARY, DateTime, ForeignKey, MetaData, event
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, registry
from sqlalchemy.types import TypeDecorator

from app.common.current_user import get_current_user_id

# Deterministic constraint names. Without this, Alembic autogenerate cannot
# emit a DROP for an unnamed constraint and migrations silently diverge.
NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s",
    "pk": "pk_%(table_name)s",
}


def uuid7() -> uuid.UUID:
    """Generate a UUIDv7 (RFC 9562): 48-bit big-endian millisecond timestamp,
    version/variant bits, then random.

    Time-ordered, so consecutive inserts stay physically adjacent in the
    clustered index.
    """
    ts_ms = time.time_ns() // 1_000_000
    rand = secrets.token_bytes(10)
    b = bytearray(16)
    b[0:6] = ts_ms.to_bytes(6, "big")
    b[6] = 0x70 | (rand[0] & 0x0F)  # version 7
    b[7] = rand[1]
    b[8] = 0x80 | (rand[2] & 0x3F)  # variant 0b10
    b[9:16] = rand[3:10]
    return uuid.UUID(bytes=bytes(b))


class GUID(TypeDecorator[uuid.UUID]):
    """UUID stored as ``BINARY(16)``, surfaced as :class:`uuid.UUID`."""

    impl = BINARY(16)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> bytes | None:
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value.bytes
        if isinstance(value, bytes):
            return value
        return uuid.UUID(str(value)).bytes

    def process_result_value(self, value: Any, dialect: Dialect) -> uuid.UUID | None:
        if value is None:
            return None
        return uuid.UUID(bytes=bytes(value))


def utcnow() -> datetime:
    """Timezone-aware UTC now.

    Stored naive because MySQL DATETIME carries no offset; every value in the
    database is UTC by convention and converted at the presentation edge.
    """
    return datetime.now(UTC).replace(tzinfo=None)


# The type map lives on the registry, not on the base. Flask-SQLAlchemy
# subclasses Base to build `db.Model`, and SQLAlchemy rejects a per-base
# type_annotation_map once a registry exists.
_registry = registry(
    metadata=MetaData(naming_convention=NAMING_CONVENTION),
    type_annotation_map={uuid.UUID: GUID},
)


class Base(DeclarativeBase):
    registry = _registry
    metadata = _registry.metadata


class UUIDPrimaryKeyMixin:
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid7)


class TimestampMixin:
    # No blanket index=True here: an index on every table's created_at costs
    # write throughput on tables that are never queried by it. Each model
    # declares the indexes it actually needs in __table_args__.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )


class AuditMixin(TimestampMixin):
    """Who created and last touched the row.

    Nullable because system actions (migrations, seeds, the bootstrap admin)
    have no acting user.
    """

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL", use_alter=True), nullable=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="SET NULL", use_alter=True), nullable=True
    )


class SoftDeleteMixin:
    # Indexed per-model, usually as the leading column of a composite that also
    # covers the list query's sort order.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def soft_delete(self) -> Self:
        self.deleted_at = utcnow()
        return self


@event.listens_for(Base, "before_insert", propagate=True)
def _stamp_created_by(mapper: Any, connection: Any, target: Any) -> None:
    if isinstance(target, AuditMixin) and target.created_by is None:
        actor = get_current_user_id()
        target.created_by = actor
        target.updated_by = actor


@event.listens_for(Base, "before_update", propagate=True)
def _stamp_updated_by(mapper: Any, connection: Any, target: Any) -> None:
    if isinstance(target, AuditMixin) and (actor := get_current_user_id()) is not None:
        target.updated_by = actor
