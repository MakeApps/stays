"""The tenant boundary.

The assertions that matter here are the ones about *absence*: that one
organisation's condos, money and people cannot be seen, counted or totalled
from inside another. A leak here is not a wrong number on a screen, it is one
customer reading another customer's books, so these are written against the
API rather than the service layer — the whole stack, the way it will actually
be called.
"""

from __future__ import annotations

from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app.auth.permissions import capabilities_for
from app.common.current_org import scoped_to
from app.extensions import db, password_hasher
from app.models.organisation import Organisation, OrganisationMember
from app.models.user import Role, User
from app.seeds.lookups import seed_lookups
from tests.conftest import ADMIN_EMAIL

OTHER_EMAIL = "owner@other.co.th"
OTHER_PASSWORD = "OtherPassword!2026"


@pytest.fixture()
def other_org(session: Any) -> Organisation:
    """A second tenant, with its own admin who is a stranger to the first."""
    org = Organisation(name="Other Portfolio", is_active=True)
    session.add(org)
    session.flush()

    user = User(
        email=OTHER_EMAIL,
        password_hash=password_hasher.hash(OTHER_PASSWORD),
        full_name="Somchai Other",
    )
    session.add(user)
    session.flush()
    session.add(
        OrganisationMember(organisation_id=org.id, user_id=user.id, role=Role.ADMIN)
    )
    session.commit()
    return org


def sign_in(app: Flask, email: str, password: str) -> FlaskClient:
    client = app.test_client()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.get_json()
    return client


def make_condo(client: FlaskClient, code: str, name: str = "Unit") -> dict[str, Any]:
    response = client.post("/api/v1/condos", json={"name": name, "code": code})
    assert response.status_code == 201, response.get_json()
    body: dict[str, Any] = response.get_json()
    return body


class TestIsolation:
    def test_condos_do_not_cross_the_boundary(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        make_condo(auth_client, "MINE-1")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)
        make_condo(theirs, "THEIRS-1")

        mine_codes = {c["code"] for c in auth_client.get("/api/v1/condos").get_json()["items"]}
        their_codes = {c["code"] for c in theirs.get("/api/v1/condos").get_json()["items"]}

        assert mine_codes == {"MINE-1"}
        assert their_codes == {"THEIRS-1"}

    def test_a_condo_cannot_be_fetched_by_id_from_outside(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        """404, not 403.

        Confirming that an id exists but is not yours is itself a disclosure —
        it turns the endpoint into an oracle for how many condos a competitor
        runs. From outside, the row simply is not there.
        """
        mine = make_condo(auth_client, "MINE-1")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

        assert theirs.get(f"/api/v1/condos/{mine['id']}").status_code == 404
        hijack = theirs.patch(f"/api/v1/condos/{mine['id']}", json={"name": "Hijacked"})
        assert hijack.status_code == 404
        assert theirs.delete(f"/api/v1/condos/{mine['id']}").status_code == 404

    def test_the_same_code_is_free_in_each_organisation(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        """Uniqueness is per tenant, or the first customer to use "A-101"
        would take it away from everyone else."""
        make_condo(auth_client, "A-101")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

        response = theirs.post("/api/v1/condos", json={"name": "Theirs", "code": "A-101"})
        assert response.status_code == 201, response.get_json()

    def test_the_dashboard_counts_only_its_own(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        make_condo(auth_client, "MINE-1")
        make_condo(auth_client, "MINE-2")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)
        make_condo(theirs, "THEIRS-1")

        assert auth_client.get("/api/v1/dashboard").get_json()["kpis"]["total_condos"] == 2
        assert theirs.get("/api/v1/dashboard").get_json()["kpis"]["total_condos"] == 1

    def test_search_does_not_reach_across(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        make_condo(auth_client, "SECRET-1", name="Very Secret Unit")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

        body = theirs.get("/api/v1/dashboard/search?q=Secret").get_json()
        hits = body.get("items", body.get("results", []))
        assert hits == [], hits

    def test_the_activity_feed_is_per_organisation(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        make_condo(auth_client, "MINE-1", name="Mine Only")
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

        feed = theirs.get("/api/v1/dashboard/activity").get_json()["items"]
        assert all("Mine Only" not in str(entry) for entry in feed), feed

    def test_lookups_are_seeded_per_organisation(
        self, app: Flask, auth_client: FlaskClient, organisation: Organisation
    ) -> None:
        """A new organisation can file an expense on its first day.

        The first organisation is seeded too, deliberately. Both get a category
        called "Electricity", and a global UNIQUE(name) on the lookup tables --
        which is what the schema had before organisations -- makes the second
        one fail outright. Seeding only the new one hides that entirely.
        """
        seed_lookups(organisation.id)

        created = auth_client.post("/api/v1/organisations", json={"name": "Fresh Books"})
        assert created.status_code == 201, created.get_json()

        moved = auth_client.post(
            "/api/v1/auth/organisation", json={"organisation_id": created.get_json()["id"]}
        )
        assert moved.status_code == 200, moved.get_json()

        categories = auth_client.get("/api/v1/expenses/categories").get_json()
        items = categories.get("items", categories)
        assert len(items) > 0


class TestSwitching:
    def test_a_member_can_move_between_their_organisations(
        self, app: Flask, auth_client: FlaskClient, session: Any, organisation: Organisation
    ) -> None:
        second = Organisation(name="Second Portfolio", is_active=True)
        session.add(second)
        session.flush()
        admin = session.scalars(
            db.select(User).where(User.email == ADMIN_EMAIL)
        ).one()
        session.add(
            OrganisationMember(
                organisation_id=second.id, user_id=admin.id, role=Role.MANAGER
            )
        )
        session.commit()

        listed = auth_client.get("/api/v1/auth/organisations").get_json()
        assert {o["name"] for o in listed["items"]} == {organisation.name, "Second Portfolio"}
        assert listed["current_id"] == str(organisation.id)

        moved = auth_client.post(
            "/api/v1/auth/organisation", json={"organisation_id": str(second.id)}
        )
        assert moved.status_code == 200
        body = moved.get_json()
        assert body["user"]["organisation"]["name"] == "Second Portfolio"
        # Role is per organisation: admin over there is a manager here.
        assert body["user"]["role"] == Role.MANAGER.value
        assert set(body["user"]["capabilities"]) == set(capabilities_for(Role.MANAGER))

        assert auth_client.get("/api/v1/auth/me").get_json()["user"]["organisation"][
            "name"
        ] == "Second Portfolio"

    def test_switching_somewhere_you_do_not_belong_is_refused(
        self, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        response = auth_client.post(
            "/api/v1/auth/organisation", json={"organisation_id": str(other_org.id)}
        )
        assert response.status_code == 401

    def test_a_revoked_membership_ends_the_session_immediately(
        self, app: Flask, auth_client: FlaskClient, session: Any, organisation: Organisation
    ) -> None:
        """Not when the access token expires -- now.

        The membership is re-read on every request precisely so that eviction
        does not leave a fifteen-minute window inside the tenant.
        """
        assert auth_client.get("/api/v1/condos").status_code == 200

        member = session.scalars(
            db.select(OrganisationMember).where(
                OrganisationMember.organisation_id == organisation.id
            )
        ).one()
        member.soft_delete()
        session.commit()

        assert auth_client.get("/api/v1/condos").status_code == 401


class TestCreating:
    def test_an_admin_can_create_one_and_is_its_admin(
        self, auth_client: FlaskClient
    ) -> None:
        response = auth_client.post("/api/v1/organisations", json={"name": "New Portfolio"})
        assert response.status_code == 201, response.get_json()
        assert response.get_json()["role"] == Role.ADMIN.value

        listed = auth_client.get("/api/v1/auth/organisations").get_json()["items"]
        assert "New Portfolio" in {o["name"] for o in listed}

    def test_the_session_does_not_move_on_its_own(
        self, auth_client: FlaskClient, organisation: Organisation
    ) -> None:
        auth_client.post("/api/v1/organisations", json={"name": "New Portfolio"})
        current = auth_client.get("/api/v1/auth/me").get_json()["user"]["organisation"]
        assert current["name"] == organisation.name

    def test_a_new_organisation_starts_empty(self, auth_client: FlaskClient) -> None:
        make_condo(auth_client, "OLD-1")
        created = auth_client.post(
            "/api/v1/organisations", json={"name": "Empty Portfolio"}
        ).get_json()
        auth_client.post(
            "/api/v1/auth/organisation", json={"organisation_id": created["id"]}
        )

        assert auth_client.get("/api/v1/condos").get_json()["items"] == []

    def test_a_manager_cannot_create_one(
        self, app: Flask, auth_client: FlaskClient
    ) -> None:
        auth_client.post(
            "/api/v1/users",
            json={
                "full_name": "Nok Chaiyaphum",
                "email": "nok@localshouts.co.th",
                "password": "correct-horse-battery",
            },
        )
        theirs = sign_in(app, "nok@localshouts.co.th", "correct-horse-battery")
        response = theirs.post("/api/v1/organisations", json={"name": "Mine Now"})
        assert response.status_code == 403

    @pytest.mark.parametrize("name", ["", " ", "x"])
    def test_a_nameless_organisation_is_refused(
        self, auth_client: FlaskClient, name: str
    ) -> None:
        assert auth_client.post("/api/v1/organisations", json={"name": name}).status_code == 422


class TestPeople:
    def test_the_team_list_is_per_organisation(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        theirs = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

        mine = {u["email"] for u in auth_client.get("/api/v1/users").get_json()["items"]}
        thirs = {u["email"] for u in theirs.get("/api/v1/users").get_json()["items"]}

        assert mine == {ADMIN_EMAIL}
        assert thirs == {OTHER_EMAIL}

    def test_an_existing_account_is_invited_rather_than_rejected(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        """The same person legitimately works for two organisations.

        Their password is untouched by this -- inviting somebody must not be a
        way to overwrite the credentials of an account you do not control.
        """
        response = auth_client.post(
            "/api/v1/users",
            json={
                "full_name": "Ignored Here",
                "email": OTHER_EMAIL,
                "password": "not-their-password",
            },
        )
        assert response.status_code == 201, response.get_json()

        emails = {u["email"] for u in auth_client.get("/api/v1/users").get_json()["items"]}
        assert emails == {ADMIN_EMAIL, OTHER_EMAIL}

        # Still signs in with the password they already had.
        sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)

    def test_adding_someone_twice_is_refused_on_the_field(
        self, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        payload = {
            "full_name": "Somchai",
            "email": OTHER_EMAIL,
            "password": "irrelevant-here",
        }
        assert auth_client.post("/api/v1/users", json=payload).status_code == 201
        again = auth_client.post("/api/v1/users", json=payload)
        assert again.status_code == 409
        assert "email" in again.get_json()["error"]["details"]["fields"]

    def test_removing_someone_revokes_membership_not_the_account(
        self, app: Flask, auth_client: FlaskClient, other_org: Organisation
    ) -> None:
        """They may work for somebody else entirely.

        Deleting the account here would sign them out of an organisation this
        admin has no authority over.
        """
        auth_client.post(
            "/api/v1/users",
            json={"full_name": "Somchai", "email": OTHER_EMAIL, "password": "irrelevant"},
        )
        listed = auth_client.get("/api/v1/users").get_json()["items"]
        theirs_id = next(u["id"] for u in listed if u["email"] == OTHER_EMAIL)

        assert auth_client.delete(f"/api/v1/users/{theirs_id}").status_code == 204
        remaining = {u["email"] for u in auth_client.get("/api/v1/users").get_json()["items"]}
        assert remaining == {ADMIN_EMAIL}

        # Still signs in, and lands in their own organisation.
        client = sign_in(app, OTHER_EMAIL, OTHER_PASSWORD)
        assert client.get("/api/v1/auth/me").get_json()["user"]["organisation"][
            "name"
        ] == other_org.name

    def test_the_last_admin_of_this_organisation_is_protected(
        self, auth_client: FlaskClient, session: Any, organisation: Organisation
    ) -> None:
        admin = session.scalars(db.select(User).where(User.email == ADMIN_EMAIL)).one()
        response = auth_client.delete(f"/api/v1/users/{admin.id}")
        assert response.status_code == 422


class TestWritesLandInTheRightPlace:
    def test_a_row_written_with_no_organisation_in_scope_is_refused(
        self, session: Any
    ) -> None:
        """The loud half of the design.

        Rows are stamped with the acting organisation on insert. Without one
        there is no honest answer, and defaulting would silently put a
        customer's data somewhere it does not belong.
        """
        from app.models.condo import Condo

        with pytest.raises(RuntimeError, match="outside any organisation"), scoped_to(None):
            session.add(Condo(code="NOWHERE-1", name="Nowhere"))
            session.flush()
        session.rollback()
