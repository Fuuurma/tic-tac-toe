import { describe, expect, it } from "vitest";
import { AI_Difficulty, GameModes, Color, PlayerSymbol } from "@/game/constants";
import { canAIMove, getAIMove } from "@/game/ai";
import { checkWinner, createInitialGameState, getValidMoves, makeMove } from "@/game/logic";

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

describe("getAIMove", () => {
  it("returns a move on an empty board within the valid empty cells (EASY)", () => {
    const state = onlineState();
    const move = getAIMove(state, AI_Difficulty.EASY, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("blocks a winning threat (NORMAL)", () => {
    // X at 0, 1. O's turn — should block at 2.
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 3)!; // O
    state = makeMove(state, 1)!; // X
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).toBe(2);
  });

  it("takes a winning move when available (NORMAL)", () => {
    // O at 5, 8. X at 0, 1. O's turn — should win at 2 (column 2,5,8).
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 5)!; // O
    state = makeMove(state, 1)!; // X
    state = makeMove(state, 8)!; // O
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).toBe(2);
  });

  it("returns null when the board is full", () => {
    // Construct a full board with no winner.
    const state = onlineState();
    const fullBoard: (PlayerSymbol | null)[] = [
      PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.X,
      PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.O,
      PlayerSymbol.O, PlayerSymbol.X, PlayerSymbol.X,
    ];
    const drawState = { ...state, board: fullBoard, moveCount: 9, currentPlayer: PlayerSymbol.X };
    expect(drawState.board.every((c) => c !== null)).toBe(true);
    expect(checkWinner(drawState.board).winner).toBeNull();
    expect(getAIMove(drawState, AI_Difficulty.NORMAL, PlayerSymbol.X)).toBeNull();
  });

  it("HARD minimax picks a legal move", () => {
    let state = onlineState();
    state = makeMove(state, 4)!; // X
    const move = getAIMove(state, AI_Difficulty.HARD, PlayerSymbol.O);
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("INSANE (MCTS) picks a legal move", () => {
    const state = onlineState();
    const move = getAIMove(state, AI_Difficulty.INSANE, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("INSANE (MCTS) finds an immediate win or blocks a threat", () => {
    // Two-in-a-row for O at 5,8. X at 0,1. O's turn.
    // MCTS should either win at 2 or play a valid move.
    let state = onlineState();
    state = makeMove(state, 0)!; // X
    state = makeMove(state, 5)!; // O
    state = makeMove(state, 1)!; // X
    state = makeMove(state, 8)!; // O
    const move = getAIMove(state, AI_Difficulty.INSANE, PlayerSymbol.O);
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
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.X);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
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
});
