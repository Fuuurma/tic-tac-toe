import { describe, it, expect } from "vitest";
import { checkWinner } from "@/app/game/logic/checkWinner";
import { PlayerSymbol } from "@/app/game/constants/constants";
import { createBoardWithMoves, WINNING_COMBINATIONS } from "../helpers/gameUtils";

describe("checkWinner", () => {
  describe("Winning conditions", () => {
    it("should detect X winning on top row", () => {
      const board = createBoardWithMoves([0, 1, 2], [3, 4]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.X);
      expect(result.winningCombination).toEqual([0, 1, 2]);
    });

    it("should detect O winning on middle row", () => {
      const board = createBoardWithMoves([0, 1], [3, 4, 5]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.O);
      expect(result.winningCombination).toEqual([3, 4, 5]);
    });

    it("should detect X winning on bottom row", () => {
      const board = createBoardWithMoves([6, 7, 8], [0, 1]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.X);
      expect(result.winningCombination).toEqual([6, 7, 8]);
    });

    it("should detect O winning on left column", () => {
      const board = createBoardWithMoves([1, 2], [0, 3, 6]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.O);
      expect(result.winningCombination).toEqual([0, 3, 6]);
    });

    it("should detect X winning on middle column", () => {
      const board = createBoardWithMoves([1, 4, 7], [0, 3]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.X);
      expect(result.winningCombination).toEqual([1, 4, 7]);
    });

    it("should detect O winning on right column", () => {
      const board = createBoardWithMoves([0, 3], [2, 5, 8]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.O);
      expect(result.winningCombination).toEqual([2, 5, 8]);
    });

    it("should detect X winning on main diagonal", () => {
      const board = createBoardWithMoves([0, 4, 8], [1, 2]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.X);
      expect(result.winningCombination).toEqual([0, 4, 8]);
    });

    it("should detect O winning on anti-diagonal", () => {
      const board = createBoardWithMoves([0, 1], [2, 4, 6]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.O);
      expect(result.winningCombination).toEqual([2, 4, 6]);
    });

    it("should detect winner for all 8 winning combinations", () => {
      WINNING_COMBINATIONS.forEach((combo, index) => {
        const board = createBoardWithMoves(combo, []);
        const result = checkWinner(board);
        expect(result.winner).toBe(PlayerSymbol.X);
        expect(result.winningCombination).toEqual(combo);
      });
    });
  });

  describe("Draw conditions", () => {
    it("should detect draw when board is full with no winner", () => {
      const board = createBoardWithMoves([0, 2, 5, 6, 7], [1, 3, 4, 8]);
      const result = checkWinner(board);
      expect(result.winner).toBe("draw");
      expect(result.winningCombination).toBeNull();
    });

    it("should detect draw with alternating pattern", () => {
      const board: (PlayerSymbol | null)[] = [
        PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.X,
        PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.O,
        PlayerSymbol.O, PlayerSymbol.X, PlayerSymbol.X,
      ];
      const result = checkWinner(board);
      expect(result.winner).toBe("draw");
      expect(result.winningCombination).toBeNull();
    });
  });

  describe("No winner yet", () => {
    it("should return null for empty board", () => {
      const board = createBoardWithMoves([], []);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should return null for partially filled board", () => {
      const board = createBoardWithMoves([0, 4], [1, 5]);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should return null when one move away from winning", () => {
      const board = createBoardWithMoves([0, 1], [3, 4]);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should return null with 5 moves on board (near full)", () => {
      const board = createBoardWithMoves([0, 2, 4], [1, 3]);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle board with single X move", () => {
      const board = createBoardWithMoves([4], []);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should handle board with single O move", () => {
      const board = createBoardWithMoves([], [4]);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should not detect winner with only 2 pieces in a row", () => {
      const board = createBoardWithMoves([0, 1], []);
      const result = checkWinner(board);
      expect(result.winner).toBeNull();
      expect(result.winningCombination).toBeNull();
    });

    it("should prioritize win over draw detection", () => {
      const board = createBoardWithMoves([0, 1, 2, 3, 4], [5, 6, 7, 8]);
      const result = checkWinner(board);
      expect(result.winner).toBe(PlayerSymbol.X);
      expect(result.winningCombination).toEqual([0, 1, 2]);
    });
  });
});
