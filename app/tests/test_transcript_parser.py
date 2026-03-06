import json
import logging

from ai_manager.transcript_parser import TranscriptTurn, parse_transcript


def _jsonl(*entries):
    return "\n".join(json.dumps(e) for e in entries)


def test_parses_user_and_assistant_turns():
    raw = _jsonl(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "Hello"}},
        {"type": "assistant", "timestamp": "2025-01-01T10:00:05Z",
         "message": {"content": [{"type": "text", "text": "Hi there"}]}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 2
    assert turns[0] == TranscriptTurn(role="user", content="Hello", timestamp="2025-01-01T10:00:00Z")
    assert turns[1] == TranscriptTurn(role="assistant", content="Hi there", timestamp="2025-01-01T10:00:05Z")


def test_filters_non_conversation_types():
    raw = _jsonl(
        {"type": "file-history-snapshot", "timestamp": "2025-01-01T10:00:00Z"},
        {"type": "progress", "data": {}},
        {"type": "user", "timestamp": "2025-01-01T10:00:01Z",
         "message": {"content": "test"}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 1
    assert turns[0].role == "user"
    assert turns[0].content == "test"


def test_filters_tool_use_blocks_extracts_text():
    raw = _jsonl(
        {"type": "assistant", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": [
             {"type": "text", "text": "Let me check"},
             {"type": "tool_use", "name": "Read", "input": {}},
             {"type": "thinking", "thinking": "hmm"},
         ]}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 1
    assert turns[0].content == "Let me check"


def test_skips_empty_content():
    raw = _jsonl(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": ""}},
        {"type": "assistant", "timestamp": "2025-01-01T10:00:01Z",
         "message": {"content": [{"type": "tool_use", "name": "Bash"}]}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 0


def test_empty_input():
    turns = parse_transcript("")
    assert turns == []


def test_preserves_timestamps():
    raw = _jsonl(
        {"type": "user", "message": {"content": "no timestamp"}},
        {"type": "user", "timestamp": "2025-06-15T12:00:00Z",
         "message": {"content": "with timestamp"}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 2
    assert turns[0].timestamp is None
    assert turns[1].timestamp == "2025-06-15T12:00:00Z"


def test_handles_malformed_lines():
    raw = "not json\n" + json.dumps(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "valid"}}
    )
    turns = parse_transcript(raw)
    assert len(turns) == 1
    assert turns[0].content == "valid"


def test_malformed_line_logs_warning(caplog):
    raw = "not json\n" + json.dumps(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "valid"}}
    )
    with caplog.at_level(logging.WARNING, logger="ai_manager.transcript_parser"):
        parse_transcript(raw)
    assert any("Skipping malformed JSONL line" in r.message for r in caplog.records)


def test_empty_transcript():
    turns = parse_transcript("")
    assert turns == []


def test_user_only_turns():
    raw = _jsonl(
        {"type": "user", "timestamp": "2025-01-01T10:00:00Z",
         "message": {"content": "first"}},
        {"type": "user", "timestamp": "2025-01-01T10:01:00Z",
         "message": {"content": "second"}},
    )
    turns = parse_transcript(raw)
    assert len(turns) == 2
    assert all(t.role == "user" for t in turns)


def test_ten_turn_conversation():
    entries = []
    for i in range(10):
        role = "user" if i % 2 == 0 else "assistant"
        entries.append({
            "type": role,
            "timestamp": f"2025-01-01T10:{i:02d}:00Z",
            "message": {"content": f"Message {i}"},
        })
    raw = _jsonl(*entries)
    turns = parse_transcript(raw)
    assert len(turns) == 10
    for i, turn in enumerate(turns):
        expected_role = "user" if i % 2 == 0 else "assistant"
        assert turn.role == expected_role
        assert turn.content == f"Message {i}"
