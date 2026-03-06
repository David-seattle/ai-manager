import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Spinner, Text } from "@fluentui/react-components";
import { WorkItemContext } from "../context/WorkItemContext";
import type { WorkItem } from "../types/api";
import Layout from "./Layout";

export default function WorkItemLayout() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchItem() {
      try {
        const res = await fetch(
          `/api/ai_manager/work_items.json?id=${id}&_shape=array`,
        );
        if (!res.ok) {
          if (!cancelled) setError("not_found");
          return;
        }
        const data: WorkItem[] = await res.json();
        if (!cancelled) {
          const first = data[0];
          if (data.length === 0 || !first) {
            setError("not_found");
          } else {
            setItem(first);
          }
        }
      } catch {
        if (!cancelled) setError("network");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItem();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spinner label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 8 }}>
          Work item not found
        </Text>
        <Text block style={{ color: "#666", marginBottom: 16 }}>
          No work item with ID &ldquo;{id}&rdquo; exists.
        </Text>
        <a href="/" style={{ color: "#106EBE", textDecoration: "none" }}>
          Back to search
        </a>
      </div>
    );
  }

  return (
    <WorkItemContext.Provider value={{ item, loading, error }}>
      <Layout workItemId={id!} />
    </WorkItemContext.Provider>
  );
}

export function WorkItemIndex() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/workitem/${id}/overview`} replace />;
}
