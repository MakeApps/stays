"""Storage factory."""

from __future__ import annotations

from app.config import Settings
from app.storage.base import (
    StorageBackend,
    StoredObject,
    build_key,
    guess_content_type,
    sha256_of,
)
from app.storage.local import LocalStorage

__all__ = [
    "LocalStorage",
    "StorageBackend",
    "StoredObject",
    "build_key",
    "build_storage",
    "guess_content_type",
    "sha256_of",
]


def build_storage(settings: Settings) -> StorageBackend:
    if settings.STORAGE_BACKEND == "s3":
        from app.storage.s3 import S3Storage

        return S3Storage(
            bucket=settings.S3_BUCKET,
            region=settings.S3_REGION,
            access_key=settings.S3_ACCESS_KEY_ID,
            secret_key=settings.S3_SECRET_ACCESS_KEY,
            endpoint_url=settings.S3_ENDPOINT_URL or None,
            url_ttl=settings.STORAGE_URL_TTL_SEC,
        )

    return LocalStorage(
        settings.STORAGE_LOCAL_DIR,
        secret=settings.SECRET_KEY,
        url_ttl=settings.STORAGE_URL_TTL_SEC,
        url_prefix=settings.API_PREFIX,
    )
