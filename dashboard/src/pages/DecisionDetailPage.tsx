import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner, Text } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";
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

const metaRowStyle = {
  display: "flex" as const,
  gap: 24,
  flexWrap: "wrap" as const,
  marginBottom: 16,
  padding: "12px 16px",
  background: "#f9fafb",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
};

const metaItemStyle = {
  display: "flex" as const,
  flexDirection: "column" as const,
  gap: 2,
};

export default function DecisionDetailPage() {
  const { filename } = useParams<{ filename: string }>();
  const { item } = useWorkItem();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    async function fetchDecision() {
      try {
        const res = await fetch(
          `/api/ai_manager/decisions.json?work_item_id=${item!.id}&_shape=array`,
        );
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: Decision[] = await res.json();
        const match = data.find(
          (d) => d.filename === `${filename}.md` || d.filename === filename,
        );
        if (!cancelled) setDecision(match ?? null);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDecision();
    return () => {
      cancelled = true;
    };
  }, [item, filename]);

  if (loading) return <Spinner label="Loading..." />;
  if (error) {
    return (
      <Text block style={{ color: "red" }}>
        Failed to load decision.
      </Text>
    );
  }
  if (!decision) {
    return (
      <div>
        <Text as="h1" size={700} weight="bold" block>
          Decision
        </Text>
        <Text block style={{ color: "#666" }}>
          Decision not found.
        </Text>
      </div>
    );
  }

  const tags = parseTags(decision.tags);

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 16 }}>
        {decision.decision_text}
      </Text>

      <div style={metaRowStyle}>
        <div style={metaItemStyle}>
          <Text size={200} style={{ color: "#6b7280" }}>Status</Text>
          <Text weight="semibold">{decision.status}</Text>
        </div>
        <div style={metaItemStyle}>
          <Text size={200} style={{ color: "#6b7280" }}>Decider</Text>
          <Text weight="semibold">{decision.decider}</Text>
        </div>
        <div style={metaItemStyle}>
          <Text size={200} style={{ color: "#6b7280" }}>Date</Text>
          <Text weight="semibold">{decision.date}</Text>
        </div>
        {tags.length > 0 && (
          <div style={metaItemStyle}>
            <Text size={200} style={{ color: "#6b7280" }}>Tags</Text>
            <div>
              {tags.map((tag) => (
                <span key={tag} style={tagStyle}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Markdown remarkPlugins={[remarkGfm]}>
        {decision.raw_content.replace(/^---\n[\s\S]*?\n---\n/, "")}
      </Markdown>
    </div>
  );
}
