"""Condo business logic."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any, BinaryIO

from flask import current_app

from app.common import activity
from app.common.errors import DuplicateError, NotFoundError, ValidationError
from app.common.money import format_thb
from app.common.pagination import Page, PageParams, paginate
from app.models.activity_log import ActivityAction, ActivityEntity
from app.models.condo import Condo, CondoImage
from app.repositories.condo_repo import CondoRepository
from app.schemas.condo import (
    CondoCreate,
    CondoListQuery,
    CondoOut,
    CondoUpdate,
    UnitStatus,
    apply_money_fields,
)
from app.services.availability import derive_unit_status
from app.services.condo_status import spans_for, status_map
from app.services.uploads import validate_upload

MAX_IMAGES_PER_CONDO = 12


class CondoService:
    def __init__(self, repo: CondoRepository) -> None:
        self.repo = repo

    # ---------- reads ----------
    def status_of(self, condo: Condo, *, today: date | None = None) -> UnitStatus:
        """Single-condo status. Prefer `statuses_for` when rendering a list."""
        when = today or date.today()
        spans = spans_for(self.repo.session, [condo.id], today=when)
        return derive_unit_status(  # type: ignore[return-value]
            is_maintenance_flagged=condo.is_maintenance,
            spans=spans.get(condo.id, []),
            today=when,
        )

    def statuses_for(self, condos: list[Condo]) -> dict[uuid.UUID, UnitStatus]:
        """One query for the whole page rather than one per card."""
        return status_map(  # type: ignore[return-value]
            self.repo.session, [(c.id, c.is_maintenance) for c in condos]
        )

    def serialise(self, condo: Condo, status: UnitStatus | None = None) -> CondoOut:
        storage = current_app.extensions["storage"]
        return CondoOut.from_model(
            condo,
            status=status or self.status_of(condo),
            image_url=storage.url_for,
        )

    def list(self, params: CondoListQuery) -> tuple[Page[Condo], dict[str, Any]]:
        page_params = PageParams(
            page=params.page, per_page=params.per_page, sort=params.sort, order=params.order
        )
        stmt = self.repo.search(page_params, q=params.q)

        if params.status == "all":
            # Fast path: no derived predicate, so the database paginates.
            return paginate(self.repo.session, stmt, page_params), self.counts_by_status()

        # Status is derived from bookings, so it cannot be a SQL predicate
        # without duplicating the rule. Filter first, then slice — filtering
        # *after* pagination would leave `total` describing a different set
        # than `items`, and short pages in the middle of the list. A portfolio
        # is at most a few hundred rows, so loading the candidates is cheap.
        candidates = list(self.repo.session.scalars(stmt).unique())
        statuses = self.statuses_for(candidates)
        matching = [c for c in candidates if statuses.get(c.id) == params.status]

        start = page_params.offset
        return (
            Page(
                items=matching[start : start + page_params.per_page],
                total=len(matching),
                page=page_params.page,
                per_page=page_params.per_page,
            ),
            self.counts_by_status(),
        )

    def counts_by_status(self) -> dict[str, int]:
        """Filter-pill counts, derived across every live unit."""
        condos = self.repo.list_all()
        statuses = self.statuses_for(condos)
        counts = {"available": 0, "occupied": 0, "reserved": 0, "maintenance": 0}
        for status in statuses.values():
            counts[status] = counts.get(status, 0) + 1
        counts["all"] = len(condos)
        return counts

    def get(self, condo_id: uuid.UUID) -> Condo:
        condo = self.repo.get(condo_id)
        if condo is None:
            raise NotFoundError("That condo does not exist.")
        return condo

    # ---------- writes ----------
    def create(self, payload: CondoCreate) -> Condo:
        if self.repo.code_taken(payload.code):
            raise DuplicateError(
                f"Condo code {payload.code} is already in use.",
                details={"fields": {"code": ["That code is already taken."]}},
            )

        data = payload.model_dump()
        condo = Condo(
            code=payload.code,
            name=payload.name,
            property_type=payload.property_type,
            bedrooms=payload.bedrooms,
            bathrooms=payload.bathrooms,
            size_sqm=payload.size_sqm,
            address=payload.address,
            description=payload.description,
            is_maintenance=payload.is_maintenance,
        )
        apply_money_fields(condo, data)
        self.repo.add(condo)
        self.repo.flush()

        activity.record(
            ActivityAction.CREATED,
            ActivityEntity.CONDO,
            entity_id=condo.id,
            entity_label=condo.name,
            meta={"summary": f"{condo.name} · {format_thb(condo.night_rate)} per night"},
        )
        return condo

    def update(self, condo_id: uuid.UUID, payload: CondoUpdate) -> Condo:
        condo = self.get(condo_id)
        data = payload.model_dump(exclude_unset=True)

        renaming = "code" in data and data["code"] and data["code"] != condo.code
        if renaming and self.repo.code_taken(data["code"], exclude_id=condo.id):
            raise DuplicateError(
                f"Condo code {data['code']} is already in use.",
                details={"fields": {"code": ["That code is already taken."]}},
            )

        for field in (
            "code",
            "name",
            "property_type",
            "bedrooms",
            "bathrooms",
            "size_sqm",
            "address",
            "description",
            "is_maintenance",
        ):
            if field in data:
                setattr(condo, field, data[field])

        apply_money_fields(condo, data)
        self.repo.flush()

        activity.record(
            ActivityAction.UPDATED,
            ActivityEntity.CONDO,
            entity_id=condo.id,
            entity_label=condo.name,
            meta={
                "summary": f"{condo.name} updated",
                "changed": sorted(data.keys()),
            },
        )
        return condo

    def delete(self, condo_id: uuid.UUID) -> None:
        condo = self.get(condo_id)
        # Phase 2 adds a guard here: a condo with future bookings should not be
        # removable without dealing with them first.
        self.repo.delete(condo)
        activity.record(
            ActivityAction.DELETED,
            ActivityEntity.CONDO,
            entity_id=condo.id,
            entity_label=condo.name,
            meta={"summary": f"{condo.name} removed"},
        )

    # ---------- images ----------
    def add_image(
        self,
        condo_id: uuid.UUID,
        stream: BinaryIO,
        *,
        filename: str | None,
        declared_type: str | None,
    ) -> CondoImage:
        condo = self.get(condo_id)
        if len(condo.images) >= MAX_IMAGES_PER_CONDO:
            raise ValidationError(f"A condo can hold at most {MAX_IMAGES_PER_CONDO} photos.")

        s = current_app.config["SETTINGS"]
        storage = current_app.extensions["storage"]

        verified = validate_upload(
            stream,
            filename=filename,
            declared_type=declared_type,
            allowed=s.image_mime_allowlist,
            max_bytes=s.UPLOAD_MAX_BYTES,
        )

        from app.storage import build_key

        key = build_key(f"condos/{condo.id.hex}", filename)
        stored = storage.put(key, stream, content_type=verified.content_type)

        image = CondoImage(
            condo_id=condo.id,
            storage_key=stored.key,
            original_filename=(filename or "")[:255] or None,
            content_type=stored.content_type,
            byte_size=stored.byte_size,
            width=verified.width,
            height=verified.height,
            position=self.repo.next_image_position(condo.id),
        )
        self.repo.add(image)
        self.repo.flush()

        activity.record(
            ActivityAction.UPLOADED,
            ActivityEntity.CONDO,
            entity_id=condo.id,
            entity_label=condo.name,
            meta={"summary": f"Photo added to {condo.name}"},
        )
        return image

    def delete_image(self, condo_id: uuid.UUID, image_id: uuid.UUID) -> None:
        image = self.repo.get_image(condo_id, image_id)
        if image is None:
            raise NotFoundError("That photo does not exist.")

        storage = current_app.extensions["storage"]
        key = image.storage_key
        self.repo.session.delete(image)
        self.repo.flush()
        # Deleted after the row commits-or-rolls-back cleanly; an orphaned
        # object costs pennies, a missing object breaks the page.
        storage.delete(key)

    def reorder_images(self, condo_id: uuid.UUID, ordered_ids: list[uuid.UUID]) -> Condo:
        condo = self.get(condo_id)
        known = {img.id: img for img in condo.images}
        if set(ordered_ids) != set(known):
            raise ValidationError("The photo list must contain every existing photo exactly once.")
        for position, image_id in enumerate(ordered_ids):
            known[image_id].position = position
        self.repo.flush()
        return condo
