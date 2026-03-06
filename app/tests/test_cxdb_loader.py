import json
import logging
import pathlib
import sqlite3
from unittest.mock import patch

import requests

from ai_manager.cxdb_loader import (
    sync_to_cxdb,
    _ensure_metadata_table,
    _get_last_commit_sha,
    _set_last_commit_sha,
    _is_valid_commit,
)
from ai_manager.schema import create_tables, upsert_session, upsert_work_item, upsert_document
from ai_manager.models import Session, WorkItem, Document


def _make_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    create_tables(conn)
    return conn


class FakeCxdbClient:
    def __init__(self):
        self.contexts: dict[int, dict] = {}
        self.turns: dict[int, list[dict]] = {}
        self._next_ctx = 1
        self._next_turn = 1

    def create_context(self, base_turn_id=0, tag=""):
        from ai_manager.cxdb_client import CxdbContext
        ctx_id = self._next_ctx
        self._next_ctx += 1
        self.contexts[ctx_id] = {"tag": tag, "head_turn_id": 0, "head_depth": 0}
        self.turns[ctx_id] = []
        return CxdbContext(context_id=ctx_id, head_turn_id=0, head_depth=0)

    def append_turn(self, context_id, type_id, data, type_version=1):
        turn_id = self._next_turn
        self._next_turn += 1
        self.turns[context_id].append({
            "turn_id": turn_id,
            "type_id": type_id,
            "data": data,
        })
        return turn_id

    def list_contexts(self, tag="", limit=100):
        from ai_manager.cxdb_client import CxdbContext
        return [
            CxdbContext(context_id=cid, head_turn_id=0, head_depth=0)
            for cid, meta in self.contexts.items()
            if not tag or meta["tag"] == tag
        ]


def test_sync_creates_context_per_session():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Did some work",
            first_message_at="2026-01-01T00:00:00Z",
            last_message_at="2026-01-01T01:00:00Z",
            message_count=5,
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    assert len(cxdb.contexts) == 1
    assert cxdb.contexts[1]["tag"] == "aim-abc1"


def test_sync_creates_context_per_work_item():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-2", etag="e2", summary="Two items",
            work_item_ids=["aim-abc1", "EN-1234"],
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    tags = [meta["tag"] for meta in cxdb.contexts.values()]
    assert "aim-abc1" in tags
    assert "EN-1234" in tags


def test_sync_appends_metadata_turn():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work session",
            first_message_at="2026-01-01T00:00:00Z",
            last_message_at="2026-01-01T01:00:00Z",
            message_count=10,
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    turns = cxdb.turns[1]
    meta_turns = [t for t in turns if t["type_id"] == "ai_manager.session_metadata"]
    assert len(meta_turns) == 1
    assert meta_turns[0]["data"]["session_id"] == "sess-1"
    assert meta_turns[0]["data"]["message_count"] == 10


def test_sync_appends_document_turns():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Docs",
            work_item_ids=["aim-abc1"],
        ))
        upsert_document(conn, Document(
            work_item_id="aim-abc1", doc_type="functional",
            filename="functional.md", content="Must do X",
        ))
        upsert_work_item(conn, WorkItem(
            id="aim-abc1", source="beads", title="Test item",
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    doc_turns = [t for t in all_turns if t["type_id"] == "ai_manager.document"]
    assert len(doc_turns) == 1
    assert doc_turns[0]["data"]["filename"] == "functional.md"


def test_sync_is_idempotent():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    first_count = len(cxdb.contexts)
    sync_to_cxdb(conn, cxdb)
    assert len(cxdb.contexts) == first_count


def test_sync_no_sessions_is_noop():
    conn = _make_db()
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)
    assert len(cxdb.contexts) == 0


# --- Transcript turn tests ---


def _jsonl(*entries):
    return "\n".join(json.dumps(e) for e in entries)


class FakeTranscriptStore:
    def __init__(self, transcripts=None):
        self._transcripts = transcripts or {}

    def download_transcript(self, session_id):
        raw = self._transcripts.get(session_id)
        if raw is None:
            raise RuntimeError(f"Transcript not found: {session_id}")
        return raw


def test_sync_appends_transcript_turns():
    conn = _make_db()
    transcript = _jsonl(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "Help me debug"}},
        {"type": "assistant", "timestamp": "2025-01-01T10:00:05Z",
         "message": {"content": [{"type": "text", "text": "Sure, let me look"}]}},
    )
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Debug session",
            work_item_ids=["aim-abc1"],
        ))
    store = FakeTranscriptStore(transcripts={"sess-1": transcript})
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb, transcript_store=store)

    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    transcript_turns = [t for t in all_turns if t["type_id"] == "ai_manager.transcript_turn"]
    assert len(transcript_turns) == 2
    assert transcript_turns[0]["data"]["role"] == "user"
    assert transcript_turns[0]["data"]["content"] == "Help me debug"
    assert transcript_turns[0]["data"]["timestamp"] == "2025-01-01T10:00:00Z"
    assert transcript_turns[1]["data"]["role"] == "assistant"
    assert transcript_turns[1]["data"]["content"] == "Sure, let me look"


def test_sync_without_transcript_store_skips_turns():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="No transcripts",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb)

    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    transcript_turns = [t for t in all_turns if t["type_id"] == "ai_manager.transcript_turn"]
    assert len(transcript_turns) == 0


def test_sync_transcript_download_error_continues():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Error session",
            work_item_ids=["aim-abc1"],
        ))
    store = FakeTranscriptStore(transcripts={})  # no transcript available
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb, transcript_store=store)

    # Should still create the context with metadata, just no transcript turns
    assert len(cxdb.contexts) == 1
    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    meta_turns = [t for t in all_turns if t["type_id"] == "ai_manager.session_metadata"]
    assert len(meta_turns) == 1
    transcript_turns = [t for t in all_turns if t["type_id"] == "ai_manager.transcript_turn"]
    assert len(transcript_turns) == 0


def test_sync_empty_transcript_no_transcript_turns():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Empty transcript",
            work_item_ids=["aim-abc1"],
        ))
    store = FakeTranscriptStore(transcripts={"sess-1": ""})
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb, transcript_store=store)

    assert len(cxdb.contexts) == 1
    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    meta_turns = [t for t in all_turns if t["type_id"] == "ai_manager.session_metadata"]
    assert len(meta_turns) == 1
    transcript_turns = [t for t in all_turns if t["type_id"] == "ai_manager.transcript_turn"]
    assert len(transcript_turns) == 0


def test_sync_ten_turn_transcript():
    conn = _make_db()
    entries = []
    for i in range(10):
        role = "user" if i % 2 == 0 else "assistant"
        entries.append({
            "type": role,
            "timestamp": f"2025-01-01T10:{i:02d}:00Z",
            "message": {"content": f"Message {i}"},
        })
    transcript = _jsonl(*entries)
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Long session",
            work_item_ids=["aim-abc1"],
        ))
    store = FakeTranscriptStore(transcripts={"sess-1": transcript})
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb, transcript_store=store)

    all_turns = []
    for turns in cxdb.turns.values():
        all_turns.extend(turns)
    transcript_turns = [t for t in all_turns if t["type_id"] == "ai_manager.transcript_turn"]
    assert len(transcript_turns) == 10
    for i, turn in enumerate(transcript_turns):
        expected_role = "user" if i % 2 == 0 else "assistant"
        assert turn["data"]["role"] == expected_role
        assert turn["data"]["content"] == f"Message {i}"


def test_sync_transcript_turns_tagged_by_work_item():
    conn = _make_db()
    transcript = _jsonl(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "Hello"}},
    )
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Multi-item",
            work_item_ids=["aim-abc1", "EN-1234"],
        ))
    store = FakeTranscriptStore(transcripts={"sess-1": transcript})
    cxdb = FakeCxdbClient()
    sync_to_cxdb(conn, cxdb, transcript_store=store)

    # Both contexts should have the transcript turn
    assert len(cxdb.contexts) == 2
    for ctx_id in cxdb.contexts:
        transcript_turns = [
            t for t in cxdb.turns[ctx_id]
            if t["type_id"] == "ai_manager.transcript_turn"
        ]
        assert len(transcript_turns) == 1


# --- Error handling and resilience tests ---


class ConnectionErrorCxdbClient(FakeCxdbClient):
    """Raises ConnectionError on create_context to simulate CXDB unreachable."""

    def create_context(self, base_turn_id=0, tag=""):
        raise requests.ConnectionError("Connection refused")


class HttpErrorCxdbClient(FakeCxdbClient):
    """Raises HTTPError on create_context to simulate server error."""

    def __init__(self):
        super().__init__()
        self._call_count = 0

    def create_context(self, base_turn_id=0, tag=""):
        self._call_count += 1
        if self._call_count == 1:
            raise requests.HTTPError("500 Server Error")
        return super().create_context(base_turn_id, tag)


class AppendTurnErrorCxdbClient(FakeCxdbClient):
    """Raises HTTPError on append_turn to simulate partial failure."""

    def append_turn(self, context_id, type_id, data, type_version=1):
        raise requests.HTTPError("502 Bad Gateway")


def test_sync_aborts_on_connection_error():
    """When CXDB is unreachable, sync should abort and return 0."""
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
        upsert_session(conn, Session(
            session_id="sess-2", etag="e2", summary="More work",
            work_item_ids=["aim-abc2"],
        ))
    cxdb = ConnectionErrorCxdbClient()
    count = sync_to_cxdb(conn, cxdb)
    assert count == 0
    assert len(cxdb.contexts) == 0


def test_sync_logs_error_on_connection_failure(caplog):
    """ConnectionError should log at ERROR level."""
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = ConnectionErrorCxdbClient()
    with caplog.at_level(logging.ERROR):
        sync_to_cxdb(conn, cxdb)
    assert any("CXDB unreachable" in r.message for r in caplog.records)


def test_sync_skips_session_on_http_error():
    """HTTPError on one session should skip it but continue to the next."""
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Will fail",
            work_item_ids=["aim-abc1"],
        ))
        upsert_session(conn, Session(
            session_id="sess-2", etag="e2", summary="Will succeed",
            work_item_ids=["aim-abc2"],
        ))
    cxdb = HttpErrorCxdbClient()
    count = sync_to_cxdb(conn, cxdb)
    # First session fails, second succeeds
    assert count >= 1
    tags = [meta["tag"] for meta in cxdb.contexts.values()]
    assert "aim-abc2" in tags


def test_sync_logs_warning_on_http_error(caplog):
    """HTTPError should log at WARNING level, not ERROR."""
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Will fail",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = HttpErrorCxdbClient()
    with caplog.at_level(logging.WARNING):
        sync_to_cxdb(conn, cxdb)
    assert any("sess-1" in r.message and r.levelno == logging.WARNING for r in caplog.records)


def test_sync_handles_append_turn_failure():
    """If append_turn fails, context is still created but turn is skipped."""
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = AppendTurnErrorCxdbClient()
    count = sync_to_cxdb(conn, cxdb)
    # Session should still be counted as synced (context was created)
    assert count == 1
    assert len(cxdb.contexts) == 1


# --- Incremental sync (git commit SHA tracking) tests ---

FAKE_SHA = "a" * 40
FAKE_SHA_2 = "b" * 40
FAKE_WORKSPACE = pathlib.Path("/tmp/fake-workspace")


def _head_returns(sha):
    return patch("ai_manager.cxdb_loader._get_current_head", return_value=sha)


def _valid_commit(result=True):
    return patch("ai_manager.cxdb_loader._is_valid_commit", return_value=result)


def test_sync_stores_commit_sha_after_first_run():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA), _valid_commit():
        sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert _get_last_commit_sha(conn) == FAKE_SHA


def test_sync_sha_updated_after_sync():
    conn = _make_db()
    _ensure_metadata_table(conn)
    _set_last_commit_sha(conn, FAKE_SHA)
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA_2), _valid_commit():
        sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert _get_last_commit_sha(conn) == FAKE_SHA_2


def test_sync_incremental_head_unchanged_only_new():
    conn = _make_db()
    cxdb = FakeCxdbClient()
    # First run: sync 2 sessions
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="A",
            work_item_ids=["aim-abc1"],
        ))
        upsert_session(conn, Session(
            session_id="sess-2", etag="e2", summary="B",
            work_item_ids=["aim-abc2"],
        ))
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 2

    # Add a new session, HEAD unchanged
    with conn:
        upsert_session(conn, Session(
            session_id="sess-3", etag="e3", summary="C",
            work_item_ids=["aim-abc3"],
        ))
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 1
    tags = [meta["tag"] for meta in cxdb.contexts.values()]
    assert "aim-abc3" in tags


def test_sync_full_scan_on_first_run():
    conn = _make_db()
    with conn:
        for i in range(5):
            upsert_session(conn, Session(
                session_id=f"sess-{i}", etag=f"e{i}", summary=f"Work {i}",
                work_item_ids=[f"aim-abc{i}"],
            ))
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 5


def test_sync_full_scan_on_invalid_sha(caplog):
    conn = _make_db()
    _ensure_metadata_table(conn)
    _set_last_commit_sha(conn, "deadbeef" * 5)  # 40 chars but invalid commit
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA_2), _valid_commit(False):
        with caplog.at_level(logging.WARNING):
            count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 1
    assert any("no longer valid" in r.message for r in caplog.records)


def test_sync_full_scan_on_git_failure(caplog):
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(None):
        with caplog.at_level(logging.WARNING):
            count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 1
    assert any("Could not determine git HEAD" in r.message for r in caplog.records)


def test_sync_git_failure_does_not_store_sha():
    conn = _make_db()
    _ensure_metadata_table(conn)
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(None):
        sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert _get_last_commit_sha(conn) is None


def test_sync_empty_workspace_stores_sha():
    conn = _make_db()
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 0
    assert _get_last_commit_sha(conn) == FAKE_SHA


def test_sync_reindex_modified_session():
    conn = _make_db()
    cxdb = FakeCxdbClient()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Original",
            work_item_ids=["aim-abc1"],
        ))
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 1

    # Modify session etag (simulates session data changed)
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1-modified", summary="Updated",
            work_item_ids=["aim-abc1"],
        ))
    with _head_returns(FAKE_SHA_2), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    assert count == 1
    # Should have created a second context for the re-indexed session
    assert len(cxdb.contexts) == 2


def test_sync_no_workspace_dir_backward_compatible():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    count = sync_to_cxdb(conn, cxdb)
    assert count == 1
    assert len(cxdb.contexts) == 1


def test_sha_hex_validation():
    assert not _is_valid_commit(FAKE_WORKSPACE, "not-a-sha")
    assert not _is_valid_commit(FAKE_WORKSPACE, "abc123")
    assert not _is_valid_commit(FAKE_WORKSPACE, "ZZZZ" * 10)


def test_metadata_table_created_idempotently():
    conn = _make_db()
    _ensure_metadata_table(conn)
    _ensure_metadata_table(conn)  # should not raise
    assert _get_last_commit_sha(conn) is None


def test_sync_state_etag_stored():
    conn = _make_db()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="my-etag-123", summary="Work",
            work_item_ids=["aim-abc1"],
        ))
    cxdb = FakeCxdbClient()
    with _head_returns(FAKE_SHA), _valid_commit():
        sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    row = conn.execute(
        "SELECT etag FROM cxdb_sync_state WHERE session_id = 'sess-1'"
    ).fetchone()
    assert row[0] == "my-etag-123"


def test_sync_head_unchanged_skips_unmodified():
    """When HEAD is unchanged, only unsynced sessions are processed (not etag-changed)."""
    conn = _make_db()
    cxdb = FakeCxdbClient()
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1", summary="A",
            work_item_ids=["aim-abc1"],
        ))
    with _head_returns(FAKE_SHA), _valid_commit():
        sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)

    # Modify the etag but keep HEAD the same
    with conn:
        upsert_session(conn, Session(
            session_id="sess-1", etag="e1-changed", summary="A modified",
            work_item_ids=["aim-abc1"],
        ))
    with _head_returns(FAKE_SHA), _valid_commit():
        count = sync_to_cxdb(conn, cxdb, workspace_dir=FAKE_WORKSPACE)
    # HEAD unchanged → fast path → only new sessions (none here)
    assert count == 0
