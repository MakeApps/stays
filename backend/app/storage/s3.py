"""S3-compatible storage backend (AWS S3, Cloudflare R2, MinIO, Backblaze B2).

Unverified until real credentials exist — the local backend is the default, and
this ships behind it. Flagged rather than quietly presented as tested.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, BinaryIO

from app.common.errors import NotFoundError
from app.storage.base import StorageBackend, StoredObject, sha256_of

if TYPE_CHECKING:  # pragma: no cover
    pass


class S3Storage(StorageBackend):
    def __init__(
        self,
        *,
        bucket: str,
        region: str,
        access_key: str,
        secret_key: str,
        endpoint_url: str | None = None,
        url_ttl: int = 900,
    ) -> None:
        import boto3
        from botocore.config import Config

        self._bucket = bucket
        self._ttl = url_ttl
        self._client: Any = boto3.client(
            "s3",
            region_name=region or None,
            aws_access_key_id=access_key or None,
            aws_secret_access_key=secret_key or None,
            endpoint_url=endpoint_url or None,
            # Path addressing keeps MinIO and R2 working; virtual-host style
            # requires DNS per bucket.
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def put(self, key: str, stream: BinaryIO, *, content_type: str) -> StoredObject:
        checksum, size = sha256_of(stream)
        self._client.upload_fileobj(
            stream,
            self._bucket,
            key,
            ExtraArgs={
                "ContentType": content_type,
                # Receipts are tax records — never world-readable.
                "ACL": "private",
                "Metadata": {"sha256": checksum},
            },
        )
        return StoredObject(
            key=key, content_type=content_type, byte_size=size, checksum_sha256=checksum
        )

    def open(self, key: str) -> BinaryIO:
        from botocore.exceptions import ClientError

        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
        except ClientError as exc:  # pragma: no cover - requires live S3
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                raise NotFoundError("No such object.") from exc
            raise
        body: BinaryIO = response["Body"]
        return body

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
        except ClientError:
            return False
        return True

    def url_for(self, key: str, *, download_name: str | None = None) -> str:
        params: dict[str, Any] = {"Bucket": self._bucket, "Key": key}
        if download_name:
            params["ResponseContentDisposition"] = f'attachment; filename="{download_name}"'
        url: str = self._client.generate_presigned_url(
            "get_object", Params=params, ExpiresIn=self._ttl
        )
        return url

    def health(self) -> None:
        self._client.head_bucket(Bucket=self._bucket)
