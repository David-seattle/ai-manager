import sqlite3

from .models import DecisionRecord, Document, QuestionRecord, WorkItem

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS work_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    path TEXT DEFAULT '',
    status TEXT DEFAULT '',
    priority TEXT DEFAULT '',
    assignee TEXT DEFAULT '',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    work_item_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT DEFAULT '',
    updated_at TEXT,
    UNIQUE(work_item_id, filename),
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS questions (
    work_item_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    question_text TEXT DEFAULT '',
    status TEXT DEFAULT 'open',
    raised_by TEXT,
    raised_date TEXT,
    source TEXT,
    resolved_date TEXT,
    resolved_by TEXT,
    context TEXT DEFAULT '',
    impact TEXT DEFAULT '',
    raw_content TEXT DEFAULT '',
    UNIQUE(work_item_id, filename),
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);

CREATE TABLE IF NOT EXISTS decisions (
    work_item_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    decision_text TEXT DEFAULT '',
    status TEXT DEFAULT 'current',
    decider_type TEXT,
    decider TEXT,
    date TEXT,
    superseded_by TEXT,
    tags TEXT DEFAULT '[]',
    problem_context TEXT DEFAULT '',
    alternatives TEXT DEFAULT '',
    raw_content TEXT DEFAULT '',
    UNIQUE(work_item_id, filename),
    FOREIGN KEY (work_item_id) REFERENCES work_items(id)
);
"""


def create_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)


def delete_children(conn: sqlite3.Connection, work_item_id: str) -> None:
    for table in ("documents", "questions", "decisions"):
        conn.execute(f"DELETE FROM {table} WHERE work_item_id = ?", (work_item_id,))


def upsert_work_item(conn: sqlite3.Connection, item: WorkItem) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO work_items
        (id, source, title, description, path, status, priority, assignee, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (item.id, item.source, item.title, item.description, item.path,
         item.status, item.priority, item.assignee, item.created_at, item.updated_at),
    )


def upsert_document(conn: sqlite3.Connection, doc: Document) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO documents
        (work_item_id, doc_type, filename, content, updated_at)
        VALUES (?, ?, ?, ?, ?)""",
        (doc.work_item_id, doc.doc_type, doc.filename, doc.content, doc.updated_at),
    )


def upsert_question(conn: sqlite3.Connection, q: QuestionRecord) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO questions
        (work_item_id, filename, question_text, status, raised_by, raised_date,
         source, resolved_date, resolved_by, context, impact, raw_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (q.work_item_id, q.filename, q.question_text, q.status, q.raised_by,
         q.raised_date, q.source, q.resolved_date, q.resolved_by,
         q.context, q.impact, q.raw_content),
    )


def upsert_decision(conn: sqlite3.Connection, d: DecisionRecord) -> None:
    conn.execute(
        """INSERT OR REPLACE INTO decisions
        (work_item_id, filename, decision_text, status, decider_type, decider,
         date, superseded_by, tags, problem_context, alternatives, raw_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (d.work_item_id, d.filename, d.decision_text, d.status, d.decider_type,
         d.decider, d.date, d.superseded_by, d.tags_json(),
         d.problem_context, d.alternatives, d.raw_content),
    )
