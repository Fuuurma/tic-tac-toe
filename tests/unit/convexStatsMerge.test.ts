import { describe, expect, it } from "vitest";
import { combinePlayerStats } from "@/convex/stats";

describe("combinePlayerStats", () => {
  it("moves guest stats into an empty account stat row", () => {
    expect(
      combinePlayerStats(
        null,
        {
          gamesPlayed: 4,
          wins: 3,
          losses: 1,
          currentStreak: 2,
          bestStreak: 3,
        },
        "Guest Alpha",
        123
      )
    ).toEqual({
      displayNameSnapshot: "Guest Alpha",
      gamesPlayed: 4,
      wins: 3,
      losses: 1,
      currentStreak: 2,
      bestStreak: 3,
      updatedAt: 123,
    });
  });

  it("merges guest stats into existing account stats without losing streak highs", () => {
    expect(
      combinePlayerStats(
        {
          gamesPlayed: 5,
          wins: 2,
          losses: 3,
          currentStreak: 1,
          bestStreak: 4,
        },
        {
          gamesPlayed: 6,
          wins: 5,
          losses: 1,
          currentStreak: 3,
          bestStreak: 3,
        },
        "Account Alpha",
        456
      )
    ).toEqual({
      displayNameSnapshot: "Account Alpha",
      gamesPlayed: 11,
      wins: 7,
      losses: 4,
      currentStreak: 3,
      bestStreak: 4,
      updatedAt: 456,
    });
  });
});
