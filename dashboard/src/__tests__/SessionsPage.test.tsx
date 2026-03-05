import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import SessionsPage from "../pages/SessionsPage";

const mockItem = {
  id: "aim-1234",
  source: "beads",
  title: "Test",
  description: "",
  path: "",
  status: "open",
  priority: "P2",
  assignee: "",
  created_at: "",
  updated_at: "",
};

const mockSessions = [
  {
    session_id: "sess-abc",
    summary: "Implemented login feature",
    first_message_at: "2026-01-15T10:00:00Z",
    last_message_at: "2026-01-15T11:30:00Z",
    message_count: 42,
  },
  {
    session_id: "sess-def",
    summary: "Fixed auth bug in middleware",
    first_message_at: "2026-01-16T14:00:00Z",
    last_message_at: "2026-01-16T15:00:00Z",
    message_count: 18,
  },
];

const mockTranscriptContent = [
  '{"type":"user","timestamp":"2026-01-15T10:00:00Z","message":{"content":"Help me implement login"}}',
  '{"type":"assistant","timestamp":"2026-01-15T10:01:00Z","message":{"content":[{"type":"text","text":"I can help with that. Let me look at the codebase."}]}}',
  '{"type":"user","timestamp":"2026-01-15T10:05:00Z","message":{"content":"Use JWT tokens"}}',
].join("\n");

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkItemContext.Provider
        value={{ item: mockItem, loading: false, error: null }}
      >
        <SessionsPage />
      </WorkItemContext.Provider>
    </MemoryRouter>,
  );
}

function mockSessionsFetch() {
  return new Response(JSON.stringify(mockSessions), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mockTranscriptFetch() {
  return new Response(
    JSON.stringify({ session_id: "sess-abc", content: mockTranscriptContent }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders sessions table", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockSessionsFetch());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Implemented login feature")).toBeInTheDocument();
    });
    expect(screen.getByText("Fixed auth bug in middleware")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("filters sessions by summary text", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockSessionsFetch());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Implemented login feature")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Filter table"), "auth bug");

    expect(
      screen.queryByText("Implemented login feature"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Fixed auth bug in middleware"),
    ).toBeInTheDocument();
  });

  it("shows transcript viewer when View Transcript is clicked", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockSessionsFetch());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Implemented login feature")).toBeInTheDocument();
    });

    // Expand the first row
    const expandBtns = screen.getAllByLabelText("Expand row");
    await user.click(expandBtns[0]!);

    // Mock the transcript fetch
    fetchSpy.mockResolvedValueOnce(mockTranscriptFetch());

    // Click View Transcript
    await user.click(screen.getByText("View Transcript"));

    await waitFor(() => {
      expect(screen.getByTestId("transcript-viewer")).toBeInTheDocument();
    });

    expect(screen.getByText("Help me implement login")).toBeInTheDocument();
    expect(
      screen.getByText(
        "I can help with that. Let me look at the codebase.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Use JWT tokens")).toBeInTheDocument();
  });

  it("closes transcript viewer", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockSessionsFetch());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Implemented login feature")).toBeInTheDocument();
    });

    const expandBtns = screen.getAllByLabelText("Expand row");
    await user.click(expandBtns[0]!);

    fetchSpy.mockResolvedValueOnce(mockTranscriptFetch());
    await user.click(screen.getByText("View Transcript"));

    await waitFor(() => {
      expect(screen.getByTestId("transcript-viewer")).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText("Close transcript"));

    expect(screen.queryByTestId("transcript-viewer")).not.toBeInTheDocument();
  });

  it("shows empty message when no sessions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No sessions found")).toBeInTheDocument();
    });
  });

  it("shows error message on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 500 }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Failed to load sessions.")).toBeInTheDocument();
    });
  });
});
