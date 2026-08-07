"""Expense and income endpoints."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select

from app.auth.decorators import require_permission
from app.auth.permissions import (
    EXPENSE_DELETE,
    EXPENSE_READ,
    EXPENSE_WRITE,
    INCOME_READ,
)
from app.common.api import parse_body, parse_query
from app.common.errors import ValidationError
from app.common.money import format_thb, to_major, to_minor
from app.common.pagination import PageParams, apply_sort, paginate
from app.extensions import db
from app.models.condo import Condo
from app.models.expense import Expense, ExpenseStatus
from app.services.analytics import AnalyticsService, month_bounds, previous_months
from app.services.expense_service import ExpenseService

bp = Blueprint("expenses", __name__)
income_bp = Blueprint("income", __name__)

SORTABLE = {
    "spent_on": Expense.spent_on,
    "amount": Expense.amount,
    "description": Expense.description,
    "created_at": Expense.created_at,
}


def _service() -> ExpenseService:
    return ExpenseService(db.session)


def _analytics() -> AnalyticsService:
    return AnalyticsService(db.session)


def _serialise(expense: Expense, service: ExpenseService) -> dict[str, Any]:
    return {
        "id": str(expense.id),
        "condo_id": str(expense.condo_id),
        "condo_name": expense.condo_ref.name,
        "condo_code": expense.condo_ref.code,
        "category_id": str(expense.category_id),
        "category": expense.category.name,
        "category_tone": expense.category.tone,
        "method_id": str(expense.method_id),
        "method": expense.method.name,
        "spent_on": expense.spent_on.isoformat(),
        "amount": str(to_major(expense.amount)),
        "amount_label": format_thb(expense.amount),
        "vendor": expense.vendor,
        "reference": expense.reference,
        "description": expense.description,
        "status": expense.status.value,
        "notes": expense.notes,
        "receipt_url": service.receipt_url(expense),
        "receipt_filename": expense.receipt_filename,
        "receipt_content_type": expense.receipt_content_type,
        "created_at": expense.created_at.isoformat() + "Z",
    }


# ---------------------------------------------------------------- schemas


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    condo_id: uuid.UUID
    category_id: uuid.UUID
    method_id: uuid.UUID
    spent_on: date
    amount: Decimal = Field(gt=0, le=Decimal("99999999"))
    description: str = Field(min_length=1, max_length=500)
    vendor: str | None = Field(default=None, max_length=160)
    reference: str | None = Field(default=None, max_length=64)
    status: Literal["paid", "pending", "cancelled"] = "paid"
    notes: str | None = Field(default=None, max_length=5000)


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    condo_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    method_id: uuid.UUID | None = None
    spent_on: date | None = None
    amount: Decimal | None = Field(default=None, gt=0, le=Decimal("99999999"))
    description: str | None = Field(default=None, min_length=1, max_length=500)
    vendor: str | None = Field(default=None, max_length=160)
    reference: str | None = Field(default=None, max_length=64)
    status: Literal["paid", "pending", "cancelled"] | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ExpenseListQuery(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    condo_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    status: Literal["all", "paid", "pending", "cancelled"] = "all"
    start: date | None = None
    end: date | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=100)
    sort: str | None = None
    order: Literal["asc", "desc"] = "desc"


class PeriodQuery(BaseModel):
    """A month anchor. Defaults to the current month."""

    month: date | None = None


# ---------------------------------------------------------------- lookups


@bp.get("/lookups")
@require_permission(EXPENSE_READ)
def lookups() -> Any:
    service = _service()
    return jsonify(
        {
            "categories": [
                {"id": str(c.id), "name": c.name, "tone": c.tone} for c in service.categories()
            ],
            "methods": [{"id": str(m.id), "name": m.name} for m in service.methods()],
        }
    ), 200


# ---------------------------------------------------------------- CRUD


@bp.get("")
@require_permission(EXPENSE_READ)
def list_expenses() -> Any:
    service = _service()
    params = parse_query(ExpenseListQuery)
    page_params = PageParams(
        page=params.page, per_page=params.per_page, sort=params.sort, order=params.order
    )

    stmt = service.base_query()
    if params.condo_id:
        stmt = stmt.where(Expense.condo_id == params.condo_id)
    if params.category_id:
        stmt = stmt.where(Expense.category_id == params.category_id)
    if params.status != "all":
        stmt = stmt.where(Expense.status == ExpenseStatus(params.status))
    if params.start:
        stmt = stmt.where(Expense.spent_on >= params.start)
    if params.end:
        stmt = stmt.where(Expense.spent_on < params.end)
    if params.q:
        stmt = service.search_filter(stmt, params.q)

    stmt = apply_sort(stmt, page_params, allowed=SORTABLE, default="spent_on")
    page = paginate(db.session, stmt, page_params)
    return jsonify(page.envelope(lambda e: _serialise(e, service))), 200


@bp.post("")
@require_permission(EXPENSE_WRITE)
def create_expense() -> Any:
    payload = parse_body(ExpenseCreate)
    service = _service()
    expense = service.create(
        condo_id=payload.condo_id,
        category_id=payload.category_id,
        method_id=payload.method_id,
        spent_on=payload.spent_on,
        amount=to_minor(payload.amount),
        description=payload.description,
        vendor=payload.vendor,
        reference=payload.reference,
        status=ExpenseStatus(payload.status),
        notes=payload.notes,
    )
    db.session.commit()
    db.session.refresh(expense)
    return jsonify(_serialise(expense, service)), 201


@bp.get("/<uuid:expense_id>")
@require_permission(EXPENSE_READ)
def get_expense(expense_id: uuid.UUID) -> Any:
    service = _service()
    return jsonify(_serialise(service.get(expense_id), service)), 200


@bp.patch("/<uuid:expense_id>")
@require_permission(EXPENSE_WRITE)
def update_expense(expense_id: uuid.UUID) -> Any:
    payload = parse_body(ExpenseUpdate)
    data = payload.model_dump(exclude_unset=True)
    if "amount" in data and data["amount"] is not None:
        data["amount"] = to_minor(data["amount"])
    if "status" in data and data["status"] is not None:
        data["status"] = ExpenseStatus(data["status"])

    service = _service()
    expense = service.update(expense_id, **data)
    db.session.commit()
    db.session.refresh(expense)
    return jsonify(_serialise(expense, service)), 200


@bp.delete("/<uuid:expense_id>")
@require_permission(EXPENSE_DELETE)
def delete_expense(expense_id: uuid.UUID) -> Any:
    _service().delete(expense_id)
    db.session.commit()
    return "", 204


@bp.post("/<uuid:expense_id>/receipt")
@require_permission(EXPENSE_WRITE)
def upload_receipt(expense_id: uuid.UUID) -> Any:
    upload = request.files.get("file")
    if upload is None:
        raise ValidationError("Attach a file under the 'file' field.")
    service = _service()
    expense = service.attach_receipt(
        expense_id, upload.stream, filename=upload.filename, declared_type=upload.mimetype
    )
    db.session.commit()
    db.session.refresh(expense)
    return jsonify(_serialise(expense, service)), 201


@bp.delete("/<uuid:expense_id>/receipt")
@require_permission(EXPENSE_WRITE)
def delete_receipt(expense_id: uuid.UUID) -> Any:
    service = _service()
    expense = service.remove_receipt(expense_id)
    db.session.commit()
    return jsonify(_serialise(expense, service)), 200


# ---------------------------------------------------------------- summaries


@bp.get("/summary")
@require_permission(EXPENSE_READ)
def expense_summary() -> Any:
    """Everything the Expenses overview needs, in one round trip."""
    params = parse_query(PeriodQuery)
    anchor = params.month or date.today()
    start, end = month_bounds(anchor)
    analytics = _analytics()

    today = date.today()
    spent_today = analytics.expenses_between(today, today + timedelta(days=1))

    pending_rows = db.session.execute(
        select(
            func.coalesce(func.sum(Expense.amount), 0),
            func.count(),
        ).where(
            Expense.spent_on >= start,
            Expense.spent_on < end,
            Expense.deleted_at.is_(None),
            Expense.status == ExpenseStatus.PENDING,
        )
    ).one()

    month_expenses = analytics.expenses_between(start, end)
    month_revenue = analytics.revenue_between(start, end)
    categories = analytics.expenses_by_category(start, end)
    trend = analytics.monthly_series(previous_months(anchor, 6))

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "today": {"amount": str(to_major(spent_today)), "label": format_thb(spent_today)},
            "month": {
                "expenses": str(to_major(month_expenses)),
                "expenses_label": format_thb(month_expenses),
                "revenue": str(to_major(month_revenue)),
                "revenue_label": format_thb(month_revenue),
                "net": str(to_major(month_revenue - month_expenses)),
                "net_label": format_thb(month_revenue - month_expenses),
                "margin_pct": (
                    round((month_revenue - month_expenses) / month_revenue * 100)
                    if month_revenue
                    else 0
                ),
            },
            "pending": {
                "amount": str(to_major(int(pending_rows[0] or 0))),
                "label": format_thb(int(pending_rows[0] or 0)),
                "count": int(pending_rows[1] or 0),
            },
            "by_category": [
                {
                    "category": name,
                    "tone": tone,
                    "amount": str(to_major(total)),
                    "label": format_thb(total),
                    "pct": round(total / month_expenses * 100) if month_expenses else 0,
                }
                for name, tone, total in categories
            ],
            "trend": [
                {
                    "month": start_.strftime("%b"),
                    "start": start_.isoformat(),
                    "revenue": str(to_major(rev)),
                    "expenses": str(to_major(exp)),
                    "net": str(to_major(rev - exp)),
                }
                for (start_, _), (rev, exp) in zip(
                    previous_months(anchor, 6), trend, strict=True
                )
            ],
        }
    ), 200


@income_bp.get("/summary")
@require_permission(INCOME_READ)
def income_summary() -> Any:
    """Income screen: KPIs, per-condo profit, and the six-month comparison."""
    params = parse_query(PeriodQuery)
    anchor = params.month or date.today()
    start, end = month_bounds(anchor)
    analytics = _analytics()
    today = date.today()

    week_start = today - timedelta(days=today.weekday())
    revenue_today = analytics.revenue_between(today, today + timedelta(days=1))
    revenue_week = analytics.revenue_between(week_start, week_start + timedelta(days=7))
    revenue_month = analytics.revenue_between(start, end)
    expenses_month = analytics.expenses_between(start, end)
    owed, owed_count = analytics.outstanding()

    finances = analytics.per_condo(start, end)
    condos = {
        c.id: c
        for c in db.session.scalars(select(Condo).where(Condo.deleted_at.is_(None)))
    }

    rows = []
    for condo_id, fin in finances.items():
        condo = condos.get(condo_id)
        if condo is None:
            continue
        rows.append(
            {
                "condo_id": str(condo_id),
                "name": condo.name,
                "code": condo.code,
                "bookings": fin.bookings,
                "nights": fin.nights,
                "revenue": str(to_major(fin.revenue)),
                "revenue_label": format_thb(fin.revenue),
                "expenses": str(to_major(fin.expenses)),
                "expenses_label": format_thb(fin.expenses),
                "net": str(to_major(fin.net)),
                "net_label": format_thb(fin.net),
                "occupancy_pct": fin.occupancy_pct,
            }
        )
    rows.sort(key=lambda r: float(str(r["revenue"])), reverse=True)

    windows = previous_months(anchor, 6)
    series = analytics.monthly_series(windows)

    return jsonify(
        {
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "kpis": {
                "today": format_thb(revenue_today),
                "week": format_thb(revenue_week),
                "month": format_thb(revenue_month),
                "expenses": format_thb(expenses_month),
                "net": format_thb(revenue_month - expenses_month),
                "margin_pct": (
                    round((revenue_month - expenses_month) / revenue_month * 100)
                    if revenue_month
                    else 0
                ),
                "outstanding": format_thb(owed),
                "outstanding_count": owed_count,
            },
            "by_condo": rows,
            "trend": [
                {
                    "month": s.strftime("%b"),
                    "revenue": str(to_major(rev)),
                    "expenses": str(to_major(exp)),
                    "net": str(to_major(rev - exp)),
                }
                for (s, _), (rev, exp) in zip(windows, series, strict=True)
            ],
        }
    ), 200
