"""Condos and their images.

Field set comes from the approved design's Add-Condo modal, including the four
values the prototype captured and then silently discarded on save (property
type, address, description, photos) and the size field the prototype displayed
but never collected — it hardcoded 38 m².

Rates are integers in satang. Note the design's own numbers are whole baht
(``night: 1800``), so the seed multiplies by 100 on the way in.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, AuditMixin, Base, SoftDeleteMixin, UUIDPrimaryKeyMixin


class PropertyType(str, enum.Enum):
    CONDOMINIUM = "Condominium"
    SERVICED_APARTMENT = "Serviced apartment"
    TOWNHOUSE = "Townhouse"


class Condo(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "condos"

    # Human-facing short code shown on the calendar and card overlays ("A-1204").
    code: Mapped[str] = mapped_column(String(24), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    property_type: Mapped[PropertyType] = mapped_column(
        Enum(
            PropertyType,
            values_callable=lambda e: [m.value for m in e],
            native_enum=False,
            length=32,
        ),
        nullable=False,
        default=PropertyType.CONDOMINIUM,
    )

    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    bathrooms: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    size_sqm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ---- money, all satang ----
    night_rate: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    month_rate: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    cleaning_fee: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    # The refundable deposit *we* pay the owner to take the unit on. It is
    # capital held by a third party, not an operating cost, and never enters a
    # profit calculation — see app.services.lease.
    security_deposit: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # ---- the long-term lease we hold the unit under ----
    # Nullable throughout: units added before leases were tracked have no lease
    # on file, and "no lease recorded" is a real state, distinct from expired.
    lease_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    lease_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_lease_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Operational override. Day-to-day status (available / occupied / reserved)
    # is *derived* from bookings and is never stored — see
    # `app.services.availability.derive_unit_status`. This flag only records a
    # deliberate takedown, which is the one state bookings cannot express.
    is_maintenance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    images: Mapped[list[CondoImage]] = relationship(
        back_populates="condo",
        cascade="all, delete-orphan",
        order_by="CondoImage.position",
        lazy="selectin",
    )
    deposit_movements: Mapped[list[DepositTransaction]] = relationship(
        back_populates="condo",
        cascade="all, delete-orphan",
        order_by="DepositTransaction.refund_date",
        lazy="selectin",
    )

    __table_args__ = (
        # Uniqueness among live rows is enforced in the service layer; MySQL has
        # no partial index, and a hard UNIQUE would burn the code permanently
        # after a soft delete.
        Index("ix_condos_code", "code"),
        Index("ix_condos_deleted_name", "deleted_at", "name"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Condo {self.code} {self.name!r}>"


class DepositTransaction(Base, UUIDPrimaryKeyMixin, AuditMixin):
    """One recovery event against the deposit paid to a property owner.

    A ledger rather than a mutable balance on the condo. The deposit can come
    back in stages with deductions along the way, and "we got ฿45,000 back and
    they kept ฿5,000 for wall repair" is a fact worth keeping — overwriting a
    single ``refunded`` column would lose the reason and the date.

    The condo's deposit status is derived from these rows, never stored, so it
    cannot claim "Refunded" without a row saying so.
    """

    __tablename__ = "deposit_transactions"

    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="CASCADE"), nullable=False
    )

    # ---- satang ----
    # Snapshot of the deposit this movement was recorded against. Kept per row
    # because the condo's `security_deposit` can be corrected later, and a
    # historical refund must still read against the figure it was judged by.
    original_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    refunded_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    deducted_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    deduction_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    refund_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    condo: Mapped[Condo] = relationship(back_populates="deposit_movements")

    __table_args__ = (Index("ix_deposit_transactions_condo_date", "condo_id", "refund_date"),)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"<DepositTransaction refunded={self.refunded_amount} "
            f"deducted={self.deducted_amount}>"
        )


class CondoImage(Base, UUIDPrimaryKeyMixin, AuditMixin):
    __tablename__ = "condo_images"

    condo_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("condos.id", ondelete="CASCADE"), nullable=False
    )
    # Storage key, not a URL — the URL is minted per request by the storage
    # backend so local disk and S3 presigning behave identically.
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    condo: Mapped[Condo] = relationship(back_populates="images")

    __table_args__ = (Index("ix_condo_images_condo_position", "condo_id", "position"),)
