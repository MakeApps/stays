"""Liveness, readiness and build info.

`/healthz` must never touch the database. A liveness probe that fails during a
database blip causes the orchestrator to restart every pod, turning a
30-second hiccup into a full outage. Dependency checks belong in `/readyz`,
which takes a pod out of rotation without killing it.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import structlog
from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from app.extensions import db

log = structlog.get_logger("app.health")

bp = Blueprint("health", __name__)

# Probe results cached so a 5-second Kubernetes probe does not hammer S3 or
# re-read alembic_version on every call.
_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def _probe(
    name: str, fn: Callable[[], Any], *, timeout: float = 2.0, cache_ttl: float = 0.0
) -> dict[str, Any]:
    now = time.monotonic()
    if cache_ttl and (hit := _cache.get(name)) and now - hit[0] < cache_ttl:
        return hit[1]

    started = time.perf_counter()
    try:
        fn()
        result: dict[str, Any] = {
            "ok": True,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        }
    except Exception as exc:  # noqa: BLE001 - a probe reports, never raises
        result = {
            "ok": False,
            "latency_ms": round((time.perf_counter() - started) * 1000, 2),
            "error": type(exc).__name__,
        }
        log.warning("readiness_probe_failed", probe=name, error=str(exc)[:200])

    if result["latency_ms"] > timeout * 1000:
        result["ok"] = False
        result["error"] = "timeout"

    if cache_ttl:
        _cache[name] = (now, result)
    return result


@bp.get("/healthz")
def healthz() -> Any:
    return jsonify({"status": "ok"}), 200


@bp.get("/readyz")
def readyz() -> Any:
    checks = {
        "database": _probe("database", lambda: db.session.execute(text("SELECT 1"))),
        "storage": _probe(
            "storage", lambda: current_app.extensions["storage"].health(), cache_ttl=30.0
        ),
        "migrations": _probe("migrations", _alembic_at_head, cache_ttl=60.0),
    }
    ready = all(c["ok"] for c in checks.values())
    body = {"status": "ready" if ready else "degraded", "checks": checks}
    return jsonify(body), (200 if ready else 503)


@bp.get("/version")
def version() -> Any:
    s = current_app.config["SETTINGS"]
    return jsonify(
        {
            "version": s.APP_VERSION,
            "git_sha": s.APP_GIT_SHA,
            "env": s.ENV,
        }
    ), 200


def _alembic_at_head() -> None:
    """Fail readiness when the schema is behind the code.

    Stops a rolling deploy routing traffic to a process whose code expects
    columns the database has not got yet.
    """
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    from app.config import BACKEND_ROOT

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    head = ScriptDirectory.from_config(cfg).get_current_head()

    row = db.session.execute(text("SELECT version_num FROM alembic_version")).first()
    current = row[0] if row else None
    if current != head:
        raise RuntimeError(f"schema at {current!r}, code expects {head!r}")
