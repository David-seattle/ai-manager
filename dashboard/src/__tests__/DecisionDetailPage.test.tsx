import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import DecisionDetailPage from "../pages/DecisionDetailPage";

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

function renderPage(filename: string) {
  const router = createMemoryRouter(
    [{ path: "/decisions/:filename", element: <DecisionDetailPage /> }],
    { initialEntries: [`/decisions/${filename}`] },
  );
  return render(
    <WorkItemContext.Provider value={{ item: mockItem, loading: false, error: null }}>
      <RouterProvider router={router} />
    </WorkItemContext.Provider>,
  );
}

describe("DecisionDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and renders decision content as markdown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            work_item_id: "aim-1234",
            filename: "chose-react.md",
            decision_text: "Use React",
            status: "current",
            decider_type: "team",
            decider: "engineering",
            date: "2026-01-01",
            superseded_by: "",
            tags: '["architecture"]',
            problem_context: "Need a UI framework",
            alternatives: "Vue, Svelte",
            raw_content: "## Decision\n\nWe chose React for the dashboard.",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderPage("chose-react");

    await waitFor(() => {
      expect(screen.getByText("We chose React for the dashboard.")).toBeInTheDocument();
    });
  });

  it("shows empty state when decision not found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage("nonexistent");

    await waitFor(() => {
      expect(screen.getByText("Decision not found.")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));

    renderPage("chose-react");

    await waitFor(() => {
      expect(screen.getByText("Failed to load decision.")).toBeInTheDocument();
    });
  });

  it("shows decision metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            work_item_id: "aim-1234",
            filename: "chose-react.md",
            decision_text: "Use React",
            status: "current",
            decider_type: "team",
            decider: "engineering",
            date: "2026-01-01",
            superseded_by: "",
            tags: '["architecture","frontend"]',
            problem_context: "",
            alternatives: "",
            raw_content: "## Decision\n\nContent here.",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderPage("chose-react");

    await waitFor(() => {
      expect(screen.getByText("current")).toBeInTheDocument();
    });
    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01")).toBeInTheDocument();
    expect(screen.getByText("architecture")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
  });

  it("strips YAML frontmatter from raw_content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            work_item_id: "aim-1234",
            filename: "chose-react.md",
            decision_text: "Use React",
            status: "current",
            decider_type: "team",
            decider: "engineering",
            date: "2026-01-01",
            superseded_by: "",
            tags: '[]',
            problem_context: "",
            alternatives: "",
            raw_content: "---\nstatus: current\ndecider: engineering\ndate: 2026-01-01\n---\n# Title\n\nBody text here.",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderPage("chose-react");

    await waitFor(() => {
      expect(screen.getByText("Body text here.")).toBeInTheDocument();
    });
    // Frontmatter fields should NOT appear in the markdown body
    expect(screen.queryByText("status: current")).not.toBeInTheDocument();
    expect(screen.queryByText("decider: engineering")).not.toBeInTheDocument();
  });
});
