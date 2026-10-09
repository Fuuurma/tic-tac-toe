// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { loadPreferences, savePreferences } from "./preferences";
import { AI_Difficulty, Color, SymbolShape } from "@/game/constants";

const KEY = "tic-tac-toe:preferences";

describe("preferences storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips saved appearance choices", () => {
    savePreferences({
      color: Color.PINK,
      playerShape: SymbolShape.HEART,
      opponentColor: Color.GRAY,
      opponentShape: SymbolShape.STAR,
      opponentName: "Maria",
      aiDifficulty: AI_Difficulty.HARD,
    });

    expect(loadPreferences()).toEqual({
      color: Color.PINK,
      playerShape: SymbolShape.HEART,
      opponentColor: Color.GRAY,
      opponentShape: SymbolShape.STAR,
      opponentName: "Maria",
      aiDifficulty: AI_Difficulty.HARD,
    });
  });

  it("merges patches instead of clobbering the stored blob", () => {
    savePreferences({ color: Color.GREEN });
    savePreferences({ aiDifficulty: AI_Difficulty.EASY });

    expect(loadPreferences()).toEqual({
      color: Color.GREEN,
      aiDifficulty: AI_Difficulty.EASY,
    });
  });

  it("drops fields that no longer match their enum", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        color: "chartreuse",
        playerShape: "octagon",
        opponentColor: "blue",
        aiDifficulty: "IMPOSSIBLE",
        opponentName: "Maria",
      }),
    );

    expect(loadPreferences()).toEqual({
      opponentColor: Color.BLUE,
      opponentName: "Maria",
    });
  });

  it("falls back to empty on corrupted JSON", () => {
    window.localStorage.setItem(KEY, "{not json");

    expect(loadPreferences()).toEqual({});
  });

  it("sanitizes a stored opponent name the same way live input is", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ opponentName: "  Wide   Name\u200B " }),
    );

    expect(loadPreferences().opponentName).toBe("Wide Name");
  });

  it("drops a stored opponent name that sanitizes to nothing", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ opponentName: "x" }));

    expect(loadPreferences().opponentName).toBeUndefined();
  });
});
