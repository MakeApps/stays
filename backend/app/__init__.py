"""Application factory."""

from __future__ import annotations

from typing import Any

import structlog
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from app.common.errors import register_error_handlers
from app.config import Settings, get_settings
from app.extensions import cors, db, limiter
from app.observability.logging_config import configure_logging
from app.observability.request_ctx import register_request_context
from app.observability.sql_metrics import install_sql_metrics
from app.storage import build_storage

log = structlog.get_logger("app")


def create_app(settings: Settings | None = None) -> Flask:
    s = settings or get_settings()
    s.assert_production_safe()

    configure_logging(s.ENV, level="DEBUG" if s.DEBUG else "INFO")

    app = Flask(__name__)
    app.config.update(
        SETTINGS=s,
        SECRET_KEY=s.SECRET_KEY,
        SQLALCHEMY_DATABASE_URI=s.DATABASE_URL,
        SQLALCHEMY_ENGINE_OPTIONS={
            "echo": s.SQL_ECHO,
            "pool_pre_ping": True,
            "pool_size": s.DB_POOL_SIZE,
            "max_overflow": s.DB_MAX_OVERFLOW,
            # MySQL closes idle connections after wait_timeout (8h default);
            # recycling below that avoids "server has gone away".
            "pool_recycle": s.DB_POOL_RECYCLE,
        },
        MAX_CONTENT_LENGTH=s.UPLOAD_MAX_BYTES,
        JSON_SORT_KEYS=False,
        PROPAGATE_EXCEPTIONS=False,
    )

    # Only meaningful behind a reverse proxy; harmless locally. Without it,
    # rate limiting keys on the proxy's IP and every client shares a bucket.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[method-assign]

    db.init_app(app)
    install_sql_metrics(s.SLOW_QUERY_MS)

    cors.init_app(
        app,
        resources={rf"{s.API_PREFIX}/*": {"origins": s.cors_origin_list}},
        supports_credentials=True,
        expose_headers=["X-Request-ID"],
    )
    limiter.init_app(app)

    app.extensions["storage"] = build_storage(s)

    register_request_context(app)
    register_error_handlers(app)
    _register_blueprints(app, s)
    _register_cli(app)

    log.info(
        "app_ready",
        env=s.ENV,
        storage=s.STORAGE_BACKEND,
        api_prefix=s.API_PREFIX,
        version=s.APP_VERSION,
    )
    return app


def _register_blueprints(app: Flask, s: Settings) -> None:
    from app.routes.auth import bp as auth_bp
    from app.routes.condos import bp as condos_bp
    from app.routes.files import bp as files_bp
    from app.routes.health import bp as health_bp

    # Health endpoints live both at the root (for orchestrator probes, which
    # rarely know the API prefix) and under the prefix for consistency.
    app.register_blueprint(health_bp)
    app.register_blueprint(health_bp, url_prefix=s.API_PREFIX, name="health_prefixed")

    app.register_blueprint(auth_bp, url_prefix=f"{s.API_PREFIX}/auth")
    app.register_blueprint(condos_bp, url_prefix=f"{s.API_PREFIX}/condos")
    app.register_blueprint(files_bp, url_prefix=s.API_PREFIX)


def _register_cli(app: Flask) -> None:
    from app.cli import register_cli

    register_cli(app)


def shell_context() -> dict[str, Any]:  # pragma: no cover - convenience
    from app import models

    return {"db": db, "models": models}
