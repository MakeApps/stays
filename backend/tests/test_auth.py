"""Authentication flow."""

from __future__ import annotations

from typing import Any

from flask import Flask
from flask.testing import FlaskClient
from sqlalchemy import select

from app.auth.cookies import ACCESS_COOKIE, REFRESH_COOKIE
from app.models.user import RefreshToken, User
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD


def _cookie_headers(response: Any) -> list[str]:
    return response.headers.getlist("Set-Cookie")


def _cookie(response: Any, name: str) -> str | None:
    for raw in _cookie_headers(response):
        if raw.startswith(f"{name}="):
            return raw
    return None


class TestLogin:
    def test_succeeds_with_correct_credentials(self, client: FlaskClient, admin: User) -> None:
        r = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert r.status_code == 200
        body = r.get_json()
        assert body["user"]["email"] == ADMIN_EMAIL
        assert body["user"]["role"] == "admin"
        assert "capabilities" in body["user"]

    def test_never_returns_the_password_hash(self, client: FlaskClient, admin: User) -> None:
        r = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert "password" not in r.get_data(as_text=True).lower()

    def test_wrong_password_is_rejected(self, client: FlaskClient, admin: User) -> None:
        r = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"})
        assert r.status_code == 401
        assert r.get_json()["error"]["code"] == "invalid_credentials"

    def test_unknown_email_is_indistinguishable(self, client: FlaskClient, admin: User) -> None:
        """No account-enumeration oracle.

        An attacker must not be able to tell a registered address from an
        unregistered one by comparing responses.
        """
        unknown = client.post(
            "/api/v1/auth/login", json={"email": "ghost@localshouts.co.th", "password": "nope"}
        )
        wrong_pw = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"}
        )
        assert unknown.status_code == wrong_pw.status_code == 401
        assert unknown.get_json()["error"]["code"] == wrong_pw.get_json()["error"]["code"]
        assert unknown.get_json()["error"]["message"] == wrong_pw.get_json()["error"]["message"]

    def test_deactivated_account_cannot_sign_in(
        self, client: FlaskClient, admin: User, session: Any
    ) -> None:
        admin.is_active = False
        session.flush()
        r = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert r.status_code == 401

    def test_email_is_matched_case_insensitively(self, client: FlaskClient, admin: User) -> None:
        r = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL.upper(), "password": ADMIN_PASSWORD},
        )
        assert r.status_code == 200


class TestCookies:
    def test_both_cookies_are_httponly(self, client: FlaskClient, admin: User) -> None:
        r = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        cookies = _cookie_headers(r)
        assert len(cookies) == 2
        assert all("HttpOnly" in c for c in cookies)
        assert all("SameSite=Lax" in c for c in cookies)

    def test_refresh_cookie_is_path_scoped(self, client: FlaskClient, admin: User) -> None:
        # Scoping keeps the refresh token off every ordinary API call.
        r = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert "Path=/api/v1/auth/refresh" in (_cookie(r, REFRESH_COOKIE) or "")

    def test_remember_me_only_affects_the_refresh_cookie(
        self, client: FlaskClient, admin: User
    ) -> None:
        remembered = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": True},
        )
        client.delete_cookie(ACCESS_COOKIE)
        client.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth/refresh")
        session_only = client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "remember": False},
        )

        assert "Max-Age" in (_cookie(remembered, REFRESH_COOKIE) or "")
        # No Max-Age => a session cookie that dies with the browser.
        assert "Max-Age" not in (_cookie(session_only, REFRESH_COOKIE) or "")

        # The access cookie's lifetime must be identical either way.
        assert "Max-Age=900" in (_cookie(remembered, ACCESS_COOKIE) or "")
        assert "Max-Age=900" in (_cookie(session_only, ACCESS_COOKIE) or "")


class TestRefreshRotation:
    def test_refresh_issues_a_new_pair(self, auth_client: FlaskClient) -> None:
        r = auth_client.post("/api/v1/auth/refresh")
        assert r.status_code == 200
        assert _cookie(r, ACCESS_COOKIE) and _cookie(r, REFRESH_COOKIE)

    def test_old_token_is_revoked_on_rotation(
        self, auth_client: FlaskClient, session: Any, admin: User
    ) -> None:
        auth_client.post("/api/v1/auth/refresh")
        tokens = list(
            session.scalars(select(RefreshToken).where(RefreshToken.user_id == admin.id))
        )
        assert len(tokens) == 2
        spent = [t for t in tokens if t.rotated_to is not None]
        assert len(spent) == 1
        assert spent[0].revoked_at is not None

    def test_reuse_revokes_the_whole_family(
        self, client: FlaskClient, admin: User, session: Any
    ) -> None:
        """A replayed refresh token means it leaked, so every descendant dies.

        This is also why the frontend's refresh must be single-flight: six
        parallel refreshes look exactly like theft.
        """
        login = client.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        original = client.get_cookie(REFRESH_COOKIE, path="/api/v1/auth/refresh")
        assert original is not None
        original_value = original.value
        assert login.status_code == 200

        assert client.post("/api/v1/auth/refresh").status_code == 200

        # Replay the spent token.
        client.set_cookie(REFRESH_COOKIE, original_value, path="/api/v1/auth/refresh")
        replay = client.post("/api/v1/auth/refresh")
        assert replay.status_code == 401

        session.expire_all()
        tokens = list(
            session.scalars(select(RefreshToken).where(RefreshToken.user_id == admin.id))
        )
        assert tokens and all(t.revoked_at is not None for t in tokens), (
            "reuse must revoke every token in the family"
        )

    def test_refresh_without_a_cookie_fails(self, client: FlaskClient) -> None:
        assert client.post("/api/v1/auth/refresh").status_code == 401


class TestSessionLifecycle:
    def test_me_requires_authentication(self, client: FlaskClient) -> None:
        assert client.get("/api/v1/auth/me").status_code == 401

    def test_me_returns_the_signed_in_user(self, auth_client: FlaskClient) -> None:
        r = auth_client.get("/api/v1/auth/me")
        assert r.status_code == 200
        assert r.get_json()["user"]["email"] == ADMIN_EMAIL

    def test_logout_clears_cookies_and_revokes(self, auth_client: FlaskClient) -> None:
        r = auth_client.post("/api/v1/auth/logout")
        assert r.status_code == 200
        assert all("Max-Age=0" in c for c in _cookie_headers(r))
        assert auth_client.get("/api/v1/auth/me").status_code == 401

    def test_logout_works_without_a_valid_access_token(
        self, auth_client: FlaskClient
    ) -> None:
        # Otherwise an expired session could never clear its own cookies.
        auth_client.delete_cookie(ACCESS_COOKIE)
        assert auth_client.post("/api/v1/auth/logout").status_code == 200

    def test_deactivating_a_user_invalidates_a_live_token(
        self, auth_client: FlaskClient, admin: User, session: Any
    ) -> None:
        assert auth_client.get("/api/v1/auth/me").status_code == 200
        admin.is_active = False
        session.flush()
        assert auth_client.get("/api/v1/auth/me").status_code == 401


class TestErrorEnvelope:
    def test_carries_the_request_id(self, client: FlaskClient) -> None:
        r = client.get("/api/v1/auth/me")
        body = r.get_json()
        assert body["error"]["request_id"] == r.headers["X-Request-ID"]

    def test_shape_is_consistent(self, client: FlaskClient) -> None:
        body = client.get("/api/v1/auth/me").get_json()
        assert set(body) == {"error"}
        assert {"code", "message", "request_id"} <= set(body["error"])


class TestHealth:
    def test_healthz_needs_no_database(self, client: FlaskClient) -> None:
        r = client.get("/healthz")
        assert r.status_code == 200
        assert r.get_json() == {"status": "ok"}

    def test_version_is_public(self, client: FlaskClient, app: Flask) -> None:
        r = client.get("/version")
        assert r.status_code == 200
        assert r.get_json()["env"] == "testing"
