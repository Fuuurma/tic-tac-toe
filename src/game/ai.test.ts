import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_Difficulty, GameModes, Color, PlayerSymbol } from "@/game/constants";
import { canAIMove, getAIMove } from "@/game/ai";
import {
  createInitialGameState,
  freshGameState,
  getValidMoves,
  makeMove,
} from "@/game/logic";

/** Create an active online state so makeMove works with proper move tracking. */
const onlineState = () => {
  const s = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
  return s;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getAIMove", () => {
  it("exposes exactly three algorithm-backed difficulty levels", () => {
    expect(Object.values(AI_Difficulty)).toEqual(["EASY", "NORMAL", "HARD"]);
  });

  it("returns a move on an empty board within the valid empty cells (EASY)", () => {
    const state = makeMove(onlineState(), 4)!;
    const move = getAIMove(state, AI_Difficulty.EASY, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("gives the center a wider Easy-selection interval than uniform play", () => {
    // A uniform nine-cell picker maps 0.41 to index 3. The weighted picker
    // maps it to center because center owns 5/25 of the weighted range.
    vi.spyOn(Math, "random").mockReturnValue(0.41);
    expect(
      getAIMove(onlineState(), AI_Difficulty.EASY, PlayerSymbol.X),
    ).toBe(4);
  });

  it("NORMAL picks a legal move on an open board", () => {
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 3)!; // O
    state = makeMove(state, 1)!; // X
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("HARD picks a legal move on an open board", () => {
    // O at 5, 8. X at 0, 1.
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 5)!; // O
    state = makeMove(state, 1)!; // X
    state = makeMove(state, 8)!; // O
    state = makeMove(state, 3)!; // X
    const move = getAIMove(state, AI_Difficulty.HARD, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("NORMAL Minimax picks a legal move", () => {
    let state = onlineState();
    state = makeMove(state, 4)!; // X
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("NORMAL varies equally scored symmetric replies", () => {
    const state = makeMove(onlineState(), 4)!;
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);

    const first = getAIMove(
      state,
      AI_Difficulty.NORMAL,
      PlayerSymbol.O,
    );
    const second = getAIMove(
      state,
      AI_Difficulty.NORMAL,
      PlayerSymbol.O,
    );

    expect(first).not.toBe(second);
    expect(getValidMoves(state.board)).toContain(first!);
    expect(getValidMoves(state.board)).toContain(second!);
  });

  it("HARD Minimax picks a legal move", () => {
    const state = makeMove(onlineState(), 4)!;
    const move = getAIMove(state, AI_Difficulty.HARD, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("NORMAL picks a legal move mid-game", () => {
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 5)!; // O
    state = makeMove(state, 1)!; // X
    state = makeMove(state, 8)!; // O
    state = makeMove(state, 3)!; // X
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("handles the 3-piece cap rule when evaluating moves", () => {
    // Place 3 X and 3 O pieces with no winning line.
    // X: [0, 5, 7], O: [1, 3, 4] — no three in a row.
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 1)!; // O
    state = makeMove(state, 5)!; // X
    state = makeMove(state, 3)!; // O
    state = makeMove(state, 7)!; // X
    state = makeMove(state, 4)!; // O
    expect(state.winner).toBeNull();
    expect(state.moves[PlayerSymbol.X]).toEqual([0, 5, 7]);
    expect(state.moves[PlayerSymbol.O]).toEqual([1, 3, 4]);
    // Next X move will remove oldest (0) and place a new piece.
    const move = getAIMove(state, AI_Difficulty.HARD, PlayerSymbol.X);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
    const next = makeMove(state, move!);
    expect(next).not.toBeNull();
    expect(next!.board[0]).toBeNull();
    expect(next!.moves[PlayerSymbol.X]).toEqual([5, 7, move]);
  });

  it("does not calculate a move for the wrong turn or an inactive game", () => {
    const active = onlineState();
    expect(getAIMove(active, AI_Difficulty.EASY, PlayerSymbol.O)).toBeNull();
    expect(getAIMove(freshGameState(), AI_Difficulty.EASY, PlayerSymbol.X)).toBeNull();
  });
});

describe("canAIMove", () => {
  it("returns true when it is the AI's turn and there is a valid move", () => {
    const state = onlineState();
    expect(canAIMove(state, PlayerSymbol.X)).toBe(true);
  });
  it("returns false when the symbol does not match the current player", () => {
    const state = onlineState();
    expect(canAIMove(state, PlayerSymbol.O)).toBe(false);
  });

  it("returns false for a waiting game", () => {
    expect(canAIMove(freshGameState(), PlayerSymbol.X)).toBe(false);
  });
});
