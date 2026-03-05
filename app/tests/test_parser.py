import pathlib

from ai_manager.parser import (
    classify_work_item,
    extract_sections,
    parse_decision,
    parse_question,
    parse_yaml_frontmatter,
)


def test_parse_yaml_frontmatter(fixtures_dir):
    text = (fixtures_dir / "sample_bead.md").read_text()
    meta, content = parse_yaml_frontmatter(text)
    assert meta["id"] == "aim-abc1"
    assert meta["title"] == "Example scaffolding task"
    assert "Docker Compose" in content


def test_extract_sections():
    md = """## Decision

Use SQLite.

## Context

Need lightweight DB.

## Alternatives

PostgreSQL.
"""
    sections = extract_sections(md)
    assert "decision" in sections
    assert sections["decision"] == "Use SQLite."
    assert "context" in sections
    assert "alternatives" in sections


def test_classify_work_item_beads():
    path = pathlib.Path("/workspace/beads/aim-abc1/README.md")
    source, item_id = classify_work_item(path)
    assert source == "beads"
    assert item_id == "aim-abc1"


def test_classify_work_item_jira():
    path = pathlib.Path("/workspace/jira/EN-1234/README.md")
    source, item_id = classify_work_item(path)
    assert source == "jira"
    assert item_id == "EN-1234"


def test_parse_question(fixtures_dir):
    text = (fixtures_dir / "sample_question.md").read_text()
    q = parse_question(text, "aim-abc1", "sample_question.md")
    assert q.work_item_id == "aim-abc1"
    assert q.status == "open"
    assert q.raised_by == "dtarico"
    assert "cache Jira API" in q.question_text
    assert "Rate limiting" in q.context
    assert "rate limits" in q.impact


def test_parse_decision(fixtures_dir):
    text = (fixtures_dir / "sample_decision.md").read_text()
    d = parse_decision(text, "aim-abc1", "sample_decision.md")
    assert d.work_item_id == "aim-abc1"
    assert d.status == "current"
    assert d.decider == "engineering"
    assert "SQLite" in d.decision_text
    assert "architecture" in d.tags
    assert "database" in d.tags
    assert "PostgreSQL" in d.alternatives
