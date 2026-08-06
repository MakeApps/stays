"""Condo data access."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import selectinload

from app.common.pagination import PageParams, apply_sort
from app.models.condo import Condo, CondoImage
from app.repositories.base import BaseRepository

# Explicit allowlist: a raw column name from the query string would be both an
# injection vector and an invitation to sort by an unindexed column.
SORTABLE = {
    "name": Condo.name,
    "code": Condo.code,
    "night_rate": Condo.night_rate,
    "month_rate": Condo.month_rate,
    "bedrooms": Condo.bedrooms,
    "created_at": Condo.created_at,
}


class CondoRepository(BaseRepository[Condo]):
    model = Condo

    def base_query(self, *, include_deleted: bool = False) -> Select[tuple[Condo]]:
        # selectinload keeps the grid at a fixed two queries regardless of how
        # many condos come back — the images relationship would otherwise be
        # the classic N+1 on this screen.
        return super().base_query(include_deleted=include_deleted).options(
            selectinload(Condo.images)
        )

    def search(self, params: PageParams, *, q: str | None = None) -> Select[tuple[Condo]]:
        stmt = self.base_query()
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(Condo.name.like(like), Condo.code.like(like), Condo.address.like(like))
            )
        return apply_sort(stmt, params, allowed=SORTABLE, default="name")

    def by_code(self, code: str, *, include_deleted: bool = False) -> Condo | None:
        stmt = self.base_query(include_deleted=include_deleted).where(Condo.code == code)
        return self.session.scalars(stmt).unique().first()

    def code_taken(self, code: str, *, exclude_id: uuid.UUID | None = None) -> bool:
        """Uniqueness among live rows only.

        MySQL has no partial unique index, and a hard UNIQUE would make a code
        permanently unusable after a soft delete, so this is enforced here.
        """
        stmt = select(func.count()).select_from(Condo).where(
            Condo.code == code, Condo.deleted_at.is_(None)
        )
        if exclude_id is not None:
            stmt = stmt.where(Condo.id != exclude_id)
        return (self.session.scalar(stmt) or 0) > 0

    def next_image_position(self, condo_id: uuid.UUID) -> int:
        current = self.session.scalar(
            select(func.max(CondoImage.position)).where(CondoImage.condo_id == condo_id)
        )
        return (current or -1) + 1

    def get_image(self, condo_id: uuid.UUID, image_id: uuid.UUID) -> CondoImage | None:
        return self.session.scalars(
            select(CondoImage).where(
                CondoImage.id == image_id, CondoImage.condo_id == condo_id
            )
        ).one_or_none()

    def counts_by_status(self) -> dict[str, Any]:
        """Totals for the filter pills.

        Phase 1 has no bookings, so occupied/reserved are always zero; the
        derivation lands with the booking module in Phase 2.
        """
        total = self.session.scalar(
            select(func.count()).select_from(Condo).where(Condo.deleted_at.is_(None))
        ) or 0
        maintenance = self.session.scalar(
            select(func.count())
            .select_from(Condo)
            .where(Condo.deleted_at.is_(None), Condo.is_maintenance.is_(True))
        ) or 0
        return {
            "all": total,
            "available": total - maintenance,
            "occupied": 0,
            "reserved": 0,
            "maintenance": maintenance,
        }
