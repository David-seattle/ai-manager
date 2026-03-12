import json
import pathlib
import sqlite3
from unittest.mock import MagicMock

import pytest

from ai_manager.models import S3Object
from ai_manager.schema import create_tables, get_session_etags, upsert_session
from ai_manager.models import Session
from ai_manager.summarizer import (
    extract_conversation_text,
    list_local_work_item_links,
    summarize_transcript,
    sync_sessions,
    truncate_text,
)


def _jsonl(*entries):
    return "\n".join(json.dumps(e) for e in entries)


class TestExtractConversationText:
    def test_user_and_assistant(self):
        raw = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "Hello"}},
            {"type": "assistant", "timestamp": "2025-01-01T10:00:05Z",
             "message": {"content": [{"type": "text", "text": "Hi there"}]}},
        )
        text, first_ts, last_ts, count = extract_conversation_text(raw)
        assert "User: Hello" in text
        assert "Assistant: Hi there" in text
        assert first_ts == "2025-01-01T10:00:00Z"
        assert last_ts == "2025-01-01T10:00:05Z"
        assert count == 2

    def test_filters_non_user_assistant(self):
        raw = _jsonl(
            {"type": "file-history-snapshot", "timestamp": "2025-01-01T10:00:00Z"},
            {"type": "progress", "data": {}},
            {"type": "user", "timestamp": "2025-01-01T10:00:01Z",
             "message": {"content": "test"}},
        )
        text, _, _, count = extract_conversation_text(raw)
        assert "User: test" in text
        assert "file-history-snapshot" not in text
        assert count == 1

    def test_filters_tool_use_blocks(self):
        raw = _jsonl(
            {"type": "assistant", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": [
                 {"type": "text", "text": "Let me check"},
                 {"type": "tool_use", "name": "Read", "input": {}},
                 {"type": "thinking", "thinking": "hmm"},
             ]}},
        )
        text, _, _, count = extract_conversation_text(raw)
        assert "Let me check" in text
        assert "tool_use" not in text
        assert "thinking" not in text.lower().replace("assistant:", "")
        assert count == 1

    def test_empty_input(self):
        text, first_ts, last_ts, count = extract_conversation_text("")
        assert text == ""
        assert first_ts is None
        assert last_ts is None
        assert count == 0


class TestTruncateText:
    def test_short_text_unchanged(self):
        text = "Short text"
        assert truncate_text(text) == text

    def test_long_text_truncated(self):
        text = ("A" * 4000 + "\n\n" + "B" * 4000 + "\n\n" + "C" * 4000)
        result = truncate_text(text, max_chars=8000)
        assert len(result) < 8200
        assert result.endswith("[...truncated]")

    def test_truncates_at_paragraph_boundary(self):
        text = "First paragraph.\n\nSecond paragraph.\n\n" + "X" * 8000
        result = truncate_text(text, max_chars=100)
        assert "First paragraph." in result
        assert result.endswith("[...truncated]")


class TestSummarizeTranscript:
    def test_calls_haiku(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="User debugged a Python issue.")]
        mock_client.messages.create.return_value = mock_response

        result = summarize_transcript(mock_client, "User: help\nAssistant: sure")
        assert result == "User debugged a Python issue."

        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-haiku-4-5-20251001"
        assert call_kwargs["max_tokens"] == 150


class TestSyncSessions:
    @pytest.fixture
    def db(self):
        conn = sqlite3.connect(":memory:")
        create_tables(conn)
        yield conn
        conn.close()

    def _make_store(self, sessions=None, transcripts=None, links=None):
        store = MagicMock()
        store.list_sessions.return_value = sessions or []
        store.session_id_from_key = TranscriptStoreMock.session_id_from_key

        def download(sid):
            return (transcripts or {}).get(sid, "")
        store.download_transcript = download

        def get_links(sid):
            return (links or {}).get(sid, [])
        store.list_work_item_links = get_links

        return store

    def _make_anthropic(self, summary="Test summary."):
        client = MagicMock()
        resp = MagicMock()
        resp.content = [MagicMock(text=summary)]
        client.messages.create.return_value = resp
        return client

    def test_new_session(self, db):
        transcript = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "help me"}},
            {"type": "assistant", "timestamp": "2025-01-01T10:00:05Z",
             "message": {"content": [{"type": "text", "text": "sure thing"}]}},
        )
        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"abc"')],
            transcripts={"sess-1": transcript},
            links={"sess-1": ["EN-1234"]},
        )
        client = self._make_anthropic()

        count = sync_sessions(db, store, client)
        assert count == 1

        row = db.execute("SELECT session_id, etag, summary, message_count FROM sessions").fetchone()
        assert row[0] == "sess-1"
        assert row[1] == '"abc"'
        assert row[2] == "Test summary."
        assert row[3] == 2

        links = db.execute("SELECT work_item_id FROM session_work_items WHERE session_id='sess-1'").fetchall()
        assert links[0][0] == "EN-1234"

    def test_unchanged_etag_skipped(self, db):
        session = Session(session_id="sess-1", etag='"abc"', summary="old summary")
        with db:
            upsert_session(db, session)

        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"abc"')],
        )
        client = self._make_anthropic()

        count = sync_sessions(db, store, client)
        assert count == 0
        client.messages.create.assert_not_called()

    def test_changed_etag_resummarized(self, db):
        session = Session(session_id="sess-1", etag='"old"', summary="old summary")
        with db:
            upsert_session(db, session)

        transcript = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "updated content"}},
        )
        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"new"')],
            transcripts={"sess-1": transcript},
        )
        client = self._make_anthropic("Updated summary.")

        count = sync_sessions(db, store, client)
        assert count == 1

        row = db.execute("SELECT summary, etag FROM sessions WHERE session_id='sess-1'").fetchone()
        assert row[0] == "Updated summary."
        assert row[1] == '"new"'

    def test_max_per_cycle(self, db):
        sessions = [
            S3Object(key=f"conversations/sess-{i}/transcript.jsonl", etag=f'"{i}"')
            for i in range(20)
        ]
        transcripts = {
            f"sess-{i}": _jsonl({"type": "user", "timestamp": "2025-01-01T10:00:00Z",
                                  "message": {"content": f"msg {i}"}})
            for i in range(20)
        }
        store = self._make_store(sessions=sessions, transcripts=transcripts)
        client = self._make_anthropic()

        count = sync_sessions(db, store, client, max_new_per_cycle=5)
        assert count == 5

        total = db.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        assert total == 5

    def test_error_continues(self, db):
        transcript_good = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "good"}},
        )
        store = self._make_store(
            sessions=[
                S3Object(key="conversations/sess-bad/transcript.jsonl", etag='"b"'),
                S3Object(key="conversations/sess-good/transcript.jsonl", etag='"g"'),
            ],
            transcripts={"sess-good": transcript_good},
        )

        def download_side_effect(sid):
            if sid == "sess-bad":
                raise RuntimeError("S3 error")
            return store.download_transcript.__wrapped__(sid) if hasattr(store.download_transcript, '__wrapped__') else transcript_good
        store.download_transcript = download_side_effect

        client = self._make_anthropic()
        count = sync_sessions(db, store, client)
        assert count == 1

        row = db.execute("SELECT session_id FROM sessions").fetchone()
        assert row[0] == "sess-good"


class TestListLocalWorkItemLinks:
    def test_reads_marker_files(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        workitems_dir.mkdir(parents=True)
        (workitems_dir / "EN-1234").touch()
        (workitems_dir / "aim-abc1").touch()

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert sorted(result) == ["EN-1234", "aim-abc1"]

    def test_no_workitems_dir(self, tmp_path):
        conv_dir = tmp_path / "conversations" / "sess-1"
        conv_dir.mkdir(parents=True)

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert result == []

    def test_no_session_dir(self, tmp_path):
        result = list_local_work_item_links(tmp_path, "nonexistent")
        assert result == []

    def test_multiple_work_items(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-2" / "workitems"
        workitems_dir.mkdir(parents=True)
        (workitems_dir / "EN-1234").touch()
        (workitems_dir / "EN-5678").touch()
        (workitems_dir / "dtarico_hq-deacon").touch()

        result = list_local_work_item_links(tmp_path, "sess-2")
        assert sorted(result) == ["EN-1234", "EN-5678", "dtarico_hq-deacon"]

    def test_reads_markers_in_user_subdirectory(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        user_dir = workitems_dir / "dtarico"
        user_dir.mkdir(parents=True)
        (user_dir / "aim-xxlo").touch()
        (user_dir / "aim-abc1").touch()

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert sorted(result) == ["aim-abc1", "aim-xxlo"]

    def test_mixed_flat_and_nested_markers(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        workitems_dir.mkdir(parents=True)
        (workitems_dir / "EN-1234").touch()
        user_dir = workitems_dir / "dtarico"
        user_dir.mkdir()
        (user_dir / "aim-xxlo").touch()

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert sorted(result) == ["EN-1234", "aim-xxlo"]

    def test_multiple_user_subdirectories(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        (workitems_dir / "dtarico").mkdir(parents=True)
        (workitems_dir / "dtarico" / "aim-xxlo").touch()
        (workitems_dir / "rzavala").mkdir()
        (workitems_dir / "rzavala" / "EN-5678").touch()

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert sorted(result) == ["EN-5678", "aim-xxlo"]

    def test_empty_user_subdirectory(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        (workitems_dir / "dtarico").mkdir(parents=True)

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert result == []

    def test_nested_subdirectory_ignored(self, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        deep_dir = workitems_dir / "dtarico" / "deep"
        deep_dir.mkdir(parents=True)
        (deep_dir / "aim-xxlo").touch()

        result = list_local_work_item_links(tmp_path, "sess-1")
        assert result == []


class TestSyncSessionsWithWorkspaceDir:
    @pytest.fixture
    def db(self):
        conn = sqlite3.connect(":memory:")
        create_tables(conn)
        yield conn
        conn.close()

    def _make_store(self, sessions=None, transcripts=None):
        store = MagicMock()
        store.list_sessions.return_value = sessions or []
        store.session_id_from_key = TranscriptStoreMock.session_id_from_key

        def download(sid):
            return (transcripts or {}).get(sid, "")
        store.download_transcript = download

        return store

    def _make_anthropic(self, summary="Test summary."):
        client = MagicMock()
        resp = MagicMock()
        resp.content = [MagicMock(text=summary)]
        client.messages.create.return_value = resp
        return client

    def test_reads_links_from_local_workspace(self, db, tmp_path):
        workitems_dir = tmp_path / "conversations" / "sess-1" / "workitems"
        workitems_dir.mkdir(parents=True)
        (workitems_dir / "EN-1234").touch()

        transcript = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "help me"}},
        )
        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"abc"')],
            transcripts={"sess-1": transcript},
        )
        client = self._make_anthropic()

        count = sync_sessions(db, store, client, workspace_dir=tmp_path)
        assert count == 1

        links = db.execute(
            "SELECT work_item_id FROM session_work_items WHERE session_id='sess-1'"
        ).fetchall()
        assert links[0][0] == "EN-1234"

        # Should NOT call S3 list_work_item_links when workspace_dir is provided
        store.list_work_item_links.assert_not_called()

    def test_no_markers_stores_empty_links(self, db, tmp_path):
        transcript = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "hello"}},
        )
        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"abc"')],
            transcripts={"sess-1": transcript},
        )
        client = self._make_anthropic()

        count = sync_sessions(db, store, client, workspace_dir=tmp_path)
        assert count == 1

        links = db.execute(
            "SELECT work_item_id FROM session_work_items WHERE session_id='sess-1'"
        ).fetchall()
        assert links == []

    def test_reads_links_from_user_subdirectory(self, db, tmp_path):
        user_dir = tmp_path / "conversations" / "sess-1" / "workitems" / "dtarico"
        user_dir.mkdir(parents=True)
        (user_dir / "aim-xxlo").touch()

        transcript = _jsonl(
            {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
             "message": {"content": "help me"}},
        )
        store = self._make_store(
            sessions=[S3Object(key="conversations/sess-1/transcript.jsonl", etag='"abc"')],
            transcripts={"sess-1": transcript},
        )
        client = self._make_anthropic()

        count = sync_sessions(db, store, client, workspace_dir=tmp_path)
        assert count == 1

        links = db.execute(
            "SELECT work_item_id FROM session_work_items WHERE session_id='sess-1'"
        ).fetchall()
        assert links[0][0] == "aim-xxlo"


class TranscriptStoreMock:
    @staticmethod
    def session_id_from_key(key):
        import re
        match = re.search(r"conversations/([^/]+)/", key)
        if match:
            return match.group(1)
        raise ValueError(f"Cannot extract session_id from key: {key}")
