"""Security headers and the production boot guard.

The guard exists because the failure it prevents is silent: a placeholder
credential or a generated signing key works perfectly in development and only
becomes a problem once real data is behind it.
"""

from __future__ import annotations

import pytest
from flask.testing import FlaskClient

from app.config import Settings

# _env_file=None keeps these hermetic: without it Settings would pick up the
# developer's .env.local and the "no key provided" case could never be tested.
HERMETIC: dict[str, object] = {"_env_file": None}

GOOD: dict[str, object] = {
    "ENV": "production",
    "DEBUG": False,
    "SECRET_KEY": "k" * 48,
    "JWT_SECRET": "j" * 48,
    "ADMIN_PASSWORD": "7Gq2xVn4TpLw9Rd6",
    "CORS_ORIGINS": "https://stays.example.com",
}


def refuse(**overrides: object) -> str:
    settings = Settings(**{**GOOD, **overrides, **HERMETIC})  # type: ignore[arg-type]
    with pytest.raises(RuntimeError) as caught:
        settings.assert_production_safe()
    return str(caught.value)


class TestProductionGuard:
    def test_a_correct_configuration_boots(self) -> None:
        Settings(**{**GOOD, **HERMETIC}).assert_production_safe()  # type: ignore[arg-type]

    def test_development_is_never_blocked(self) -> None:
        # The guard must not make local work annoying; it is a production gate.
        Settings(ENV="development", DEBUG=True, **HERMETIC).assert_production_safe()  # type: ignore[arg-type]

    def test_generated_signing_keys_are_refused(self) -> None:
        """A per-process random key differs between workers and across restarts,
        so every session would break on deploy. This is a correctness guard as
        much as a security one."""
        settings = Settings(
            ENV="production", DEBUG=False, ADMIN_PASSWORD="7Gq2xVn4TpLw9Rd6",
            CORS_ORIGINS="https://stays.example.com", **HERMETIC,  # type: ignore[arg-type]
        )
        with pytest.raises(RuntimeError) as caught:
            settings.assert_production_safe()
        assert "SECRET_KEY" in str(caught.value)

    def test_debug_is_refused(self) -> None:
        assert "DEBUG" in refuse(DEBUG=True)

    def test_wildcard_cors_is_refused(self) -> None:
        # Credentials ride on cookies; "*" would let any origin use them.
        assert "CORS_ORIGINS" in refuse(CORS_ORIGINS="*")

    def test_s3_without_a_bucket_is_refused(self) -> None:
        assert "S3_BUCKET" in refuse(STORAGE_BACKEND="s3")

    @pytest.mark.parametrize(
        "password",
        ["ChangeMe!2026", "short", "admin12345678", "my-secret-value", "letmein12345"],
    )
    def test_placeholder_admin_passwords_are_refused(self, password: str) -> None:
        assert "ADMIN_PASSWORD" in refuse(ADMIN_PASSWORD=password)

    def test_a_blank_admin_password_is_allowed(self) -> None:
        """Blank means `create-admin` generates one, which is the safest path."""
        Settings(**{**GOOD, "ADMIN_PASSWORD": "", **HERMETIC}).assert_production_safe()  # type: ignore[arg-type]


class TestSecurityHeaders:
    def test_present_on_every_response(self, client: FlaskClient) -> None:
        response = client.get("/healthz")
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["Referrer-Policy"] == "no-referrer"
        assert "default-src 'none'" in response.headers["Content-Security-Policy"]

    def test_authenticated_responses_are_never_cached(self, auth_client: FlaskClient) -> None:
        response = auth_client.get("/api/v1/condos")
        assert response.headers["Cache-Control"] == "no-store"

    def test_hsts_is_not_set_outside_production(self, client: FlaskClient) -> None:
        # Setting it on localhost would pin the browser to HTTPS for every
        # other project served from the same host.
        assert "Strict-Transport-Security" not in client.get("/healthz").headers

    def test_errors_carry_the_headers_too(self, client: FlaskClient) -> None:
        response = client.get("/api/v1/condos")
        assert response.status_code == 401
        assert response.headers["X-Content-Type-Options"] == "nosniff"
