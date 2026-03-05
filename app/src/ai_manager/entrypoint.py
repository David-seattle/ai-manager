import logging
import os
import pathlib
import sqlite3
import subprocess
import sys
import threading

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

S3_BUCKET = os.environ.get("TRANSCRIPT_S3_BUCKET", "")
S3_REGION = os.environ.get("TRANSCRIPT_S3_REGION", "us-east-2")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TRANSCRIPT_PROXY_PORT = os.environ.get("TRANSCRIPT_PROXY_PORT", "8002")


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

    transcript_store = None
    anthropic_client = None
    if S3_BUCKET and ANTHROPIC_API_KEY:
        import anthropic
        import boto3

        from .s3_client import TranscriptStore

        s3 = boto3.client("s3", region_name=S3_REGION)
        transcript_store = TranscriptStore(s3, S3_BUCKET)
        anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        logger.info("Transcript store configured for s3://%s", S3_BUCKET)

        from .transcript_proxy import start_proxy

        proxy_port = int(TRANSCRIPT_PROXY_PORT)
        proxy_server = start_proxy(transcript_store, proxy_port)
        proxy_thread = threading.Thread(target=proxy_server.serve_forever, daemon=True)
        proxy_thread.start()
        logger.info("Transcript proxy started on port %d", proxy_port)

    try:
        loader_loop(
            db_path=DB_PATH,
            workspace_dir=WORKSPACE_DIR,
            repo_url=REPO_URL,
            github_token=GITHUB_TOKEN or None,
            jira_client=jira_client,
            transcript_store=transcript_store,
            anthropic_client=anthropic_client,
        )
    except KeyboardInterrupt:
        logger.info("Shutting down")
    finally:
        datasette_proc.terminate()
        datasette_proc.wait(timeout=10)


if __name__ == "__main__":
    main()
