import { describe, expect, it } from "vitest";
import {
  breakdownKey,
  breakdownRows,
  type GameStats,
  type StatsBreakdown,
} from "./useGameStats";
import { AI_Difficulty, GameModes } from "@/game/constants";

const stats = (overrides: Partial<GameStats>): GameStats => ({
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  breakdown: {},
  ...overrides,
});

describe("breakdownRows earlier-games row", () => {
  it("reconciles a pre-breakdown record as one earlier-games row", () => {
    const rows = breakdownRows(
      stats({ totalGames: 10, wins: 6, losses: 4 }),
      GameModes.VS_COMPUTER,
    );

    expect(rows.map((r) => r.label)).toEqual([
      "Earlier games",
      "Easy",
      "Normal",
      "Hard",
    ]);
    expect(rows[0].bucket).toEqual({ wins: 6, losses: 4 });
  });

  it("shows only the unallocated remainder when buckets cover part of the record", () => {
    const breakdown: StatsBreakdown = {
      [GameModes.ONLINE]: { wins: 2, losses: 1 },
    };
    const rows = breakdownRows(
      stats({ totalGames: 10, wins: 6, losses: 4, breakdown }),
      undefined,
    );

    expect(rows.map((r) => r.label)).toEqual(["Earlier games", "Online"]);
    expect(rows[0].bucket).toEqual({ wins: 4, losses: 3 });
    expect(rows[1].bucket).toEqual({ wins: 2, losses: 1 });
  });

  it("shows the row when only one side has a remainder", () => {
    const breakdown: StatsBreakdown = {
      [GameModes.ONLINE]: { wins: 6, losses: 1 },
    };
    const rows = breakdownRows(
      stats({ totalGames: 10, wins: 6, losses: 4, breakdown }),
      undefined,
    );

    expect(rows[0].label).toBe("Earlier games");
    expect(rows[0].bucket).toEqual({ wins: 0, losses: 3 });
  });

  it("adds no row when the buckets already account for every game", () => {
    const breakdown: StatsBreakdown = {
      [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
        wins: 4,
        losses: 2,
      },
      [GameModes.ONLINE]: { wins: 1, losses: 1 },
    };
    const rows = breakdownRows(
      stats({ totalGames: 8, wins: 5, losses: 3, breakdown }),
      GameModes.VS_COMPUTER,
    );

    expect(rows.map((r) => r.label)).toEqual([
      "Easy",
      "Normal",
      "Hard",
      "Online",
    ]);
  });

  it("adds no row when bucket sums meet or exceed the totals", () => {
    const breakdown: StatsBreakdown = {
      [GameModes.ONLINE]: { wins: 7, losses: 5 },
    };
    const rows = breakdownRows(
      stats({ totalGames: 10, wins: 6, losses: 4, breakdown }),
      undefined,
    );

    expect(rows.map((r) => r.label)).toEqual(["Online"]);
  });
});
