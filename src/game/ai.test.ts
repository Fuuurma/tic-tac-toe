import { describe, expect, it } from "vitest";
import { AI_Difficulty, PlayerSymbol } from "@/game/constants";
import { canAIMove, getAIMove } from "@/game/ai";
import { freshGameState, getValidMoves } from "@/game/logic";

describe("getAIMove", () => {
  it("returns a move on an empty board within the valid empty cells (EASY)", () => {
    const state = freshGameState();
    const move = getAIMove(state, AI_Difficulty.EASY, PlayerSymbol.O);
    expect(move).not.toBeNull();
    expect(getValidMoves(state.board)).toContain(move!);
  });

  it("blocks a winning threat (NORMAL uses heuristic)", () => {
    let state = freshGameState();
    state = make(state, 0, PlayerSymbol.X);
    state = make(state, 1, PlayerSymbol.X);
    state = { ...state, currentPlayer: PlayerSymbol.O };
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).toBe(2);
  });

  it("takes a winning move when available (NORMAL)", () => {
    let state = freshGameState();
    state = make(state, 0, PlayerSymbol.O);
    state = make(state, 1, PlayerSymbol.O);
    state = make(state, 3, PlayerSymbol.X);
    state = make(state, 4, PlayerSymbol.X);
    state = { ...state, currentPlayer: PlayerSymbol.O };
    const move = getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O);
    expect(move).toBe(2);
  });

  it("returns null when the board is full", () => {
    const state = freshGameState();
    state.board = Array(9).fill(PlayerSymbol.X);
    expect(getAIMove(state, AI_Difficulty.NORMAL, PlayerSymbol.O)).toBeNull();
  });

  it("HARD minimax picks a legal move", () => {
    let state = freshGameState();
    state = make(state, 4, PlayerSymbol.O);
    state = { ...state, currentPlayer: PlayerSymbol.O };
    const move = getAIMove(state, AI_Difficulty.HARD, PlayerSymbol.O);
    expect(getValidMoves(state.board)).toContain(move!);
  });
});

describe("canAIMove", () => {
  it("returns true when it is the AI's turn and there is a valid move", () => {
    const state = freshGameState();
    expect(canAIMove(state, PlayerSymbol.X)).toBe(true);
  });
  it("returns false when the symbol does not match the current player", () => {
    const state = freshGameState();
    expect(canAIMove(state, PlayerSymbol.O)).toBe(false);
  });
});

function make(
  state: ReturnType<typeof freshGameState>,
  index: number,
  symbol: PlayerSymbol,
) {
  return {
    ...state,
    board: state.board.map((c: PlayerSymbol | null, i: number) => (i === index ? symbol : c)),
    currentPlayer: symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X,
  };
}
