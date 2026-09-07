"""Authentication endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from flask import Blueprint, current_app, jsonify, make_response, request
from pydantic import BaseModel, Field

from app.auth.cookies import REFRESH_COOKIE, clear_session_cookies, set_session_cookies
from app.auth.decorators import (
    current_organisation,
    current_role,
    current_user,
    public,
    require_auth,
)
from app.auth.permissions import capabilities_for
from app.auth.service import AuthService, IssuedSession
from app.common import activity
from app.common.api import parse_body
from app.common.errors import AuthenticationError
from app.extensions import db, limiter
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.organisation import Organisation
from app.models.user import Role, User
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


def _organisation(organisation: Organisation, role: Role) -> dict[str, Any]:
    return {
        "id": str(organisation.id),
        "name": organisation.name,
        "role": role.value,
    }


def _me(user: User, organisation: Organisation, role: Role) -> dict[str, Any]:
    """Identity, plus where the session is standing.

    ``role`` and ``capabilities`` describe this organisation only. The same
    account can be an admin in one and a manager in another, so a client that
    cached them across a switch would draw the wrong screen.
    """
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": role.value,
        "capabilities": sorted(capabilities_for(role)),
        "last_login_at": user.last_login_at.isoformat() + "Z" if user.last_login_at else None,
        "organisation": _organisation(organisation, role),
    }


def _session_body(session: IssuedSession) -> dict[str, Any]:
    return {
        "user": _me(session.user, session.organisation, session.role),
        "access_expires_at": session.access_expires_at.isoformat(),
    }


def _record_failed_sign_in(service: AuthService, email: str) -> None:
    """Attributed to the account's own organisation, or dropped entirely.

    An address nobody has registered belongs to no tenant, so there is no feed
    it could honestly appear in. What an admin needs to see is somebody
    guessing at *their* people's passwords, and that is what survives here.
    """
    user = service.find_by_email(email)
    if user is None:
        return
    memberships = service.memberships_for(user)
    if not memberships:
        return
    organisation, _ = memberships[0]
    activity.record(
        ActivityAction.LOGIN_FAILED,
        ActivityEntity.SESSION,
        entity_label=email,
        organisation_id=organisation.id,
        meta={"summary": "Failed sign-in attempt"},
    )


@bp.post("/login")
@public
@limiter.limit(lambda: current_app.config["SETTINGS"].RATELIMIT_LOGIN)
def login() -> Any:
    payload = parse_body(LoginPayload)
    service = _service()

    try:
        user = service.authenticate(payload.email, payload.password)
    except AuthenticationError:
        _record_failed_sign_in(service, payload.email)
        db.session.commit()
        raise

    # Oldest membership, so signing in always lands in the same place. Creating
    # a second organisation must not quietly move where you start.
    organisation, membership = service.default_organisation(user)
    session = service.issue_session(
        user,
        organisation=organisation,
        role=membership.role,
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
        organisation_id=organisation.id,
        meta={"summary": f"{user.full_name} signed in"},
    )
    db.session.commit()

    response = make_response(jsonify(_session_body(session)), 200)
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

    response = make_response(jsonify(_session_body(session)), 200)
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
    return jsonify(
        {"user": _me(current_user(), current_organisation(), current_role())}
    ), 200


@bp.get("/organisations")
@require_auth
def my_organisations() -> Any:
    """Everywhere this account can act, for the switcher.

    Deliberately not behind a capability: this is the list of doors you already
    hold keys to, and a manager needs it as much as an admin does.
    """
    memberships = _service().memberships_for(current_user())
    return jsonify(
        {
            "items": [_organisation(org, member.role) for org, member in memberships],
            "current_id": str(current_organisation().id),
        }
    ), 200


class SwitchOrganisationPayload(BaseModel):
    organisation_id: uuid.UUID


@bp.post("/organisation")
@require_auth
def switch_organisation() -> Any:
    """Move this session into another organisation.

    A fresh token rather than a server-side flag: the organisation is a claim,
    so switching cannot be done to somebody else's session, and an old token
    keeps pointing at the tenant it was minted for until it expires.
    """
    payload = parse_body(SwitchOrganisationPayload)
    user = current_user()
    service = _service()

    organisation, membership = service.membership_or_raise(user, payload.organisation_id)
    session = service.issue_session(
        user,
        organisation=organisation,
        role=membership.role,
        # The previous session's choice is not readable here (the refresh cookie
        # is path-scoped to /auth/refresh), and a switch is not a new sign-in,
        # so the shorter-lived option is the safe default.
        remember=False,
        user_agent=request.headers.get("User-Agent"),
        ip=request.remote_addr,
    )
    db.session.commit()

    response = make_response(jsonify(_session_body(session)), 200)
    return set_session_cookies(response, session, current_app.config["SETTINGS"])


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
        organisation=current_organisation(),
        role=current_role(),
        remember=False,
        user_agent=request.headers.get("User-Agent"),
        ip=request.remote_addr,
    )
    db.session.commit()

    response = make_response(jsonify(_session_body(session)), 200)
    return set_session_cookies(response, session, current_app.config["SETTINGS"])
