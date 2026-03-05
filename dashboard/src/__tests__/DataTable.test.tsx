import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import DataTable from "../components/DataTable";

interface TestRow {
  name: string;
  value: string;
  [key: string]: unknown;
}

const columns = [
  { key: "name" as const, header: "Name", sortable: true },
  { key: "value" as const, header: "Value", sortable: true },
];

const data: TestRow[] = [
  { name: "Alpha", value: "100" },
  { name: "Beta", value: "200" },
  { name: "Charlie", value: "50" },
];

describe("DataTable", () => {
  it("renders table with data", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("shows empty message when no data", () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("sorts by column on click", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    await user.click(screen.getByText("Name"));

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getByText("Alpha")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Charlie")).toBeInTheDocument();
  });

  it("toggles sort direction on repeated clicks", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    await user.click(screen.getByText("Name"));
    await user.click(screen.getByText("Name"));

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getByText("Charlie")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Alpha")).toBeInTheDocument();
  });

  it("filters data", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={data}
        filterKeys={["name"]}
      />,
    );

    await user.type(screen.getByLabelText("Filter table"), "beta");

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument();
  });

  it("expands and collapses rows", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        data={data}
        renderExpanded={(row) => <div>Detail: {row.name}</div>}
      />,
    );

    const expandBtns = screen.getAllByLabelText("Expand row");
    expect(expandBtns).toHaveLength(3);

    await user.click(expandBtns[0]!);
    expect(screen.getByText("Detail: Alpha")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Collapse row"));
    expect(screen.queryByText("Detail: Alpha")).not.toBeInTheDocument();
  });
});
