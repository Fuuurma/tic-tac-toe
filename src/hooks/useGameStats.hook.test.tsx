// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AI_Difficulty, GameModes } from "@/game/constants";
import { useGameStats, type GameStats } from "./useGameStats";

/**
 * The record is only useful if the result lands in the bucket the player
 * actually chose, and survives a reload. These cover both halves: correct
 * attribution per mode+difficulty, and persistence under the guest's own
 * storage key.
 */

const guestId = () => window.localStorage.getItem("tic-tac-toe:guestId") ?? "";

const stored = (): GameStats | null => {
  const raw = window.localStorage.getItem(`tic-tac-toe:stats:${guestId()}`);
  return raw ? (JSON.parse(raw) as GameStats) : null;
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useGameStats breakdown recording", () => {
  it("files a vs Computer result under the chosen difficulty", () => {
    const { result } = renderHook(() => useGameStats());

    act(() => {
      result.current.recordWin({
        gameMode: GameModes.VS_COMPUTER,
        aiDifficulty: AI_Difficulty.HARD,
      });
    });
    act(() => {
      result.current.recordLoss({
        gameMode: GameModes.VS_COMPUTER,
        aiDifficulty: AI_Difficulty.HARD,
      });
    });

    expect(result.current.stats.breakdown["VS_COMPUTER:HARD"]).toEqual({
      wins: 1,
      losses: 1,
    });
    // The headline record still reflects both games.
    expect(result.current.stats.totalGames).toBe(2);
    expect(result.current.stats.wins).toBe(1);
    expect(result.current.stats.losses).toBe(1);
  });

  it("keeps each difficulty in its own bucket", () => {
    const { result } = renderHook(() => useGameStats());

    act(() => {
      result.current.recordWin({
        gameMode: GameModes.VS_COMPUTER,
        aiDifficulty: AI_Difficulty.EASY,
      });
    });
    act(() => {
      result.current.recordWin({
        gameMode: GameModes.VS_COMPUTER,
        aiDifficulty: AI_Difficulty.NORMAL,
      });
    });

    expect(result.current.stats.breakdown).toEqual({
      "VS_COMPUTER:EASY": { wins: 1, losses: 0 },
      "VS_COMPUTER:NORMAL": { wins: 1, losses: 0 },
    });
  });

  it("files modes without a difficulty under the mode alone", () => {
    const { result } = renderHook(() => useGameStats());

    act(() => {
      result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    act(() => {
      result.current.recordLoss({ gameMode: GameModes.ONLINE });
    });

    expect(result.current.stats.breakdown).toEqual({
      [GameModes.VS_FRIEND]: { wins: 1, losses: 0 },
      [GameModes.ONLINE]: { wins: 0, losses: 1 },
    });
  });

  it("persists the breakdown under the guest's own key", () => {
    const { result, unmount } = renderHook(() => useGameStats());
    act(() => {
      result.current.recordWin({
        gameMode: GameModes.VS_COMPUTER,
        aiDifficulty: AI_Difficulty.NORMAL,
      });
    });
    unmount();

    expect(stored()?.breakdown).toEqual({
      "VS_COMPUTER:NORMAL": { wins: 1, losses: 0 },
    });

    // A fresh mount for the same guest reads the record back.
    const reloaded = renderHook(() => useGameStats());
    expect(reloaded.result.current.stats.breakdown).toEqual({
      "VS_COMPUTER:NORMAL": { wins: 1, losses: 0 },
    });
  });

  it("resets the win streak on a loss without touching the tally", () => {
    const { result } = renderHook(() => useGameStats());

    act(() => {
      result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    act(() => {
      result.current.recordWin({ gameMode: GameModes.VS_FRIEND });
    });
    expect(result.current.stats.bestWinStreak).toBe(2);

    act(() => {
      result.current.recordLoss({ gameMode: GameModes.VS_FRIEND });
    });
    expect(result.current.stats.currentWinStreak).toBe(0);
    expect(result.current.stats.bestWinStreak).toBe(2);
    expect(result.current.stats.breakdown[GameModes.VS_FRIEND]).toEqual({
      wins: 2,
      losses: 1,
    });
  });
});