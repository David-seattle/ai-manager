import { useEffect, useState } from "react";
import { Spinner, Text } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Question } from "../types/api";

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

  if (loading) return <Spinner label="Loading..." />;
  if (error) {
    return (
      <Text block style={{ color: "red" }}>
        Failed to load questions.
      </Text>
    );
  }

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 16 }}>
        Questions
      </Text>
      <DataTable
        columns={columns}
        data={questions}
        filterKeys={["question_text", "status", "raised_by"]}
        emptyMessage="No questions found"
        renderExpanded={(q) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {q.context && (
              <div>
                <Text weight="semibold">Context:</Text>
                <Text block style={{ color: "#4b5563", marginTop: 4 }}>
                  {q.context}
                </Text>
              </div>
            )}
            {q.impact && (
              <div>
                <Text weight="semibold">Impact:</Text>
                <Text block style={{ color: "#4b5563", marginTop: 4 }}>
                  {q.impact}
                </Text>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
