"""Condo endpoints."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from app.auth.decorators import require_permission
from app.auth.permissions import CONDO_DELETE, CONDO_READ, CONDO_WRITE
from app.common.api import parse_body, parse_query
from app.common.errors import ValidationError
from app.common.money import format_thb, to_major
from app.extensions import db
from app.models.booking import Booking
from app.models.expense import Expense
from app.repositories.condo_repo import CondoRepository
from app.schemas.condo import CondoCreate, CondoListQuery, CondoUpdate, DepositRefundCreate
from app.services.analytics import REVENUE_STATUSES, AnalyticsService, month_bounds
from app.services.condo_service import CondoService
from app.services.lease import deposit_state

bp = Blueprint("condos", __name__)


def _service() -> CondoService:
    return CondoService(CondoRepository(db.session))


@bp.get("")
@require_permission(CONDO_READ)
def list_condos() -> Any:
    service = _service()
    params = parse_query(CondoListQuery)
    page, counts = service.list(params)
    statuses = service.statuses_for(page.items)
    deposits = service.deposits_for(page.items)
    body = page.envelope(
        lambda c: service.serialise(c, statuses.get(c.id), deposits.get(c.id)).model_dump(
            mode="json"
        )
    )
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


@bp.get("/<uuid:condo_id>/finance")
@require_permission(CONDO_READ)
def condo_finance(condo_id: uuid.UUID) -> Any:
    """This unit's money for a month, plus its upcoming stays and recent bills.

    Everything the condo detail surfaces need, in one round trip.
    """
    service = _service()
    condo = service.get(condo_id)

    raw_month = request.args.get("month")
    anchor = date.fromisoformat(raw_month) if raw_month else date.today()
    start, end = month_bounds(anchor)

    analytics = AnalyticsService(db.session)
    fin = analytics.per_condo(start, end).get(condo.id)
    today = date.today()
    deposit = deposit_state(condo)

    upcoming = list(
        db.session.scalars(
            select(Booking)
            .where(
                Booking.condo_id == condo.id,
                Booking.deleted_at.is_(None),
                Booking.status.in_(REVENUE_STATUSES),
                Booking.check_out > today,
            )
            .order_by(Booking.check_in)
            .limit(5)
        )
    )
    recent = list(
        db.session.scalars(
            select(Expense)
            .where(Expense.condo_id == condo.id, Expense.deleted_at.is_(None))
            .order_by(Expense.spent_on.desc())
            .limit(5)
        )
    )

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "revenue": format_thb(fin.revenue if fin else 0),
            "lease_cost": format_thb(fin.lease_cost if fin else 0),
            "expenses": format_thb(fin.expenses if fin else 0),
            "net": format_thb(fin.net if fin else 0),
            "net_is_negative": bool(fin and fin.net < 0),
            # Reported beside profit, never inside it: capital lodged with the
            # owner, not a cost of trading.
            "deposit_outstanding": format_thb(deposit.outstanding),
            "deposit_status": deposit.status,
            "occupancy_pct": fin.occupancy_pct if fin else 0,
            "booked_nights": fin.nights if fin else 0,
            "available_nights": fin.available_nights if fin else 0,
            "bookings": fin.bookings if fin else 0,
            "upcoming": [
                {
                    "id": str(b.id),
                    "guest_name": b.guest_name,
                    "check_in": b.check_in.isoformat(),
                    "check_out": b.check_out.isoformat(),
                    "nights": b.nights,
                    "total_label": format_thb(b.total),
                    "payment_status": b.payment_status,
                }
                for b in upcoming
            ],
            "recent_expenses": [
                {
                    "id": str(e.id),
                    "description": e.description,
                    "category": e.category.name,
                    "tone": e.category.tone,
                    "spent_on": e.spent_on.isoformat(),
                    "amount_label": format_thb(e.amount),
                    "amount": str(to_major(e.amount)),
                }
                for e in recent
            ],
        }
    ), 200


@bp.get("/<uuid:condo_id>/deposit")
@require_permission(CONDO_READ)
def condo_deposit(condo_id: uuid.UUID) -> Any:
    """The deposit balance and every recovery recorded against it."""
    service = _service()
    condo = service.get(condo_id)
    state = deposit_state(condo)

    return jsonify(
        {
            "condo_id": str(condo.id),
            "condo_name": condo.name,
            "status": state.status,
            "original": str(to_major(state.original)),
            "original_label": format_thb(state.original),
            "refunded_label": format_thb(state.refunded),
            "deducted_label": format_thb(state.deducted),
            "outstanding": str(to_major(state.outstanding)),
            "outstanding_label": format_thb(state.outstanding),
            "movements": [
                {
                    "id": str(m.id),
                    "refund_date": m.refund_date.isoformat(),
                    "refunded_label": format_thb(m.refunded_amount),
                    "deducted_label": format_thb(m.deducted_amount),
                    "deducted": str(to_major(m.deducted_amount)),
                    "deduction_reason": m.deduction_reason,
                    "notes": m.notes,
                }
                for m in sorted(condo.deposit_movements, key=lambda m: m.refund_date, reverse=True)
            ],
        }
    ), 200


@bp.post("/<uuid:condo_id>/deposit/refunds")
@require_permission(CONDO_WRITE)
def refund_condo_deposit(condo_id: uuid.UUID) -> Any:
    """Record a recovery against the deposit held by the owner."""
    service = _service()
    service.refund_deposit(condo_id, parse_body(DepositRefundCreate))
    db.session.commit()

    condo = service.get(condo_id)
    state = deposit_state(condo)
    return jsonify(
        {
            "condo": service.serialise(condo, deposit=state).model_dump(mode="json"),
            "status": state.status,
            "outstanding_label": format_thb(state.outstanding),
        }
    ), 201


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
