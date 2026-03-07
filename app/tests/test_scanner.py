import json
import shutil

from ai_manager.scanner import scan_work_item_dir, scan_workspace


def test_scan_workspace(fixtures_dir):
    workspace = fixtures_dir / "workspace"
    items, docs, questions, decisions = scan_workspace(workspace)

    assert len(items) == 2

    beads_item = next(i for i in items if i.source == "beads")
    assert beads_item.id == "aim-abc1"
    assert beads_item.title == "Example scaffolding task"

    jira_item = next(i for i in items if i.source == "jira")
    assert jira_item.id == "EN-1234"
    assert jira_item.title == "Implement data pipeline for supplier normalization"

    assert len(docs) == 2
    doc_types = {d.doc_type for d in docs}
    assert "functional" in doc_types
    assert "acceptance-criteria" in doc_types

    assert len(questions) == 1
    assert questions[0].work_item_id == "aim-abc1"
    assert "caching" in questions[0].question_text.lower()

    assert len(decisions) == 1
    assert decisions[0].work_item_id == "aim-abc1"
    assert "SQLite" in decisions[0].decision_text


def test_bead_json_enriches_work_item(fixtures_dir):
    """bead.json overrides frontmatter for status, assignee, timestamps, and sets issue_type."""
    item_dir = fixtures_dir / "workspace" / "beads" / "aim-abc1"
    item, _, _, _ = scan_work_item_dir(item_dir, "beads", "aim-abc1")

    assert item.issue_type == "task"
    assert item.status == "in_progress"
    assert item.assignee == "ai_manager/polecats/quartz"
    assert item.created_at == "2026-03-01T00:00:00Z"
    assert item.updated_at == "2026-03-05T12:00:00Z"
    assert item.priority == "2"


def test_bead_json_missing_falls_back_to_frontmatter(fixtures_dir, tmp_path):
    """Without bead.json, scanner uses frontmatter from .md files."""
    item_dir = tmp_path / "aim-xyz9"
    item_dir.mkdir()
    (item_dir / "README.md").write_text(
        "---\ntitle: From frontmatter\nstatus: open\n---\nBody text.\n"
    )

    item, _, _, _ = scan_work_item_dir(item_dir, "beads", "aim-xyz9")

    assert item.title == "From frontmatter"
    assert item.status == "open"
    assert item.issue_type == ""
    assert item.description == "Body text."


def test_bead_json_only_no_markdown(tmp_path):
    """bead.json alone (no .md) populates all metadata."""
    item_dir = tmp_path / "aim-solo"
    item_dir.mkdir()
    (item_dir / "bead.json").write_text(json.dumps({
        "id": "aim-solo",
        "title": "Solo bead",
        "description": "Only bead.json, no markdown.",
        "status": "closed",
        "issue_type": "bug",
        "priority": 1,
        "assignee": "someone",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-02-01T00:00:00Z",
    }))

    item, _, _, _ = scan_work_item_dir(item_dir, "beads", "aim-solo")

    assert item.title == "Solo bead"
    assert item.description == "Only bead.json, no markdown."
    assert item.status == "closed"
    assert item.issue_type == "bug"
    assert item.priority == "1"
    assert item.assignee == "someone"


def test_bead_json_malformed_ignored(tmp_path):
    """Malformed bead.json is silently ignored, falls back to defaults."""
    item_dir = tmp_path / "aim-bad"
    item_dir.mkdir()
    (item_dir / "bead.json").write_text("not valid json {{{")

    item, _, _, _ = scan_work_item_dir(item_dir, "beads", "aim-bad")

    assert item.title == "aim-bad"
    assert item.issue_type == ""


def test_scan_workspace_namespaced_beads(fixtures_dir, tmp_path):
    """Scanner should recurse into per-user namespace dirs (beads/<owner>/<bead-id>/)."""
    workspace = tmp_path / "workspace"
    # Copy jira as-is (flat structure)
    shutil.copytree(fixtures_dir / "workspace" / "jira", workspace / "jira")
    # Create namespaced beads: beads/dtarico/aim-abc1/
    namespaced = workspace / "beads" / "dtarico"
    shutil.copytree(fixtures_dir / "workspace" / "beads" / "aim-abc1", namespaced / "aim-abc1")

    items, docs, questions, decisions = scan_workspace(workspace)

    assert len(items) == 2
    beads_item = next(i for i in items if i.source == "beads")
    assert beads_item.id == "aim-abc1"
    assert beads_item.title == "Example scaffolding task"
