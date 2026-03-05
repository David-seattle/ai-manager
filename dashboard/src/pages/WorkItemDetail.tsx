import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

interface WorkItem {
  id: string;
  title: string;
}

export default function WorkItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchItem() {
      try {
        const res = await fetch(`/api/ai_manager/beads/${id}.json`);
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) setItem({ id: data.id ?? id!, title: data.title ?? "Untitled" });
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItem();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <p>Loading...</p>;

  if (notFound) {
    return (
      <div>
        <h1>Work item not found</h1>
        <p>No work item with ID &ldquo;{id}&rdquo; exists.</p>
        <Link to="/">Back to search</Link>
      </div>
    );
  }

  return (
    <div>
      <h1>{item!.title}</h1>
      <p>ID: {item!.id}</p>
      <Link to="/">Back to search</Link>
    </div>
  );
}
