import { useEffect, useState } from "react";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Decision } from "../types/api";
import styles from "./DecisionsPage.module.css";

function parseTags(tags: string): string[] {
  try {
    const parsed: unknown = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const columns: Column<Decision>[] = [
  { key: "decision_text", header: "Decision", sortable: true },
  { key: "status", header: "Status", sortable: true },
  { key: "decider", header: "Decider", sortable: true },
  { key: "date", header: "Date", sortable: true },
  {
    key: "tags",
    header: "Tags",
    render: (value) => {
      const tags = parseTags(String(value ?? "[]"));
      return tags.map((tag) => (
        <span key={tag} className={styles.tag}>
          {tag}
        </span>
      ));
    },
  },
];

export default function DecisionsPage() {
  const { item } = useWorkItem();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    async function fetchDecisions() {
      try {
        const res = await fetch(
          `/api/ai_manager/decisions.json?work_item_id=${item!.id}&_shape=array`,
        );
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: Decision[] = await res.json();
        if (!cancelled) setDecisions(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDecisions();
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Failed to load decisions.</p>;

  return (
    <div>
      <h1>Decisions</h1>
      <DataTable
        columns={columns}
        data={decisions}
        filterKeys={["decision_text", "status", "decider"]}
        emptyMessage="No decisions found"
        renderExpanded={(d) => (
          <div className={styles.detail}>
            {d.problem_context && (
              <div>
                <strong>Problem Context:</strong>
                <p>{d.problem_context}</p>
              </div>
            )}
            {d.alternatives && (
              <div>
                <strong>Alternatives:</strong>
                <p>{d.alternatives}</p>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
