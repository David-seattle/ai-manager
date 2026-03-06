import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import DecisionsPage from "../pages/DecisionsPage";

const mockItem = {
  id: "aim-1234",
  source: "beads",
  issue_type: "task",
  title: "Test",
  description: "",
  path: "",
  status: "open",
  priority: "P2",
  assignee: "",
  created_at: "",
  updated_at: "",
};

const mockDecisions = [
  {
    work_item_id: "aim-1234",
    filename: "d1.md",
    decision_text: "Use React Router",
    status: "current",
    decider_type: "team",
    decider: "engineering",
    date: "2026-01-01",
    superseded_by: "",
    tags: '["architecture","frontend"]',
    problem_context: "Need client-side routing",
    alternatives: "Next.js, plain hash routing",
    raw_content: "",
  },
  {
    work_item_id: "aim-1234",
    filename: "d2.md",
    decision_text: "Use SQLite",
    status: "current",
    decider_type: "lead",
    decider: "david",
    date: "2026-01-02",
    superseded_by: "",
    tags: '["backend"]',
    problem_context: "Need lightweight data store",
    alternatives: "PostgreSQL, DuckDB",
    raw_content: "",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkItemContext.Provider value={{ item: mockItem, loading: false, error: null }}>
        <DecisionsPage />
      </WorkItemContext.Provider>
    </MemoryRouter>,
  );
}

describe("DecisionsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders decisions table with tags", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockDecisions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Use React Router")).toBeInTheDocument();
    });
    expect(screen.getByText("Use SQLite")).toBeInTheDocument();
    expect(screen.getByText("architecture")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
  });

  it("expands row to show details", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockDecisions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Use React Router")).toBeInTheDocument();
    });

    const expandBtns = screen.getAllByLabelText("Expand row");
    await user.click(expandBtns[0]!);

    expect(screen.getByText("Need client-side routing")).toBeInTheDocument();
    expect(screen.getByText("Next.js, plain hash routing")).toBeInTheDocument();
  });

  it("filters decisions", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockDecisions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Use React Router")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Filter table"), "SQLite");

    expect(screen.queryByText("Use React Router")).not.toBeInTheDocument();
    expect(screen.getByText("Use SQLite")).toBeInTheDocument();
  });
});
