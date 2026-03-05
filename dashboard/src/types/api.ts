export interface WorkItem {
  id: string;
  source: string;
  title: string;
  description: string;
  path: string;
  status: string;
  priority: string;
  assignee: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  work_item_id: string;
  doc_type: string;
  filename: string;
  content: string;
  updated_at: string;
}

export interface Question {
  work_item_id: string;
  filename: string;
  question_text: string;
  status: string;
  raised_by: string;
  raised_date: string;
  source: string;
  resolved_date: string;
  resolved_by: string;
  context: string;
  impact: string;
  raw_content: string;
}

export interface Decision {
  work_item_id: string;
  filename: string;
  decision_text: string;
  status: string;
  decider_type: string;
  decider: string;
  date: string;
  superseded_by: string;
  tags: string;
  problem_context: string;
  alternatives: string;
  raw_content: string;
}
