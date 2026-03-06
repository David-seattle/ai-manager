import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input, Text, Badge, Spinner } from "@fluentui/react-components";
import type { WorkItem } from "../types/api";

function statusColor(status: string): "brand" | "success" | "warning" | "danger" | "informative" {
  switch (status?.toLowerCase()) {
    case "done":
    case "closed":
    case "resolved":
      return "success";
    case "in_progress":
    case "in progress":
      return "brand";
    case "blocked":
      return "danger";
    case "open":
    case "new":
      return "warning";
    default:
      return "informative";
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "\u2026";
}

export default function Landing() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        const res = await fetch(
          "/api/ai_manager/work_items.json?_shape=array&_sort_desc=updated_at&_size=30",
        );
        if (!res.ok) {
          if (!cancelled) setError("Failed to load work items");
          return;
        }
        const data: WorkItem[] = await res.json();
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setError("Failed to load work items");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItems();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/workitem/${trimmed}`);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          height: 48,
          background: "#106EBE",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>AI Manager</span>
      </header>

      <div style={{ maxWidth: 960, width: "100%", margin: "0 auto", padding: "24px 16px" }}>
        <Text as="h1" size={800} weight="bold" style={{ marginBottom: 16 }}>
          Work Items
        </Text>

        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <Input
            type="text"
            value={query}
            onChange={(_e, d) => setQuery(d.value)}
            placeholder="Search work item by ID..."
            aria-label="Work item ID"
            style={{ width: "100%", maxWidth: 480 }}
            size="large"
          />
        </form>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spinner label="Loading work items..." />
          </div>
        )}

        {error && (
          <Text block style={{ color: "#666" }}>
            {error}
          </Text>
        )}

        {!loading && !error && items.length === 0 && (
          <Text block style={{ color: "#666" }}>
            No work items found.
          </Text>
        )}

        {!loading && !error && items.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/workitem/${item.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    border: "1px solid #e0e0e0",
                    borderRadius: 8,
                    padding: 16,
                    background: "#fff",
                    cursor: "pointer",
                    transition: "box-shadow 0.15s",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    {item.status && (
                      <Badge appearance="filled" color={statusColor(item.status)}>
                        {item.status}
                      </Badge>
                    )}
                    {item.issue_type && (
                      <Badge appearance="outline" style={{ marginLeft: "auto" }}>
                        {item.issue_type}
                      </Badge>
                    )}
                  </div>

                  <Text weight="semibold" size={400} block style={{ marginBottom: 8 }}>
                    {item.title || item.id}
                  </Text>

                  {item.description && (
                    <Text
                      size={200}
                      block
                      style={{ color: "#666", lineHeight: 1.4, flex: 1 }}
                    >
                      {truncate(item.description, 120)}
                    </Text>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
