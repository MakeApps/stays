"""Signed file delivery.

The condo tests assert that `cover_url` is *produced*. Nothing asserted it
could be *fetched*, so every photo 500'd in the browser while the suite stayed
green — send_file cannot detect a MIME type from an open handle, and photos,
unlike receipts, carry no download_name. These tests follow the URL.
"""

from __future__ import annotations

import io
import time
from typing import Any
from urllib.parse import parse_qs, urlparse

from flask import Flask
from flask.testing import FlaskClient

from tests.test_condos import VALID


def _png() -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (24, 16), (124, 58, 237)).save(buffer, format="PNG")
    return buffer.getvalue()


def _condo_with_photo(auth_client: FlaskClient) -> dict[str, Any]:
    condo = auth_client.post("/api/v1/condos", json=VALID).get_json()
    upload = auth_client.post(
        f"/api/v1/condos/{condo['id']}/images",
        data={"file": (io.BytesIO(_png()), "cover.png")},
        content_type="multipart/form-data",
    )
    assert upload.status_code == 201, upload.get_json()
    return upload.get_json()["condo"]


def _parts(url: str) -> tuple[str, dict[str, list[str]]]:
    parsed = urlparse(url)
    return parsed.path, parse_qs(parsed.query)


class TestServingAPhoto:
    def test_the_cover_url_actually_serves_the_image(self, auth_client: FlaskClient) -> None:
        condo = _condo_with_photo(auth_client)

        response = auth_client.get(condo["cover_url"])

        assert response.status_code == 200, response.get_data(as_text=True)[:300]
        assert response.mimetype == "image/png"
        assert response.get_data() == _png()

    def test_the_response_cannot_be_treated_as_active_content(
        self, auth_client: FlaskClient
    ) -> None:
        condo = _condo_with_photo(auth_client)
        response = auth_client.get(condo["cover_url"])

        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert "default-src 'none'" in response.headers["Content-Security-Policy"]

    def test_a_photo_needs_no_session(self, client: FlaskClient, auth_client: FlaskClient) -> None:
        """The signature is the authorisation, so <img> works without cookies.

        This is also what lets Next's image optimiser fetch it server-side.
        """
        condo = _condo_with_photo(auth_client)
        assert client.get(condo["cover_url"]).status_code == 200


class TestTheSignature:
    def test_a_tampered_signature_is_rejected(self, auth_client: FlaskClient) -> None:
        condo = _condo_with_photo(auth_client)
        path, query = _parts(condo["cover_url"])

        response = auth_client.get(f"{path}?expires={query['expires'][0]}&sig={'0' * 64}")

        assert response.status_code == 404

    def test_an_expired_link_is_rejected(self, app: Flask, auth_client: FlaskClient) -> None:
        condo = _condo_with_photo(auth_client)
        path, _ = _parts(condo["cover_url"])

        storage = app.extensions["storage"]
        key = path.split("/files/", 1)[1]
        stale = int(time.time()) - 1
        response = auth_client.get(
            f"{path}?expires={stale}&sig={storage.sign(key, stale)}"
        )

        # Correctly signed, and still refused: the expiry is inside the message.
        assert response.status_code == 404

    def test_a_signature_does_not_transfer_to_another_key(
        self, app: Flask, auth_client: FlaskClient
    ) -> None:
        condo = _condo_with_photo(auth_client)
        _, query = _parts(condo["cover_url"])
        expires, sig = query["expires"][0], query["sig"][0]

        response = auth_client.get(f"/api/v1/files/../../.env?expires={expires}&sig={sig}")

        assert response.status_code in (400, 404)

    def test_the_filename_parameter_cannot_relabel_the_content_type(
        self, auth_client: FlaskClient
    ) -> None:
        """`filename` is outside the signature, so it must not pick the MIME.

        Serving stored bytes as text/html on an attacker's say-so is how a
        signed-URL host becomes an XSS host.
        """
        condo = _condo_with_photo(auth_client)
        path, query = _parts(condo["cover_url"])

        response = auth_client.get(
            f"{path}?expires={query['expires'][0]}&sig={query['sig'][0]}&filename=evil.html"
        )

        assert response.status_code == 200
        assert response.mimetype == "image/png"
