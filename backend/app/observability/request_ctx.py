"""Per-request context: request id, timing, and the structured access log.

``request_id`` and ``user_id`` are bound once into structlog contextvars, so no
individual logging call ever has to pass them. The id is echoed back in the
``X-Request-ID`` response header and embedded in every error envelope, which is
what lets a support screenshot map to a trace in one lookup.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from flask import Flask, Response, g, request

from app.common.current_user import set_current_user_id
from app.models.base import uuid7

access_log = structlog.get_logger("app.access")

# Probes run every few seconds; logging them buries the real traffic.
SILENT_PATHS = frozenset({"/healthz", "/readyz", "/version"})


def _client_ip() -> str:
    # Only trust the first hop when a proxy is actually in front of us; see
    # ProxyFix in create_app.
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "-"


def _is_silent(path: str) -> bool:
    return any(path.endswith(p) for p in SILENT_PATHS)


def register_request_context(app: Flask) -> None:
    @app.before_request
    def _open_context() -> None:
        incoming = request.headers.get("X-Request-ID", "")
        rid = incoming if _looks_like_id(incoming) else str(uuid7())

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=rid,
            method=request.method,
            path=request.path,
            ip=_client_ip(),
        )

        g.request_id = rid
        g.t_start = time.perf_counter()
        g.db_ms = 0.0
        g.db_queries = 0
        set_current_user_id(None)

    @app.after_request
    def _close_context(response: Response) -> Response:
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")

        if _is_silent(request.path):
            return response

        duration_ms = (time.perf_counter() - getattr(g, "t_start", time.perf_counter())) * 1000
        payload: dict[str, Any] = {
            "status": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "route": request.url_rule.rule if request.url_rule else None,
            "db_ms": round(getattr(g, "db_ms", 0.0), 2),
            "db_queries": getattr(g, "db_queries", 0),
        }

        if response.status_code >= 500:
            access_log.error("http_request", **payload)
        elif response.status_code >= 400:
            access_log.warning("http_request", **payload)
        else:
            access_log.info("http_request", **payload)

        threshold = app.config["SETTINGS"].N_PLUS_ONE_THRESHOLD
        if payload["db_queries"] > threshold:
            # Almost always a lazy-load that slipped into a serialiser. Catching
            # it here is how it gets fixed before it reaches production.
            access_log.warning(
                "n_plus_one_suspected",
                db_queries=payload["db_queries"],
                threshold=threshold,
                route=payload["route"],
            )

        return response

    @app.teardown_request
    def _clear_actor(_exc: BaseException | None = None) -> None:
        set_current_user_id(None)
        structlog.contextvars.clear_contextvars()


def _looks_like_id(value: str) -> bool:
    """Accept an upstream request id only if it is a plausible UUID.

    Echoing arbitrary client input into every log line and response header
    would be a log-injection vector.
    """
    if not value or len(value) > 64:
        return False
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True
