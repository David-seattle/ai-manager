import json
from dataclasses import dataclass, field


@dataclass
class WorkItem:
    id: str
    source: str  # "beads" or "jira"
    title: str
    description: str = ""
    path: str = ""
    status: str = ""
    priority: str = ""
    assignee: str = ""
    created_at: str | None = None
    updated_at: str | None = None


@dataclass
class Document:
    work_item_id: str
    doc_type: str
    filename: str
    content: str
    updated_at: str | None = None


@dataclass
class QuestionRecord:
    work_item_id: str
    filename: str
    question_text: str
    status: str = "open"
    raised_by: str | None = None
    raised_date: str | None = None
    source: str | None = None
    resolved_date: str | None = None
    resolved_by: str | None = None
    context: str = ""
    impact: str = ""
    raw_content: str = ""


@dataclass
class DecisionRecord:
    work_item_id: str
    filename: str
    decision_text: str
    status: str = "current"
    decider_type: str | None = None
    decider: str | None = None
    date: str | None = None
    superseded_by: str | None = None
    tags: list[str] = field(default_factory=list)
    problem_context: str = ""
    alternatives: str = ""
    raw_content: str = ""

    def tags_json(self) -> str:
        return json.dumps(self.tags)
