"""The acting organisation for the current request, as a context variable.

The tenant boundary is enforced by a query filter in ``models.base`` that reads
this, so it lives beside :mod:`app.common.current_user` and for the same
reason: ``models.base`` must be able to see it without importing anything that
imports models.

``None`` means *unscoped*, and that is deliberate — sign-in has to find a user
before it knows which organisation they are acting in, and the CLI, seeds and
migrations legitimately operate across all of them. Every authenticated request
sets it, and :func:`app.auth.decorators.require_auth` is what guarantees that.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

_current_org_id: ContextVar[uuid.UUID | None] = ContextVar("current_org_id", default=None)


def get_current_org_id() -> uuid.UUID | None:
    return _current_org_id.get()


def set_current_org_id(org_id: uuid.UUID | None) -> None:
    _current_org_id.set(org_id)


@contextmanager
def scoped_to(org_id: uuid.UUID | None) -> Iterator[None]:
    """Run a block inside one organisation, restoring the previous scope after.

    Used by the CLI, the seeds and the tests. Passing ``None`` deliberately
    lifts the filter, which is how a migration or a cross-tenant report reads
    every row.
    """
    token = _current_org_id.set(org_id)
    try:
        yield
    finally:
        _current_org_id.reset(token)
