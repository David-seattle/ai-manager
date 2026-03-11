import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { usePinnedCards, MAX_PINNED } from "../hooks/usePinnedCards";

const STORAGE_KEY = "dashboard_pinned_cards_v1";

beforeEach(() => {
  localStorage.clear();
});

describe("usePinnedCards", () => {
  it("starts with empty pins when localStorage is empty", () => {
    const { result } = renderHook(() => usePinnedCards());
    expect(result.current.pinnedIds).toEqual([]);
    expect(result.current.isFull).toBe(false);
  });

  it("pins a card and persists to localStorage", () => {
    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.togglePin("aim-001"));

    expect(result.current.pinnedIds).toEqual(["aim-001"]);
    expect(result.current.isPinned("aim-001")).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["aim-001"]);
  });

  it("unpins a pinned card", () => {
    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.togglePin("aim-001"));
    act(() => result.current.togglePin("aim-001"));

    expect(result.current.pinnedIds).toEqual([]);
    expect(result.current.isPinned("aim-001")).toBe(false);
  });

  it("prepends new pins (most recently pinned first)", () => {
    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.togglePin("aim-001"));
    act(() => result.current.togglePin("aim-002"));
    act(() => result.current.togglePin("aim-003"));

    expect(result.current.pinnedIds).toEqual(["aim-003", "aim-002", "aim-001"]);
  });

  it("re-pinning moves card to the front", () => {
    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.togglePin("aim-001"));
    act(() => result.current.togglePin("aim-002"));
    act(() => result.current.togglePin("aim-003"));

    // Unpin and re-pin aim-001
    act(() => result.current.togglePin("aim-001"));
    act(() => result.current.togglePin("aim-001"));

    expect(result.current.pinnedIds).toEqual(["aim-001", "aim-003", "aim-002"]);
  });

  it("enforces MAX_PINNED limit", () => {
    const { result } = renderHook(() => usePinnedCards());

    for (let i = 1; i <= MAX_PINNED; i++) {
      act(() => result.current.togglePin(`aim-${String(i).padStart(3, "0")}`));
    }

    expect(result.current.isFull).toBe(true);

    // Attempt to pin a 7th
    act(() => result.current.togglePin("aim-overflow"));
    expect(result.current.pinnedIds).toHaveLength(MAX_PINNED);
    expect(result.current.isPinned("aim-overflow")).toBe(false);
  });

  it("exports MAX_PINNED as 6", () => {
    expect(MAX_PINNED).toBe(6);
  });

  it("restores pins from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["aim-002", "aim-001"]));

    const { result } = renderHook(() => usePinnedCards());

    expect(result.current.pinnedIds).toEqual(["aim-002", "aim-001"]);
    expect(result.current.isPinned("aim-002")).toBe(true);
  });

  it("handles corrupt localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-json!!!");

    const { result } = renderHook(() => usePinnedCards());

    expect(result.current.pinnedIds).toEqual([]);
  });

  it("handles non-array JSON in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bad: "object" }));

    const { result } = renderHook(() => usePinnedCards());

    expect(result.current.pinnedIds).toEqual([]);
  });

  it("handles array of non-strings in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));

    const { result } = renderHook(() => usePinnedCards());

    expect(result.current.pinnedIds).toEqual([]);
  });

  it("cleanupStale removes IDs not in validIds set", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["aim-001", "aim-deleted", "aim-002"]));

    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.cleanupStale(new Set(["aim-001", "aim-002", "aim-003"])));

    expect(result.current.pinnedIds).toEqual(["aim-001", "aim-002"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(["aim-001", "aim-002"]);
  });

  it("cleanupStale is a no-op when all pins are valid", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["aim-001", "aim-002"]));

    const { result } = renderHook(() => usePinnedCards());

    act(() => result.current.cleanupStale(new Set(["aim-001", "aim-002", "aim-003"])));

    expect(result.current.pinnedIds).toEqual(["aim-001", "aim-002"]);
  });
});
