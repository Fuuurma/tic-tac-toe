"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GameModes } from "@/game/constants";
import { resetStats, useGameStats, type GameStats } from "./useGameStats";

const guestId = () => window.localStorage.getItem("tic-tac-toe:guestId") ?? "";

const stored = (): GameStats | null => {
  const raw = window.localStorage.getItem(`tic-tac-toe:stats:${guestId()}`);
  return raw ? (JSON.parse(raw) as GameStats) : null;
};

const ZEROED: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  breakdown: {},
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("resetStats", () => {
  it("zeroes the record for every mounted view", () => {
    const first = renderHook(() => useGameStats());
    const second = renderHook(() => useGameStats());

    act(() => {
      first.result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    act(() => {
      first.result.current.recordLoss({
        gameMode: GameModes.VS_COMPUTER,
      });
    });

    expect(first.result.current.stats.totalGames).toBe(2);
    expect(first.result.current.stats.wins).toBe(1);
    expect(first.result.current.stats.losses).toBe(1);

    let outcome = false;
    act(() => {
      outcome = resetStats();
    });

    expect(outcome).toBe(true);
    for (const view of [first, second]) {
      expect(view.result.current.stats.totalGames).toBe(0);
      expect(view.result.current.stats.wins).toBe(0);
      expect(view.result.current.stats.losses).toBe(0);
      expect(view.result.current.stats.currentWinStreak).toBe(0);
      expect(view.result.current.stats.bestWinStreak).toBe(0);
      expect(view.result.current.stats.breakdown).toEqual({});
    }
    expect(stored()).toEqual(ZEROED);
  });

  it("keeps the record and reports failure when storage refuses the write", () => {
    const { result } = renderHook(() => useGameStats());

    act(() => {
      result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    const before = stored();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "QuotaExceededError");
    });

    let outcome = true;
    act(() => {
      outcome = resetStats();
    });

    expect(outcome).toBe(false);
    expect(result.current.stats.totalGames).toBe(1);
    expect(result.current.stats.wins).toBe(1);
    expect(stored()).toEqual(before);
  });

  it("does not replay outcomes queued while storage was refusing writes", () => {
    const { result } = renderHook(() => useGameStats());

    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("denied", "QuotaExceededError");
      });

    act(() => {
      result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    expect(result.current.stats.totalGames).toBe(1);

    setItemSpy.mockRestore();

    let outcome = false;
    act(() => {
      outcome = resetStats();
    });

    expect(outcome).toBe(true);
    expect(result.current.stats.totalGames).toBe(0);
    expect(result.current.stats.wins).toBe(0);
    expect(result.current.stats.breakdown).toEqual({});
    expect(stored()).toEqual(ZEROED);
  });
});
