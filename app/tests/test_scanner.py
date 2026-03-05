from ai_manager.scanner import scan_workspace


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
