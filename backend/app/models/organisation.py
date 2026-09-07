"""Organisations and membership.

An organisation is the tenant boundary: condos, bookings, expenses, the
categories they are filed under and the activity feed all belong to exactly
one, and nothing in the app reads across that line.

Membership is a join table rather than a column on ``users`` because the same
person runs more than one set of condos — an owner with two portfolios, an
agency managing for several clients — and re-registering under a second email
to do that is not a product, it is a workaround. The role lives here too, not
on the user: being an admin is something you are *within* an organisation, so
the same account can own one and merely work in another.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    GUID,
    AuditMixin,
    Base,
    SoftDeleteMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.user import Role, User


class Organisation(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    __tablename__ = "organisations"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    members: Mapped[list[OrganisationMember]] = relationship(
        back_populates="organisation", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Names are not unique. Two unrelated customers may both call their
        # portfolio "Sunset Rentals", and rejecting the second one would be
        # enforcing a global namespace on tenants that cannot see each other.
        Index("ix_organisations_name", "name"),
        Index("ix_organisations_deleted_at", "deleted_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Organisation {self.name}>"


class OrganisationMember(Base, UUIDPrimaryKeyMixin, AuditMixin, SoftDeleteMixin):
    """One person's standing in one organisation."""

    __tablename__ = "organisation_members"

    organisation_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("organisations.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("users.id"), nullable=False)

    role: Mapped[Role] = mapped_column(
        Enum(Role, values_callable=lambda e: [m.value for m in e], native_enum=False, length=20),
        nullable=False,
        default=Role.MANAGER,
    )

    organisation: Mapped[Organisation] = relationship(back_populates="members")
    # AuditMixin adds created_by and updated_by, which also point at users, so
    # the join has to say which of the three columns means "the member".
    user: Mapped[User] = relationship(foreign_keys=[user_id])

    __table_args__ = (
        # Not UNIQUE, for the same reason users.email is not: removing someone
        # from an organisation soft-deletes the row, and a hard constraint
        # would then make re-adding them impossible. Enforced in the service.
        Index("ix_organisation_members_org_user", "organisation_id", "user_id"),
        Index("ix_organisation_members_user_id", "user_id"),
        Index("ix_organisation_members_deleted_at", "deleted_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<OrganisationMember user={self.user_id} role={self.role.value}>"
