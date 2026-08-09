"""Condo request/response schemas.

Field set follows the approved design's Add-Condo modal, with two corrections
the prototype needed:

* ``size_sqm`` is collected. The prototype displayed m² on the card and the
  detail drawer but had no input and hardcoded ``sqm: 38`` on save.
* ``property_type``, ``address``, ``description`` and photos are persisted.
  The prototype captured all four and then dropped them.
"""

from __future__ import annotations

import re
import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.common.money import to_major, to_minor
from app.models.condo import Condo, PropertyType
from app.services.lease import DepositState, LeaseStatus, days_remaining, lease_status

CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 \-_/]{0,23}$")


def _normalise_code(v: str) -> str:
    if not CODE_RE.match(v):
        raise ValueError("Use letters, numbers, spaces, dashes or slashes (max 24 characters)")
    return v.upper()


Baht = Annotated[Decimal, Field(ge=0, le=Decimal("99999999"))]
CondoCode = Annotated[str, Field(min_length=1, max_length=24), AfterValidator(_normalise_code)]

UnitStatus = Literal["available", "occupied", "reserved", "maintenance"]
DepositStatusOut = Literal["none", "held", "partially_refunded", "refunded"]


class CondoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    code: CondoCode
    property_type: PropertyType = PropertyType.CONDOMINIUM
    bedrooms: int = Field(default=1, ge=0, le=20)
    bathrooms: int = Field(default=1, ge=1, le=20)
    size_sqm: int | None = Field(default=None, ge=1, le=10000)

    night_rate: Baht = Decimal(0)
    month_rate: Baht = Decimal(0)
    cleaning_fee: Baht = Decimal(0)
    #: Refundable deposit paid to the property owner — capital, not a cost.
    security_deposit: Baht = Decimal(0)

    # ---- the lease we hold the unit under ----
    lease_start_date: date | None = None
    lease_end_date: date | None = None
    monthly_lease_amount: Baht = Decimal(0)

    address: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_maintenance: bool = False

    @field_validator("address", "description")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return v or None

    @model_validator(mode="after")
    def _lease_dates_run_forwards(self) -> CondoBase:
        if (
            self.lease_start_date is not None
            and self.lease_end_date is not None
            and self.lease_end_date < self.lease_start_date
        ):
            raise ValueError("The lease cannot end before it starts")
        return self


class CondoCreate(CondoBase):
    pass


class CondoUpdate(BaseModel):
    """Partial update — every field optional, but validated when present."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=160)
    code: CondoCode | None = None
    property_type: PropertyType | None = None
    bedrooms: int | None = Field(default=None, ge=0, le=20)
    bathrooms: int | None = Field(default=None, ge=1, le=20)
    size_sqm: int | None = Field(default=None, ge=1, le=10000)
    night_rate: Baht | None = None
    month_rate: Baht | None = None
    cleaning_fee: Baht | None = None
    security_deposit: Baht | None = None
    lease_start_date: date | None = None
    lease_end_date: date | None = None
    monthly_lease_amount: Baht | None = None
    address: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_maintenance: bool | None = None

    @model_validator(mode="after")
    def _lease_dates_run_forwards(self) -> CondoUpdate:
        # Only checks a payload carrying both ends. A patch that moves one date
        # is validated against the stored other end in the service, which is
        # the only place both values are known.
        if (
            self.lease_start_date is not None
            and self.lease_end_date is not None
            and self.lease_end_date < self.lease_start_date
        ):
            raise ValueError("The lease cannot end before it starts")
        return self


class CondoListQuery(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    status: Literal["all", "available", "occupied", "reserved", "maintenance"] = "all"
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=100)
    sort: str | None = None
    order: Literal["asc", "desc"] = "asc"


class CondoImageOut(BaseModel):
    id: uuid.UUID
    url: str
    width: int | None
    height: int | None
    position: int


class CondoOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    property_type: PropertyType
    bedrooms: int
    bathrooms: int
    size_sqm: int | None

    night_rate: Decimal
    month_rate: Decimal
    cleaning_fee: Decimal
    security_deposit: Decimal

    # ---- lease, all derived except the three stored fields ----
    lease_start_date: date | None
    lease_end_date: date | None
    monthly_lease_amount: Decimal
    monthly_lease_label: str
    lease_status: LeaseStatus
    lease_days_remaining: int | None

    # ---- deposit: a balance, never an expense ----
    security_deposit_label: str
    deposit_status: DepositStatusOut
    deposit_refunded: Decimal
    deposit_deducted: Decimal
    deposit_outstanding: Decimal
    deposit_outstanding_label: str

    address: str | None
    description: str | None
    status: UnitStatus
    images: list[CondoImageOut]
    cover_url: str | None

    # Pre-formatted for the UI so ฿ rendering cannot drift between the two
    # apps — the design shows "฿1,800", never "1800.00".
    night_rate_label: str
    month_rate_label: str

    @staticmethod
    def from_model(
        condo: Condo,
        *,
        status: UnitStatus,
        image_url: Any,
        deposit: DepositState | None = None,
        today: date | None = None,
    ) -> CondoOut:
        from app.common.money import format_thb
        from app.services.lease import deposit_state

        images = [
            CondoImageOut(
                id=img.id,
                url=image_url(img.storage_key),
                width=img.width,
                height=img.height,
                position=img.position,
            )
            for img in condo.images
        ]
        # Passed in when serialising a list, so the ledger is read once for the
        # page instead of once per card.
        state = deposit if deposit is not None else deposit_state(condo)
        return CondoOut(
            id=condo.id,
            code=condo.code,
            name=condo.name,
            property_type=condo.property_type,
            bedrooms=condo.bedrooms,
            bathrooms=condo.bathrooms,
            size_sqm=condo.size_sqm,
            night_rate=to_major(condo.night_rate),
            month_rate=to_major(condo.month_rate),
            cleaning_fee=to_major(condo.cleaning_fee),
            security_deposit=to_major(condo.security_deposit),
            lease_start_date=condo.lease_start_date,
            lease_end_date=condo.lease_end_date,
            monthly_lease_amount=to_major(condo.monthly_lease_amount),
            monthly_lease_label=format_thb(condo.monthly_lease_amount),
            lease_status=lease_status(condo, today=today),
            lease_days_remaining=days_remaining(condo, today=today),
            security_deposit_label=format_thb(condo.security_deposit),
            deposit_status=state.status,
            deposit_refunded=to_major(state.refunded),
            deposit_deducted=to_major(state.deducted),
            deposit_outstanding=to_major(state.outstanding),
            deposit_outstanding_label=format_thb(state.outstanding),
            address=condo.address,
            description=condo.description,
            status=status,
            images=images,
            cover_url=images[0].url if images else None,
            night_rate_label=format_thb(condo.night_rate),
            month_rate_label=format_thb(condo.month_rate),
        )


class DepositRefundCreate(BaseModel):
    """Recording money coming back from the owner.

    ``refunded`` and ``deducted`` are captured separately rather than derived
    from one another: only the deducted part is ever a real cost, and knowing
    why is the point of recording it at all.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    refund_date: date
    refunded_amount: Baht = Decimal(0)
    deducted_amount: Baht = Decimal(0)
    deduction_reason: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("deduction_reason", "notes")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return v or None

    @model_validator(mode="after")
    def _something_moved(self) -> DepositRefundCreate:
        if self.refunded_amount <= 0 and self.deducted_amount <= 0:
            raise ValueError("Record a refunded amount, a deduction, or both")
        if self.deducted_amount > 0 and not self.deduction_reason:
            raise ValueError("Say what the deduction was for")
        return self


def apply_money_fields(condo: Condo, data: dict[str, Any]) -> None:
    """Copy validated baht values onto the model as satang."""
    for field in (
        "night_rate",
        "month_rate",
        "cleaning_fee",
        "security_deposit",
        "monthly_lease_amount",
    ):
        if field in data and data[field] is not None:
            setattr(condo, field, to_minor(data[field]))
