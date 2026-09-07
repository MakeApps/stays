"""organisations

Introduces the tenant boundary. Condos, bookings, expenses, the categories and
payment methods they are filed under, and the activity feed each belong to
exactly one organisation, and a query filter in ``models.base`` confines every
read to the acting one.

Not additive, and deliberately so:

* ``users.role`` is dropped. Being an admin is something you are *within* an
  organisation -- the same person can own one portfolio and merely work in
  another -- so the role moves onto ``organisation_members``. Leaving the
  column behind would have created a second source of truth that disagrees the
  first time someone is added to a second organisation.
* Every scoped table gains a NOT NULL ``organisation_id``. The column is added
  nullable, backfilled, and only then tightened, so no existing row is lost and
  the constraint is real rather than aspirational.

Existing data is folded into one organisation named below, and every existing
user becomes a member of it carrying the role they already had. A system that
was running before this migration looks unchanged after it.

Revision ID: d5f2a83c61be
Revises: c8ca2930c7e5
Create Date: 2026-09-07 09:12:04.118902
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

# Binds `app` in this namespace so autogenerate's `app.models.base.GUID(...)`
# references resolve. `import ... as x` would bind only `x`.
import app.models.base

revision: str = 'd5f2a83c61be'
down_revision: str | None = 'c8ca2930c7e5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

GUID = app.models.base.GUID

#: The organisation every pre-existing row is folded into.
DEFAULT_ORGANISATION_NAME = "LocalShouts Stays"

#: Tables whose rows belong to a tenant and are filtered by the acting one.
SCOPED_TABLES: tuple[str, ...] = (
    "condos",
    "bookings",
    "expenses",
    "expense_categories",
    "payment_methods",
    "activity_logs",
)


def _uuid7_bytes() -> bytes:
    return app.models.base.uuid7().bytes


def upgrade() -> None:
    op.create_table(
        'organisations',
        sa.Column('name', sa.String(length=160), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', GUID(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', GUID(length=16), nullable=True),
        sa.Column('updated_by', GUID(length=16), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ['created_by'], ['users.id'],
            name=op.f('fk_organisations_created_by_users'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.ForeignKeyConstraint(
            ['updated_by'], ['users.id'],
            name=op.f('fk_organisations_updated_by_users'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_organisations')),
    )
    op.create_index('ix_organisations_deleted_at', 'organisations', ['deleted_at'], unique=False)
    op.create_index('ix_organisations_name', 'organisations', ['name'], unique=False)

    op.create_table(
        'organisation_members',
        sa.Column('organisation_id', GUID(length=16), nullable=False),
        sa.Column('user_id', GUID(length=16), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('id', GUID(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', GUID(length=16), nullable=True),
        sa.Column('updated_by', GUID(length=16), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ['organisation_id'], ['organisations.id'],
            name=op.f('fk_organisation_members_organisation_id_organisations'),
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'],
            name=op.f('fk_organisation_members_user_id_users'),
        ),
        sa.ForeignKeyConstraint(
            ['created_by'], ['users.id'],
            name=op.f('fk_organisation_members_created_by_users'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.ForeignKeyConstraint(
            ['updated_by'], ['users.id'],
            name=op.f('fk_organisation_members_updated_by_users'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_organisation_members')),
    )
    op.create_index(
        'ix_organisation_members_org_user', 'organisation_members',
        ['organisation_id', 'user_id'], unique=False,
    )
    op.create_index(
        'ix_organisation_members_user_id', 'organisation_members', ['user_id'], unique=False,
    )
    op.create_index(
        'ix_organisation_members_deleted_at', 'organisation_members',
        ['deleted_at'], unique=False,
    )

    # Nullable first: the rows already in these tables have nowhere to point yet.
    for table in SCOPED_TABLES:
        op.add_column(table, sa.Column('organisation_id', GUID(length=16), nullable=True))
    # Sessions remember which organisation they are acting in, so a refresh
    # lands back where the user was rather than guessing.
    op.add_column(
        'refresh_tokens', sa.Column('organisation_id', GUID(length=16), nullable=True)
    )

    conn = op.get_bind()
    now = datetime.now(UTC).replace(tzinfo=None)
    org_id = _uuid7_bytes()

    conn.execute(
        sa.text(
            "INSERT INTO organisations (id, name, is_active, created_at, updated_at) "
            "VALUES (:id, :name, 1, :now, :now)"
        ),
        {"id": org_id, "name": DEFAULT_ORGANISATION_NAME, "now": now},
    )

    for table in (*SCOPED_TABLES, "refresh_tokens"):
        # S608: the table name comes from the tuple above, never from input.
        conn.execute(
            sa.text(f"UPDATE {table} SET organisation_id = :org"),  # noqa: S608
            {"org": org_id},
        )

    # Every user, soft-deleted ones included: excluding them would strand the
    # rows they created with a created_by pointing at a non-member.
    for user_id, role in conn.execute(sa.text("SELECT id, role FROM users")).fetchall():
        conn.execute(
            sa.text(
                "INSERT INTO organisation_members "
                "(id, organisation_id, user_id, role, created_at, updated_at) "
                "VALUES (:id, :org, :user, :role, :now, :now)"
            ),
            {
                "id": _uuid7_bytes(),
                "org": org_id,
                "user": user_id,
                "role": role,
                "now": now,
            },
        )

    # Now that every row points somewhere, the constraint can be real.
    for table in SCOPED_TABLES:
        op.alter_column(table, 'organisation_id', existing_type=sa.BINARY(16), nullable=False)
        op.create_index(f'ix_{table}_organisation_id', table, ['organisation_id'], unique=False)
        op.create_foreign_key(
            op.f(f'fk_{table}_organisation_id_organisations'),
            table, 'organisations', ['organisation_id'], ['id'],
        )
    op.alter_column(
        'refresh_tokens', 'organisation_id', existing_type=sa.BINARY(16), nullable=False
    )
    op.create_foreign_key(
        op.f('fk_refresh_tokens_organisation_id_organisations'),
        'refresh_tokens', 'organisations', ['organisation_id'], ['id'],
    )

    # Uniqueness on the lookup tables becomes per organisation. Left global,
    # the first tenant to own the name "Electricity" would take it away from
    # every other one -- and seeding a second organisation would fail outright.
    op.drop_index('uq_expense_categories_name', table_name='expense_categories')
    op.create_index(
        'uq_expense_categories_organisation_id_name',
        'expense_categories', ['organisation_id', 'name'], unique=True,
    )
    op.drop_index('uq_payment_methods_name', table_name='payment_methods')
    op.create_index(
        'uq_payment_methods_organisation_id_name',
        'payment_methods', ['organisation_id', 'name'], unique=True,
    )

    # Superseded by organisation_members.role.
    op.drop_index('ix_users_role_active', table_name='users')
    op.create_index('ix_users_is_active', 'users', ['is_active'], unique=False)
    op.drop_column('users', 'role')


def downgrade() -> None:
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='admin'),
    )
    conn = op.get_bind()
    # Best effort: a user in several organisations had one role per membership
    # and there is only one column to put it in, so the earliest wins.
    conn.execute(
        sa.text(
            "UPDATE users u SET role = COALESCE(("
            "  SELECT m.role FROM organisation_members m"
            "  WHERE m.user_id = u.id AND m.deleted_at IS NULL"
            "  ORDER BY m.created_at LIMIT 1"
            "), 'admin')"
        )
    )
    op.drop_index('ix_users_is_active', table_name='users')
    op.create_index('ix_users_role_active', 'users', ['role', 'is_active'], unique=False)

    op.drop_index(
        'uq_payment_methods_organisation_id_name', table_name='payment_methods'
    )
    op.create_index('uq_payment_methods_name', 'payment_methods', ['name'], unique=True)
    op.drop_index(
        'uq_expense_categories_organisation_id_name', table_name='expense_categories'
    )
    op.create_index(
        'uq_expense_categories_name', 'expense_categories', ['name'], unique=True
    )

    op.drop_constraint(
        op.f('fk_refresh_tokens_organisation_id_organisations'),
        'refresh_tokens', type_='foreignkey',
    )
    op.drop_column('refresh_tokens', 'organisation_id')
    for table in SCOPED_TABLES:
        op.drop_constraint(
            op.f(f'fk_{table}_organisation_id_organisations'), table, type_='foreignkey'
        )
        op.drop_index(f'ix_{table}_organisation_id', table_name=table)
        op.drop_column(table, 'organisation_id')

    op.drop_table('organisation_members')
    op.drop_table('organisations')
