import { useEffect, useState, useCallback } from "react";
import { Spinner, Text, Button } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Session, TranscriptEntry } from "../types/api";
import type { CSSProperties } from "react";

const columns: Column<Session>[] = [
  {
    key: "first_message_at",
    header: "Started",
    sortable: true,
    render: (v) => formatTimestamp(v as string),
  },
  {
    key: "last_message_at",
    header: "Last Message",
    sortable: true,
    render: (v) => formatTimestamp(v as string),
  },
  { key: "message_count", header: "Messages", sortable: true },
  { key: "summary", header: "Summary", sortable: true },
];

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function extractText(entry: TranscriptEntry): string {
  const content = entry.message?.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join(" ");
  }
  return "";
}

const PAGE_SIZE = 50;

const viewerStyle: CSSProperties = {
  marginTop: 24,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  overflow: "hidden",
};

const viewerHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  background: "#f5f5f5",
  borderBottom: "1px solid #e0e0e0",
};

const messagesStyle: CSSProperties = {
  padding: 16,
  maxHeight: 600,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const userMessageStyle: CSSProperties = {
  padding: 12,
  borderRadius: 6,
  fontSize: 14,
  background: "#eff6ff",
  borderLeft: "3px solid #3b82f6",
};

const assistantMessageStyle: CSSProperties = {
  padding: 12,
  borderRadius: 6,
  fontSize: 14,
  background: "#f0fdf4",
  borderLeft: "3px solid #22c55e",
};

const messageRoleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 4,
  textTransform: "uppercase",
};

const paginationStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 16,
  padding: 12,
  borderTop: "1px solid #e0e0e0",
  background: "#f5f5f5",
};

export default function SessionsPage() {
  const { item } = useWorkItem();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    async function fetchSessions() {
      try {
        const sql = `SELECT s.session_id, s.summary, s.first_message_at, s.last_message_at, s.message_count FROM sessions s INNER JOIN session_work_items sw ON s.session_id = sw.session_id WHERE sw.work_item_id = :wid ORDER BY s.first_message_at DESC`;
        const res = await fetch(
          `/api/ai_manager.json?sql=${encodeURIComponent(sql)}&wid=${encodeURIComponent(item!.id)}&_shape=array`,
        );
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: Session[] = await res.json();
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [item]);

  const loadTranscript = useCallback(async (sessionId: string) => {
    setActiveSession(sessionId);
    setTranscriptLoading(true);
    setTranscriptError(false);
    setPage(0);

    try {
      const res = await fetch(`/transcript/${sessionId}`);
      if (!res.ok) {
        setTranscriptError(true);
        return;
      }
      const data = await res.json();
      const raw: string = data.content;
      const entries: TranscriptEntry[] = [];
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === "user" || entry.type === "assistant") {
            entries.push(entry);
          }
        } catch {
          // skip malformed lines
        }
      }
      setTranscript(entries);
    } catch {
      setTranscriptError(true);
    } finally {
      setTranscriptLoading(false);
    }
  }, []);

  const totalPages = Math.ceil(transcript.length / PAGE_SIZE);
  const pagedEntries = transcript.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <Spinner label="Loading..." />;
  if (error) {
    return (
      <Text block style={{ color: "red" }}>
        Failed to load sessions.
      </Text>
    );
  }

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 16 }}>
        Sessions
      </Text>
      <DataTable
        columns={columns}
        data={sessions}
        filterKeys={["summary"]}
        emptyMessage="No sessions found"
        renderExpanded={(s) => (
          <div style={{ padding: "8px 0" }}>
            <Button
              appearance="primary"
              size="small"
              onClick={() => loadTranscript(s.session_id)}
            >
              View Transcript
            </Button>
          </div>
        )}
      />

      {activeSession && (
        <div style={viewerStyle} data-testid="transcript-viewer">
          <div style={viewerHeaderStyle}>
            <Text as="h2" size={400} weight="semibold">
              Transcript: {activeSession}
            </Text>
            <Button
              appearance="subtle"
              size="small"
              onClick={() => setActiveSession(null)}
              aria-label="Close transcript"
            >
              Close
            </Button>
          </div>

          {transcriptLoading && (
            <div style={{ padding: 16 }}>
              <Spinner label="Loading transcript..." />
            </div>
          )}
          {transcriptError && (
            <Text block style={{ padding: 16, color: "red" }}>
              Failed to load transcript.
            </Text>
          )}

          {!transcriptLoading && !transcriptError && transcript.length > 0 && (
            <>
              <div style={messagesStyle}>
                {pagedEntries.map((entry, i) => (
                  <div
                    key={page * PAGE_SIZE + i}
                    style={
                      entry.type === "user"
                        ? userMessageStyle
                        : assistantMessageStyle
                    }
                  >
                    <div style={messageRoleStyle}>
                      {entry.type === "user" ? "User" : "Assistant"}
                      {entry.timestamp && (
                        <span
                          style={{
                            fontWeight: 400,
                            marginLeft: 8,
                            textTransform: "none" as const,
                          }}
                        >
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        lineHeight: 1.5,
                      }}
                    >
                      {extractText(entry)}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div style={paginationStyle}>
                  <Button
                    appearance="subtle"
                    size="small"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Text size={200} style={{ color: "#6b7280" }}>
                    Page {page + 1} of {totalPages}
                  </Text>
                  <Button
                    appearance="subtle"
                    size="small"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}

          {!transcriptLoading &&
            !transcriptError &&
            transcript.length === 0 && (
              <Text block style={{ padding: 16, color: "#666" }}>
                No messages in this transcript.
              </Text>
            )}
        </div>
      )}
    </div>
  );
}
