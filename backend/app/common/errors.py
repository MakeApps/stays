"""Domain exceptions and the single error envelope every endpoint returns.

Envelope::

    {
      "error": {
        "code": "booking_conflict",
        "message": "Those dates overlap an existing booking.",
        "details": {...},          # optional, machine-readable
        "request_id": "018f..."    # always present, matches the log line
      }
    }

``request_id`` is the reason this is worth centralising: a user can screenshot
an error and support can find the exact log entry and stack trace from it.
"""

from __future__ import annotations

from typing import Any

from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException


class AppError(Exception):
    """Base for every expected, user-facing failure."""

    status_code: int = 400
    code: str = "bad_request"
    message: str = "The request could not be processed."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
        code: str | None = None,
    ) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message
        if code:
            self.code = code
        self.details = details or {}

    def to_dict(self, request_id: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.details:
            body["details"] = self.details
        if request_id:
            body["request_id"] = request_id
        return {"error": body}


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Some fields need attention."


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthenticated"
    message = "Sign in to continue."


class InvalidCredentialsError(AuthenticationError):
    code = "invalid_credentials"
    # Deliberately does not distinguish unknown email from wrong password —
    # that difference is an account-enumeration oracle.
    message = "Email or password is incorrect."


class TokenExpiredError(AuthenticationError):
    code = "token_expired"
    message = "Your session expired. Sign in again."


class PermissionDeniedError(AppError):
    status_code = 403
    code = "permission_denied"
    message = "You do not have access to that."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "That record does not exist."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "That change conflicts with existing data."


class BookingConflictError(ConflictError):
    code = "booking_conflict"
    message = "Those dates are already booked for this condo."


class DuplicateError(ConflictError):
    code = "duplicate"
    message = "That value is already taken."


class UnsupportedMediaError(AppError):
    status_code = 415
    code = "unsupported_media_type"
    message = "That file type is not accepted."


class PayloadTooLargeError(AppError):
    status_code = 413
    code = "payload_too_large"
    message = "That file is too large."


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many attempts. Try again shortly."


class FeatureUnavailableError(AppError):
    status_code = 501
    code = "feature_unavailable"
    message = "That feature is not available in this environment."


def register_error_handlers(app: Flask) -> None:
    import structlog

    log = structlog.get_logger("app.error")

    def _request_id() -> str | None:
        from flask import g

        return getattr(g, "request_id", None)

    @app.errorhandler(AppError)
    def _handle_app_error(exc: AppError):  # type: ignore[no-untyped-def]
        rid = _request_id()
        # 4xx is a client problem: log it, but a stack trace is just noise.
        log.warning(
            "app_error",
            code=exc.code,
            status=exc.status_code,
            detail_keys=sorted(exc.details),
        )
        return jsonify(exc.to_dict(rid)), exc.status_code

    @app.errorhandler(HTTPException)
    def _handle_http_error(exc: HTTPException):  # type: ignore[no-untyped-def]
        rid = _request_id()
        status = exc.code or 500
        mapped = AppError(
            exc.description or "Request failed.",
            code={
                400: "bad_request",
                401: "unauthenticated",
                403: "permission_denied",
                404: "not_found",
                405: "method_not_allowed",
                413: "payload_too_large",
                415: "unsupported_media_type",
                429: "rate_limited",
            }.get(status, "http_error"),
        )
        mapped.status_code = status
        if status >= 500:
            log.error("http_error", status=status, path=request.path, exc_info=exc)
        else:
            log.warning("http_error", status=status, path=request.path)
        return jsonify(mapped.to_dict(rid)), status

    @app.errorhandler(Exception)
    def _handle_unexpected(exc: Exception):  # type: ignore[no-untyped-def]
        rid = _request_id()
        # Genuinely unexpected: full traceback, and never leak internals outward.
        log.error("unhandled_exception", path=request.path, exc_info=exc)
        body = AppError(
            "Something went wrong on our side.", code="internal_error"
        ).to_dict(rid)
        return jsonify(body), 500
