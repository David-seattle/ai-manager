import json
import pathlib

from .models import DecisionRecord, Document, QuestionRecord, WorkItem
from .parser import (
    classify_work_item,
    parse_decision,
    parse_question,
    parse_yaml_frontmatter,
)


def _read_bead_json(item_dir: pathlib.Path) -> dict:
    bead_file = item_dir / "bead.json"
    if not bead_file.exists():
        return {}
    try:
        return json.loads(bead_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def scan_work_item_dir(
    item_dir: pathlib.Path, source: str, item_id: str
) -> tuple[WorkItem, list[Document], list[QuestionRecord], list[DecisionRecord]]:
    # Read the main item file if it exists (e.g. item_dir/README.md or any .md at top level)
    title = item_id
    description = ""
    status = ""
    issue_type = ""
    priority = ""
    assignee = ""
    created_at = None
    updated_at = None

    top_level_mds = sorted(item_dir.glob("*.md"))
    if top_level_mds:
        text = top_level_mds[0].read_text(encoding="utf-8")
        meta, body = parse_yaml_frontmatter(text)
        title = meta.get("title", meta.get("summary", meta.get("key", item_id)))
        description = body.strip()
        status = meta.get("status", "")
        issue_type = meta.get("type", meta.get("issue_type", ""))
        priority = str(meta.get("priority", ""))
        assignee = meta.get("assignee", "")
        created_at = str(meta.get("created", "")) or None
        updated_at = str(meta.get("updated", "")) or None

    # bead.json is authoritative — overrides frontmatter when present
    bead_meta = _read_bead_json(item_dir)
    if bead_meta:
        title = bead_meta.get("title", title)
        description = bead_meta.get("description", description)
        status = bead_meta.get("status", status)
        issue_type = bead_meta.get("issue_type", issue_type)
        priority = str(bead_meta.get("priority", "")) or priority
        assignee = bead_meta.get("assignee", "") or assignee
        created_at = bead_meta.get("created_at") or created_at
        updated_at = bead_meta.get("updated_at") or updated_at

    work_item = WorkItem(
        id=item_id,
        source=source,
        issue_type=issue_type,
        title=title,
        description=description,
        path=str(item_dir),
        status=status,
        priority=priority,
        assignee=assignee,
        created_at=created_at,
        updated_at=updated_at,
    )

    documents: list[Document] = []
    questions: list[QuestionRecord] = []
    decisions: list[DecisionRecord] = []

    # Parse requirements documents
    req_dir = item_dir / "requirements"
    if req_dir.exists():
        for md_file in sorted(req_dir.glob("*.md")):
            content = md_file.read_text(encoding="utf-8")
            documents.append(Document(
                work_item_id=item_id,
                doc_type=md_file.stem,
                filename=md_file.name,
                content=content,
            ))

    # Parse decisions
    dec_dir = item_dir / "decisions"
    if dec_dir.exists():
        for md_file in sorted(dec_dir.glob("*.md")):
            if md_file.name == ".gitkeep":
                continue
            content = md_file.read_text(encoding="utf-8")
            decisions.append(parse_decision(content, item_id, md_file.name))

    # Parse questions (support both open-questions/ and questions/)
    for q_dir_name in ("open-questions", "questions"):
        q_dir = item_dir / q_dir_name
        if q_dir.exists():
            for md_file in sorted(q_dir.glob("*.md")):
                if md_file.name == ".gitkeep":
                    continue
                content = md_file.read_text(encoding="utf-8")
                questions.append(parse_question(content, item_id, md_file.name))

    return work_item, documents, questions, decisions


def scan_workspace(
    root: pathlib.Path,
) -> tuple[list[WorkItem], list[Document], list[QuestionRecord], list[DecisionRecord]]:
    all_items: list[WorkItem] = []
    all_docs: list[Document] = []
    all_questions: list[QuestionRecord] = []
    all_decisions: list[DecisionRecord] = []

    for source_dir_name in ("beads", "jira"):
        source_dir = root / source_dir_name
        if not source_dir.exists():
            continue

        for item_dir in sorted(source_dir.iterdir()):
            if not item_dir.is_dir():
                continue

            # Support per-user namespacing: beads/<owner>/<bead-id>/
            # If directory has no requirements/decisions/questions subdirs and no .md files,
            # treat it as a namespace directory and recurse into its children.
            has_content = (
                (item_dir / "requirements").exists()
                or (item_dir / "decisions").exists()
                or (item_dir / "questions").exists()
                or any(item_dir.glob("*.md"))
            )
            if has_content:
                dirs_to_scan = [item_dir]
            else:
                dirs_to_scan = sorted(d for d in item_dir.iterdir() if d.is_dir())

            for scan_dir in dirs_to_scan:
                source, item_id = classify_work_item(scan_dir / "_")
                item, docs, questions, decisions = scan_work_item_dir(scan_dir, source, item_id)
                all_items.append(item)
                all_docs.extend(docs)
                all_questions.extend(questions)
                all_decisions.extend(decisions)

    return all_items, all_docs, all_questions, all_decisions
