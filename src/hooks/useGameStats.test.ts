import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  breakdownKey,
  breakdownRows,
  readStats,
  type GameStats,
  type StatsBreakdown,
} from "./useGameStats";
import { AI_Difficulty, GameModes } from "@/game/constants";

class MockStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(): string | null {
    return null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const GUEST_ID = "guest:test-id";
const STORAGE_KEY = `tic-tac-toe:stats:${GUEST_ID}`;
let mockStorage: MockStorage;

beforeEach(() => {
  mockStorage = new MockStorage();
  // @ts-expect-error — installing a partial window for node test env
  globalThis.window = { localStorage: mockStorage };
});

afterEach(() => {
  // @ts-expect-error — cleaning up
  delete globalThis.window;
});

const DEFAULT_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  breakdown: {},
};

// Records written before the breakdown existed must still load, with the
// new field defaulted rather than dropped.
const withBreakdown = (stats: Omit<GameStats, "breakdown">, breakdown: StatsBreakdown = {}) => ({
  ...stats,
  breakdown,
});

describe("readStats", () => {
  it("returns default stats when no stored data exists", () => {
    expect(readStats(GUEST_ID)).toEqual(DEFAULT_STATS);
  });

  it("loads valid stats from localStorage", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalGames: 10,
        wins: 7,
        losses: 3,
        currentWinStreak: 2,
        bestWinStreak: 5,
      }),
    );
    expect(readStats(GUEST_ID)).toEqual(
      withBreakdown({
        totalGames: 10,
        wins: 7,
        losses: 3,
        currentWinStreak: 2,
        bestWinStreak: 5,
      }),
    );
  });

  it("falls back to defaults when localStorage has invalid JSON", () => {
    mockStorage.setItem(STORAGE_KEY, "not valid json");
    expect(readStats(GUEST_ID)).toEqual(DEFAULT_STATS);
  });

  it("falls back to defaults when localStorage has non-numeric fields", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalGames: "not a number",
        wins: null,
        losses: undefined,
        currentWinStreak: -Infinity,
        bestWinStreak: NaN,
      }),
    );
    expect(readStats(GUEST_ID)).toEqual(DEFAULT_STATS);
  });

  it("rejects negative values from corrupted localStorage", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalGames: -5,
        wins: -1,
        losses: -3,
        currentWinStreak: -2,
        bestWinStreak: -10,
      }),
    );
    expect(readStats(GUEST_ID)).toEqual(DEFAULT_STATS);
  });

  it("preserves valid fields while replacing invalid ones", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalGames: 5,
        wins: "bad",
        losses: 2,
        currentWinStreak: 3,
        bestWinStreak: "also bad",
      }),
    );
    expect(readStats(GUEST_ID)).toEqual(
      withBreakdown({
        totalGames: 5,
        wins: 0,
        losses: 2,
        currentWinStreak: 3,
        bestWinStreak: 0,
      }),
    );
  });

  it("handles missing fields by using defaults", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ totalGames: 1 }),
    );
    expect(readStats(GUEST_ID)).toEqual(
      withBreakdown({
        totalGames: 1,
        wins: 0,
        losses: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
      }),
    );
  });
});

describe("breakdown storage", () => {
  it("round-trips buckets through localStorage", () => {
    const stored = {
      ...withBreakdown({ totalGames: 4, wins: 3, losses: 1, currentWinStreak: 2, bestWinStreak: 2 }),
      breakdown: {
        [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
          wins: 3,
          losses: 1,
        },
      },
    };
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    expect(readStats(GUEST_ID).breakdown).toEqual({
      [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
        wins: 3,
        losses: 1,
      },
    });
  });

  it("drops malformed buckets and keeps well-formed siblings", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        breakdown: {
          [GameModes.VS_FRIEND]: { wins: 2, losses: 0 },
          [GameModes.ONLINE]: { wins: "two", losses: 1 },
          [GameModes.VS_COMPUTER]: { wins: -1, losses: 3 },
          broken: "not an object",
        },
      }),
    );
    expect(readStats(GUEST_ID).breakdown).toEqual({
      [GameModes.VS_FRIEND]: { wins: 2, losses: 0 },
    });
  });

  it("ignores a non-object breakdown field", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ breakdown: ["nope"] }),
    );
    expect(readStats(GUEST_ID).breakdown).toEqual({});
  });
});

describe("breakdownKey", () => {
  it("splits vs Computer by difficulty", () => {
    expect(breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.EASY)).toBe(
      "VS_COMPUTER:EASY",
    );
  });

  it("ignores difficulty for modes that have none", () => {
    expect(
      breakdownKey(GameModes.VS_FRIEND, AI_Difficulty.HARD),
    ).toBe(GameModes.VS_FRIEND);
    expect(breakdownKey(GameModes.ONLINE)).toBe(GameModes.ONLINE);
  });
});

describe("breakdownRows", () => {
  const breakdown: StatsBreakdown = {
    [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
      wins: 4,
      losses: 2,
    },
    [GameModes.ONLINE]: { wins: 1, losses: 1 },
  };

  it("always lists every difficulty for the mode being played", () => {
    const rows = breakdownRows(breakdown, GameModes.VS_COMPUTER);
    // Played mode first, then other modes that have a record.
    expect(rows.map((r) => r.label)).toEqual([
      "Easy",
      "Normal",
      "Hard",
      "Online",
    ]);
    expect(rows[2].bucket).toEqual({ wins: 4, losses: 2 });
    // Untouched difficulties stay visible as empty rather than disappearing.
    expect(rows[0].bucket).toEqual({ wins: 0, losses: 0 });
  });

  it("lists the played mode first, then other recorded modes", () => {
    const rows = breakdownRows(breakdown, GameModes.VS_FRIEND);
    expect(rows.map((r) => r.label)).toEqual([
      "vs Friend",
      "Easy",
      "Normal",
      "Hard",
      "Online",
    ]);
  });

  it("omits modes with no record at all", () => {
    const rows = breakdownRows({}, GameModes.VS_FRIEND);
    expect(rows.map((r) => r.label)).toEqual(["vs Friend"]);
  });

  it("shows no rows when there is neither a mode nor a record", () => {
    expect(breakdownRows({}, undefined)).toEqual([]);
  });
});
