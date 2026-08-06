"""Pagination, sorting and the list-response envelope.

Sort fields are validated against an explicit allowlist per resource. Passing a
raw column name from the query string into ``order_by`` is a SQL-injection
vector and also lets a client sort by an unindexed column and table-scan the
database, so both are refused here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

T = TypeVar("T")

MAX_PAGE_SIZE = 100


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=MAX_PAGE_SIZE)
    sort: str | None = None
    order: str = Field(default="asc")

    @field_validator("order")
    @classmethod
    def _order_direction(cls, v: str) -> str:
        lowered = v.lower()
        if lowered not in {"asc", "desc"}:
            raise ValueError("order must be 'asc' or 'desc'")
        return lowered

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page


@dataclass(frozen=True, slots=True)
class Page(Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int

    @property
    def pages(self) -> int:
        return (self.total + self.per_page - 1) // self.per_page if self.per_page else 0

    def envelope(self, serialise: Any) -> dict[str, Any]:
        return {
            "items": [serialise(item) for item in self.items],
            "meta": {
                "page": self.page,
                "per_page": self.per_page,
                "total": self.total,
                "pages": self.pages,
                "has_next": self.page < self.pages,
                "has_prev": self.page > 1,
            },
        }


def apply_sort(
    stmt: Select[Any],
    params: PageParams,
    *,
    allowed: dict[str, InstrumentedAttribute[Any]],
    default: str,
) -> Select[Any]:
    key = params.sort or default
    column = allowed.get(key)
    if column is None:
        from app.common.errors import ValidationError

        raise ValidationError(
            f"Cannot sort by {key!r}.",
            details={"allowed": sorted(allowed)},
        )
    direction = desc if params.order == "desc" else asc
    # Secondary key on the primary key keeps pagination stable when the sort
    # column has ties — otherwise rows can repeat or vanish between pages.
    return stmt.order_by(direction(column), asc(_primary_key(stmt)))


def _primary_key(stmt: Select[Any]) -> Any:
    entity = stmt.column_descriptions[0]["entity"]
    return entity.id


def paginate(session: Session, stmt: Select[Any], params: PageParams) -> Page[Any]:
    total = session.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = list(
        session.scalars(stmt.limit(params.per_page).offset(params.offset)).unique()
    )
    return Page(items=rows, total=total, page=params.page, per_page=params.per_page)
