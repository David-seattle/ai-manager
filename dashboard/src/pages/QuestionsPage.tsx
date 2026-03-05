import { useEffect, useState } from "react";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Question } from "../types/api";
import styles from "./QuestionsPage.module.css";

const columns: Column<Question>[] = [
  { key: "question_text", header: "Question", sortable: true },
  { key: "status", header: "Status", sortable: true },
  { key: "raised_by", header: "Raised By", sortable: true },
  { key: "raised_date", header: "Date", sortable: true },
];

export default function QuestionsPage() {
  const { item } = useWorkItem();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    async function fetchQuestions() {
      try {
        const res = await fetch(
          `/api/ai_manager/questions.json?work_item_id=${item!.id}&_shape=array`,
        );
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: Question[] = await res.json();
        if (!cancelled) setQuestions(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Failed to load questions.</p>;

  return (
    <div>
      <h1>Questions</h1>
      <DataTable
        columns={columns}
        data={questions}
        filterKeys={["question_text", "status", "raised_by"]}
        emptyMessage="No questions found"
        renderExpanded={(q) => (
          <div className={styles.detail}>
            {q.context && (
              <div>
                <strong>Context:</strong>
                <p>{q.context}</p>
              </div>
            )}
            {q.impact && (
              <div>
                <strong>Impact:</strong>
                <p>{q.impact}</p>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
