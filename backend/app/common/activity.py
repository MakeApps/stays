"""Activity logging.

Services call :func:`record` once per mutation. Keeping it behind a single
helper — rather than constructing ``ActivityLog`` rows inline — is what stops
the eleventh mutation from silently skipping the audit trail.

Human-readable copy is produced at *read* time by :func:`render`, so changing
the wording later does not require rewriting history.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from flask import g, has_request_context, request

from app.extensions import db
from app.models.activity_log import ActivityAction, ActivityEntity, ActivityLog


def record(
    action: ActivityAction,
    entity_type: ActivityEntity,
    *,
    entity_id: uuid.UUID | None = None,
    entity_label: str | None = None,
    meta: dict[str, Any] | None = None,
    actor_id: uuid.UUID | None = None,
    actor_name: str | None = None,
) -> ActivityLog:
    from app.common.current_user import get_current_user_id

    if actor_id is None:
        actor_id = get_current_user_id()
    if actor_name is None and has_request_context():
        user = getattr(g, "current_user", None)
        actor_name = getattr(user, "full_name", None)

    entry = ActivityLog(
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=(entity_label or "")[:255] or None,
        meta_json=json.dumps(meta, ensure_ascii=False, default=str) if meta else None,
        request_id=getattr(g, "request_id", None) if has_request_context() else None,
        ip=(request.remote_addr if has_request_context() else None),
    )
    db.session.add(entry)
    return entry


_TITLES: dict[tuple[ActivityEntity, ActivityAction], str] = {
    (ActivityEntity.CONDO, ActivityAction.CREATED): "Condo added",
    (ActivityEntity.CONDO, ActivityAction.UPDATED): "Condo updated",
    (ActivityEntity.CONDO, ActivityAction.DELETED): "Condo removed",
    (ActivityEntity.BOOKING, ActivityAction.CREATED): "Booking added",
    (ActivityEntity.BOOKING, ActivityAction.UPDATED): "Booking updated",
    (ActivityEntity.BOOKING, ActivityAction.DELETED): "Booking deleted",
    (ActivityEntity.EXPENSE, ActivityAction.CREATED): "Expense added",
    (ActivityEntity.EXPENSE, ActivityAction.UPDATED): "Expense updated",
    (ActivityEntity.EXPENSE, ActivityAction.DELETED): "Expense deleted",
    (ActivityEntity.SESSION, ActivityAction.LOGGED_IN): "Signed in",
    (ActivityEntity.SESSION, ActivityAction.LOGGED_OUT): "Signed out",
    (ActivityEntity.SESSION, ActivityAction.LOGIN_FAILED): "Failed sign-in",
    (ActivityEntity.USER, ActivityAction.CREATED): "User added",
    (ActivityEntity.USER, ActivityAction.UPDATED): "User updated",
}


def render(entry: ActivityLog) -> dict[str, Any]:
    """Shape an entry for the dashboard's Recent activity card."""
    title = _TITLES.get(
        (entry.entity_type, entry.action),
        f"{entry.entity_type.value.title()} {entry.action.value}",
    )
    meta = entry.meta()
    body = meta.get("summary") or entry.entity_label or ""

    return {
        "id": str(entry.id),
        "title": title,
        "body": body,
        "when": entry.created_at.isoformat() + "Z",
        "kind": entry.tone,
        "actor": entry.actor_name,
        "entity_type": entry.entity_type.value,
        "entity_id": str(entry.entity_id) if entry.entity_id else None,
    }
