"""Base repository.

Repositories own data access and nothing else — no business rules, no HTTP
concepts. Soft-deleted rows are excluded by default; including them has to be
an explicit, visible choice at the call site.
"""

from __future__ import annotations

import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.base import Base, SoftDeleteMixin

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(self, session: Session) -> None:
        self.session = session

    # ---- reads ----
    def base_query(self, *, include_deleted: bool = False) -> Select[tuple[ModelT]]:
        stmt = select(self.model)
        if not include_deleted and issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))  # type: ignore[attr-defined]
        return stmt

    def get(self, entity_id: uuid.UUID, *, include_deleted: bool = False) -> ModelT | None:
        stmt = self.base_query(include_deleted=include_deleted).where(
            self.model.id == entity_id  # type: ignore[attr-defined]
        )
        return self.session.scalars(stmt).unique().one_or_none()

    def list_all(self, *, include_deleted: bool = False) -> list[ModelT]:
        return list(self.session.scalars(self.base_query(include_deleted=include_deleted)).unique())

    def exists(self, **filters: Any) -> bool:
        stmt = self.base_query()
        for field, value in filters.items():
            stmt = stmt.where(getattr(self.model, field) == value)
        return self.session.scalar(select(stmt.exists())) or False

    # ---- writes ----
    def add(self, entity: ModelT) -> ModelT:
        self.session.add(entity)
        return entity

    def delete(self, entity: ModelT) -> None:
        """Soft delete where supported, hard delete otherwise."""
        if isinstance(entity, SoftDeleteMixin):
            entity.soft_delete()
        else:
            self.session.delete(entity)

    def flush(self) -> None:
        self.session.flush()
