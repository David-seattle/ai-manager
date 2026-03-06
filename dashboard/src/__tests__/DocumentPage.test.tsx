import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import DocumentPage from "../pages/DocumentPage";

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

function renderDocPage(docType: string) {
  const router = createMemoryRouter(
    [{ path: "/doc/:docType", element: <DocumentPage /> }],
    { initialEntries: [`/doc/${docType}`] },
  );
  return render(
    <WorkItemContext.Provider value={{ item: mockItem, loading: false, error: null }}>
      <RouterProvider router={router} />
    </WorkItemContext.Provider>,
  );
}

describe("DocumentPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and renders document content as markdown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { work_item_id: "aim-1234", doc_type: "functional", filename: "req.md", content: "## Requirements\n\nDo the thing.", updated_at: "" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderDocPage("functional");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Functional Requirements" })).toBeInTheDocument();
    });
    expect(screen.getByText("Do the thing.")).toBeInTheDocument();
  });

  it("shows empty state when no document exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderDocPage("functional");

    await waitFor(() => {
      expect(screen.getByText("No document available.")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network"));

    renderDocPage("functional");

    await waitFor(() => {
      expect(screen.getByText("Failed to load document.")).toBeInTheDocument();
    });
  });

  it("uses correct doc type in title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderDocPage("acceptance-criteria");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Acceptance Criteria" })).toBeInTheDocument();
    });
  });
});
