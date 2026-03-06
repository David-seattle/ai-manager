import { useState, useMemo, type ReactNode, type CSSProperties } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Input,
  Text,
} from "@fluentui/react-components";

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  filterKeys?: (keyof T & string)[];
  renderExpanded?: (row: T) => ReactNode;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

const headerRowStyle: CSSProperties = {
  fontWeight: 600,
  backgroundColor: "#f5f5f5",
};

const headerCellStyle: CSSProperties = {
  fontWeight: 600,
  color: "#374151",
  userSelect: "none",
};

const sortableStyle: CSSProperties = {
  ...headerCellStyle,
  cursor: "pointer",
};

const expandColStyle: CSSProperties = {
  width: 32,
  padding: "4px",
};

const expandBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  padding: 4,
  color: "#6b7280",
};

const detailRowStyle: CSSProperties = {
  backgroundColor: "#f8fafc",
};

const detailContentStyle: CSSProperties = {
  padding: "12px 16px",
  fontSize: 14,
  color: "#374151",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  filterKeys,
  renderExpanded,
  emptyMessage = "No data",
}: Props<T>) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    if (!filter || !filterKeys?.length) return data;
    const lower = filter.toLowerCase();
    return data.filter((row) =>
      filterKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(lower)),
    );
  }, [data, filter, filterKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleExpand(idx: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div>
      {filterKeys && filterKeys.length > 0 && (
        <Input
          placeholder="Filter..."
          value={filter}
          onChange={(_e, d) => setFilter(d.value)}
          aria-label="Filter table"
          style={{ width: "100%", marginBottom: 12 }}
        />
      )}
      <div style={{ overflowX: "auto" }}>
        <Table style={{ tableLayout: "auto", minWidth: "100%" }}>
          <TableHeader>
            <TableRow style={headerRowStyle}>
              {renderExpanded && <TableHeaderCell style={expandColStyle} />}
              {columns.map((col) => (
                <TableHeaderCell
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  style={col.sortable ? sortableStyle : headerCellStyle}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.header}
                  {sortKey === col.key && (
                    <span style={{ fontSize: 11, marginLeft: 4 }}>
                      {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                    </span>
                  )}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderExpanded ? 1 : 0)}
                  style={{ textAlign: "center", padding: 32 }}
                >
                  <Text style={{ color: "#9ca3af", fontStyle: "italic" }}>
                    {emptyMessage}
                  </Text>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, idx) => (
                <DataTableRow
                  key={idx}
                  row={row}
                  idx={idx}
                  columns={columns}
                  renderExpanded={renderExpanded}
                  expanded={expandedRows.has(idx)}
                  onToggle={toggleExpand}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataTableRow<T extends Record<string, any>>({
  row,
  idx,
  columns,
  renderExpanded,
  expanded,
  onToggle,
}: {
  row: T;
  idx: number;
  columns: Column<T>[];
  renderExpanded?: (row: T) => ReactNode;
  expanded: boolean;
  onToggle: (idx: number) => void;
}) {
  return (
    <>
      <TableRow
        style={expanded ? { backgroundColor: "#f0f7ff" } : undefined}
      >
        {renderExpanded && (
          <TableCell style={expandColStyle}>
            <button
              style={expandBtnStyle}
              onClick={() => onToggle(idx)}
              aria-label={expanded ? "Collapse row" : "Expand row"}
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </button>
          </TableCell>
        )}
        {columns.map((col) => (
          <TableCell key={col.key}>
            {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
          </TableCell>
        ))}
      </TableRow>
      {expanded && renderExpanded && (
        <TableRow style={detailRowStyle}>
          <TableCell colSpan={columns.length + 1}>
            <div style={detailContentStyle}>{renderExpanded(row)}</div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
