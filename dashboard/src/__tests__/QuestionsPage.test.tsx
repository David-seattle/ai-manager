import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import QuestionsPage from "../pages/QuestionsPage";

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

const mockQuestions = [
  {
    work_item_id: "aim-1234",
    filename: "q1.md",
    question_text: "What is the API format?",
    status: "open",
    raised_by: "alice",
    raised_date: "2026-01-01",
    source: "",
    resolved_date: "",
    resolved_by: "",
    context: "Need to know the JSON structure",
    impact: "Blocks frontend work",
    raw_content: "",
  },
  {
    work_item_id: "aim-1234",
    filename: "q2.md",
    question_text: "How to handle auth?",
    status: "resolved",
    raised_by: "bob",
    raised_date: "2026-01-02",
    source: "",
    resolved_date: "2026-01-03",
    resolved_by: "charlie",
    context: "Auth tokens needed",
    impact: "Security concern",
    raw_content: "",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkItemContext.Provider value={{ item: mockItem, loading: false, error: null }}>
        <QuestionsPage />
      </WorkItemContext.Provider>
    </MemoryRouter>,
  );
}

describe("QuestionsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders questions table", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuestions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("What is the API format?")).toBeInTheDocument();
    });
    expect(screen.getByText("How to handle auth?")).toBeInTheDocument();
  });

  it("filters questions by text", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuestions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("What is the API format?")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Filter table"), "auth");

    expect(screen.queryByText("What is the API format?")).not.toBeInTheDocument();
    expect(screen.getByText("How to handle auth?")).toBeInTheDocument();
  });

  it("expands row to show detail", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuestions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("What is the API format?")).toBeInTheDocument();
    });

    const expandBtns = screen.getAllByLabelText("Expand row");
    await user.click(expandBtns[0]!);

    expect(screen.getByText("Need to know the JSON structure")).toBeInTheDocument();
    expect(screen.getByText("Blocks frontend work")).toBeInTheDocument();
  });

  it("sorts by column", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockQuestions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("What is the API format?")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Status"));

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getByText("open")).toBeInTheDocument();
  });
});
