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

  it("NORMAL produces a legal move when a top-row threat is on the board", () => {
    let s = onlineState();
    s = makeMove(s, 0)!; // X
    s = makeMove(s, 3)!; // O (any legal move)
    s = makeMove(s, 1)!; // X
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
