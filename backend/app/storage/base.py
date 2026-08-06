"""Storage abstraction.

One interface, two implementations: local disk for development (no credentials
needed, so work is never blocked on a bucket) and S3-compatible for production.
Callers only ever hold a *storage key*; URLs are minted per request so the two
backends behave identically at the call site.
"""

from __future__ import annotations

import hashlib
import mimetypes
import posixpath
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import BinaryIO

from app.models.base import uuid7


@dataclass(frozen=True, slots=True)
class StoredObject:
    key: str
    content_type: str
    byte_size: int
    checksum_sha256: str


class StorageBackend(ABC):
    """Contract every storage implementation honours."""

    @abstractmethod
    def put(self, key: str, stream: BinaryIO, *, content_type: str) -> StoredObject: ...

    @abstractmethod
    def open(self, key: str) -> BinaryIO: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    @abstractmethod
    def url_for(self, key: str, *, download_name: str | None = None) -> str:
        """A time-limited URL the browser can fetch directly."""

    @abstractmethod
    def health(self) -> None:
        """Raise if the backend is unreachable. Used by /readyz."""


def build_key(prefix: str, filename: str | None, *, today: date | None = None) -> str:
    """Date-sharded, collision-free, and never derived from user input.

    Using the uploaded filename as the key is how you get path traversal and
    overwrite bugs; only the extension is carried across, and only if it is a
    plausible one.
    """
    stamp = (today or date.today()).strftime("%Y/%m")
    ext = ""
    if filename and "." in filename:
        candidate = filename.rsplit(".", 1)[-1].lower()
        if candidate.isalnum() and 1 <= len(candidate) <= 5:
            ext = f".{candidate}"
    return posixpath.join(prefix, stamp, f"{uuid7().hex}{ext}")


def guess_content_type(filename: str | None, fallback: str = "application/octet-stream") -> str:
    if not filename:
        return fallback
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or fallback


def sha256_of(stream: BinaryIO, *, chunk: int = 1024 * 1024) -> tuple[str, int]:
    """Checksum and byte length, restoring the stream position afterwards."""
    digest = hashlib.sha256()
    total = 0
    start = stream.tell()
    while data := stream.read(chunk):
        digest.update(data)
        total += len(data)
    stream.seek(start)
    return digest.hexdigest(), total
