import sqlite3

from ai_manager.models import DecisionRecord, Document, QuestionRecord, Session, WorkItem
from ai_manager.schema import (
    create_tables,
    delete_children,
    get_session_etags,
    upsert_decision,
    upsert_document,
    upsert_question,
    upsert_session,
    upsert_work_item,
)


def test_create_tables_idempotent(in_memory_db):
    create_tables(in_memory_db)
    create_tables(in_memory_db)
    tables = in_memory_db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    names = [t[0] for t in tables]
    assert "work_items" in names
    assert "documents" in names
    assert "questions" in names
    assert "decisions" in names
    assert "sessions" in names
    assert "session_work_items" in names


def test_upsert_work_item(in_memory_db):
    create_tables(in_memory_db)
    item = WorkItem(id="aim-abc1", source="beads", title="Test item")
    upsert_work_item(in_memory_db, item)
    in_memory_db.commit()

    rows = in_memory_db.execute("SELECT id, source, title FROM work_items").fetchall()
    assert len(rows) == 1
    assert rows[0] == ("aim-abc1", "beads", "Test item")

    item.title = "Updated title"
    upsert_work_item(in_memory_db, item)
    in_memory_db.commit()

    rows = in_memory_db.execute("SELECT title FROM work_items WHERE id='aim-abc1'").fetchall()
    assert rows[0][0] == "Updated title"


def test_upsert_document(in_memory_db):
    create_tables(in_memory_db)
    item = WorkItem(id="aim-abc1", source="beads", title="Test")
    upsert_work_item(in_memory_db, item)

    doc = Document(work_item_id="aim-abc1", doc_type="functional", filename="functional.md", content="Reqs here")
    upsert_document(in_memory_db, doc)
    in_memory_db.commit()

    rows = in_memory_db.execute("SELECT work_item_id, doc_type, filename FROM documents").fetchall()
    assert len(rows) == 1
    assert rows[0] == ("aim-abc1", "functional", "functional.md")


def test_upsert_question(in_memory_db):
    create_tables(in_memory_db)
    item = WorkItem(id="aim-abc1", source="beads", title="Test")
    upsert_work_item(in_memory_db, item)

    q = QuestionRecord(work_item_id="aim-abc1", filename="q1.md", question_text="Why?")
    upsert_question(in_memory_db, q)
    in_memory_db.commit()

    rows = in_memory_db.execute("SELECT work_item_id, filename, question_text FROM questions").fetchall()
    assert len(rows) == 1
    assert rows[0][2] == "Why?"


def test_upsert_decision(in_memory_db):
    create_tables(in_memory_db)
    item = WorkItem(id="aim-abc1", source="beads", title="Test")
    upsert_work_item(in_memory_db, item)

    d = DecisionRecord(work_item_id="aim-abc1", filename="d1.md", decision_text="Use X", tags=["arch"])
    upsert_decision(in_memory_db, d)
    in_memory_db.commit()

    rows = in_memory_db.execute("SELECT work_item_id, decision_text, tags FROM decisions").fetchall()
    assert len(rows) == 1
    assert rows[0][1] == "Use X"
    assert rows[0][2] == '["arch"]'


def test_delete_children(in_memory_db):
    create_tables(in_memory_db)
    item = WorkItem(id="aim-abc1", source="beads", title="Test")
    upsert_work_item(in_memory_db, item)

    doc = Document(work_item_id="aim-abc1", doc_type="func", filename="f.md", content="c")
    upsert_document(in_memory_db, doc)
    q = QuestionRecord(work_item_id="aim-abc1", filename="q.md", question_text="Q")
    upsert_question(in_memory_db, q)
    d = DecisionRecord(work_item_id="aim-abc1", filename="d.md", decision_text="D")
    upsert_decision(in_memory_db, d)
    in_memory_db.commit()

    delete_children(in_memory_db, "aim-abc1")
    in_memory_db.commit()

    assert in_memory_db.execute("SELECT COUNT(*) FROM documents").fetchone()[0] == 0
    assert in_memory_db.execute("SELECT COUNT(*) FROM questions").fetchone()[0] == 0
    assert in_memory_db.execute("SELECT COUNT(*) FROM decisions").fetchone()[0] == 0
    assert in_memory_db.execute("SELECT COUNT(*) FROM work_items").fetchone()[0] == 1


def test_upsert_session(in_memory_db):
    create_tables(in_memory_db)
    session = Session(
        session_id="sess-1",
        etag='"abc"',
        summary="Did some work",
        first_message_at="2025-01-01T10:00:00Z",
        last_message_at="2025-01-01T10:05:00Z",
        message_count=5,
        cataloged_at="2025-01-02T00:00:00Z",
        work_item_ids=["EN-1234", "aim-abc1"],
    )
    upsert_session(in_memory_db, session)
    in_memory_db.commit()

    row = in_memory_db.execute(
        "SELECT session_id, etag, summary, message_count FROM sessions"
    ).fetchone()
    assert row == ("sess-1", '"abc"', "Did some work", 5)

    links = in_memory_db.execute(
        "SELECT work_item_id FROM session_work_items ORDER BY work_item_id"
    ).fetchall()
    assert [l[0] for l in links] == ["EN-1234", "aim-abc1"]


def test_upsert_session_replaces_work_item_links(in_memory_db):
    create_tables(in_memory_db)
    session = Session(session_id="sess-1", etag='"v1"', work_item_ids=["EN-1", "EN-2"])
    upsert_session(in_memory_db, session)
    in_memory_db.commit()

    session.etag = '"v2"'
    session.work_item_ids = ["EN-2", "EN-3", "EN-4"]
    upsert_session(in_memory_db, session)
    in_memory_db.commit()

    links = in_memory_db.execute(
        "SELECT work_item_id FROM session_work_items ORDER BY work_item_id"
    ).fetchall()
    assert [l[0] for l in links] == ["EN-2", "EN-3", "EN-4"]


def test_get_session_etags(in_memory_db):
    create_tables(in_memory_db)
    upsert_session(in_memory_db, Session(session_id="s1", etag='"a"'))
    upsert_session(in_memory_db, Session(session_id="s2", etag='"b"'))
    in_memory_db.commit()

    etags = get_session_etags(in_memory_db)
    assert etags == {"s1": '"a"', "s2": '"b"'}
