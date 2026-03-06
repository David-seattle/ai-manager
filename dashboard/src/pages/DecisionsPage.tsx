import { useEffect, useState } from "react";
import { Spinner, Text } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Decision } from "../types/api";

function parseTags(tags: string): string[] {
  try {
    const parsed: unknown = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const tagStyle = {
  display: "inline-block" as const,
  padding: "2px 8px",
  margin: "0 4px 2px 0",
  fontSize: 12,
  background: "#dbeafe",
  color: "#1e40af",
  borderRadius: 9999,
};

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
        <span key={tag} style={tagStyle}>
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

  if (loading) return <Spinner label="Loading..." />;
  if (error) {
    return (
      <Text block style={{ color: "red" }}>
        Failed to load decisions.
      </Text>
    );
  }

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 16 }}>
        Decisions
      </Text>
      <DataTable
        columns={columns}
        data={decisions}
        filterKeys={["decision_text", "status", "decider"]}
        emptyMessage="No decisions found"
        renderExpanded={(d) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {d.problem_context && (
              <div>
                <Text weight="semibold">Problem Context:</Text>
                <Text block style={{ color: "#4b5563", marginTop: 4 }}>
                  {d.problem_context}
                </Text>
              </div>
            )}
            {d.alternatives && (
              <div>
                <Text weight="semibold">Alternatives:</Text>
                <Text block style={{ color: "#4b5563", marginTop: 4 }}>
                  {d.alternatives}
                </Text>
              </div>
            )}
          </div>
        )}
      />
    </div>
  );
}
