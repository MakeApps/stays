"""Signed file delivery for the local-disk storage backend.

Development uses the same access model as production: a time-limited signed
URL rather than a static mount. Receipts and condo photos are not public just
because the dev server happens to be running.

With ``STORAGE_BACKEND=s3`` this route is unused — the backend presigns
directly against the bucket.
"""

from __future__ import annotations

import mimetypes
from typing import Any

from flask import Blueprint, Response, current_app, request, send_file

from app.auth.decorators import public
from app.common.errors import NotFoundError
from app.storage.local import LocalStorage

bp = Blueprint("files", __name__)


@bp.get("/files/<path:key>")
@public
def serve_file(key: str) -> Any:
    storage = current_app.extensions["storage"]
    if not isinstance(storage, LocalStorage):
        raise NotFoundError("Files are served directly from object storage.")

    try:
        expires = int(request.args.get("expires", "0"))
    except ValueError as exc:
        raise NotFoundError("That link is not valid.") from exc

    signature = request.args.get("sig", "")
    # The signature *is* the authorisation here — it encodes both the key and
    # the expiry, so a tampered path or a stale link fails.
    if not storage.verify(key, expires, signature):
        raise NotFoundError("That link has expired.")

    handle = storage.open(key)
    # Passed explicitly, and taken from the *key*, which the signature covers.
    # Without it send_file cannot detect a type from an open handle and raises,
    # which is why photos (no download_name) 500'd while receipts did not. It
    # must not come from `filename` either: that parameter is unsigned, so a
    # crafted link could relabel a stored image as text/html.
    mimetype = mimetypes.guess_type(key)[0] or "application/octet-stream"
    response: Response = send_file(
        handle,
        mimetype=mimetype,
        download_name=request.args.get("filename"),
        max_age=current_app.config["SETTINGS"].STORAGE_URL_TTL_SEC,
    )
    # Never let a stored file be interpreted as active content.
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return response
