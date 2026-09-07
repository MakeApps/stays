"""Test fixtures.

Tests run against a **real MariaDB/MySQL database**, not SQLite. The schema
depends on engine-specific behaviour (BINARY(16) keys, BIGINT money, index
semantics, and in Phase 2 a composite-key uniqueness constraint that carries
the double-booking guarantee), so SQLite would prove the wrong thing.

Each test runs inside a transaction that is rolled back afterwards, so the
suite is order-independent and leaves no residue.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import OperationalError

from app import create_app
from app.common.current_org import scoped_to
from app.config import Settings, get_settings
from app.extensions import db, password_hasher
from app.models.base import Base
from app.models.organisation import Organisation, OrganisationMember
from app.models.user import Role, User

TEST_DB_SUFFIX = "_test"

ADMIN_EMAIL = "admin@localshouts.co.th"
ADMIN_PASSWORD = "TestPassword!2026"
ORGANISATION_NAME = "Test Organisation"


def _test_database_url() -> str:
    base = get_settings().DATABASE_URL
    url = make_url(base)
    name = (url.database or "localshouts_stays") + TEST_DB_SUFFIX
    return str(url.set(database=name))


def _server_url(url_str: str) -> str:
    # `.set(database=None)` is a no-op — URL.set ignores None. An empty string
    # is what actually clears the schema and connects to the server itself.
    return str(make_url(url_str).set(database=""))


@pytest.fixture(scope="session")
def database_url() -> str:
    url = _test_database_url()
    name = make_url(url).database
    try:
        server: Engine = create_engine(_server_url(url), isolation_level="AUTOCOMMIT")
        with server.connect() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{name}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
        server.dispose()
    except OperationalError as exc:
        # Only skip when there is genuinely no server — anything else (bad
        # credentials, missing privileges, broken DDL) must fail loudly rather
        # than quietly reporting a green suite that tested nothing.
        if _is_unreachable(exc):
            pytest.skip(f"No database server reachable at {_server_url(url)}: {exc}")
        raise
    return url


def _is_unreachable(exc: OperationalError) -> bool:
    # 2003 can't connect, 2002 socket, 2005 unknown host.
    code = exc.orig.args[0] if exc.orig and exc.orig.args else None
    return code in {2002, 2003, 2005}


@pytest.fixture(scope="session")
def app(database_url: str) -> Iterator[Flask]:
    os.environ["DATABASE_URL"] = database_url
    settings = Settings(
        ENV="testing",
        DEBUG=False,
        DATABASE_URL=database_url,
        SECRET_KEY="test-secret-key-that-is-long-enough-for-tests",
        JWT_SECRET="test-jwt-secret-that-is-long-enough-for-tests",
        RATELIMIT_STORAGE_URI="memory://",
        RATELIMIT_ENABLED=False,
        # Argon2 at production cost would make the suite crawl; these tests
        # exercise the auth *flow*, not the KDF's parameters.
        ARGON2_TIME_COST=1,
        ARGON2_MEMORY_KB=8,
        ARGON2_PARALLELISM=1,
    )
    application = create_app(settings)

    with application.app_context():
        Base.metadata.drop_all(db.engine)
        Base.metadata.create_all(db.engine)

    yield application

    with application.app_context():
        Base.metadata.drop_all(db.engine)


@pytest.fixture()
def session(app: Flask) -> Iterator[Any]:
    """Real committed writes, with the tables wiped after each test.

    Flask-SQLAlchemy scopes its session to the *app context*, and the test
    client pushes a fresh one per request — so a test-held transaction is
    invisible to the request under test and vice versa. Rather than fight that
    with nested savepoints, tests commit for real and the tables are truncated
    afterwards. Slower per test, but it exercises the same commit path
    production uses, including the FK and uniqueness behaviour.
    """
    with app.app_context():
        yield db.session

        db.session.rollback()
        db.session.remove()
        _truncate_all()


def _truncate_all() -> None:
    with db.engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(text(f"TRUNCATE TABLE `{table.name}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))


@pytest.fixture()
def organisation(session: Any) -> Organisation:
    """The tenant everything else in a test belongs to.

    Almost every fixture and assertion below is a question about one
    organisation, so it is created first and the rest hang off it.
    """
    org = Organisation(name=ORGANISATION_NAME, is_active=True)
    session.add(org)
    session.commit()
    return org


@pytest.fixture()
def admin(session: Any, organisation: Organisation) -> User:
    user = User(
        email=ADMIN_EMAIL,
        password_hash=password_hasher.hash(ADMIN_PASSWORD),
        full_name="Pim Suwannarat",
    )
    session.add(user)
    session.flush()
    session.add(
        OrganisationMember(
            organisation_id=organisation.id, user_id=user.id, role=Role.ADMIN
        )
    )
    session.commit()
    return user


@pytest.fixture()
def scoped(organisation: Organisation) -> Iterator[Organisation]:
    """Run a test's own writes inside the organisation, as a request would.

    Only needed when a test builds rows directly rather than through the API —
    the API sets the scope itself, from the token.
    """
    with scoped_to(organisation.id):
        yield organisation


@pytest.fixture()
def client(app: Flask, session: Any) -> FlaskClient:
    return app.test_client()


@pytest.fixture()
def auth_client(client: FlaskClient, admin: User) -> FlaskClient:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert response.status_code == 200, response.get_json()
    return client
