"""lease_terms_and_deposit_ledger

Adds the long-term lease we hold each unit under, and a ledger of recoveries
against the refundable deposit paid to its owner.

Purely additive. Every new column is nullable or carries a server default, so
existing condos migrate to "no lease recorded" rather than to a zero-length
lease, and no existing row needs rewriting.

Autogenerate also proposed six audit-column foreign keys on
``expense_categories``, ``expenses`` and ``payment_methods``. Those are
pre-existing drift between the models and the initial migration, unrelated to
leases, and are deliberately left out — fixing them belongs in its own change
where it can be reviewed on its own merits.

Revision ID: c8ca2930c7e5
Revises: 977d7dcfbaa3
Create Date: 2026-08-08 22:50:43.781653
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# Binds `app` in this namespace so autogenerate's `app.models.base.GUID(...)`
# references resolve. `import ... as x` would bind only `x`.
import app.models.base  # noqa: F401

revision: str = 'c8ca2930c7e5'
down_revision: str | None = '977d7dcfbaa3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'deposit_transactions',
        sa.Column('condo_id', app.models.base.GUID(length=16), nullable=False),
        sa.Column('original_amount', sa.BigInteger(), nullable=False),
        sa.Column('refunded_amount', sa.BigInteger(), nullable=False),
        sa.Column('deducted_amount', sa.BigInteger(), nullable=False),
        sa.Column('deduction_reason', sa.String(length=255), nullable=True),
        sa.Column('refund_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', app.models.base.GUID(length=16), nullable=False),
        sa.Column('created_by', app.models.base.GUID(length=16), nullable=True),
        sa.Column('updated_by', app.models.base.GUID(length=16), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['condo_id'], ['condos.id'],
            name=op.f('fk_deposit_transactions_condo_id'), ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['created_by'], ['users.id'],
            name=op.f('fk_deposit_transactions_created_by'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.ForeignKeyConstraint(
            ['updated_by'], ['users.id'],
            name=op.f('fk_deposit_transactions_updated_by'),
            ondelete='SET NULL', use_alter=True,
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_deposit_transactions')),
    )
    op.create_index(
        'ix_deposit_transactions_condo_date',
        'deposit_transactions',
        ['condo_id', 'refund_date'],
        unique=False,
    )

    op.add_column('condos', sa.Column('lease_start_date', sa.Date(), nullable=True))
    op.add_column('condos', sa.Column('lease_end_date', sa.Date(), nullable=True))
    # server_default, not just nullable=False: MySQL and MariaDB in strict mode
    # refuse a NOT NULL column with no default on a table that already holds
    # rows, and this one does.
    op.add_column(
        'condos',
        sa.Column('monthly_lease_amount', sa.BigInteger(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('condos', 'monthly_lease_amount')
    op.drop_column('condos', 'lease_end_date')
    op.drop_column('condos', 'lease_start_date')
    op.drop_index('ix_deposit_transactions_condo_date', table_name='deposit_transactions')
    op.drop_table('deposit_transactions')
