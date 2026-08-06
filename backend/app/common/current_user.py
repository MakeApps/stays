"""The acting user for the current request, as a context variable.

Kept deliberately separate from the auth package so that ``models.base`` can
stamp audit columns without importing anything that imports models — that
cycle is the usual reason audit stamping ends up copy-pasted into services.

A ContextVar (rather than Flask's ``g``) means background jobs, CLI commands
and tests can set an actor without faking a request context.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

_current_user_id: ContextVar[uuid.UUID | None] = ContextVar("current_user_id", default=None)


def get_current_user_id() -> uuid.UUID | None:
    return _current_user_id.get()


def set_current_user_id(user_id: uuid.UUID | None) -> None:
    _current_user_id.set(user_id)


@contextmanager
def acting_as(user_id: uuid.UUID | None) -> Iterator[None]:
    """Run a block attributed to ``user_id``, restoring the previous actor after.

    Used by CLI commands and seeds so their writes are attributed rather than
    landing with a null ``created_by``.
    """
    token = _current_user_id.set(user_id)
    try:
        yield
    finally:
        _current_user_id.reset(token)
