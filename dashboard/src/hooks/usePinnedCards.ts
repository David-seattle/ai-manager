import { useState, useCallback } from "react";

export const MAX_PINNED = 6;
const STORAGE_KEY = "dashboard_pinned_cards_v1";

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeStorage(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable (private browsing) — state still works in-memory
  }
}

export function usePinnedCards() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(readStorage);

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  const isFull = pinnedIds.length >= MAX_PINNED;

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIds((prev) => {
        const idx = prev.indexOf(id);
        let next: string[];
        if (idx !== -1) {
          next = prev.filter((v) => v !== id);
        } else {
          if (prev.length >= MAX_PINNED) return prev;
          next = [id, ...prev];
        }
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  const cleanupStale = useCallback(
    (validIds: Set<string>) => {
      setPinnedIds((prev) => {
        const next = prev.filter((id) => validIds.has(id));
        if (next.length !== prev.length) {
          writeStorage(next);
        }
        return next.length !== prev.length ? next : prev;
      });
    },
    [],
  );

  return { pinnedIds, togglePin, isPinned, isFull, cleanupStale };
}
