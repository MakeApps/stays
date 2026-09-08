"""Reversible encryption for stored third-party credentials.

Distinct from :mod:`app.common.security`, and from the password and refresh-token
hashing in :mod:`app.auth.tokens`: those values are *verified*, never read back,
so a one-way hash is both sufficient and safer. The secrets here have to be
replayed — an Airbnb iCal URL carries a token in its query string that we must
present on every poll, and a partner OAuth refresh token will have to be sent
back to Airbnb — so they are encrypted rather than hashed.

Fernet rather than raw AES: it is authenticated (AES-128-CBC plus HMAC-SHA256),
so a tampered or truncated ciphertext fails loudly instead of decrypting to
rubbish, and its token format carries a version byte for later key rotation.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class CredentialUnreadableError(Exception):
    """Stored ciphertext did not decrypt under the current key.

    Almost always means CHANNEL_ENCRYPTION_KEY changed (or was never set, so
    the fallback moved with a regenerated SECRET_KEY). Callers turn this into
    "reconnect this channel" rather than a 500 — the row is intact, the key
    that wrote it is simply gone.
    """


def derive_fernet_key(material: str) -> bytes:
    """Urlsafe-base64 32-byte key from arbitrary secret material.

    Fernet demands exactly 32 bytes, base64-encoded. Configuration carries a
    key of any length, so it is hashed to size rather than making an operator
    produce that exact format by hand. A single SHA-256 with no stretching is
    deliberate: the input is expected to be a high-entropy generated value, not
    a human-chosen passphrase, and ``assert_production_safe`` enforces a floor
    of 32 characters.
    """
    return base64.urlsafe_b64encode(hashlib.sha256(material.encode("utf-8")).digest())


@lru_cache(maxsize=1)
def _cipher() -> Fernet:
    from app.config import get_settings

    settings = get_settings()
    return Fernet(derive_fernet_key(settings.CHANNEL_ENCRYPTION_KEY or settings.SECRET_KEY))


def reset_cipher() -> None:
    """Drop the cached key. Only tests, which rebuild settings between cases."""
    _cipher.cache_clear()


def encrypt(plaintext: str) -> str:
    return _cipher().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    try:
        return _cipher().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise CredentialUnreadableError(
            "Stored credential could not be decrypted with the current key."
        ) from exc


class SecretText(TypeDecorator[str]):
    """A string column held encrypted at rest.

    Ciphertext is non-deterministic — Fernet mixes in a random IV and a
    timestamp — so two encryptions of the same value differ. A column of this
    type therefore **cannot be filtered, joined or indexed on**. Anything that
    needs looking up keeps a separate hash column beside it; see
    ``ChannelListing.export_token_hash``.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        return encrypt(str(value))

    def process_result_value(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        return decrypt(str(value))


def new_token(nbytes: int = 32) -> str:
    """An unguessable URL-safe token, for feed URLs nobody authenticates to."""
    return secrets.token_urlsafe(nbytes)


def token_fingerprint(token: str) -> str:
    """SHA-256 hex, matching ``auth.tokens.hash_refresh_token``.

    Lets a bearer token be looked up without the database holding the token
    itself, so a stolen dump is not a stolen feed URL.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
