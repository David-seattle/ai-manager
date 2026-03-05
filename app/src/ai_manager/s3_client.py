import re

from .models import S3Object


class TranscriptStore:
    def __init__(self, s3_client, bucket: str) -> None:
        self._s3 = s3_client
        self._bucket = bucket

    def list_sessions(self) -> list[S3Object]:
        objects: list[S3Object] = []
        paginator = self._s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self._bucket, Prefix="conversations/"):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith("/transcript.jsonl"):
                    objects.append(S3Object(key=obj["Key"], etag=obj["ETag"]))
        return objects

    def download_transcript(self, session_id: str) -> str:
        key = f"conversations/{session_id}/transcript.jsonl"
        resp = self._s3.get_object(Bucket=self._bucket, Key=key)
        return resp["Body"].read().decode("utf-8")

    def list_work_item_links(self, session_id: str) -> list[str]:
        prefix = f"conversations/{session_id}/workitems/"
        resp = self._s3.list_objects_v2(Bucket=self._bucket, Prefix=prefix)
        links: list[str] = []
        for obj in resp.get("Contents", []):
            name = obj["Key"].rsplit("/", 1)[-1]
            if name:
                links.append(name)
        return links

    @staticmethod
    def session_id_from_key(key: str) -> str:
        match = re.search(r"conversations/([^/]+)/", key)
        if match:
            return match.group(1)
        raise ValueError(f"Cannot extract session_id from key: {key}")
