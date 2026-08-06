"""Demo data from the approved design.

The nine condos in the prototype's seed (design lines 1845–1855). Rates there
are whole baht, so they are converted to satang on the way in.

Seeding real, recognisable data matters more than it sounds: every phase
becomes demoable immediately, and the figures on screen can be checked against
the prototype rather than against nothing.
"""

from __future__ import annotations

from app.common.money import to_minor
from app.extensions import db
from app.models.condo import Condo, PropertyType
from sqlalchemy import func, select

# code, name, beds, baths, sqm, night, month, cleaning, deposit
DESIGN_CONDOS: list[tuple[str, str, int, int, int, int, int, int, int]] = [
    ("A-1204", "Ashton Asoke 1204", 1, 1, 42, 1800, 32000, 500, 10000),
    ("A-0908", "Ashton Asoke 0908", 0, 1, 30, 1500, 28000, 500, 8000),
    ("R-1502", "Rhythm Ekkamai 1502", 1, 1, 45, 2100, 38000, 600, 12000),
    ("R-0705", "Rhythm Ekkamai 0705", 1, 1, 44, 1950, 35000, 600, 12000),
    ("N-2201", "Noble Ploenchit 2201", 2, 2, 68, 3200, 55000, 900, 20000),
    ("I-0403", "Ideo Q Chula 0403", 0, 1, 28, 1400, 26000, 450, 7000),
    ("I-0811", "Ideo Q Chula 0811", 1, 1, 38, 1600, 29000, 450, 9000),
    ("L-1103", "Life Asoke 1103", 1, 1, 40, 1750, 31000, 500, 10000),
    ("M-1808", "Ideo Mobi 1808", 1, 1, 36, 1650, 30000, 500, 9000),
]

ADDRESSES: dict[str, str] = {
    "A": "Sukhumvit 21, Watthana, Bangkok",
    "R": "Sukhumvit 63, Watthana, Bangkok",
    "N": "Ploenchit Road, Pathum Wan, Bangkok",
    "I": "Banthat Thong Road, Pathum Wan, Bangkok",
    "L": "Asoke Montri Road, Watthana, Bangkok",
    "M": "Sukhumvit 81, Phra Khanong, Bangkok",
}


def seed_condos(*, force: bool = False) -> int:
    """Insert the design's condos. Returns the count, or -1 if skipped."""
    existing = db.session.scalar(
        select(func.count()).select_from(Condo).where(Condo.deleted_at.is_(None))
    ) or 0
    if existing and not force:
        return -1

    created = 0
    for code, name, beds, baths, sqm, night, month, cleaning, deposit in DESIGN_CONDOS:
        if db.session.scalar(select(Condo).where(Condo.code == code)) is not None:
            continue
        db.session.add(
            Condo(
                code=code,
                name=name,
                property_type=PropertyType.CONDOMINIUM,
                bedrooms=beds,
                bathrooms=baths,
                size_sqm=sqm,
                night_rate=to_minor(night),
                month_rate=to_minor(month),
                cleaning_fee=to_minor(cleaning),
                security_deposit=to_minor(deposit),
                address=ADDRESSES.get(code[0]),
            )
        )
        created += 1

    db.session.commit()
    return created
