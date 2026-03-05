import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import WorkItemDetail from "../pages/WorkItemDetail";

function renderWithRoute(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/workitem/${id}`]}>
      <Routes>
        <Route path="/workitem/:id" element={<WorkItemDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkItemDetail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows work item info on successful fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "aim-1234", title: "Fix the thing" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    renderWithRoute("aim-1234");
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Fix the thing" })).toBeInTheDocument();
    });
    expect(screen.getByText("ID: aim-1234")).toBeInTheDocument();
  });

  it("shows not-found message on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 404 }),
    );

    renderWithRoute("nonexistent");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/nonexistent/)).toBeInTheDocument();
  });

  it("shows not-found message on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network error"));

    renderWithRoute("broken");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /not found/i })).toBeInTheDocument();
    });
  });
});
