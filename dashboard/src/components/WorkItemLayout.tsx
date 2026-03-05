import { useEffect, useState } from "react";
import { useParams, Outlet, Navigate } from "react-router-dom";
import { WorkItemContext } from "../context/WorkItemContext";
import type { WorkItem } from "../types/api";
import Sidebar from "./Sidebar";
import styles from "./WorkItemLayout.module.css";

export default function WorkItemLayout() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/ai_manager/work_items/${id}.json`);
        if (!res.ok) {
          if (!cancelled) setError("not_found");
          return;
        }
        const data: WorkItem = await res.json();
        if (!cancelled) setItem(data);
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

  if (loading) return <p>Loading...</p>;

  if (error) {
    return (
      <div className={styles.error}>
        <h1>Work item not found</h1>
        <p>
          No work item with ID &ldquo;{id}&rdquo; exists.
        </p>
        <a href="/">Back to search</a>
      </div>
    );
  }

  return (
    <WorkItemContext.Provider value={{ item, loading, error }}>
      <div className={styles.layout}>
        <Sidebar workItemId={id!} />
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </WorkItemContext.Provider>
  );
}

export function WorkItemIndex() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/workitem/${id}/overview`} replace />;
}
