import logging
import pathlib
import sqlite3
import time

from .git_sync import sync_workspace
from .jira_client import JiraClient
from .scanner import scan_workspace
from .schema import (
    delete_children,
    upsert_decision,
    upsert_document,
    upsert_question,
    upsert_work_item,
)
from .cxdb_loader import sync_to_cxdb
from .summarizer import sync_sessions

logger = logging.getLogger(__name__)


def run_sync_cycle(
    conn: sqlite3.Connection,
    workspace_dir: pathlib.Path,
    jira_client: JiraClient | None = None,
) -> None:
    items, docs, questions, decisions = scan_workspace(workspace_dir)

    for item in items:
        with conn:
            delete_children(conn, item.id)
            upsert_work_item(conn, item)

    for doc in docs:
        with conn:
            upsert_document(conn, doc)

    for q in questions:
        with conn:
            upsert_question(conn, q)

    for d in decisions:
        with conn:
            upsert_decision(conn, d)

    # Enrich EN- items from Jira API if title is just the ID
    if jira_client:
        for item in items:
            if item.id.startswith("EN-") and item.title == item.id:
                data = jira_client.fetch_issue(item.id)
                if data:
                    item.title = data.get("summary", item.title)
                    item.description = data.get("description", item.description) or ""
                    item.status = data.get("status", item.status)
                    item.assignee = data.get("assignee", item.assignee)
                    item.priority = data.get("priority", item.priority)
                    with conn:
                        upsert_work_item(conn, item)

    logger.info("Sync complete: %d items, %d docs, %d questions, %d decisions",
                len(items), len(docs), len(questions), len(decisions))


def loader_loop(
    db_path: pathlib.Path,
    workspace_dir: pathlib.Path,
    repo_url: str,
    github_token: str | None = None,
    jira_client: JiraClient | None = None,
    transcript_store=None,
    anthropic_client=None,
    cxdb_client=None,
    interval: int = 30,
) -> None:
    conn = sqlite3.connect(str(db_path))
    try:
        while True:
            try:
                sync_workspace(repo_url, workspace_dir, github_token)
                run_sync_cycle(conn, workspace_dir, jira_client)
                if transcript_store and anthropic_client:
                    sync_sessions(conn, transcript_store, anthropic_client, workspace_dir=workspace_dir)
                if cxdb_client:
                    sync_to_cxdb(conn, cxdb_client, transcript_store=transcript_store, workspace_dir=workspace_dir)
            except Exception:
                logger.exception("Sync cycle failed")
            time.sleep(interval)
    finally:
        conn.close()
