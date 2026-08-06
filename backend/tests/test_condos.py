"""Condo API."""

from __future__ import annotations

import io
from typing import Any

from flask.testing import FlaskClient

VALID = {
    "name": "Ashton Asoke 1204",
    "code": "A-1204",
    "bedrooms": 1,
    "bathrooms": 1,
    "size_sqm": 42,
    "night_rate": "1800",
    "month_rate": "32000",
    "cleaning_fee": "500",
    "security_deposit": "10000",
}


def create(client: FlaskClient, **overrides: Any) -> dict[str, Any]:
    r = client.post("/api/v1/condos", json={**VALID, **overrides})
    assert r.status_code == 201, r.get_json()
    return r.get_json()  # type: ignore[no-any-return]


class TestAuthorisation:
    def test_list_requires_auth(self, client: FlaskClient) -> None:
        assert client.get("/api/v1/condos").status_code == 401

    def test_create_requires_auth(self, client: FlaskClient) -> None:
        assert client.post("/api/v1/condos", json=VALID).status_code == 401


class TestCreate:
    def test_persists_every_field_the_prototype_dropped(
        self, auth_client: FlaskClient
    ) -> None:
        """The design's modal captured these four then discarded them on save."""
        body = create(
            auth_client,
            property_type="Townhouse",
            address="Sukhumvit 21, Watthana, Bangkok",
            description="High floor, BTS 4 minutes walk.",
        )
        assert body["property_type"] == "Townhouse"
        assert body["address"] == "Sukhumvit 21, Watthana, Bangkok"
        assert body["description"] == "High floor, BTS 4 minutes walk."

    def test_stores_size_sqm(self, auth_client: FlaskClient) -> None:
        # The prototype displayed m² but had no input and hardcoded 38.
        assert create(auth_client, size_sqm=42)["size_sqm"] == 42

    def test_code_is_normalised_to_upper_case(self, auth_client: FlaskClient) -> None:
        assert create(auth_client, code="a-1204")["code"] == "A-1204"

    def test_money_round_trips_through_satang(self, auth_client: FlaskClient) -> None:
        body = create(auth_client, night_rate="2450.50")
        assert body["night_rate"] == "2450.50"
        assert body["night_rate_label"] == "฿2,451"

    def test_labels_match_the_design(self, auth_client: FlaskClient) -> None:
        body = create(auth_client, night_rate="1800", month_rate="32000")
        assert body["night_rate_label"] == "฿1,800"
        assert body["month_rate_label"] == "฿32,000"

    def test_duplicate_code_is_refused(self, auth_client: FlaskClient) -> None:
        create(auth_client)
        r = auth_client.post("/api/v1/condos", json=VALID)
        assert r.status_code == 409
        body = r.get_json()
        assert body["error"]["code"] == "duplicate"
        assert "code" in body["error"]["details"]["fields"]

    def test_invalid_payload_reports_each_field(self, auth_client: FlaskClient) -> None:
        r = auth_client.post(
            "/api/v1/condos", json={"name": "", "code": "!!bad!!", "bedrooms": 99}
        )
        assert r.status_code == 422
        assert set(r.get_json()["error"]["details"]["fields"]) >= {"name", "code", "bedrooms"}

    def test_negative_money_is_refused(self, auth_client: FlaskClient) -> None:
        r = auth_client.post("/api/v1/condos", json={**VALID, "night_rate": "-100"})
        assert r.status_code == 422


class TestList:
    def test_returns_envelope_and_facets(self, auth_client: FlaskClient) -> None:
        create(auth_client, code="A-1")
        create(auth_client, code="A-2")
        body = auth_client.get("/api/v1/condos").get_json()
        assert body["meta"]["total"] == 2
        assert body["facets"]["status"]["all"] == 2

    def test_search_matches_name_and_code(self, auth_client: FlaskClient) -> None:
        create(auth_client, code="A-1", name="Ashton Asoke 1204")
        create(auth_client, code="R-1", name="Rhythm Ekkamai 1502")
        assert auth_client.get("/api/v1/condos?q=Rhythm").get_json()["meta"]["total"] == 1
        assert auth_client.get("/api/v1/condos?q=A-1").get_json()["meta"]["total"] == 1

    def test_sorting(self, auth_client: FlaskClient) -> None:
        create(auth_client, code="A-1", night_rate="1000")
        create(auth_client, code="A-2", night_rate="3000")
        body = auth_client.get("/api/v1/condos?sort=night_rate&order=desc").get_json()
        assert [i["code"] for i in body["items"]] == ["A-2", "A-1"]

    def test_sort_field_is_allowlisted(self, auth_client: FlaskClient) -> None:
        # A raw column name would be an injection vector and a way to force an
        # unindexed table scan.
        r = auth_client.get("/api/v1/condos?sort=password_hash")
        assert r.status_code == 422
        assert "allowed" in r.get_json()["error"]["details"]

    def test_pagination(self, auth_client: FlaskClient) -> None:
        for i in range(5):
            create(auth_client, code=f"A-{i}")
        body = auth_client.get("/api/v1/condos?per_page=2&page=2").get_json()
        assert len(body["items"]) == 2
        assert body["meta"]["page"] == 2
        assert body["meta"]["pages"] == 3
        assert body["meta"]["has_next"] and body["meta"]["has_prev"]

    def test_per_page_is_capped(self, auth_client: FlaskClient) -> None:
        assert auth_client.get("/api/v1/condos?per_page=5000").status_code == 422

    def test_maintenance_filter(self, auth_client: FlaskClient) -> None:
        create(auth_client, code="A-1")
        create(auth_client, code="A-2", is_maintenance=True)
        body = auth_client.get("/api/v1/condos?status=maintenance").get_json()
        assert body["meta"]["total"] == 1
        assert body["items"][0]["code"] == "A-2"


class TestUpdate:
    def test_partial_update_leaves_other_fields_alone(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        r = auth_client.patch(f"/api/v1/condos/{condo['id']}", json={"night_rate": "2000"})
        assert r.status_code == 200
        body = r.get_json()
        assert body["night_rate_label"] == "฿2,000"
        assert body["name"] == VALID["name"]
        assert body["size_sqm"] == 42

    def test_maintenance_flag_changes_derived_status(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        assert condo["status"] == "available"
        r = auth_client.patch(f"/api/v1/condos/{condo['id']}", json={"is_maintenance": True})
        assert r.get_json()["status"] == "maintenance"

    def test_cannot_take_another_condos_code(self, auth_client: FlaskClient) -> None:
        create(auth_client, code="A-1")
        other = create(auth_client, code="A-2")
        r = auth_client.patch(f"/api/v1/condos/{other['id']}", json={"code": "A-1"})
        assert r.status_code == 409

    def test_keeping_its_own_code_is_fine(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client, code="A-1")
        r = auth_client.patch(f"/api/v1/condos/{condo['id']}", json={"code": "A-1"})
        assert r.status_code == 200

    def test_missing_condo_is_404(self, auth_client: FlaskClient) -> None:
        missing = "00000000-0000-7000-8000-000000000000"
        assert auth_client.patch(f"/api/v1/condos/{missing}", json={}).status_code == 404


class TestDelete:
    def test_soft_deletes(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        assert auth_client.delete(f"/api/v1/condos/{condo['id']}").status_code == 204
        assert auth_client.get(f"/api/v1/condos/{condo['id']}").status_code == 404
        assert auth_client.get("/api/v1/condos").get_json()["meta"]["total"] == 0

    def test_code_is_reusable_afterwards(self, auth_client: FlaskClient) -> None:
        """Why uniqueness lives in the service rather than a UNIQUE index.

        MySQL has no partial index, so a hard constraint would make a code
        permanently unusable once a unit is soft-deleted.
        """
        condo = create(auth_client, code="A-1204")
        auth_client.delete(f"/api/v1/condos/{condo['id']}")
        r = auth_client.post("/api/v1/condos", json={**VALID, "code": "A-1204"})
        assert r.status_code == 201


class TestImages:
    @staticmethod
    def _png() -> bytes:
        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (24, 16), (124, 58, 237)).save(buffer, format="PNG")
        return buffer.getvalue()

    def test_upload_returns_the_condo_with_a_cover(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        r = auth_client.post(
            f"/api/v1/condos/{condo['id']}/images",
            data={"file": (io.BytesIO(self._png()), "cover.png")},
            content_type="multipart/form-data",
        )
        assert r.status_code == 201, r.get_json()
        body = r.get_json()["condo"]
        assert len(body["images"]) == 1
        assert body["cover_url"] == body["images"][0]["url"]
        assert body["images"][0]["width"] == 24
        assert body["images"][0]["height"] == 16

    def test_rejects_a_non_image_regardless_of_extension(
        self, auth_client: FlaskClient
    ) -> None:
        """Content-Type is a claim; magic bytes are evidence."""
        condo = create(auth_client)
        r = auth_client.post(
            f"/api/v1/condos/{condo['id']}/images",
            data={"file": (io.BytesIO(b"<html>not an image</html>"), "evil.png")},
            content_type="multipart/form-data",
        )
        assert r.status_code == 415
        assert r.get_json()["error"]["code"] == "unsupported_media_type"

    def test_rejects_an_empty_file(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        r = auth_client.post(
            f"/api/v1/condos/{condo['id']}/images",
            data={"file": (io.BytesIO(b""), "empty.png")},
            content_type="multipart/form-data",
        )
        assert r.status_code == 415

    def test_missing_file_field_is_a_validation_error(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        r = auth_client.post(
            f"/api/v1/condos/{condo['id']}/images",
            data={},
            content_type="multipart/form-data",
        )
        assert r.status_code == 422

    def test_delete_removes_the_image(self, auth_client: FlaskClient) -> None:
        condo = create(auth_client)
        upload = auth_client.post(
            f"/api/v1/condos/{condo['id']}/images",
            data={"file": (io.BytesIO(self._png()), "cover.png")},
            content_type="multipart/form-data",
        )
        image_id = upload.get_json()["image_id"]
        assert (
            auth_client.delete(f"/api/v1/condos/{condo['id']}/images/{image_id}").status_code
            == 204
        )
        assert auth_client.get(f"/api/v1/condos/{condo['id']}").get_json()["images"] == []


class TestActivityLog:
    def test_records_creation(self, auth_client: FlaskClient, session: Any) -> None:
        from sqlalchemy import select

        from app.models.activity_log import ActivityAction, ActivityEntity, ActivityLog

        create(auth_client)
        entries = list(
            session.scalars(
                select(ActivityLog).where(ActivityLog.entity_type == ActivityEntity.CONDO)
            )
        )
        assert any(e.action is ActivityAction.CREATED for e in entries)
        assert entries[0].actor_id is not None
        assert entries[0].request_id is not None
