import pathlib
import re

import frontmatter

from .models import DecisionRecord, QuestionRecord


def parse_yaml_frontmatter(text: str) -> tuple[dict, str]:
    post = frontmatter.loads(text)
    return dict(post.metadata), post.content


def extract_sections(markdown: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    for line in markdown.split("\n"):
        heading_match = re.match(r"^##\s+(.+)$", line)
        if heading_match:
            if current_key is not None:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = heading_match.group(1).strip().lower()
            current_lines = []
        elif current_key is not None:
            current_lines.append(line)

    if current_key is not None:
        sections[current_key] = "\n".join(current_lines).strip()

    return sections


def classify_work_item(path: pathlib.Path) -> tuple[str, str]:
    parent_name = path.parent.name
    if "jira" in path.parts:
        return "jira", parent_name
    if "beads" in path.parts:
        return "beads", parent_name
    return "unknown", parent_name


def _frontmatter_str(meta: dict, key: str) -> str | None:
    val = meta.get(key)
    if val is None:
        return None
    return str(val)


def parse_question(text: str, work_item_id: str, filename: str) -> QuestionRecord:
    meta, content = parse_yaml_frontmatter(text)
    sections = extract_sections(content)

    return QuestionRecord(
        work_item_id=work_item_id,
        filename=filename,
        question_text=sections.get("question", ""),
        status=meta.get("status", "open"),
        raised_by=_frontmatter_str(meta, "raised-by"),
        raised_date=_frontmatter_str(meta, "raised-date"),
        source=_frontmatter_str(meta, "source"),
        resolved_date=_frontmatter_str(meta, "resolved-date"),
        resolved_by=_frontmatter_str(meta, "resolved-by"),
        context=sections.get("context", ""),
        impact=sections.get("impact", ""),
        raw_content=text,
    )


def parse_decision(text: str, work_item_id: str, filename: str) -> DecisionRecord:
    meta, content = parse_yaml_frontmatter(text)
    sections = extract_sections(content)

    tags_raw = meta.get("tags", [])
    if isinstance(tags_raw, str):
        tags_raw = [t.strip() for t in tags_raw.split(",")]

    return DecisionRecord(
        work_item_id=work_item_id,
        filename=filename,
        decision_text=sections.get("decision", ""),
        status=meta.get("status", "current"),
        decider_type=_frontmatter_str(meta, "decider-type"),
        decider=_frontmatter_str(meta, "decider"),
        date=_frontmatter_str(meta, "date"),
        superseded_by=_frontmatter_str(meta, "superseded-by"),
        tags=tags_raw,
        problem_context=sections.get("problem / context", sections.get("context", "")),
        alternatives=sections.get("alternatives considered", ""),
        raw_content=text,
    )
