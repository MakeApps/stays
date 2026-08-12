"""User accounts.

Two things are worth pinning here. First, that a created account can actually
do the job — everything except administering other accounts — because the UI
never shows a role and a silently wrong default would only surface as a
mystery 403 weeks later. Second, that an admin cannot remove their own way
back in: every other mistake on this screen is fixable by editing a row.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask.testing import FlaskClient

from app.auth.permissions import ALL_CAPABILITIES, capabilities_for
from app.models.user import Role
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

NEW_USER: dict[str, Any] = {
    "full_name": "Nok Chaiyaphum",
    "email": "nok@localshouts.co.th",
    "password": "correct-horse-battery",
}


def create(client: FlaskClient, **overrides: Any) -> dict[str, Any]:
    response = client.post("/api/v1/users", json={**NEW_USER, **overrides})
    assert response.status_code == 201, response.get_json()
    body: dict[str, Any] = response.get_json()
    return body


class TestWhatANewAccountCanDo:
    def test_a_manager_has_everything_except_accounts_and_the_audit_trail(self) -> None:
        """The product decision, expressed as a set difference.

        Nobody hits a permission wall doing the job. What stays with the admin
        is the power that can lock the owner out of their own system, and the
        feed showing what every other employee did.
        """
        granted = capabilities_for(Role.MANAGER)
        assert ALL_CAPABILITIES - granted == {"user:read", "user:write", "activity:read"}

    def test_a_new_account_can_sign_in_and_work(self, auth_client: FlaskClient) -> None:
        created = create(auth_client)
        assert created["is_admin"] is False
        assert created["is_active"] is True

        fresh = auth_client.application.test_client()
        login = fresh.post(
            "/api/v1/auth/login",
            json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
        )
        assert login.status_code == 200, login.get_json()

        # The work itself: create a condo, and delete it again.
        condo = fresh.post(
            "/api/v1/condos", json={"name": "Nok's Unit", "code": "NOK-1"}
        )
        assert condo.status_code == 201, condo.get_json()
        assert fresh.delete(f"/api/v1/condos/{condo.get_json()['id']}").status_code == 204

    def test_a_new_account_cannot_reach_the_users_screen(
        self, auth_client: FlaskClient
    ) -> None:
        create(auth_client)
        fresh = auth_client.application.test_client()
        fresh.post(
            "/api/v1/auth/login",
            json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
        )

        assert fresh.get("/api/v1/users").status_code == 403
        assert fresh.post("/api/v1/users", json=NEW_USER).status_code == 403

    def test_a_new_account_is_not_sent_the_activity_feed(
        self, auth_client: FlaskClient
    ) -> None:
        """Withheld from the payload, not merely hidden on the dashboard.

        /dashboard needs only dashboard:read, so a manager reaches it — and it
        embeds the audit trail. Hiding the card in React would still have put
        every other account's actions one network tab away.
        """
        create(auth_client)
        fresh = auth_client.application.test_client()
        fresh.post(
            "/api/v1/auth/login",
            json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
        )

        assert fresh.get("/api/v1/dashboard/activity").status_code == 403

        board = fresh.get("/api/v1/dashboard")
        assert board.status_code == 200, board.get_json()
        assert "activity" not in board.get_json()

    def test_the_admin_still_gets_the_activity_feed(
        self, auth_client: FlaskClient
    ) -> None:
        board = auth_client.get("/api/v1/dashboard")
        assert board.status_code == 200
        assert isinstance(board.get_json()["activity"], list)
        assert auth_client.get("/api/v1/dashboard/activity").status_code == 200


class TestCreating:
    def test_the_new_account_appears_in_the_list(self, auth_client: FlaskClient) -> None:
        create(auth_client)
        body = auth_client.get("/api/v1/users").get_json()
        assert {u["email"] for u in body["items"]} == {ADMIN_EMAIL, NEW_USER["email"]}

    def test_the_address_is_stored_lowercased(self, auth_client: FlaskClient) -> None:
        """So `Nok@…` cannot become a second account for the same person."""
        created = create(auth_client, email="NOK@LocalShouts.co.th")
        assert created["email"] == "nok@localshouts.co.th"

        again = auth_client.post(
            "/api/v1/users", json={**NEW_USER, "email": "nok@LOCALSHOUTS.co.th"}
        )
        assert again.status_code == 409

    def test_a_duplicate_address_is_refused_on_the_field(
        self, auth_client: FlaskClient
    ) -> None:
        create(auth_client)
        response = auth_client.post("/api/v1/users", json=NEW_USER)
        assert response.status_code == 409
        assert "email" in response.get_json()["error"]["details"]["fields"]

    @pytest.mark.parametrize("password", ["", "short", "1234567"])
    def test_a_weak_password_is_refused(
        self, auth_client: FlaskClient, password: str
    ) -> None:
        response = auth_client.post("/api/v1/users", json={**NEW_USER, "password": password})
        assert response.status_code == 422

    def test_the_password_never_comes_back(self, auth_client: FlaskClient) -> None:
        created = create(auth_client)
        assert "password" not in created
        assert "password_hash" not in created


class TestEditing:
    def test_renaming_and_re_addressing(self, auth_client: FlaskClient) -> None:
        user = create(auth_client)
        response = auth_client.patch(
            f"/api/v1/users/{user['id']}",
            json={"full_name": "Nok C.", "email": "nok.c@localshouts.co.th"},
        )
        assert response.status_code == 200
        assert response.get_json()["full_name"] == "Nok C."
        assert response.get_json()["email"] == "nok.c@localshouts.co.th"

    def test_resetting_a_password_ends_that_user_sessions(
        self, auth_client: FlaskClient
    ) -> None:
        """A reset that leaves the old sessions alive is not a reset.

        It is the only lever an admin has over a device they cannot reach.
        """
        user = create(auth_client)
        theirs = auth_client.application.test_client()
        theirs.post(
            "/api/v1/auth/login",
            json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
        )
        assert theirs.post("/api/v1/auth/refresh").status_code == 200

        auth_client.patch(f"/api/v1/users/{user['id']}", json={"password": "a-brand-new-one"})

        assert theirs.post("/api/v1/auth/refresh").status_code == 401

    def test_suspending_blocks_sign_in(self, auth_client: FlaskClient) -> None:
        user = create(auth_client)
        auth_client.patch(f"/api/v1/users/{user['id']}", json={"is_active": False})

        fresh = auth_client.application.test_client()
        response = fresh.post(
            "/api/v1/auth/login",
            json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
        )
        assert response.status_code == 401

    def test_taking_someone_else_address_is_refused(
        self, auth_client: FlaskClient
    ) -> None:
        user = create(auth_client)
        response = auth_client.patch(
            f"/api/v1/users/{user['id']}", json={"email": ADMIN_EMAIL}
        )
        assert response.status_code == 409


class TestTheLockoutGuards:
    """An admin must not be able to remove their own way back in."""

    def _admin_id(self, client: FlaskClient) -> str:
        body = client.get("/api/v1/users").get_json()
        return next(u["id"] for u in body["items"] if u["email"] == ADMIN_EMAIL)

    def test_you_cannot_delete_yourself(self, auth_client: FlaskClient) -> None:
        response = auth_client.delete(f"/api/v1/users/{self._admin_id(auth_client)}")
        assert response.status_code == 422
        assert "your own account" in response.get_json()["error"]["message"]

    def test_you_cannot_suspend_yourself(self, auth_client: FlaskClient) -> None:
        response = auth_client.patch(
            f"/api/v1/users/{self._admin_id(auth_client)}", json={"is_active": False}
        )
        assert response.status_code == 422

    def test_the_admin_can_still_sign_in_after_a_refused_delete(
        self, auth_client: FlaskClient
    ) -> None:
        """The guard must refuse *before* writing, not half-way through."""
        auth_client.delete(f"/api/v1/users/{self._admin_id(auth_client)}")

        fresh = auth_client.application.test_client()
        response = fresh.post(
            "/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200


class TestRemoving:
    def test_a_removed_user_disappears_and_cannot_sign_in(
        self, auth_client: FlaskClient
    ) -> None:
        user = create(auth_client)
        assert auth_client.delete(f"/api/v1/users/{user['id']}").status_code == 204

        assert [u["email"] for u in auth_client.get("/api/v1/users").get_json()["items"]] == [
            ADMIN_EMAIL
        ]
        fresh = auth_client.application.test_client()
        assert (
            fresh.post(
                "/api/v1/auth/login",
                json={"email": NEW_USER["email"], "password": NEW_USER["password"]},
            ).status_code
            == 401
        )

    def test_the_address_is_reusable_after_removal(self, auth_client: FlaskClient) -> None:
        """Uniqueness is among live rows, so removing someone does not burn
        their address forever — which matters on a team of a dozen people."""
        user = create(auth_client)
        auth_client.delete(f"/api/v1/users/{user['id']}")
        assert auth_client.post("/api/v1/users", json=NEW_USER).status_code == 201

    def test_removal_is_in_the_activity_log(self, auth_client: FlaskClient) -> None:
        user = create(auth_client)
        auth_client.delete(f"/api/v1/users/{user['id']}")

        feed = auth_client.get("/api/v1/dashboard/activity").get_json()["items"]
        titles = [e["title"] for e in feed]
        assert "User added" in titles
        assert "User removed" in titles or "User deleted" in titles
