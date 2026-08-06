"""Auth cookie handling.

Tokens live in httpOnly cookies, never in JavaScript-readable storage. This UI
renders user-authored strings (guest names, notes, vendor names) next to
financial totals, so an XSS with readable tokens would be bank-adjacent.

"Remember me" changes **only** the refresh cookie's lifetime — 30 days versus a
session cookie that dies with the browser. It must never lengthen the access
token, which stays short regardless.
"""

from __future__ import annotations

from flask import Response

from app.auth.service import IssuedSession
from app.config import Settings

ACCESS_COOKIE = "ls_at"
REFRESH_COOKIE = "ls_rt"


def _refresh_path(settings: Settings) -> str:
    # Scoping the refresh cookie to its own endpoint means it is not attached
    # to ordinary API calls, so it cannot leak through a chatty request log.
    return f"{settings.API_PREFIX}/auth/refresh"


def set_session_cookies(
    response: Response, session: IssuedSession, settings: Settings
) -> Response:
    secure = settings.is_production

    response.set_cookie(
        ACCESS_COOKIE,
        session.access_token,
        max_age=settings.ACCESS_TOKEN_TTL_MIN * 60,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        session.refresh_token,
        # No max_age => a session cookie, cleared when the browser closes.
        max_age=settings.REFRESH_TOKEN_TTL_DAYS * 86400 if session.remember else None,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path=_refresh_path(settings),
    )
    return response


def clear_session_cookies(response: Response, settings: Settings) -> Response:
    secure = settings.is_production
    response.set_cookie(
        ACCESS_COOKIE, "", max_age=0, httponly=True, secure=secure, samesite="Lax", path="/"
    )
    response.set_cookie(
        REFRESH_COOKIE,
        "",
        max_age=0,
        httponly=True,
        secure=secure,
        samesite="Lax",
        path=_refresh_path(settings),
    )
    return response
