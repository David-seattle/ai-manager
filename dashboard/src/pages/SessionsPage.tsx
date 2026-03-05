import { useEffect, useState, useCallback } from "react";
import { useWorkItem } from "../hooks/useWorkItem";
import DataTable, { type Column } from "../components/DataTable";
import type { Session, TranscriptEntry } from "../types/api";
import styles from "./SessionsPage.module.css";

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Failed to load sessions.</p>;

  return (
    <div>
      <h1>Sessions</h1>
      <DataTable
        columns={columns}
        data={sessions}
        filterKeys={["summary"]}
        emptyMessage="No sessions found"
        renderExpanded={(s) => (
          <div className={styles.expandedActions}>
            <button
              className={styles.viewBtn}
              onClick={() => loadTranscript(s.session_id)}
            >
              View Transcript
            </button>
          </div>
        )}
      />

      {activeSession && (
        <div className={styles.viewer} data-testid="transcript-viewer">
          <div className={styles.viewerHeader}>
            <h2>Transcript: {activeSession}</h2>
            <button
              className={styles.closeBtn}
              onClick={() => setActiveSession(null)}
              aria-label="Close transcript"
            >
              Close
            </button>
          </div>

          {transcriptLoading && <p>Loading transcript...</p>}
          {transcriptError && <p>Failed to load transcript.</p>}

          {!transcriptLoading && !transcriptError && transcript.length > 0 && (
            <>
              <div className={styles.messages}>
                {pagedEntries.map((entry, i) => (
                  <div
                    key={page * PAGE_SIZE + i}
                    className={
                      entry.type === "user"
                        ? styles.userMessage
                        : styles.assistantMessage
                    }
                  >
                    <div className={styles.messageRole}>
                      {entry.type === "user" ? "User" : "Assistant"}
                      {entry.timestamp && (
                        <span className={styles.messageTime}>
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className={styles.messageText}>
                      {extractText(entry)}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {!transcriptLoading &&
            !transcriptError &&
            transcript.length === 0 && <p>No messages in this transcript.</p>}
        </div>
      )}
    </div>
  );
}
