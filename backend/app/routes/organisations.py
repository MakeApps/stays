"""Organisation endpoints.

Creating one is admin-only, so a manager cannot stand up a tenant of their own.
Reading the list you belong to is not here at all -- it is ``/auth/organisations``,
because it is a fact about your session rather than about any one organisation.
"""

from __future__ import annotations

import uuid
from typing import Any

from flask import Blueprint, jsonify
from pydantic import BaseModel, ConfigDict, Field

from app.auth.decorators import current_organisation, current_user, require_permission
from app.auth.permissions import ORGANISATION_WRITE
from app.common.api import parse_body
from app.common.errors import PermissionDeniedError, ValidationError
from app.common.money import currency_for
from app.extensions import db
from app.models.organisation import Organisation
from app.models.user import Role
from app.services.organisation_service import (
    MAX_NAME_LENGTH,
    MIN_NAME_LENGTH,
    OrganisationService,
)

bp = Blueprint("organisations", __name__)


def _service() -> OrganisationService:
    return OrganisationService(db.session)


def _serialise(organisation: Organisation, role: Role | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "id": str(organisation.id),
        "name": organisation.name,
        "currency": organisation.currency,
        "currency_symbol": currency_for(organisation.currency).symbol,
        "created_at": organisation.created_at.isoformat() + "Z",
    }
    if role is not None:
        body["role"] = role.value
    return body


class OrganisationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=MIN_NAME_LENGTH, max_length=MAX_NAME_LENGTH)
    # Optional: an omitted currency is the default, not an error, so a client
    # written before currencies existed still creates organisations.
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class OrganisationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=MIN_NAME_LENGTH, max_length=MAX_NAME_LENGTH)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


@bp.post("")
@require_permission(ORGANISATION_WRITE)
def create_organisation() -> Any:
    """Stand up a new organisation, with the caller as its admin.

    The session is *not* moved into it. Switching mints new cookies, and doing
    that as a side effect of a create would drop an admin out of the
    organisation they were working in without asking. The client switches when
    the person says so.
    """
    payload = parse_body(OrganisationCreate)
    organisation = _service().create(
        name=payload.name, owner=current_user(), currency=payload.currency
    )
    db.session.commit()
    return jsonify(_serialise(organisation, Role.ADMIN)), 201


@bp.patch("/<uuid:organisation_id>")
@require_permission(ORGANISATION_WRITE)
def update_organisation(organisation_id: uuid.UUID) -> Any:
    """Rename the organisation, change the currency its books are kept in, or both."""
    # Only the one you are acting in. Holding organisation:write here says
    # nothing about the organisation over there -- you may be a manager in it,
    # or not a member at all.
    if organisation_id != current_organisation().id:
        raise PermissionDeniedError("Switch to that organisation before changing it.")

    payload = parse_body(OrganisationUpdate)
    if payload.name is None and payload.currency is None:
        raise ValidationError("Nothing to change.")

    service = _service()
    organisation = current_organisation()
    if payload.name is not None:
        service.rename(organisation, payload.name)
    if payload.currency is not None:
        service.set_currency(organisation, payload.currency)
    db.session.commit()
    return jsonify(_serialise(organisation)), 200
