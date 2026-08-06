"""Flask extension singletons.

Instantiated bare here and bound to the app inside :func:`app.create_app`, so
the module graph stays acyclic and tests can build isolated apps.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy

from app.config import get_settings
from app.models.base import Base

# Flask-SQLAlchemy 3.1 accepts a DeclarativeBase subclass, so `db.Model` *is*
# our Base and the naming convention / type map carry over.
db = SQLAlchemy(model_class=Base)

cors = CORS()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=get_settings().RATELIMIT_STORAGE_URI,
    strategy="fixed-window",
    headers_enabled=True,
)


def _build_password_hasher() -> PasswordHasher:
    s = get_settings()
    return PasswordHasher(
        time_cost=s.ARGON2_TIME_COST,
        memory_cost=s.ARGON2_MEMORY_KB,
        parallelism=s.ARGON2_PARALLELISM,
    )


password_hasher: PasswordHasher = _build_password_hasher()
