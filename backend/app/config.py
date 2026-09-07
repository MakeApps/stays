"""Environment-driven configuration.

One settings object per environment, resolved once at import of ``create_app``.
Anything secret has no usable default: production refuses to boot without it
(see :func:`Settings.assert_production_safe`) rather than silently running on a
development key.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Env = Literal["development", "testing", "production"]

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------- core ----------
    ENV: Env = "development"
    DEBUG: bool = False
    APP_NAME: str = "LocalShouts Stays"
    APP_TIMEZONE: str = "Asia/Bangkok"
    API_PREFIX: str = "/api/v1"

    #: Used only when bootstrapping an empty system, so `create-admin` has
    #: an organisation to make the admin an admin of.
    DEFAULT_ORGANISATION_NAME: str = "LocalShouts Stays"
    APP_GIT_SHA: str = "dev"
    APP_VERSION: str = "0.1.0"

    # ---------- database ----------
    # Local default targets XAMPP's MariaDB. Production runs MySQL 8.0, so the
    # schema stays inside the common subset of both engines.
    DATABASE_URL: str = (
        "mysql+pymysql://root@127.0.0.1:3306/localshouts_stays?charset=utf8mb4"
    )
    SQL_ECHO: bool = False
    SLOW_QUERY_MS: int = 200
    N_PLUS_ONE_THRESHOLD: int = 40
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600  # below MySQL's default wait_timeout of 8h

    # ---------- security ----------
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    JWT_SECRET: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MIN: int = 15
    REFRESH_TOKEN_TTL_DAYS: int = 30
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_KB: int = 65536
    ARGON2_PARALLELISM: int = 4

    CORS_ORIGINS: str = "http://localhost:3000"

    # Disabled only under test: the suite signs in dozens of times and would
    # otherwise throttle itself into false failures.
    RATELIMIT_ENABLED: bool = True
    RATELIMIT_STORAGE_URI: str = "memory://"
    RATELIMIT_DEFAULT: str = "600 per hour"
    RATELIMIT_LOGIN: str = "10 per minute"
    # Writes are cheap to make and expensive to undo; this is a runaway-script
    # guard, set well above anything a person can do by hand.
    RATELIMIT_WRITE: str = "120 per minute"
    RATELIMIT_UPLOAD: str = "30 per minute"

    # ---------- seeded admin ----------
    # `flask create-admin` reads these. No public signup exists.
    ADMIN_EMAIL: str = "info@localshouts.com"
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "Pim Suwannarat"

    # ---------- storage ----------
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    STORAGE_LOCAL_DIR: Path = BACKEND_ROOT / "var" / "storage"
    STORAGE_URL_TTL_SEC: int = 900
    UPLOAD_MAX_BYTES: int = 10 * 1024 * 1024
    UPLOAD_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"
    UPLOAD_RECEIPT_TYPES: str = "image/jpeg,image/png,image/webp,application/pdf"

    S3_ENDPOINT_URL: str = ""
    S3_REGION: str = "auto"
    S3_BUCKET: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""

    # ---------- money ----------
    # Every monetary column is an integer in minor units. THB minor unit is the
    # satang (1/100). Storing money as float is never acceptable here.
    CURRENCY: str = "THB"
    CURRENCY_MINOR_UNITS: int = 2
    DEFAULT_VAT_PCT: str = "7"

    # ---------- reports ----------
    # WeasyPrint needs GTK, which is impractical on Windows. PDF endpoints
    # return 501 until the container phase provides the runtime + Thai fonts.
    REPORTS_PDF_ENGINE: Literal["none", "weasyprint"] = "none"

    @field_validator("DATABASE_URL")
    @classmethod
    def _require_utf8mb4(cls, v: str) -> str:
        if "charset=" not in v:
            sep = "&" if "?" in v else "?"
            v = f"{v}{sep}charset=utf8mb4"
        return v

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def image_mime_allowlist(self) -> frozenset[str]:
        return frozenset(m.strip() for m in self.UPLOAD_IMAGE_TYPES.split(",") if m.strip())

    @computed_field  # type: ignore[prop-decorator]
    @property
    def receipt_mime_allowlist(self) -> frozenset[str]:
        return frozenset(m.strip() for m in self.UPLOAD_RECEIPT_TYPES.split(",") if m.strip())

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    def assert_production_safe(self) -> None:
        """Fail fast at boot rather than serve traffic with a generated key.

        A per-process random SECRET_KEY would invalidate every session on each
        restart and differ between workers, so this is a correctness guard as
        much as a security one.
        """
        if not self.is_production:
            return

        problems: list[str] = []
        for name in ("SECRET_KEY", "JWT_SECRET"):
            if name not in self.model_fields_set:
                problems.append(
                    f"{name} was not provided by the environment — the generated "
                    "fallback differs per worker and per restart, which would "
                    "invalidate every session"
                )
            elif len(getattr(self, name)) < 32:
                problems.append(f"{name} must be at least 32 characters")
        if self.DEBUG:
            problems.append("DEBUG must be false in production")
        if self.STORAGE_BACKEND == "s3" and not self.S3_BUCKET:
            problems.append("S3_BUCKET is required when STORAGE_BACKEND=s3")
        if "*" in self.cors_origin_list:
            problems.append("CORS_ORIGINS must not be '*' when cookies carry credentials")
        # A placeholder that ships to production is how the first breach happens.
        weak = {"changeme", "password", "admin", "secret", "letmein"}
        lowered = self.ADMIN_PASSWORD.strip().lower()
        if self.ADMIN_PASSWORD and (
            len(self.ADMIN_PASSWORD) < 12 or any(w in lowered for w in weak)
        ):
            problems.append(
                "ADMIN_PASSWORD looks like a placeholder — use at least 12 characters "
                "with no obvious word, or leave it blank and let create-admin generate one"
            )

        if problems:
            raise RuntimeError(
                "Refusing to start in production:\n  - " + "\n  - ".join(problems)
            )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
