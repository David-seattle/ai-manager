import json
import logging
import pathlib
from datetime import datetime, timezone

from .models import Session
from .schema import get_session_etags, upsert_session

logger = logging.getLogger(__name__)


def extract_conversation_text(raw_jsonl: str) -> tuple[str, str | None, str | None, int]:
    lines: list[str] = []
    first_ts: str | None = None
    last_ts: str | None = None
    message_count = 0

    for raw_line in raw_jsonl.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            entry = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant"):
            continue

        message_count += 1
        ts = entry.get("timestamp")
        if ts:
            if first_ts is None:
                first_ts = ts
            last_ts = ts

        message = entry.get("message", {})
        content = message.get("content", "")

        if entry_type == "user":
            if isinstance(content, str):
                text = content.strip()
            elif isinstance(content, list):
                text = " ".join(
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                ).strip()
            else:
                continue
            if text:
                lines.append(f"User: {text}")

        elif entry_type == "assistant":
            if isinstance(content, list):
                text = " ".join(
                    block.get("text", "")
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                ).strip()
            elif isinstance(content, str):
                text = content.strip()
            else:
                continue
            if text:
                lines.append(f"Assistant: {text}")

    return "\n\n".join(lines), first_ts, last_ts, message_count


def truncate_text(text: str, max_chars: int = 8000) -> str:
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_break = truncated.rfind("\n\n")
    if last_break > max_chars // 2:
        truncated = truncated[:last_break]
    return truncated + "\n\n[...truncated]"


def summarize_transcript(anthropic_client, transcript_text: str) -> str:
    response = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        messages=[
            {
                "role": "user",
                "content": (
                    "Summarize this conversation in 1-2 sentences. "
                    "Focus on what the user was trying to accomplish.\n\n"
                    + transcript_text
                ),
            }
        ],
    )
    return response.content[0].text.strip()


def list_local_work_item_links(workspace_dir: pathlib.Path, session_id: str) -> list[str]:
    workitems_dir = workspace_dir / "conversations" / session_id / "workitems"
    if not workitems_dir.is_dir():
        return []
    return [f.name for f in workitems_dir.iterdir() if f.is_file()]


def sync_sessions(conn, transcript_store, anthropic_client, max_new_per_cycle: int = 10, workspace_dir: pathlib.Path | None = None) -> int:
    known_etags = get_session_etags(conn)
    s3_objects = transcript_store.list_sessions()

    processed = 0
    for obj in s3_objects:
        session_id = transcript_store.session_id_from_key(obj.key)

        if known_etags.get(session_id) == obj.etag:
            continue

        if processed >= max_new_per_cycle:
            break

        try:
            raw = transcript_store.download_transcript(session_id)
            text, first_ts, last_ts, msg_count = extract_conversation_text(raw)
            truncated = truncate_text(text)

            summary = ""
            if truncated.strip():
                summary = summarize_transcript(anthropic_client, truncated)

            if workspace_dir:
                work_item_ids = list_local_work_item_links(workspace_dir, session_id)
            else:
                work_item_ids = transcript_store.list_work_item_links(session_id)

            session = Session(
                session_id=session_id,
                etag=obj.etag,
                summary=summary,
                first_message_at=first_ts,
                last_message_at=last_ts,
                message_count=msg_count,
                cataloged_at=datetime.now(timezone.utc).isoformat(),
                work_item_ids=work_item_ids,
            )
            with conn:
                upsert_session(conn, session)
            processed += 1
            logger.info("Cataloged session %s (%d messages)", session_id, msg_count)
        except Exception:
            logger.exception("Failed to process session %s", session_id)
            continue

    return processed
