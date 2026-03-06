"""Load workspace session data into CXDB as contexts and turns."""

import logging
import sqlite3

from .cxdb_client import CxdbClient

logger = logging.getLogger(__name__)

# CXDB turn type IDs
TYPE_SESSION_META = "ai_manager.session_metadata"
TYPE_DOCUMENT = "ai_manager.document"
TYPE_WORK_ITEM = "ai_manager.work_item"


def _get_sessions(conn: sqlite3.Connection) -> list[dict]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT session_id, etag, summary, first_message_at, last_message_at, "
        "message_count, cataloged_at FROM sessions"
    ).fetchall()
    sessions = []
    for row in rows:
        wids = conn.execute(
            "SELECT work_item_id FROM session_work_items WHERE session_id = ?",
            (row["session_id"],),
        ).fetchall()
        sessions.append({
            **dict(row),
            "work_item_ids": [w["work_item_id"] for w in wids],
        })
    conn.row_factory = None
    return sessions


def _get_documents_for_work_item(conn: sqlite3.Connection, work_item_id: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT work_item_id, doc_type, filename, content, updated_at "
        "FROM documents WHERE work_item_id = ?",
        (work_item_id,),
    ).fetchall()
    result = [dict(r) for r in rows]
    conn.row_factory = None
    return result


def _get_synced_sessions(conn: sqlite3.Connection) -> set[str]:
    """Return session IDs already synced to CXDB."""
    try:
        rows = conn.execute(
            "SELECT session_id FROM cxdb_sync_state"
        ).fetchall()
        return {r[0] for r in rows}
    except sqlite3.OperationalError:
        return set()


def _ensure_sync_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cxdb_sync_state ("
        "  session_id TEXT PRIMARY KEY,"
        "  context_ids TEXT DEFAULT '',"
        "  synced_at TEXT DEFAULT (datetime('now'))"
        ")"
    )


def sync_to_cxdb(conn: sqlite3.Connection, cxdb: CxdbClient) -> int:
    _ensure_sync_table(conn)
    synced = _get_synced_sessions(conn)
    sessions = _get_sessions(conn)

    count = 0
    for session in sessions:
        sid = session["session_id"]
        if sid in synced:
            continue

        work_item_ids = session["work_item_ids"]
        if not work_item_ids:
            work_item_ids = ["_untagged"]

        context_ids = []
        for wid in work_item_ids:
            try:
                ctx = cxdb.create_context(tag=wid)
                context_ids.append(ctx.context_id)

                cxdb.append_turn(ctx.context_id, TYPE_SESSION_META, {
                    "session_id": sid,
                    "summary": session.get("summary", ""),
                    "first_message_at": session.get("first_message_at"),
                    "last_message_at": session.get("last_message_at"),
                    "message_count": session.get("message_count", 0),
                    "work_item_ids": session["work_item_ids"],
                })

                for doc in _get_documents_for_work_item(conn, wid):
                    cxdb.append_turn(ctx.context_id, TYPE_DOCUMENT, {
                        "work_item_id": doc["work_item_id"],
                        "doc_type": doc["doc_type"],
                        "filename": doc["filename"],
                        "content": doc["content"],
                    })

            except Exception:
                logger.exception("Failed to sync session %s for work item %s", sid, wid)
                continue

        with conn:
            conn.execute(
                "INSERT OR REPLACE INTO cxdb_sync_state (session_id, context_ids) "
                "VALUES (?, ?)",
                (sid, ",".join(str(c) for c in context_ids)),
            )
        count += 1
        logger.info("Synced session %s to CXDB (%d contexts)", sid, len(context_ids))

    return count
