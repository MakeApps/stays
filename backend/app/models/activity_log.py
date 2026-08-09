"""Activity log.

Feeds the dashboard's "Recent activity" card and doubles as the audit trail.
Rows are written by ``app.common.activity``, which services call through a
single helper rather than sprinkling log statements — that is what stops it
being forgotten on the eleventh mutation.

Rendering is deliberately split: the *structured* fields (action, entity,
metadata) are the durable record, while the human strings shown in the UI are
produced by a renderer at read time. Storing rendered copy would freeze
today's wording into historical rows.
"""

from __future__ import annotations

import enum
import uuid
from typing import Any

from sqlalchemy import Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin, UUIDPrimaryKeyMixin


class ActivityAction(str, enum.Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    RESTORED = "restored"
    LOGGED_IN = "logged_in"
    LOGGED_OUT = "logged_out"
    LOGIN_FAILED = "login_failed"
    UPLOADED = "uploaded"
    EXPORTED = "exported"
    REFUNDED = "refunded"
    EXPIRED = "expired"


class ActivityEntity(str, enum.Enum):
    USER = "user"
    CONDO = "condo"
    BOOKING = "booking"
    EXPENSE = "expense"
    SESSION = "session"
    LEASE = "lease"
    DEPOSIT = "deposit"


# Dot colours used by the dashboard timeline (design lines 2350–2352).
TONE_BY_ENTITY: dict[ActivityEntity, str] = {
    ActivityEntity.USER: "blue",
    ActivityEntity.CONDO: "purple",
    ActivityEntity.BOOKING: "purple",
    ActivityEntity.EXPENSE: "red",
    ActivityEntity.SESSION: "blue",
    ActivityEntity.LEASE: "amber",
    # Deposits are capital moving, not profit or loss — its own colour so
    # the feed never reads a recovered deposit as revenue.
    ActivityEntity.DEPOSIT: "green",
}


class ActivityLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "activity_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    action: Mapped[ActivityAction] = mapped_column(
        Enum(
            ActivityAction,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=24,
        ),
        nullable=False,
    )
    entity_type: Mapped[ActivityEntity] = mapped_column(
        Enum(
            ActivityEntity,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=24,
        ),
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(GUID, nullable=True)
    # Short human label so the feed stays readable after the entity is deleted.
    entity_label: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # MariaDB aliases JSON to LONGTEXT and MySQL 8 has a native type; Text is
    # the common subset. Serialised by the activity helper.
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    __table_args__ = (
        # The feed is always "newest first", so this is the workhorse index.
        Index("ix_activity_logs_created_at", "created_at"),
        Index("ix_activity_logs_entity", "entity_type", "entity_id"),
        Index("ix_activity_logs_actor", "actor_id"),
    )

    @property
    def tone(self) -> str:
        if self.action is ActivityAction.DELETED:
            return "red"
        return TONE_BY_ENTITY.get(self.entity_type, "purple")

    def meta(self) -> dict[str, Any]:
        import json

        if not self.meta_json:
            return {}
        try:
            parsed: dict[str, Any] = json.loads(self.meta_json)
        except (ValueError, TypeError):
            return {}
        return parsed
