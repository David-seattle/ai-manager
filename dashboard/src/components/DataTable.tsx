import { useState, useMemo, type ReactNode } from "react";
import styles from "./DataTable.module.css";

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
    <div className={styles.wrapper}>
      {filterKeys && filterKeys.length > 0 && (
        <input
          type="text"
          className={styles.filter}
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter table"
        />
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            {renderExpanded && <th className={styles.expandCol} />}
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={col.sortable ? styles.sortable : undefined}
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
                  <span className={styles.sortIndicator}>
                    {sortDir === "asc" ? " \u25B2" : " \u25BC"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (renderExpanded ? 1 : 0)}
                className={styles.empty}
              >
                {emptyMessage}
              </td>
            </tr>
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
        </tbody>
      </table>
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
      <tr className={expanded ? styles.expandedRow : undefined}>
        {renderExpanded && (
          <td className={styles.expandCol}>
            <button
              className={styles.expandBtn}
              onClick={() => onToggle(idx)}
              aria-label={expanded ? "Collapse row" : "Expand row"}
            >
              {expanded ? "\u25BC" : "\u25B6"}
            </button>
          </td>
        )}
        {columns.map((col) => (
          <td key={col.key}>
            {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
          </td>
        ))}
      </tr>
      {expanded && renderExpanded && (
        <tr className={styles.detailRow}>
          <td colSpan={columns.length + 1}>
            <div className={styles.detailContent}>{renderExpanded(row)}</div>
          </td>
        </tr>
      )}
    </>
  );
}
