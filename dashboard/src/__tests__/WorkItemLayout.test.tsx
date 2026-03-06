import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WorkItemLayout, { WorkItemIndex } from "../components/WorkItemLayout";
import Overview from "../pages/Overview";

const mockWorkItem = {
  id: "aim-1234",
  source: "beads",
  issue_type: "bug",
  title: "Fix the thing",
  description: "A detailed description",
  path: "/some/path",
  status: "open",
  priority: "P2",
  assignee: "obsidian",
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

function renderWithRoute(id: string) {
  const router = createMemoryRouter(
    [
      {
        path: "/workitem/:id",
        element: <WorkItemLayout />,
        children: [
          { index: true, element: <WorkItemIndex /> },
          { path: "overview", element: <Overview /> },
        ],
      },
    ],
    { initialEntries: [`/workitem/${id}`] },
  );
  return render(<RouterProvider router={router} />);
}

describe("WorkItemLayout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    renderWithRoute("aim-1234");
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders sidebar and overview on successful fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([mockWorkItem]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRoute("aim-1234");

    await waitFor(() => {
      expect(screen.getByText("Fix the thing")).toBeInTheDocument();
    });
    expect(screen.getByRole("navigation", { name: /work item/i })).toBeInTheDocument();
  });

  it("shows not-found message on empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRoute("nonexistent");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/nonexistent/)).toBeInTheDocument();
  });

  it("shows not-found message on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 404 }),
    );

    renderWithRoute("nonexistent");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    });
  });

  it("shows not-found message on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));

    renderWithRoute("broken");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    });
  });

  it("fetches from correct API URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([mockWorkItem]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRoute("aim-5678");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/ai_manager/work_items.json?id=aim-5678&_shape=array",
      );
    });
  });
});
