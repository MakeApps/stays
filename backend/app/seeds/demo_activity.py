"""The prototype's bookings and expenses, as loadable demo data.

Taken from the design's seed arrays (lines 1856–1902). Day-of-month numbers are
anchored to the **current** month rather than hardcoded to August 2026, so the
demo still looks alive whenever it is loaded and the dashboard is never staring
at an empty period.

Amounts in the design are whole baht; they are converted to satang on the way
in. Because every figure here matches the prototype, any screen can be checked
against it side by side.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import func, select

from app.common.money import to_minor
from app.extensions import db
from app.models.booking import BookingStatus
from app.models.condo import Condo
from app.models.expense import Expense, ExpenseCategory, ExpenseStatus, PaymentMethod
from app.services.booking_service import BookingService
from app.services.pricing import PricingMode

# condo code, guest, check-in day, check-out day, status, total, received, phone, email, notes
BOOKINGS: list[tuple[str, str, int, int, str, int, int, str, str, str]] = [
    ("A-1204", "Sarah Chen", 1, 9, "booked", 14400, 14400, "+66 81 224 8890", "sarah.chen@gmail.com", "Repeat guest, late check-out approved."),
    ("A-1204", "James Whitfield", 12, 19, "booked", 12600, 6000, "+44 7700 900412", "jwhitfield@outlook.com", ""),
    ("A-0908", "Chloe Baptiste", 10, 14, "booked", 6000, 6000, "+33 6 12 44 88 21", "chloe.b@proton.me", ""),
    ("A-0908", "Nok Phanit", 22, 28, "pending", 9000, 0, "+66 92 771 3320", "nok.phanit@gmail.com", "Holding until deposit clears Friday."),
    ("R-1502", "Marco Fenn", 3, 14, "booked", 23100, 23100, "+49 151 2233 991", "m.fenn@web.de", ""),
    ("R-1502", "Aiko Tanaka", 20, 27, "pending", 14700, 5000, "+81 90 1234 5678", "aiko.tanaka@icloud.com", "Moved at guest request."),
    ("R-0705", "Daniel Ortiz", 8, 11, "booked", 5850, 5850, "+34 611 223 445", "dortiz@gmail.com", ""),
    ("R-0705", "Priya Nair", 16, 24, "booked", 15600, 8000, "+91 98200 44112", "priya.nair@gmail.com", "Extra bed requested."),
    ("N-2201", "Beckett family", 1, 16, "booked", 48000, 48000, "+61 412 887 300", "r.beckett@bigpond.com", "Two children, cot provided."),
    ("N-2201", "Lena Vogt", 24, 28, "booked", 22400, 10000, "+43 664 112 8890", "lena.vogt@gmx.at", ""),
    ("I-0403", "Aircon replacement", 5, 12, "maintenance", 0, 0, "Somchai · maintenance", "somchai.fix@line.me", "Both units replaced, unavailable to book."),
    ("I-0811", "Tom Reilly", 6, 10, "booked", 6400, 6400, "+353 87 224 1180", "treilly@gmail.com", ""),
    ("I-0811", "Yuki Mori", 18, 23, "pending", 8000, 0, "+81 80 4422 9910", "yuki.mori@gmail.com", "Awaiting flight confirmation."),
    ("L-1103", "Grace Okafor", 2, 13, "booked", 19250, 19250, "+234 803 221 4477", "g.okafor@yahoo.com", ""),
    ("L-1103", "Ravi Menon", 15, 21, "booked", 10500, 4000, "+91 99400 22118", "ravi.menon@gmail.com", ""),
]

# day, condo code, category, amount, method, vendor, reference, description, status
EXPENSES: list[tuple[int, str, str, int, str, str, str, str, str]] = [
    (6, "A-1204", "Electricity", 2840, "PromptPay", "MEA", "EL-2608-1204", "July meter reading", "paid"),
    (6, "R-1502", "Cleaning", 800, "Cash", "Khun Malee", "", "Turnover clean after Marco", "paid"),
    (5, "N-2201", "Internet", 1090, "Bank Transfer", "AIS Fibre", "AIS-88213", "Monthly 500/300 fibre", "paid"),
    (4, "I-0403", "Repairs", 18500, "Bank Transfer", "Chai Aircon", "INV-4471", "Two aircon units replaced", "paid"),
    (3, "L-1103", "Water", 420, "PromptPay", "MWA", "WA-0803", "July water bill", "paid"),
    (2, "A-0908", "Supplies", 1250, "Credit Card", "Big C", "", "Towels, amenities, coffee pods", "paid"),
    (1, "R-0705", "Laundry", 640, "Cash", "Ekkamai Laundry", "", "Linen service, 8 sets", "paid"),
    (1, "N-2201", "Commission", 4800, "Bank Transfer", "Agoda", "AGD-77120", "Channel commission", "pending"),
    (8, "A-1204", "Cleaning", 800, "Cash", "Khun Malee", "", "Turnover clean after Sarah", "paid"),
    (10, "M-1808", "Furniture", 12400, "Credit Card", "Index Living Mall", "IDX-9910", "Sofa and four dining chairs", "paid"),
    (12, "I-0811", "Maintenance", 1500, "Cash", "Somchai", "", "Water heater annual service", "paid"),
    (14, "R-1502", "Electricity", 3120, "PromptPay", "MEA", "EL-2608-1502", "July meter reading", "paid"),
    (15, "L-1103", "Property Tax", 6800, "Bank Transfer", "BMA", "TAX-2026-11", "Annual land and building tax", "pending"),
    (16, "A-0908", "Insurance", 3400, "Credit Card", "Muang Thai", "POL-33218", "Contents cover renewal", "paid"),
    (18, "N-2201", "Marketing", 2500, "Credit Card", "Meta", "FB-8821", "Boosted listing, 14 days", "paid"),
    (20, "R-0705", "Appliances", 8900, "Bank Transfer", "Power Buy", "PB-2210", "Replacement fridge, 8.6 cu ft", "pending"),
    (21, "I-0403", "Cleaning", 900, "Cash", "Khun Malee", "", "Deep clean after aircon work", "paid"),
    (22, "M-1808", "Internet", 690, "PromptPay", "True Online", "TR-4410", "Monthly fibre", "paid"),
    (24, "A-1204", "Miscellaneous", 350, "Cash", "Local locksmith", "", "Two key fob duplicates", "paid"),
    (25, "L-1103", "Cleaning", 800, "Cash", "Khun Malee", "", "Turnover clean after Ravi", "paid"),
    (26, "R-1502", "Repairs", 2200, "Cash", "Building plumber", "", "Rebilled to juristic office", "cancelled"),
    (28, "I-0811", "Supplies", 980, "Credit Card", "Lotus", "", "Kitchen restock and cleaning products", "paid"),
]


def _clamp(day: int, anchor: date) -> date:
    """Day-of-month against the current month, clamped for shorter months."""
    _, last = monthrange(anchor.year, anchor.month)
    return date(anchor.year, anchor.month, min(day, last))


def seed_activity(*, force: bool = False) -> tuple[int, int]:
    """Load the design's bookings and expenses. Returns (bookings, expenses)."""
    existing = db.session.scalar(select(func.count()).select_from(Expense)) or 0
    from app.models.booking import Booking

    existing += db.session.scalar(select(func.count()).select_from(Booking)) or 0
    if existing and not force:
        return (-1, -1)

    anchor = date.today()
    condos = {c.code: c for c in db.session.scalars(select(Condo).where(Condo.deleted_at.is_(None)))}
    categories = {c.name: c for c in db.session.scalars(select(ExpenseCategory))}
    methods = {m.name: m for m in db.session.scalars(select(PaymentMethod))}
    if not categories or not methods:
        raise RuntimeError("Run `flask seed-lookups` first.")

    service = BookingService(db.session)
    booked = 0
    for code, guest, day_in, day_out, status, total, received, phone, email, notes in BOOKINGS:
        condo = condos.get(code)
        if condo is None:
            continue
        check_in = _clamp(day_in, anchor)
        check_out = _clamp(day_out, anchor)
        if check_out <= check_in:
            check_out = check_in + timedelta(days=1)
        try:
            service.create(
                condo_id=condo.id,
                guest_name=guest,
                check_in=check_in,
                check_out=check_out,
                mode=PricingMode.TOTAL,
                total_manual=to_minor(total),
                received=to_minor(received),
                status=BookingStatus(status),
                guest_phone=phone,
                guest_email=email,
                notes=notes or None,
                tax_pct=0,
            )
            booked += 1
        except Exception:
            db.session.rollback()
            continue
    db.session.commit()

    spent = 0
    for day, code, category, amount, method, vendor, reference, description, status in EXPENSES:
        condo = condos.get(code)
        cat = categories.get(category)
        meth = methods.get(method)
        if condo is None or cat is None or meth is None:
            continue
        db.session.add(
            Expense(
                condo_id=condo.id,
                category_id=cat.id,
                method_id=meth.id,
                spent_on=_clamp(day, anchor),
                amount=to_minor(amount),
                description=description,
                vendor=vendor or None,
                reference=reference or None,
                status=ExpenseStatus(status),
            )
        )
        spent += 1
    db.session.commit()

    return booked, spent
