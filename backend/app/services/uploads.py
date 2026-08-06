"""Upload validation.

A browser-supplied Content-Type is a *claim*, not evidence. Everything here is
checked against the file's own magic bytes, because accepting
``image/jpeg`` on the client's word is how an HTML file with a ``.jpg``
extension ends up served back to users.

``filetype`` is used rather than ``python-magic`` because the latter needs a
native libmagic DLL that is awkward to install on Windows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO

import filetype

from app.common.errors import PayloadTooLargeError, UnsupportedMediaError

# Enough for any signature filetype inspects.
_SNIFF_BYTES = 8192


@dataclass(frozen=True, slots=True)
class VerifiedUpload:
    content_type: str
    byte_size: int
    width: int | None = None
    height: int | None = None


def _measure(stream: BinaryIO) -> int:
    start = stream.tell()
    stream.seek(0, 2)
    size = stream.tell() - start
    stream.seek(start)
    return size


def validate_upload(
    stream: BinaryIO,
    *,
    filename: str | None,
    declared_type: str | None,
    allowed: frozenset[str],
    max_bytes: int,
) -> VerifiedUpload:
    size = _measure(stream)
    if size == 0:
        raise UnsupportedMediaError("That file is empty.")
    if size > max_bytes:
        raise PayloadTooLargeError(
            f"Files must be under {max_bytes // (1024 * 1024)} MB.",
            details={"max_bytes": max_bytes, "actual_bytes": size},
        )

    start = stream.tell()
    head = stream.read(_SNIFF_BYTES)
    stream.seek(start)

    kind = filetype.guess(head)
    sniffed = kind.mime if kind else None

    if sniffed is None:
        raise UnsupportedMediaError(
            "That file type could not be recognised.",
            details={"declared": declared_type},
        )
    if sniffed not in allowed:
        raise UnsupportedMediaError(
            f"{sniffed} is not accepted here.",
            details={"allowed": sorted(allowed), "detected": sniffed},
        )

    width = height = None
    if sniffed.startswith("image/"):
        width, height = _image_dimensions(stream)

    return VerifiedUpload(content_type=sniffed, byte_size=size, width=width, height=height)


def _image_dimensions(stream: BinaryIO) -> tuple[int | None, int | None]:
    from PIL import Image, UnidentifiedImageError

    start = stream.tell()
    try:
        with Image.open(stream) as img:
            # verify() also rejects truncated or malformed images that merely
            # carry a valid header.
            size = img.size
            img.verify()
        return size
    except (UnidentifiedImageError, OSError, ValueError):
        raise UnsupportedMediaError("That image could not be read.") from None
    finally:
        stream.seek(start)
