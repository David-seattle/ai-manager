"""Parse transcript JSONL files into structured turns."""

import json
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TranscriptTurn:
    role: str  # "user" or "assistant"
    content: str
    timestamp: str | None = None


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        return " ".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ).strip()
    return ""


def parse_transcript(raw_jsonl: str) -> list[TranscriptTurn]:
    turns: list[TranscriptTurn] = []
    for raw_line in raw_jsonl.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            entry = json.loads(raw_line)
        except json.JSONDecodeError:
            logger.warning("Skipping malformed JSONL line: %s", raw_line[:200])
            continue

        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant"):
            continue

        message = entry.get("message", {})
        text = _extract_text(message.get("content", ""))
        if not text:
            continue

        turns.append(TranscriptTurn(
            role=entry_type,
            content=text,
            timestamp=entry.get("timestamp"),
        ))

    return turns
