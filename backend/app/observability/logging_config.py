"""Structured logging.

structlog wrapping stdlib ``dictConfig`` so third-party loggers (SQLAlchemy,
boto3, werkzeug) land in the same JSON stream. Containers never write log
files — the platform collects stdout.

Redaction is a *processor*, not developer discipline. Guest phone and email are
personal data under Thailand's PDPA, and this application logs alongside
financial records, so leaking them into a log aggregator is a real problem.
Request bodies are never logged; only field names on validation failure.
"""

from __future__ import annotations

import logging
import logging.config
import re
import sys
from typing import Any, MutableMapping

import structlog

SENSITIVE_KEYS = frozenset(
    {
        "password",
        "new_password",
        "current_password",
        "token",
        "access_token",
        "refresh_token",
        "token_hash",
        "authorization",
        "secret",
        "api_key",
        "secret_key",
        "jwt_secret",
        "s3_secret_access_key",
    }
)

PII_KEYS = frozenset({"email", "guest_email", "phone", "guest_phone", "admin_email"})

_EMAIL_RE = re.compile(r"^([^@]{1,2})[^@]*(@.*)$")


def _mask_email(value: str) -> str:
    m = _EMAIL_RE.match(value)
    return f"{m.group(1)}***{m.group(2)}" if m else "***"


def _mask_phone(value: str) -> str:
    digits = [c for c in value if c.isdigit()]
    if len(digits) <= 4:
        return "***"
    return f"{value[:4]}…{''.join(digits[-4:])}"


def redact(
    _logger: Any, _method: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    for key in list(event_dict):
        lowered = key.lower()
        if lowered in SENSITIVE_KEYS:
            event_dict[key] = "***"
        elif lowered in PII_KEYS and isinstance(event_dict[key], str):
            value = event_dict[key]
            event_dict[key] = _mask_email(value) if "@" in value else _mask_phone(value)
    return event_dict


def configure_logging(env: str, *, level: str = "INFO") -> None:
    human = env == "development"

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        redact,
    ]

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "structured": {
                    "()": structlog.stdlib.ProcessorFormatter,
                    "processors": [
                        structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                        structlog.dev.ConsoleRenderer(colors=True)
                        if human
                        else structlog.processors.JSONRenderer(),
                    ],
                    "foreign_pre_chain": shared_processors,
                }
            },
            "handlers": {
                "stdout": {
                    "class": "logging.StreamHandler",
                    "stream": sys.stdout,
                    "formatter": "structured",
                }
            },
            "loggers": {
                "": {"handlers": ["stdout"], "level": level},
                # INFO here logs every statement — never in production.
                "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
                "botocore": {"level": "WARNING", "propagate": True},
                "boto3": {"level": "WARNING", "propagate": True},
                "urllib3": {"level": "WARNING", "propagate": True},
                # The app emits its own structured access log.
                "werkzeug": {"level": "WARNING", "propagate": True},
            },
        }
    )

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
