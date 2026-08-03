import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readStats, type GameStats } from "./useGameStats";

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
};

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
    expect(readStats(GUEST_ID)).toEqual({
      totalGames: 10,
      wins: 7,
      losses: 3,
      currentWinStreak: 2,
      bestWinStreak: 5,
    });
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
    expect(readStats(GUEST_ID)).toEqual({
      totalGames: 5,
      wins: 0,
      losses: 2,
      currentWinStreak: 3,
      bestWinStreak: 0,
    });
  });

  it("handles missing fields by using defaults", () => {
    mockStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ totalGames: 1 }),
    );
    expect(readStats(GUEST_ID)).toEqual({
      totalGames: 1,
      wins: 0,
      losses: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
    });
  });
});
