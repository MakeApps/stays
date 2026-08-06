"""Request validation and response helpers.

Pydantic models are the contract for both directions. Validation failures are
converted into the standard error envelope with per-field messages, and only
field *names* reach the logs — the values routinely contain guest names,
emails and phone numbers.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar, cast

from flask import request
from pydantic import BaseModel, ValidationError as PydanticValidationError

from app.common.errors import ValidationError

P = ParamSpec("P")
R = TypeVar("R")
M = TypeVar("M", bound=BaseModel)


def _format_errors(exc: PydanticValidationError) -> dict[str, list[str]]:
    fields: dict[str, list[str]] = {}
    for err in exc.errors():
        location = ".".join(str(part) for part in err["loc"] if part != "body") or "_"
        fields.setdefault(location, []).append(err["msg"])
    return fields


def parse_body(model: type[M]) -> M:
    payload = request.get_json(silent=True)
    if payload is None:
        raise ValidationError("Expected a JSON body.")
    try:
        return model.model_validate(payload)
    except PydanticValidationError as exc:
        raise ValidationError(details={"fields": _format_errors(exc)}) from exc


def parse_query(model: type[M]) -> M:
    # Flatten to single values; repeated params are rare here and explicit
    # list fields handle them where needed.
    try:
        return model.model_validate(dict(request.args))
    except PydanticValidationError as exc:
        raise ValidationError(
            "Some filters are not valid.", details={"fields": _format_errors(exc)}
        ) from exc


def parse_form(model: type[M]) -> M:
    try:
        return model.model_validate(dict(request.form))
    except PydanticValidationError as exc:
        raise ValidationError(details={"fields": _format_errors(exc)}) from exc


def body(model: type[BaseModel]) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Inject a validated body as the ``payload`` keyword argument."""

    def decorator(fn: Callable[P, R]) -> Callable[P, R]:
        from functools import wraps

        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            kwargs["payload"] = parse_body(model)  # type: ignore[index]
            return fn(*args, **kwargs)

        return cast(Callable[P, R], wrapper)

    return decorator


def query(model: type[BaseModel]) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Inject validated query params as the ``params`` keyword argument."""

    def decorator(fn: Callable[P, R]) -> Callable[P, R]:
        from functools import wraps

        @wraps(fn)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            kwargs["params"] = parse_query(model)  # type: ignore[index]
            return fn(*args, **kwargs)

        return cast(Callable[P, R], wrapper)

    return decorator


def ok(data: Any, status: int = 200) -> tuple[Any, int]:
    from flask import jsonify

    if isinstance(data, BaseModel):
        return jsonify(data.model_dump(mode="json")), status
    return jsonify(data), status


def created(data: Any) -> tuple[Any, int]:
    return ok(data, 201)


def no_content() -> tuple[str, int]:
    return "", 204
