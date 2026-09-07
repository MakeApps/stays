"""Token minting and verification.

Access tokens are short-lived JWTs carrying identity, the organisation being
acted in, and the role held *there*. Refresh tokens
are **opaque random strings**, not JWTs: they are stored server-side (hashed)
so they can be revoked, rotated and reuse-detected. A self-contained refresh
JWT cannot be revoked before it expires, which defeats the point.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.common.errors import AuthenticationError, TokenExpiredError
from app.models.user import Role

ACCESS_TYPE = "access"


@dataclass(frozen=True, slots=True)
class AccessClaims:
    user_id: uuid.UUID
    #: The organisation this session is acting in. Switching organisations
    #: mints a new token rather than mutating anything server-side, so a stolen
    #: token can never be pointed at a different tenant.
    organisation_id: uuid.UUID
    #: Held in that organisation, not globally.
    role: Role
    expires_at: datetime
    jti: str


def mint_access_token(
    *,
    user_id: uuid.UUID,
    organisation_id: uuid.UUID,
    role: Role,
    secret: str,
    algorithm: str,
    ttl_minutes: int,
) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=ttl_minutes)
    payload = {
        "sub": str(user_id),
        "org": str(organisation_id),
        "role": role.value,
        "typ": ACCESS_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, secret, algorithm=algorithm), expires


def decode_access_token(token: str, *, secret: str, algorithm: str) -> AccessClaims:
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[algorithm],
            options={"require": ["exp", "iat", "sub", "org"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError() from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("That session token is not valid.") from exc

    if payload.get("typ") != ACCESS_TYPE:
        # Refusing a refresh token here stops it being replayed as an access token.
        raise AuthenticationError("Wrong token type.")

    try:
        user_id = uuid.UUID(payload["sub"])
        organisation_id = uuid.UUID(payload["org"])
        role = Role(payload["role"])
    except (KeyError, ValueError) as exc:
        raise AuthenticationError("That session token is malformed.") from exc

    return AccessClaims(
        user_id=user_id,
        organisation_id=organisation_id,
        role=role,
        expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        jti=payload.get("jti", ""),
    )


def generate_refresh_token() -> tuple[str, str]:
    """Return ``(raw_token, sha256_hex)``.

    The raw value goes to the client once and is never persisted; only the
    hash is stored, so a database disclosure does not yield usable sessions.
    """
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    # A fast hash is correct here: the input is 48 bytes of CSPRNG output, so
    # there is no dictionary to attack and no reason to pay Argon2's cost.
    return hashlib.sha256(raw.encode()).hexdigest()
