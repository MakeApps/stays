"""Expense business logic."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any, BinaryIO

from flask import current_app
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.common import activity
from app.common.errors import NotFoundError, ValidationError
from app.common.money import format_thb
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.condo import Condo
from app.models.expense import Expense, ExpenseCategory, ExpenseStatus, PaymentMethod
from app.services.uploads import validate_upload


class ExpenseService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # ---------- lookups ----------
    def categories(self) -> list[ExpenseCategory]:
        return list(
            self.session.scalars(
                select(ExpenseCategory)
                .where(ExpenseCategory.is_active.is_(True))
                .order_by(ExpenseCategory.position, ExpenseCategory.name)
            )
        )

    def methods(self) -> list[PaymentMethod]:
        return list(
            self.session.scalars(
                select(PaymentMethod)
                .where(PaymentMethod.is_active.is_(True))
                .order_by(PaymentMethod.position, PaymentMethod.name)
            )
        )

    def _category(self, category_id: uuid.UUID) -> ExpenseCategory:
        found = self.session.get(ExpenseCategory, category_id)
        if found is None:
            raise ValidationError(
                "That category does not exist.",
                details={"fields": {"category_id": ["Choose a category from the list."]}},
            )
        return found

    def _method(self, method_id: uuid.UUID) -> PaymentMethod:
        found = self.session.get(PaymentMethod, method_id)
        if found is None:
            raise ValidationError(
                "That payment method does not exist.",
                details={"fields": {"method_id": ["Choose a method from the list."]}},
            )
        return found

    # ---------- reads ----------
    def get(self, expense_id: uuid.UUID) -> Expense:
        found = self.session.scalars(
            select(Expense).where(Expense.id == expense_id, Expense.deleted_at.is_(None))
        ).one_or_none()
        if found is None:
            raise NotFoundError("That expense does not exist.")
        return found

    def base_query(self) -> Any:
        return select(Expense).where(Expense.deleted_at.is_(None))

    def search_filter(self, stmt: Any, term: str) -> Any:
        like = f"%{term.strip()}%"
        return stmt.where(
            or_(
                Expense.description.like(like),
                Expense.vendor.like(like),
                Expense.reference.like(like),
            )
        )

    # ---------- writes ----------
    def create(
        self,
        *,
        condo_id: uuid.UUID,
        category_id: uuid.UUID,
        method_id: uuid.UUID,
        spent_on: date,
        amount: int,
        description: str,
        vendor: str | None = None,
        reference: str | None = None,
        status: ExpenseStatus = ExpenseStatus.PAID,
        notes: str | None = None,
    ) -> Expense:
        condo = self.session.get(Condo, condo_id)
        if condo is None or condo.deleted_at is not None:
            raise ValidationError(
                "That condo does not exist.",
                details={"fields": {"condo_id": ["Choose an existing condo."]}},
            )
        if amount <= 0:
            raise ValidationError(
                "Every expense needs an amount.",
                details={"fields": {"amount": ["Enter an amount above zero."]}},
            )
        if not description.strip():
            raise ValidationError(
                "Say what this expense was for.",
                details={"fields": {"description": ["Add a description."]}},
            )

        category = self._category(category_id)
        self._method(method_id)

        expense = Expense(
            condo_id=condo_id,
            category_id=category_id,
            method_id=method_id,
            spent_on=spent_on,
            amount=amount,
            description=description.strip(),
            vendor=(vendor or "").strip() or None,
            reference=(reference or "").strip() or None,
            status=status,
            notes=(notes or "").strip() or None,
        )
        self.session.add(expense)
        self.session.flush()

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.EXPENSE,
            entity_id=expense.id,
            entity_label=expense.description,
            meta={
                "summary": f"{category.name} · {format_thb(amount)} · {condo.name}",
            },
        )
        return expense

    def update(self, expense_id: uuid.UUID, **changes: Any) -> Expense:
        expense = self.get(expense_id)

        if changes.get("category_id"):
            self._category(changes["category_id"])
        if changes.get("method_id"):
            self._method(changes["method_id"])
        if "amount" in changes and changes["amount"] is not None and changes["amount"] <= 0:
            raise ValidationError(
                "Every expense needs an amount.",
                details={"fields": {"amount": ["Enter an amount above zero."]}},
            )

        for field in (
            "condo_id",
            "category_id",
            "method_id",
            "spent_on",
            "amount",
            "description",
            "vendor",
            "reference",
            "status",
            "notes",
        ):
            if field in changes and changes[field] is not None:
                setattr(expense, field, changes[field])

        self.session.flush()
        activity.record(
            ActivityAction.UPDATED,
            ActivityEntity.EXPENSE,
            entity_id=expense.id,
            entity_label=expense.description,
            meta={"summary": f"{expense.description} updated"},
        )
        return expense

    def delete(self, expense_id: uuid.UUID) -> None:
        expense = self.get(expense_id)
        expense.soft_delete()
        activity.record(
            ActivityAction.DELETED,
            ActivityEntity.EXPENSE,
            entity_id=expense.id,
            entity_label=expense.description,
            meta={
                "summary": (
                    f"{expense.category.name} · {format_thb(expense.amount)} removed"
                )
            },
        )

    # ---------- receipt ----------
    def attach_receipt(
        self,
        expense_id: uuid.UUID,
        stream: BinaryIO,
        *,
        filename: str | None,
        declared_type: str | None,
    ) -> Expense:
        expense = self.get(expense_id)
        s = current_app.config["SETTINGS"]
        storage = current_app.extensions["storage"]

        # Receipts accept PDF as well as images; still verified by magic bytes,
        # never by the browser's Content-Type claim.
        verified = validate_upload(
            stream,
            filename=filename,
            declared_type=declared_type,
            allowed=s.receipt_mime_allowlist,
            max_bytes=s.UPLOAD_MAX_BYTES,
        )

        from app.storage import build_key

        previous = expense.receipt_key
        key = build_key(f"receipts/{expense.condo_id.hex}", filename)
        stored = storage.put(key, stream, content_type=verified.content_type)

        expense.receipt_key = stored.key
        expense.receipt_filename = (filename or "")[:255] or None
        expense.receipt_content_type = stored.content_type
        expense.receipt_byte_size = stored.byte_size
        self.session.flush()

        # Replaced receipts are removed only after the row is updated; an
        # orphaned object costs pennies, a missing one breaks the record.
        if previous and previous != stored.key:
            storage.delete(previous)

        activity.record(
            ActivityAction.UPLOADED,
            ActivityEntity.EXPENSE,
            entity_id=expense.id,
            entity_label=expense.description,
            meta={"summary": f"Receipt attached to {expense.description}"},
        )
        return expense

    def remove_receipt(self, expense_id: uuid.UUID) -> Expense:
        expense = self.get(expense_id)
        key = expense.receipt_key
        expense.receipt_key = None
        expense.receipt_filename = None
        expense.receipt_content_type = None
        expense.receipt_byte_size = None
        self.session.flush()
        if key:
            current_app.extensions["storage"].delete(key)
        return expense

    def receipt_url(self, expense: Expense) -> str | None:
        if not expense.receipt_key:
            return None
        storage = current_app.extensions["storage"]
        return str(
            storage.url_for(expense.receipt_key, download_name=expense.receipt_filename)
        )
