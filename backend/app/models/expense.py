"""Expenses, with categories and payment methods as lookup tables.

The design fixes 15 categories and 5 payment methods (lines 1823–1824) and maps
each category to a pill tone (1825–1831). Those live in tables rather than a
Python enum so an owner can add "Pest control" without a migration and a code
deploy — and so the tone travels with the data instead of being duplicated in
the frontend.

A **cancelled** expense is excluded from every total, mirroring the design's
``live(e)`` helper (line 1949). It is kept rather than deleted because a
cancelled bill is still part of the audit trail.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import BigInteger, Boolean, Date, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    GUID,
    AuditMixin,
    Base,
    OrganisationScopedMixin,
    SoftDeleteMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.condo import Condo


class ExpenseStatus(str, enum.Enum):
    PAID = "paid"
    PENDING = "pending"
    CANCELLED = "cancelled"


class ExpenseCategory(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin):
    __tablename__ = "expense_categories"

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    # Pill tone from the design's CATTONE map: ok / warn / info / brand / neutral.
    tone: Mapped[str] = mapped_column(String(16), nullable=False, default="neutral")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Unique *within* an organisation. A global constraint would mean the
    # first tenant to create "Electricity" took the name away from every
    # other one, which is exactly what happened before this was composite.
    __table_args__ = (
        Index(
            "uq_expense_categories_organisation_id_name",
            "organisation_id",
            "name",
            unique=True,
        ),
    )


class PaymentMethod(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin):
    __tablename__ = "payment_methods"

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index(
            "uq_payment_methods_organisation_id_name",
            "organisation_id",
            "name",
            unique=True,
        ),
    )


class Expense(Base, UUIDPrimaryKeyMixin, OrganisationScopedMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "expenses"

    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("expense_categories.id", ondelete="RESTRICT"), nullable=False
    )
    method_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("payment_methods.id", ondelete="RESTRICT"), nullable=False
    )

    spent_on: Mapped[date] = mapped_column(Date, nullable=False)
    # Satang, like every other monetary column.
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    vendor: Mapped[str | None] = mapped_column(String(160), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[ExpenseStatus] = mapped_column(
        Enum(
            ExpenseStatus,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=16,
        ),
        nullable=False,
        default=ExpenseStatus.PAID,
    )

    # Receipts are tax records: stored as a key, served through a signed URL,
    # never world-readable.
    receipt_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    receipt_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receipt_content_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    receipt_byte_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    condo_ref: Mapped[Condo] = relationship("Condo", lazy="selectin")
    category: Mapped[ExpenseCategory] = relationship(lazy="selectin")
    method: Mapped[PaymentMethod] = relationship(lazy="selectin")

    __table_args__ = (
        # The reporting workhorse: every month/range rollup scans this.
        Index("ix_expenses_spent_on", "spent_on"),
        Index("ix_expenses_condo_date", "condo_id", "spent_on"),
        Index("ix_expenses_deleted_status", "deleted_at", "status"),
        Index("ix_expenses_category", "category_id"),
    )

    @property
    def counts_toward_totals(self) -> bool:
        """Cancelled bills stay on the record but out of the arithmetic."""
        return self.status is not ExpenseStatus.CANCELLED and self.deleted_at is None

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Expense {self.spent_on} {self.description[:24]!r}>"
