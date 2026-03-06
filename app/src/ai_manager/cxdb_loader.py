"""Load workspace session data into CXDB as contexts and turns."""

from __future__ import annotations

import logging
import pathlib
import re
import sqlite3
import subprocess
from typing import TYPE_CHECKING

import requests

from .cxdb_client import CxdbClient
from .transcript_parser import parse_transcript

if TYPE_CHECKING:
    from .s3_client import TranscriptStore

logger = logging.getLogger(__name__)

# CXDB turn type IDs
TYPE_SESSION_META = "ai_manager.session_metadata"
TYPE_DOCUMENT = "ai_manager.document"
TYPE_WORK_ITEM = "ai_manager.work_item"
TYPE_TRANSCRIPT_TURN = "ai_manager.transcript_turn"


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


def _get_synced_sessions(conn: sqlite3.Connection) -> dict[str, str]:
    """Return session IDs already synced to CXDB, mapped to their etag at sync time."""
    try:
        rows = conn.execute(
            "SELECT session_id, etag FROM cxdb_sync_state"
        ).fetchall()
        return {r[0]: r[1] for r in rows}
    except sqlite3.OperationalError:
        return {}


def _ensure_sync_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cxdb_sync_state ("
        "  session_id TEXT PRIMARY KEY,"
        "  context_ids TEXT DEFAULT '',"
        "  etag TEXT DEFAULT '',"
        "  synced_at TEXT DEFAULT (datetime('now'))"
        ")"
    )
    try:
        conn.execute("ALTER TABLE cxdb_sync_state ADD COLUMN etag TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass  # column already exists


def _ensure_metadata_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cxdb_sync_metadata ("
        "  key TEXT PRIMARY KEY,"
        "  value TEXT NOT NULL,"
        "  updated_at TEXT DEFAULT (datetime('now'))"
        ")"
    )


def _get_last_commit_sha(conn: sqlite3.Connection) -> str | None:
    row = conn.execute(
        "SELECT value FROM cxdb_sync_metadata WHERE key = 'last_commit_sha'"
    ).fetchone()
    return row[0] if row else None


def _set_last_commit_sha(conn: sqlite3.Connection, sha: str) -> None:
    with conn:
        conn.execute(
            "INSERT OR REPLACE INTO cxdb_sync_metadata (key, value, updated_at) "
            "VALUES ('last_commit_sha', ?, datetime('now'))",
            (sha,),
        )


def _get_current_head(workspace_dir: pathlib.Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(workspace_dir), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
        logger.warning("git rev-parse HEAD failed: %s", result.stderr.strip())
        return None
    except Exception:
        logger.warning("Failed to get git HEAD for %s", workspace_dir)
        return None


def _is_valid_commit(workspace_dir: pathlib.Path, sha: str) -> bool:
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        return False
    try:
        result = subprocess.run(
            ["git", "-C", str(workspace_dir), "cat-file", "-t", sha],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0 and result.stdout.strip() == "commit"
    except Exception:
        return False


def _get_unsynced_sessions(conn: sqlite3.Connection) -> list[dict]:
    """Return sessions not yet synced to CXDB (fast path: new sessions only)."""
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT s.session_id, s.etag, s.summary, s.first_message_at, s.last_message_at, "
        "s.message_count, s.cataloged_at "
        "FROM sessions s "
        "LEFT JOIN cxdb_sync_state c ON s.session_id = c.session_id "
        "WHERE c.session_id IS NULL"
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


def _get_sessions_needing_resync(conn: sqlite3.Connection) -> list[dict]:
    """Return sessions that are new or have changed etag since last sync."""
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT s.session_id, s.etag, s.summary, s.first_message_at, s.last_message_at, "
        "s.message_count, s.cataloged_at "
        "FROM sessions s "
        "LEFT JOIN cxdb_sync_state c ON s.session_id = c.session_id "
        "WHERE c.session_id IS NULL OR c.etag != s.etag"
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


def _load_transcript_turns(
    transcript_store: TranscriptStore | None,
    session_id: str,
) -> list[dict]:
    if transcript_store is None:
        return []
    try:
        raw = transcript_store.download_transcript(session_id)
    except Exception:
        logger.warning("Could not download transcript for session %s", session_id)
        return []
    return [
        {"role": t.role, "content": t.content, "timestamp": t.timestamp}
        for t in parse_transcript(raw)
    ]


def sync_to_cxdb(
    conn: sqlite3.Connection,
    cxdb: CxdbClient,
    transcript_store: TranscriptStore | None = None,
    workspace_dir: pathlib.Path | None = None,
) -> int:
    _ensure_sync_table(conn)
    _ensure_metadata_table(conn)

    current_head = None
    if workspace_dir is not None:
        current_head = _get_current_head(workspace_dir)
        stored_sha = _get_last_commit_sha(conn)

        if current_head is not None and current_head == stored_sha:
            sessions = _get_unsynced_sessions(conn)
        else:
            if current_head is None:
                logger.warning("Could not determine git HEAD, running full scan")
            elif stored_sha is not None and not _is_valid_commit(workspace_dir, stored_sha):
                logger.warning(
                    "Stored commit SHA %s is no longer valid, running full scan",
                    stored_sha,
                )
            sessions = _get_sessions_needing_resync(conn)
    else:
        # No workspace_dir: backward-compatible full scan
        synced = _get_synced_sessions(conn)
        sessions = [s for s in _get_sessions(conn) if s["session_id"] not in synced]

    count = 0
    for session in sessions:
        sid = session["session_id"]

        work_item_ids = session["work_item_ids"]
        if not work_item_ids:
            work_item_ids = ["_untagged"]

        transcript_turns = _load_transcript_turns(transcript_store, sid)

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

                for turn_data in transcript_turns:
                    cxdb.append_turn(ctx.context_id, TYPE_TRANSCRIPT_TURN, turn_data)

            except requests.ConnectionError:
                logger.error("CXDB unreachable, aborting sync for session %s", sid)
                return count
            except requests.HTTPError:
                logger.warning("HTTP error syncing session %s for work item %s, skipping", sid, wid)
                continue
            except Exception:
                logger.exception("Failed to sync session %s for work item %s", sid, wid)
                continue

        with conn:
            conn.execute(
                "INSERT OR REPLACE INTO cxdb_sync_state (session_id, context_ids, etag) "
                "VALUES (?, ?, ?)",
                (sid, ",".join(str(c) for c in context_ids), session.get("etag", "")),
            )
        count += 1
        logger.info("Synced session %s to CXDB (%d contexts)", sid, len(context_ids))

    if current_head is not None:
        _set_last_commit_sha(conn, current_head)

    return count
