"""Every endpoint must declare its authorisation.

This is the test that keeps authorisation from being forgotten as the API
grows. A new route either carries ``@require_permission``/``@require_auth`` or
is explicitly marked ``@public`` — anything else fails the build rather than
silently shipping an open endpoint.
"""

from __future__ import annotations

from flask import Flask

from app.auth.decorators import describe_route
from app.auth.permissions import ALL_CAPABILITIES

# Endpoints that are open by design.
EXPECTED_PUBLIC = {
    "health.healthz",
    "health.readyz",
    "health.version",
    "health_prefixed.healthz",
    "health_prefixed.readyz",
    "health_prefixed.version",
    "auth.login",
    "auth.refresh",
    "auth.logout",
    "files.serve_file",
}


# Flask registers this itself and it serves nothing of ours — the API has no
# static assets, the Next.js app owns those.
FRAMEWORK_ENDPOINTS = {"static"}


def _endpoints(app: Flask) -> list[tuple[str, str]]:
    return [
        (rule.endpoint, describe_route(app.view_functions[rule.endpoint]) or "MISSING")
        for rule in app.url_map.iter_rules()
        if rule.endpoint not in FRAMEWORK_ENDPOINTS
    ]


def test_no_endpoint_is_missing_a_declaration(app: Flask) -> None:
    missing = [ep for ep, cap in _endpoints(app) if cap == "MISSING"]
    assert not missing, (
        "These endpoints declare no capability. Add @require_permission(...), "
        f"@require_auth, or @public: {sorted(missing)}"
    )


def test_public_endpoints_are_the_expected_ones(app: Flask) -> None:
    actual = {ep for ep, cap in _endpoints(app) if cap == "*public*"}
    unexpected = actual - EXPECTED_PUBLIC
    assert not unexpected, (
        "New unauthenticated endpoints appeared. If that is deliberate, add them "
        f"to EXPECTED_PUBLIC with a reason: {sorted(unexpected)}"
    )


def test_declared_capabilities_exist(app: Flask) -> None:
    sentinels = {"*public*", "*authenticated*", "MISSING"}
    unknown = {
        cap for _, cap in _endpoints(app) if cap not in sentinels and cap not in ALL_CAPABILITIES
    }
    assert not unknown, f"Routes declare capabilities that do not exist: {sorted(unknown)}"


def test_health_endpoints_never_require_auth(app: Flask) -> None:
    # An orchestrator probe cannot authenticate, so a guarded /healthz means
    # the platform restarts a perfectly healthy process.
    for endpoint, capability in _endpoints(app):
        if endpoint.split(".")[-1] in {"healthz", "readyz", "version"}:
            assert capability == "*public*", f"{endpoint} must stay public"
