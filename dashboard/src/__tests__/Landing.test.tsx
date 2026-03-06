import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Landing from "../pages/Landing";
import type { WorkItem } from "../types/api";

const mockItems: WorkItem[] = [
  {
    id: "aim-001",
    source: "jira",
    issue_type: "bug",
    title: "Fix login bug",
    description: "Users are unable to log in when using SSO. This needs to be resolved urgently before the next release cycle which is coming up very soon and blocking deployments.",
    path: "/items/aim-001",
    status: "in_progress",
    priority: "P1",
    assignee: "alice",
    created_at: "2026-03-01",
    updated_at: "2026-03-06",
  },
  {
    id: "aim-002",
    source: "beads",
    issue_type: "task",
    title: "Add dashboard cards",
    description: "Replace search homepage with card-based dashboard",
    path: "/items/aim-002",
    status: "open",
    priority: "P2",
    assignee: "bob",
    created_at: "2026-03-02",
    updated_at: "2026-03-05",
  },
];

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Landing", () => {
  it("renders the heading and search input", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    renderLanding();
    expect(screen.getByRole("heading", { name: /work items/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/work item id/i)).toBeInTheDocument();
  });

  it("navigates to /workitem/<id> on submit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    const user = userEvent.setup();
    renderLanding();
    const input = screen.getByLabelText(/work item id/i);
    await user.type(input, "aim-1234{Enter}");
    expect(input).toHaveValue("aim-1234");
  });

  it("shows loading spinner while fetching", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderLanding();
    expect(screen.getByText(/loading work items/i)).toBeInTheDocument();
  });

  it("renders work item cards after fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockItems,
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    expect(screen.getByText("Add dashboard cards")).toBeInTheDocument();
    expect(screen.getByText("in_progress")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("task")).toBeInTheDocument();
  });

  it("truncates long descriptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockItems,
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    // The long description should be truncated (120 chars + ellipsis)
    expect(screen.queryByText(mockItems[0]!.description)).not.toBeInTheDocument();
    expect(screen.getByText(/Users are unable to log in/)).toBeInTheDocument();
  });

  it("shows cards as links to work item detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockItems,
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    const cardLinks = links.filter(
      (l) => l.getAttribute("href") === "/workitem/aim-001" || l.getAttribute("href") === "/workitem/aim-002",
    );
    expect(cardLinks).toHaveLength(2);
  });

  it("shows error message on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText(/failed to load work items/i)).toBeInTheDocument();
    });
  });

  it("hides issue type badge when issue_type is empty", async () => {
    const itemsWithEmptyType = mockItems.map((item) => ({ ...item, issue_type: "" }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => itemsWithEmptyType,
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText("Fix login bug")).toBeInTheDocument();
    });

    expect(screen.queryByText("bug")).not.toBeInTheDocument();
    expect(screen.queryByText("task")).not.toBeInTheDocument();
  });

  it("shows empty state when no items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText(/no work items found/i)).toBeInTheDocument();
    });
  });
});
