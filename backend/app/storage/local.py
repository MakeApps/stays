"""Local-disk storage backend for development.

Serves files through a signed application route rather than a static mount, so
access control and expiry behave the same way they will against S3. Receipts
are financial records and must not be world-readable just because the
development server is running.
"""

from __future__ import annotations

import hmac
import shutil
import time
from hashlib import sha256
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote, urlencode

from app.common.errors import NotFoundError
from app.storage.base import StorageBackend, StoredObject, sha256_of


class LocalStorage(StorageBackend):
    def __init__(self, root: Path, *, secret: str, url_ttl: int, url_prefix: str) -> None:
        self._root = root
        self._secret = secret.encode()
        self._ttl = url_ttl
        self._url_prefix = url_prefix.rstrip("/")
        self._root.mkdir(parents=True, exist_ok=True)

    # ---- path safety ----
    def _path(self, key: str) -> Path:
        # resolve() then containment check: without this, a key of
        # "../../.env" escapes the storage root.
        candidate = (self._root / key).resolve()
        root = self._root.resolve()
        if not candidate.is_relative_to(root):
            raise NotFoundError("No such object.")
        return candidate

    # ---- interface ----
    def put(self, key: str, stream: BinaryIO, *, content_type: str) -> StoredObject:
        checksum, size = sha256_of(stream)
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as fh:
            shutil.copyfileobj(stream, fh)
        return StoredObject(
            key=key, content_type=content_type, byte_size=size, checksum_sha256=checksum
        )

    def open(self, key: str) -> BinaryIO:
        path = self._path(key)
        if not path.is_file():
            raise NotFoundError("No such object.")
        return path.open("rb")

    def delete(self, key: str) -> None:
        path = self._path(key)
        path.unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def url_for(self, key: str, *, download_name: str | None = None) -> str:
        expires = int(time.time()) + self._ttl
        params = {"expires": str(expires), "sig": self.sign(key, expires)}
        if download_name:
            params["filename"] = download_name
        return f"{self._url_prefix}/files/{quote(key)}?{urlencode(params)}"

    def health(self) -> None:
        probe = self._root / ".healthcheck"
        probe.write_bytes(b"ok")
        probe.unlink(missing_ok=True)

    # ---- signing ----
    def sign(self, key: str, expires: int) -> str:
        msg = f"{key}:{expires}".encode()
        return hmac.new(self._secret, msg, sha256).hexdigest()

    def verify(self, key: str, expires: int, signature: str) -> bool:
        if expires < int(time.time()):
            return False
        # compare_digest, not ==, so signature checking is not timing-variable.
        return hmac.compare_digest(self.sign(key, expires), signature)
