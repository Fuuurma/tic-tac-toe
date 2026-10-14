// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fetchMatchmakingHealth, type MatchmakingHealth } from "@/lib/matchmaking";
import { usePlayerCount } from "./usePlayerCount";

vi.mock("@/lib/matchmaking", () => ({
  MATCHMAKING_CONFIGURED: true,
  fetchMatchmakingHealth: vi.fn(async () => ({ game: "ttt", waiting: 1, matches: 1 })),
  totalOnlinePlayers: () => 3,
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePlayerCount lifecycle (F608)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetchMatchmakingHealth).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("stops polling on refocus once the last subscriber is gone", async () => {
    const { unmount } = renderHook(() => usePlayerCount(true, "ttt"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(fetchMatchmakingHealth).toHaveBeenCalledTimes(1);

    unmount();
    vi.mocked(fetchMatchmakingHealth).mockClear();

    setVisibility("hidden");
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchMatchmakingHealth).not.toHaveBeenCalled();
  });

  it("removes each refocus handler after its last subscriber unmounts", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");

    for (let i = 0; i < 4; i += 1) {
      const { unmount } = renderHook(() => usePlayerCount(true, "ttt"));
      unmount();
    }

    const registered = addListener.mock.calls
      .filter(([type]) => type === "visibilitychange")
      .map(([, listener]) => listener);
    const removed = removeListener.mock.calls
      .filter(([type]) => type === "visibilitychange")
      .map(([, listener]) => listener);

    expect(registered).toHaveLength(4);
    expect(removed).toEqual(registered);
  });

  it("does not re-arm the poll when a read lands after the last unsubscribe", async () => {
    let resolveHealth: (value: MatchmakingHealth) => void = () => {};
    vi.mocked(fetchMatchmakingHealth).mockImplementationOnce(
      () =>
        new Promise<MatchmakingHealth>((resolve) => {
          resolveHealth = resolve;
        }),
    );

    const { unmount } = renderHook(() => usePlayerCount(true, "ttt"));
    unmount();
    await act(async () => {
      resolveHealth({ game: "ttt", waiting: 0, matches: 0 });
      await vi.advanceTimersByTimeAsync(0);
    });
    vi.mocked(fetchMatchmakingHealth).mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMatchmakingHealth).not.toHaveBeenCalled();
  });
});
