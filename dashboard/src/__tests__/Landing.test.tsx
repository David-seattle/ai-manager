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
  localStorage.clear();
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

  describe("card pinning", () => {
    function mockFetch(items: WorkItem[] = mockItems) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => items,
      } as Response);
    }

    it("shows pin button on each card", async () => {
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      });

      const pinButtons = screen.getAllByRole("button", { name: /pin/i });
      expect(pinButtons).toHaveLength(2);
    });

    it("pins a card and shows Pinned section", async () => {
      mockFetch();
      const user = userEvent.setup();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      });

      const pinButtons = screen.getAllByRole("button", { name: /pin/i });
      await user.click(pinButtons[0]!);

      expect(screen.getByText("Pinned")).toBeInTheDocument();
    });

    it("unpins a pinned card", async () => {
      localStorage.setItem("dashboard_pinned_cards_v1", JSON.stringify(["aim-001"]));
      mockFetch();
      const user = userEvent.setup();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });

      const unpinButton = screen.getByRole("button", { name: /unpin/i });
      await user.click(unpinButton);

      expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
    });

    it("pinned cards appear before unpinned cards", async () => {
      localStorage.setItem("dashboard_pinned_cards_v1", JSON.stringify(["aim-002"]));
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });

      // aim-002 should be in the pinned section (before aim-001)
      const titles = screen.getAllByText(/Fix login bug|Add dashboard cards/);
      expect(titles[0]!.textContent).toBe("Add dashboard cards");
      expect(titles[1]!.textContent).toBe("Fix login bug");
    });

    it("shows max pins message when 6 cards pinned", async () => {
      const manyItems: WorkItem[] = Array.from({ length: 7 }, (_, i) => ({
        id: `aim-${String(i + 1).padStart(3, "0")}`,
        source: "beads",
        issue_type: "task",
        title: `Item ${i + 1}`,
        description: "",
        path: `/items/aim-${String(i + 1).padStart(3, "0")}`,
        status: "open",
        priority: "P2",
        assignee: "alice",
        created_at: "2026-03-01",
        updated_at: "2026-03-01",
      }));

      const pinnedIds = manyItems.slice(0, 6).map((item) => item.id);
      localStorage.setItem("dashboard_pinned_cards_v1", JSON.stringify(pinnedIds));
      mockFetch(manyItems);

      const user = userEvent.setup();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Item 7")).toBeInTheDocument();
      });

      // Try to pin the 7th card
      const unpinnedPinButton = screen.getAllByRole("button", { name: /pin/i }).find(
        (btn) => !btn.getAttribute("aria-label")?.includes("Unpin"),
      );
      expect(unpinnedPinButton).toBeDefined();
      await user.click(unpinnedPinButton!);

      expect(screen.getByText(/unpin a card to make room/i)).toBeInTheDocument();
    });

    it("persists pin state across reloads via localStorage", async () => {
      mockFetch();
      const user = userEvent.setup();
      const { unmount } = renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      });

      const pinButtons = screen.getAllByRole("button", { name: /pin/i });
      await user.click(pinButtons[0]!);

      expect(JSON.parse(localStorage.getItem("dashboard_pinned_cards_v1")!)).toContain("aim-001");

      unmount();

      // Re-render — pin should survive
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });
    });

    it("silently removes stale pins for deleted work items", async () => {
      localStorage.setItem(
        "dashboard_pinned_cards_v1",
        JSON.stringify(["aim-001", "aim-deleted"]),
      );
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      });

      // aim-deleted should have been cleaned up
      const stored = JSON.parse(localStorage.getItem("dashboard_pinned_cards_v1")!);
      expect(stored).toEqual(["aim-001"]);
    });

    it("pinned card has visual distinction (left border)", async () => {
      localStorage.setItem("dashboard_pinned_cards_v1", JSON.stringify(["aim-001"]));
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Pinned")).toBeInTheDocument();
      });

      const pinnedCard = screen.getByText("Fix login bug").closest("[data-pinned]");
      expect(pinnedCard).toHaveAttribute("data-pinned", "true");
    });

    it("does not show Pinned section when no cards are pinned", async () => {
      mockFetch();
      renderLanding();

      await waitFor(() => {
        expect(screen.getByText("Fix login bug")).toBeInTheDocument();
      });

      expect(screen.queryByText("Pinned")).not.toBeInTheDocument();
    });
  });
});
