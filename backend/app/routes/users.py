"""User account endpoints.

Every route here needs ``user:read`` or ``user:write``, which only the admin
role holds — so the whole module is admin-only without a single explicit role
check. Accounts created through it are managers: everything except this
screen.

Scoped to the organisation the caller is acting in. "The team" is a question
about one organisation, not about the system, and an address that already has
an account elsewhere is invited into this one rather than rejected.
"""

from __future__ import annotations

import uuid
from typing import Any

from flask import Blueprint, jsonify
from pydantic import BaseModel, ConfigDict, Field

from app.auth.decorators import require_permission
from app.auth.permissions import USER_READ, USER_WRITE
from app.common.api import parse_body, parse_query
from app.common.current_user import get_current_user_id
from app.common.pagination import PageParams, paginate
from app.extensions import db
from app.models.user import Role, User
from app.services.user_service import MIN_PASSWORD_LENGTH, UserService

bp = Blueprint("users", __name__)


def _service() -> UserService:
    return UserService(db.session)


def _serialise(user: User, role: Role | None = None) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        # Sent so the UI can mark the owner account and disable the controls
        # that would remove it. The server refuses regardless. Admin *here* --
        # the same person may be a manager in another organisation.
        "is_admin": role is Role.ADMIN,
        "is_active": user.is_active,
        "last_login_at": (
            user.last_login_at.isoformat() + "Z" if user.last_login_at else None
        ),
        "created_at": user.created_at.isoformat() + "Z",
    }


class UserListQuery(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=160)
    # Deliberately a bounded string rather than EmailStr: the same choice the
    # login endpoint makes, so an address that can sign in can also be created.
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=256)


class UserUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    email: str | None = Field(default=None, min_length=3, max_length=255)
    #: Optional: sent only when the admin is resetting it.
    password: str | None = Field(default=None, min_length=MIN_PASSWORD_LENGTH, max_length=256)
    is_active: bool | None = None


@bp.get("")
@require_permission(USER_READ)
def list_users() -> Any:
    params = parse_query(UserListQuery)
    service = _service()
    page = paginate(
        db.session,
        service.search(params.q),
        PageParams(page=params.page, per_page=params.per_page),
    )
    roles = {m.user_id: m.role for m in service.memberships()}
    return jsonify(page.envelope(lambda u: _serialise(u, roles.get(u.id)))), 200


@bp.post("")
@require_permission(USER_WRITE)
def create_user() -> Any:
    payload = parse_body(UserCreate)
    service = _service()
    user = service.create(
        email=payload.email, full_name=payload.full_name, password=payload.password
    )
    db.session.commit()
    return jsonify(_serialise(user, service.role_of(user.id))), 201


@bp.get("/<uuid:user_id>")
@require_permission(USER_READ)
def get_user(user_id: uuid.UUID) -> Any:
    service = _service()
    return jsonify(_serialise(service.get(user_id), service.role_of(user_id))), 200


@bp.patch("/<uuid:user_id>")
@require_permission(USER_WRITE)
def update_user(user_id: uuid.UUID) -> Any:
    payload = parse_body(UserUpdate)
    data = payload.model_dump(exclude_unset=True)
    service = _service()
    user = service.update(
        user_id,
        actor_id=get_current_user_id(),
        full_name=data.get("full_name"),
        email=data.get("email"),
        password=data.get("password"),
        is_active=data.get("is_active"),
    )
    db.session.commit()
    return jsonify(_serialise(user, service.role_of(user_id))), 200


@bp.delete("/<uuid:user_id>")
@require_permission(USER_WRITE)
def delete_user(user_id: uuid.UUID) -> Any:
    _service().delete(user_id, actor_id=get_current_user_id())
    db.session.commit()
    return "", 204
