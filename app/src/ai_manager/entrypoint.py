import logging
import os
import pathlib
import sqlite3
import subprocess
import sys

from .jira_client import JiraClient
from .loader import loader_loop
from .schema import create_tables

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DB_PATH = pathlib.Path(os.environ.get("DB_PATH", "/data/ai_manager.db"))
WORKSPACE_DIR = pathlib.Path(os.environ.get("WORKSPACE_DIR", "/workspace"))
REPO_URL = os.environ.get("WORKSPACE_REPO_URL", "")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
DATASETTE_PORT = os.environ.get("DATASETTE_PORT", "8001")

JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "")
JIRA_EMAIL = os.environ.get("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.environ.get("JIRA_API_TOKEN", "")


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    create_tables(conn)
    conn.close()
    logger.info("Database initialized at %s", DB_PATH)

    datasette_proc = subprocess.Popen(
        ["datasette", str(DB_PATH), "--host", "0.0.0.0", "--port", DATASETTE_PORT,
         "--metadata", "datasette/metadata.yml"],
        stdout=sys.stdout, stderr=sys.stderr,
    )
    logger.info("Datasette started on port %s (pid %d)", DATASETTE_PORT, datasette_proc.pid)

    jira_client = None
    if JIRA_BASE_URL and JIRA_EMAIL and JIRA_API_TOKEN:
        jira_client = JiraClient(JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)
        logger.info("Jira client configured for %s", JIRA_BASE_URL)

    try:
        loader_loop(
            db_path=DB_PATH,
            workspace_dir=WORKSPACE_DIR,
            repo_url=REPO_URL,
            github_token=GITHUB_TOKEN or None,
            jira_client=jira_client,
        )
    except KeyboardInterrupt:
        logger.info("Shutting down")
    finally:
        datasette_proc.terminate()
        datasette_proc.wait(timeout=10)


if __name__ == "__main__":
    main()
