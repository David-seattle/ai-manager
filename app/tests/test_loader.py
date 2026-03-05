from ai_manager.loader import run_sync_cycle
from ai_manager.schema import create_tables


def test_run_sync_cycle(in_memory_db, fixtures_dir):
    create_tables(in_memory_db)
    workspace = fixtures_dir / "workspace"

    run_sync_cycle(in_memory_db, workspace)

    items = in_memory_db.execute("SELECT id, source, title FROM work_items ORDER BY id").fetchall()
    assert len(items) == 2
    assert items[0][0] == "EN-1234"
    assert items[0][1] == "jira"
    assert items[1][0] == "aim-abc1"
    assert items[1][1] == "beads"

    docs = in_memory_db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    assert docs == 2

    questions = in_memory_db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    assert questions == 1

    decisions = in_memory_db.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]
    assert decisions == 1


def test_run_sync_cycle_idempotent(in_memory_db, fixtures_dir):
    create_tables(in_memory_db)
    workspace = fixtures_dir / "workspace"

    run_sync_cycle(in_memory_db, workspace)
    run_sync_cycle(in_memory_db, workspace)

    items = in_memory_db.execute("SELECT COUNT(*) FROM work_items").fetchone()[0]
    assert items == 2

    docs = in_memory_db.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    assert docs == 2
