"""Expense categories and payment methods from the approved design.

Names come from lines 1823–1824 and the tones from the CATTONE map at
1825–1831, so the pill colours match the prototype exactly.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.common.current_org import scoped_to
from app.extensions import db
from app.models.expense import ExpenseCategory, PaymentMethod

# (name, pill tone) — tones are the DS pill modifiers.
CATEGORIES: list[tuple[str, str]] = [
    ("Electricity", "info"),
    ("Water", "info"),
    ("Internet", "info"),
    ("Cleaning", "ok"),
    ("Maintenance", "warn"),
    ("Repairs", "warn"),
    ("Laundry", "ok"),
    ("Supplies", "ok"),
    ("Furniture", "brand"),
    ("Appliances", "brand"),
    ("Property Tax", "neutral"),
    ("Insurance", "neutral"),
    ("Commission", "neutral"),
    ("Marketing", "neutral"),
    ("Miscellaneous", "neutral"),
]

METHODS: list[str] = ["Cash", "Bank Transfer", "Credit Card", "PromptPay", "Other"]


def seed_lookups(organisation_id: uuid.UUID, *, commit: bool = True) -> tuple[int, int]:
    """Give one organisation its own categories and payment methods.

    Per organisation, not global: an expense points at a category row, so a
    shared row would be a line item one tenant could see referenced from
    another's reporting. Every organisation starts from the same list and is
    free to diverge.

    Idempotent, so it is safe to re-run after adding a category to the list --
    which is why it is scoped explicitly rather than relying on an ambient
    scope that may not be set when the CLI calls it.
    """
    with scoped_to(organisation_id):
        added_categories = 0
        for position, (name, tone) in enumerate(CATEGORIES):
            existing = db.session.scalar(
                select(ExpenseCategory).where(ExpenseCategory.name == name)
            )
            if existing is None:
                db.session.add(
                    ExpenseCategory(
                        organisation_id=organisation_id, name=name, tone=tone, position=position
                    )
                )
                added_categories += 1
            else:
                existing.tone = tone
                existing.position = position

        added_methods = 0
        for position, name in enumerate(METHODS):
            existing = db.session.scalar(select(PaymentMethod).where(PaymentMethod.name == name))
            if existing is None:
                db.session.add(
                    PaymentMethod(
                        organisation_id=organisation_id, name=name, position=position
                    )
                )
                added_methods += 1
            else:
                existing.position = position

        if commit:
            db.session.commit()
        else:
            db.session.flush()
    return added_categories, added_methods
