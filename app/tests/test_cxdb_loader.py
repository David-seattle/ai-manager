import sqlite3

from ai_manager.cxdb_loader import sync_to_cxdb
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
