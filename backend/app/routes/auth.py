"""Authentication endpoints."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, jsonify, make_response, request
from pydantic import BaseModel, Field

from app.auth.cookies import REFRESH_COOKIE, clear_session_cookies, set_session_cookies
from app.auth.decorators import current_user, public, require_auth
from app.auth.permissions import capabilities_for
from app.auth.service import AuthService
from app.common import activity
from app.common.api import parse_body
from app.common.errors import AuthenticationError
from app.extensions import db, limiter
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.user import User
from app.services.user_service import MIN_PASSWORD_LENGTH

bp = Blueprint("auth", __name__)


class LoginPayload(BaseModel):
    # Deliberately a plain string, not EmailStr. Format validation belongs on
    # user *creation*; applying it at sign-in only adds a way for a legitimately
    # registered address to become unusable, and tells an attacker nothing the
    # credential check would not.
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=200)
    remember: bool = False


def _service() -> AuthService:
    return AuthService(current_app.config["SETTINGS"])


def _me(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "capabilities": sorted(capabilities_for(user.role)),
        "last_login_at": user.last_login_at.isoformat() + "Z" if user.last_login_at else None,
    }


@bp.post("/login")
@public
@limiter.limit(lambda: current_app.config["SETTINGS"].RATELIMIT_LOGIN)
def login() -> Any:
    payload = parse_body(LoginPayload)
    service = _service()

    try:
        user = service.authenticate(payload.email, payload.password)
    except AuthenticationError:
        activity.record(
            ActivityAction.LOGIN_FAILED,
            ActivityEntity.SESSION,
            entity_label=payload.email,
            meta={"summary": "Failed sign-in attempt"},
        )
        db.session.commit()
        raise

    session = service.issue_session(
        user,
        remember=payload.remember,
        user_agent=request.headers.get("User-Agent"),
        ip=request.remote_addr,
    )
    activity.record(
        ActivityAction.LOGGED_IN,
        ActivityEntity.SESSION,
        entity_id=user.id,
        entity_label=user.full_name,
        actor_id=user.id,
        actor_name=user.full_name,
        meta={"summary": f"{user.full_name} signed in"},
    )
    db.session.commit()

    response = make_response(
        jsonify(
            {
                "user": _me(user),
                "access_expires_at": session.access_expires_at.isoformat(),
            }
        ),
        200,
    )
    return set_session_cookies(response, session, current_app.config["SETTINGS"])


@bp.post("/refresh")
@public
def refresh() -> Any:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise AuthenticationError("No session to refresh.")

    session = _service().rotate(
        raw, user_agent=request.headers.get("User-Agent"), ip=request.remote_addr
    )
    db.session.commit()

    response = make_response(
        jsonify(
            {
                "user": _me(session.user),
                "access_expires_at": session.access_expires_at.isoformat(),
            }
        ),
        200,
    )
    return set_session_cookies(response, session, current_app.config["SETTINGS"])


@bp.post("/logout")
@public
def logout() -> Any:
    # Public by design: signing out must work even with an expired access
    # token, otherwise the cookies can never be cleared.
    raw = request.cookies.get(REFRESH_COOKIE)
    service = _service()
    service.revoke(raw)
    db.session.commit()

    response = make_response(jsonify({"ok": True}), 200)
    return clear_session_cookies(response, current_app.config["SETTINGS"])


@bp.get("/me")
@require_auth
def me() -> Any:
    return jsonify({"user": _me(current_user())}), 200


class ChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=256)


@bp.post("/password")
@require_auth
# Rate limited like sign-in, not like an ordinary write: it checks a
# credential, so it is a guessing target in exactly the same way.
@limiter.limit(lambda: current_app.config["SETTINGS"].RATELIMIT_LOGIN)
def change_password() -> Any:
    """Self-service, so it lives here rather than under /users.

    That blueprint is admin-only, which would leave a manager with no way to
    change their own password at all.
    """
    payload = parse_body(ChangePasswordPayload)
    user = current_user()
    service = _service()

    service.change_password(
        user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    # Every session, including this one, was just revoked. Replacing it here is
    # what keeps the caller signed in — without this they would keep working
    # until the access token expired and then be bounced to /login.
    #
    # Not remembered: the original choice is not recoverable (only the cookie's
    # lifetime ever encoded it, and that cookie does not reach this path), and
    # after a credential change the shorter-lived option is the safer default.
    session = service.issue_session(
        user,
        remember=False,
        user_agent=request.headers.get("User-Agent"),
        ip=request.remote_addr,
    )
    db.session.commit()

    response = make_response(
        jsonify(
            {"user": _me(user), "access_expires_at": session.access_expires_at.isoformat()}
        ),
        200,
    )
    return set_session_cookies(response, session, current_app.config["SETTINGS"])
