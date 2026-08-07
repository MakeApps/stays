"""Security headers and rate limits.

The API returns JSON, not HTML, so most of these are belt-and-braces — but the
signed-file route *does* serve user-uploaded bytes, and that is exactly where a
missing ``X-Content-Type-Options`` turns an uploaded file into stored XSS.
"""

from __future__ import annotations

from flask import Flask, Response

# Applied to every response. A JSON API has no need for framing, sniffing or
# referrer leakage, and a restrictive CSP costs nothing here because nothing is
# rendered by this origin.
BASE_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}


def register_security_headers(app: Flask) -> None:
    is_production = app.config["SETTINGS"].is_production

    @app.after_request
    def _apply(response: Response) -> Response:
        for header, value in BASE_HEADERS.items():
            # The file route sets its own sandboxed CSP; do not override it.
            response.headers.setdefault(header, value)

        if is_production:
            # Only meaningful over TLS, and setting it in development would
            # pin localhost to HTTPS in the browser's HSTS store.
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )

        # Never let a browser or proxy cache an authenticated API response.
        if response.headers.get("Cache-Control") is None:
            response.headers["Cache-Control"] = "no-store"

        return response
