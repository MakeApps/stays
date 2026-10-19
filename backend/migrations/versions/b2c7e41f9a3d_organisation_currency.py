"""organisation currency

Revision ID: b2c7e41f9a3d
Revises: 6a953cd13cf6
Create Date: 2026-10-19 10:12:00.000000

One nullable-free column on `organisations`, server-defaulted to THB so every
existing organisation reads exactly as it did before: the books were always in
baht, the column only says so. Amounts are not touched — the currency is the
unit the stored integers are already in, never a conversion of them.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b2c7e41f9a3d'
down_revision: str | None = '6a953cd13cf6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'organisations',
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='THB'),
    )


def downgrade() -> None:
    op.drop_column('organisations', 'currency')
