"""Route guards.

``@require_auth`` and ``@require_permission`` attach the acting user to the
request and enforce a declared capability. Every non-public endpoint carries
one; ``tests/test_route_coverage.py`` walks ``app.url_map`` and fails the build
if any route is missing a declaration, so authorisation cannot be forgotten
when a new endpoint is added.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec, TypeVar, cast

import structlog
from flask import current_app, g, request

from app.auth.permissions import can
from app.auth.tokens import decode_access_token
from app.common.current_org import set_current_org_id
from app.common.current_user import set_current_user_id
from app.common.errors import AuthenticationError, PermissionDeniedError
from app.models.organisation import Organisation, OrganisationMember
from app.models.user import Role, User

log = structlog.get_logger("app.auth")

P = ParamSpec("P")
R = TypeVar("R")

# Marks a route as deliberately unauthenticated, so the coverage test can tell
# "public on purpose" from "forgot the decorator".
PUBLIC_ATTR = "_ls_public"
CAPABILITY_ATTR = "_ls_capability"

ACCESS_COOKIE = "ls_at"


def public(fn: Callable[P, R]) -> Callable[P, R]:
    setattr(fn, PUBLIC_ATTR, True)
    return fn


def _bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    # The Next.js BFF forwards the cookie; direct API clients use the header.
    return request.cookies.get(ACCESS_COOKIE)


def _load_user() -> User:
    from sqlalchemy import select

    from app.extensions import db

    token = _bearer_token()
    if not token:
        raise AuthenticationError()

    s = current_app.config["SETTINGS"]
    claims = decode_access_token(token, secret=s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)

    user = db.session.get(User, claims.user_id)
    if user is None or user.deleted_at is not None or not user.is_active:
        # Deactivating a user must take effect before their access token expires.
        raise AuthenticationError("This account is no longer active.")

    # The membership is re-read on every request rather than trusted from the
    # token. Being removed from an organisation has to take effect immediately;
    # honouring the claim would leave the person inside it until their access
    # token expired, which is the whole window an eviction exists to close.
    membership = db.session.scalar(
        select(OrganisationMember).where(
            OrganisationMember.organisation_id == claims.organisation_id,
            OrganisationMember.user_id == user.id,
            OrganisationMember.deleted_at.is_(None),
        )
    )
    if membership is None:
        raise AuthenticationError("You no longer have access to that organisation.")

    organisation = db.session.get(Organisation, claims.organisation_id)
    if organisation is None or organisation.deleted_at is not None or not organisation.is_active:
        raise AuthenticationError("That organisation is no longer available.")

    if membership.role is not claims.role:
        # Role changed since the token was minted - force a refresh so the new
        # role takes effect rather than honouring a stale claim.
        raise AuthenticationError("Your access level changed. Sign in again.")

    g.current_user = user
    g.current_membership = membership
    g.current_organisation = organisation
    set_current_user_id(user.id)
    # Everything below this line reads one tenant's rows and no other. The
    # filter that enforces it lives in models.base and reads exactly this.
    set_current_org_id(organisation.id)
    structlog.contextvars.bind_contextvars(
        user_id=str(user.id),
        organisation_id=str(organisation.id),
        role=membership.role.value,
    )
    return user


def require_auth(fn: Callable[P, R]) -> Callable[P, R]:
    @wraps(fn)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        _load_user()
        return fn(*args, **kwargs)

    setattr(wrapper, CAPABILITY_ATTR, "*authenticated*")
    return cast(Callable[P, R], wrapper)


def require_permission(capability: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorator(fn: Callable[P, R]) -> Callable[P, R]:
        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            _load_user()
            role = current_role()
            if not can(role, capability):
                log.warning(
                    "permission_denied", capability=capability, role=role.value
                )
                raise PermissionDeniedError()
            return fn(*args, **kwargs)

        setattr(wrapper, CAPABILITY_ATTR, capability)
        return cast(Callable[P, R], wrapper)

    return decorator


def current_user() -> User:
    user = getattr(g, "current_user", None)
    if user is None:  # pragma: no cover - guarded by the decorators
        raise AuthenticationError()
    return cast(User, user)


def current_user_id() -> uuid.UUID:
    return current_user().id


def current_membership() -> OrganisationMember:
    membership = getattr(g, "current_membership", None)
    if membership is None:  # pragma: no cover - guarded by the decorators
        raise AuthenticationError()
    return cast(OrganisationMember, membership)


def current_organisation() -> Organisation:
    organisation = getattr(g, "current_organisation", None)
    if organisation is None:  # pragma: no cover - guarded by the decorators
        raise AuthenticationError()
    return cast(Organisation, organisation)


def current_role() -> Role:
    """The acting user's role *in the organisation they are acting in*.

    There is no global role: the same account can own one portfolio and merely
    work in another.
    """
    return current_membership().role


def describe_route(view: Any) -> str | None:
    """Capability a view declares, or None. Used by the coverage test."""
    if getattr(view, PUBLIC_ATTR, False):
        return "*public*"
    return cast("str | None", getattr(view, CAPABILITY_ATTR, None))
