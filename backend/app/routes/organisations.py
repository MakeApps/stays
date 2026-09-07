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
from app.common.errors import PermissionDeniedError
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
        "created_at": organisation.created_at.isoformat() + "Z",
    }
    if role is not None:
        body["role"] = role.value
    return body


class OrganisationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=MIN_NAME_LENGTH, max_length=MAX_NAME_LENGTH)


class OrganisationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=MIN_NAME_LENGTH, max_length=MAX_NAME_LENGTH)


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
    organisation = _service().create(name=payload.name, owner=current_user())
    db.session.commit()
    return jsonify(_serialise(organisation, Role.ADMIN)), 201


@bp.patch("/<uuid:organisation_id>")
@require_permission(ORGANISATION_WRITE)
def rename_organisation(organisation_id: uuid.UUID) -> Any:
    # Only the one you are acting in. Holding organisation:write here says
    # nothing about the organisation over there -- you may be a manager in it,
    # or not a member at all.
    if organisation_id != current_organisation().id:
        raise PermissionDeniedError("Switch to that organisation before renaming it.")

    payload = parse_body(OrganisationUpdate)
    organisation = _service().rename(current_organisation(), payload.name)
    db.session.commit()
    return jsonify(_serialise(organisation)), 200
