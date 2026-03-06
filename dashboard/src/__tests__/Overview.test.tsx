import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { WorkItemContext } from "../context/WorkItemContext";
import Overview from "../pages/Overview";

const mockItem = {
  id: "aim-1234",
  source: "beads",
  issue_type: "task",
  title: "Test Work Item",
  description: "This is a **bold** description.",
  path: "/path",
  status: "open",
  priority: "P1",
  assignee: "obsidian",
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

function renderOverview(item = mockItem) {
  return render(
    <MemoryRouter>
      <WorkItemContext.Provider value={{ item, loading: false, error: null }}>
        <Overview />
      </WorkItemContext.Provider>
    </MemoryRouter>,
  );
}

describe("Overview", () => {
  it("renders title and metadata badges", () => {
    renderOverview();
    expect(screen.getByRole("heading", { name: "Test Work Item" })).toBeInTheDocument();
    expect(screen.getByText("Status: open")).toBeInTheDocument();
    expect(screen.getByText("Priority: P1")).toBeInTheDocument();
    expect(screen.getByText("Assignee: obsidian")).toBeInTheDocument();
    expect(screen.getByText("ID: aim-1234")).toBeInTheDocument();
  });

  it("renders description as markdown", () => {
    renderOverview();
    expect(screen.getByText("bold")).toBeInTheDocument();
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders nothing when item is null", () => {
    render(
      <MemoryRouter>
        <WorkItemContext.Provider value={{ item: null, loading: false, error: null }}>
          <Overview />
        </WorkItemContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
