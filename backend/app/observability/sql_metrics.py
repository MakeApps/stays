"""Per-request SQL instrumentation.

Counts queries and cumulative database time so the access log can carry
``db_ms`` / ``db_queries``, and logs any statement slower than
``SLOW_QUERY_MS``. Together with the N+1 alarm in ``request_ctx`` this is what
surfaces a lazy-load creeping into the dashboard or calendar serialiser while
it is still cheap to fix.
"""

from __future__ import annotations

import re
import time

import structlog
from flask import g, has_request_context
from sqlalchemy import event
from sqlalchemy.engine import Engine

sql_log = structlog.get_logger("app.sql")

_WS = re.compile(r"\s+")


def _squash(statement: str, limit: int = 2000) -> str:
    return _WS.sub(" ", statement).strip()[:limit]


def install_sql_metrics(slow_query_ms: int) -> None:
    """Attach engine-wide listeners. Idempotent — safe across repeated app builds."""

    if getattr(install_sql_metrics, "_installed", False):
        return

    @event.listens_for(Engine, "before_cursor_execute")
    def _before(  # type: ignore[no-untyped-def]
        conn, cursor, statement, parameters, context, executemany
    ) -> None:
        context._ls_started = time.perf_counter()

    @event.listens_for(Engine, "after_cursor_execute")
    def _after(  # type: ignore[no-untyped-def]
        conn, cursor, statement, parameters, context, executemany
    ) -> None:
        started: float | None = getattr(context, "_ls_started", None)
        if started is None:
            return
        elapsed_ms = (time.perf_counter() - started) * 1000

        if has_request_context():
            g.db_ms = getattr(g, "db_ms", 0.0) + elapsed_ms
            g.db_queries = getattr(g, "db_queries", 0) + 1

        if elapsed_ms > slow_query_ms:
            # Parameters are deliberately omitted — they routinely contain
            # guest names, emails and phone numbers.
            sql_log.warning(
                "slow_query",
                duration_ms=round(elapsed_ms, 2),
                statement=_squash(statement),
                executemany=executemany,
            )

    install_sql_metrics._installed = True  # type: ignore[attr-defined]


def reset_for_tests() -> None:
    """Allow re-installation in test suites that rebuild the app repeatedly."""
    if hasattr(install_sql_metrics, "_installed"):
        delattr(install_sql_metrics, "_installed")


def current_query_count() -> int:
    """Query count for the active request — used by the query-budget tests."""
    return getattr(g, "db_queries", 0) if has_request_context() else 0
