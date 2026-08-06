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
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.common.money import to_major, to_minor
from app.models.condo import Condo, PropertyType

CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 \-_/]{0,23}$")


def _normalise_code(v: str) -> str:
    if not CODE_RE.match(v):
        raise ValueError("Use letters, numbers, spaces, dashes or slashes (max 24 characters)")
    return v.upper()


Baht = Annotated[Decimal, Field(ge=0, le=Decimal("99999999"))]
CondoCode = Annotated[str, Field(min_length=1, max_length=24), AfterValidator(_normalise_code)]

UnitStatus = Literal["available", "occupied", "reserved", "maintenance"]


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
    security_deposit: Baht = Decimal(0)

    address: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_maintenance: bool = False

    @field_validator("address", "description")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        return v or None


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
    address: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_maintenance: bool | None = None


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
    ) -> CondoOut:
        from app.common.money import format_thb

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
            address=condo.address,
            description=condo.description,
            status=status,
            images=images,
            cover_url=images[0].url if images else None,
            night_rate_label=format_thb(condo.night_rate),
            month_rate_label=format_thb(condo.month_rate),
        )


def apply_money_fields(condo: Condo, data: dict[str, Any]) -> None:
    """Copy validated baht values onto the model as satang."""
    for field in ("night_rate", "month_rate", "cleaning_fee", "security_deposit"):
        if field in data and data[field] is not None:
            setattr(condo, field, to_minor(data[field]))
