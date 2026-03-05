import boto3
import pytest
from moto import mock_aws

from ai_manager.s3_client import TranscriptStore

BUCKET = "test-transcripts"


@pytest.fixture
def s3_store():
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        yield TranscriptStore(client, BUCKET), client


def test_list_sessions_empty_bucket(s3_store):
    store, _ = s3_store
    assert store.list_sessions() == []


def test_list_sessions_finds_transcripts(s3_store):
    store, client = s3_store
    for uid in ["aaa-111", "bbb-222", "ccc-333"]:
        client.put_object(
            Bucket=BUCKET,
            Key=f"conversations/{uid}/transcript.jsonl",
            Body=b"{}",
        )
    results = store.list_sessions()
    assert len(results) == 3
    keys = {obj.key for obj in results}
    assert "conversations/aaa-111/transcript.jsonl" in keys
    for obj in results:
        assert obj.etag


def test_list_sessions_ignores_non_transcript_files(s3_store):
    store, client = s3_store
    client.put_object(Bucket=BUCKET, Key="conversations/aaa/transcript.jsonl", Body=b"{}")
    client.put_object(Bucket=BUCKET, Key="conversations/aaa/other.txt", Body=b"nope")
    client.put_object(Bucket=BUCKET, Key="conversations/aaa/workitems/EN-123", Body=b"")
    results = store.list_sessions()
    assert len(results) == 1
    assert results[0].key.endswith("transcript.jsonl")


def test_session_id_from_key():
    assert TranscriptStore.session_id_from_key("conversations/abc-123/transcript.jsonl") == "abc-123"
    with pytest.raises(ValueError):
        TranscriptStore.session_id_from_key("bad-key")


def test_download_transcript(s3_store):
    store, client = s3_store
    content = '{"type":"user","message":{"content":"hello"}}\n'
    client.put_object(Bucket=BUCKET, Key="conversations/sess-1/transcript.jsonl", Body=content.encode())
    result = store.download_transcript("sess-1")
    assert result == content


def test_list_work_item_links(s3_store):
    store, client = s3_store
    client.put_object(Bucket=BUCKET, Key="conversations/sess-1/workitems/EN-1234", Body=b"")
    client.put_object(Bucket=BUCKET, Key="conversations/sess-1/workitems/aim-abc1", Body=b"")
    links = store.list_work_item_links("sess-1")
    assert sorted(links) == ["EN-1234", "aim-abc1"]


def test_list_work_item_links_no_links(s3_store):
    store, _ = s3_store
    links = store.list_work_item_links("nonexistent")
    assert links == []
