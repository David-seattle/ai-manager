import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input, Text, Badge, Spinner } from "@fluentui/react-components";
import { Pin20Filled, Pin20Regular } from "@fluentui/react-icons";
import type { WorkItem } from "../types/api";
import { usePinnedCards } from "../hooks/usePinnedCards";

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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
} as const;

export default function Landing() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinFullMessage, setPinFullMessage] = useState(false);
  const navigate = useNavigate();
  const { pinnedIds, togglePin, isPinned, isFull, cleanupStale } = usePinnedCards();

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
        if (!cancelled) {
          setItems(data);
          cleanupStale(new Set(data.map((d) => d.id)));
        }
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
  }, [cleanupStale]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/workitem/${trimmed}`);
    }
  }

  function handleTogglePin(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!isPinned(id) && isFull) {
      setPinFullMessage(true);
      return;
    }
    setPinFullMessage(false);
    togglePin(id);
  }

  const pinnedItems = items.filter((item) => isPinned(item.id));
  // Sort pinned items by pin order (pinnedIds array order)
  pinnedItems.sort((a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id));
  const unpinnedItems = items.filter((item) => !isPinned(item.id));

  function renderCard(item: WorkItem, pinned: boolean) {
    return (
      <Link
        key={item.id}
        to={`/workitem/${item.id}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          data-pinned={pinned ? "true" : undefined}
          style={{
            border: "1px solid #e0e0e0",
            borderLeft: pinned ? "3px solid #106EBE" : "1px solid #e0e0e0",
            borderRadius: 8,
            padding: 16,
            background: pinned ? "#f0f6ff" : "#fff",
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
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
            <button
              type="button"
              aria-label={pinned ? `Unpin ${item.id}` : `Pin ${item.id}`}
              onClick={(e) => handleTogglePin(e, item.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                marginLeft: 8,
                display: "flex",
                alignItems: "center",
                color: pinned ? "#106EBE" : "#999",
              }}
            >
              {pinned ? <Pin20Filled /> : <Pin20Regular />}
            </button>
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
    );
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

        {pinFullMessage && (
          <Text block style={{ color: "#d13438", marginBottom: 12 }}>
            Unpin a card to make room.
          </Text>
        )}

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
          <>
            {pinnedItems.length > 0 && (
              <>
                <Text weight="semibold" size={400} block style={{ marginBottom: 8 }}>
                  Pinned
                </Text>
                <div style={gridStyle}>
                  {pinnedItems.map((item) => renderCard(item, true))}
                </div>
                <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "16px 0" }} />
              </>
            )}
            <div style={gridStyle}>
              {unpinnedItems.map((item) => renderCard(item, false))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
