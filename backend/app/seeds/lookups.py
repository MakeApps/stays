"""Expense categories and payment methods from the approved design.

Names come from lines 1823–1824 and the tones from the CATTONE map at
1825–1831, so the pill colours match the prototype exactly.
"""

from __future__ import annotations

from sqlalchemy import select

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


def seed_lookups() -> tuple[int, int]:
    """Idempotent: safe to re-run after adding a category to the list."""
    added_categories = 0
    for position, (name, tone) in enumerate(CATEGORIES):
        existing = db.session.scalar(
            select(ExpenseCategory).where(ExpenseCategory.name == name)
        )
        if existing is None:
            db.session.add(ExpenseCategory(name=name, tone=tone, position=position))
            added_categories += 1
        else:
            existing.tone = tone
            existing.position = position

    added_methods = 0
    for position, name in enumerate(METHODS):
        existing = db.session.scalar(select(PaymentMethod).where(PaymentMethod.name == name))
        if existing is None:
            db.session.add(PaymentMethod(name=name, position=position))
            added_methods += 1
        else:
            existing.position = position

    db.session.commit()
    return added_categories, added_methods
