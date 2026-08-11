import { describe, expect, it } from "vitest";
import { AI_Difficulty, GameModes, Color, PlayerSymbol } from "@/game/constants";
import { getAIMove } from "@/game/ai";
import { createInitialGameState, getValidMoves, makeMove } from "@/game/logic";

const onlineState = () =>
  createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });

describe("AI behavior regressions", () => {
  it("X always produces a legal move after a multi-ply fixture", () => {
    let s = onlineState();
    for (const m of [0, 1, 4, 3, 6, 5]) s = makeMove(s, m)!;
    expect(s.winner).toBeNull();
    for (const d of [AI_Difficulty.NORMAL, AI_Difficulty.HARD]) {
      const move = getAIMove(s, d, PlayerSymbol.X);
      expect(move, d).not.toBeNull();
      expect(getValidMoves(s.board), d).toContain(move!);
    }
  });

  it("HARD produces a legal move after X plays a corner (corner-trap regression)", () => {
    const s = makeMove(onlineState(), 0)!;
    const move = getAIMove(s, AI_Difficulty.HARD, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(s.board)).toContain(move!);
  });

  it.each([AI_Difficulty.NORMAL, AI_Difficulty.HARD])(
    "%s blocks an immediate top-row loss",
    (difficulty) => {
      let s = onlineState();
      s = makeMove(s, 0)!; // X
      s = makeMove(s, 3)!; // O
      s = makeMove(s, 1)!; // X threatens 2

      expect(getAIMove(s, difficulty, PlayerSymbol.O)).toBe(2);
    },
  );

  it.each([AI_Difficulty.NORMAL, AI_Difficulty.HARD])(
    "%s takes an immediate win instead of blocking",
    (difficulty) => {
      let s = onlineState();
      s = makeMove(s, 0)!; // X
      s = makeMove(s, 3)!; // O
      s = makeMove(s, 1)!; // X threatens 2
      s = makeMove(s, 4)!; // O threatens 5
      s = makeMove(s, 8)!; // X

      expect(getAIMove(s, difficulty, PlayerSymbol.O)).toBe(5);
    },
  );

  it.each([AI_Difficulty.NORMAL, AI_Difficulty.HARD])(
    "%s finds a win created by oldest-piece eviction",
    (difficulty) => {
      let s = onlineState();
      for (const move of [0, 1, 4, 3, 6, 5]) {
        s = makeMove(s, move)!;
      }

      // X moves at 2, evicting oldest piece 0 and completing [2, 4, 6].
      expect(s.moves[PlayerSymbol.X]).toEqual([0, 4, 6]);
      expect(getAIMove(s, difficulty, PlayerSymbol.X)).toBe(2);
    },
  );

  it.each([AI_Difficulty.NORMAL, AI_Difficulty.HARD])(
    "%s prefers an immediate eviction-cycle win over a delayed line",
    (difficulty) => {
      let s = onlineState();
      for (const move of [
        4, 8, 1, 2, 6, 7, 0, 5, 4, 8, 2, 1, 3, 6, 0, 5, 8, 2,
      ]) {
        s = makeMove(s, move)!;
      }

      expect(s.currentPlayer).toBe(PlayerSymbol.X);
      expect(makeMove(s, 4)?.winner).toBe(PlayerSymbol.X);
      expect(getAIMove(s, difficulty, PlayerSymbol.X)).toBe(4);
    },
  );

  it("NORMAL produces a legal move when no immediate tactic exists", () => {
    let s = onlineState();
    s = makeMove(s, 0)!; // X
    s = makeMove(s, 4)!; // O
    s = makeMove(s, 7)!; // X
    const move = getAIMove(s, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(s.board)).toContain(move!);
  });

  it("all levels produce a legal move when a threat appears after oldest-piece removal", () => {
    let s = onlineState();
    s = makeMove(s, 0)!; // X, oldest X piece
    s = makeMove(s, 1)!; // O
    s = makeMove(s, 4)!; // X
    s = makeMove(s, 3)!; // O
    s = makeMove(s, 6)!; // X, next X move removes 0 and can win at 2

    expect(s.currentPlayer).toBe(PlayerSymbol.O);
    for (const difficulty of Object.values(AI_Difficulty)) {
      const move = getAIMove(s, difficulty, PlayerSymbol.O);
      expect(move, difficulty).not.toBeNull();
      expect(getValidMoves(s.board), difficulty).toContain(move!);
    }
  });
});
