"""Condo endpoints."""

from __future__ import annotations

import uuid
from typing import Any

from flask import Blueprint, jsonify, request

from app.auth.decorators import require_permission
from app.auth.permissions import CONDO_DELETE, CONDO_READ, CONDO_WRITE
from app.common.api import parse_body, parse_query
from app.common.errors import ValidationError
from app.extensions import db
from app.repositories.condo_repo import CondoRepository
from app.schemas.condo import CondoCreate, CondoListQuery, CondoUpdate
from app.services.condo_service import CondoService

bp = Blueprint("condos", __name__)


def _service() -> CondoService:
    return CondoService(CondoRepository(db.session))


@bp.get("")
@require_permission(CONDO_READ)
def list_condos() -> Any:
    service = _service()
    params = parse_query(CondoListQuery)
    page, counts = service.list(params)
    body = page.envelope(lambda c: service.serialise(c).model_dump(mode="json"))
    body["facets"] = {"status": counts}
    return jsonify(body), 200


@bp.post("")
@require_permission(CONDO_WRITE)
def create_condo() -> Any:
    service = _service()
    condo = service.create(parse_body(CondoCreate))
    db.session.commit()
    return jsonify(service.serialise(condo).model_dump(mode="json")), 201


@bp.get("/<uuid:condo_id>")
@require_permission(CONDO_READ)
def get_condo(condo_id: uuid.UUID) -> Any:
    service = _service()
    return jsonify(service.serialise(service.get(condo_id)).model_dump(mode="json")), 200


@bp.patch("/<uuid:condo_id>")
@require_permission(CONDO_WRITE)
def update_condo(condo_id: uuid.UUID) -> Any:
    service = _service()
    condo = service.update(condo_id, parse_body(CondoUpdate))
    db.session.commit()
    return jsonify(service.serialise(condo).model_dump(mode="json")), 200


@bp.delete("/<uuid:condo_id>")
@require_permission(CONDO_DELETE)
def delete_condo(condo_id: uuid.UUID) -> Any:
    service = _service()
    service.delete(condo_id)
    db.session.commit()
    return "", 204


@bp.post("/<uuid:condo_id>/images")
@require_permission(CONDO_WRITE)
def upload_condo_image(condo_id: uuid.UUID) -> Any:
    upload = request.files.get("file")
    if upload is None:
        raise ValidationError("Attach a file under the 'file' field.")

    service = _service()
    image = service.add_image(
        condo_id,
        upload.stream,
        filename=upload.filename,
        declared_type=upload.mimetype,
    )
    db.session.commit()

    condo = service.get(condo_id)
    payload = service.serialise(condo).model_dump(mode="json")
    return jsonify({"condo": payload, "image_id": str(image.id)}), 201


@bp.delete("/<uuid:condo_id>/images/<uuid:image_id>")
@require_permission(CONDO_WRITE)
def delete_condo_image(condo_id: uuid.UUID, image_id: uuid.UUID) -> Any:
    service = _service()
    service.delete_image(condo_id, image_id)
    db.session.commit()
    return "", 204


@bp.put("/<uuid:condo_id>/images/order")
@require_permission(CONDO_WRITE)
def reorder_condo_images(condo_id: uuid.UUID) -> Any:
    payload = request.get_json(silent=True) or {}
    raw_ids = payload.get("image_ids")
    if not isinstance(raw_ids, list):
        raise ValidationError("Send {\"image_ids\": [...]} in the new order.")

    try:
        ordered = [uuid.UUID(str(v)) for v in raw_ids]
    except ValueError as exc:
        raise ValidationError("image_ids must all be valid ids.") from exc

    service = _service()
    condo = service.reorder_images(condo_id, ordered)
    db.session.commit()
    return jsonify(service.serialise(condo).model_dump(mode="json")), 200
