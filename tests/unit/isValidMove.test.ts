import { describe, it, expect, beforeEach } from "vitest";
import { isValidMove } from "@/app/game/logic/isValidMove";
import { PlayerSymbol, GameStatus } from "@/app/game/constants/constants";
import { GameState } from "@/app/types/types";
import { createMockGameState } from "../helpers/gameUtils";

describe("isValidMove", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createMockGameState();
  });

  describe("Valid moves", () => {
    it("should return true for valid empty cell", () => {
      expect(isValidMove(gameState, 4, true)).toBe(true);
    });

    it("should return true for any empty cell on fresh board", () => {
      for (let i = 0; i < 9; i++) {
        expect(isValidMove(gameState, i, true)).toBe(true);
      }
    });

    it("should return true for move in active game", () => {
      const state = createMockGameState({
        gameStatus: GameStatus.ACTIVE,
        board: [PlayerSymbol.X, null, null, null, null, null, null, null, null],
        currentPlayer: PlayerSymbol.O,
      });
      expect(isValidMove(state, 1, true)).toBe(true);
    });
  });

  describe("Invalid moves - Not logged in", () => {
    it("should return false when user is not logged in", () => {
      expect(isValidMove(gameState, 4, false)).toBe(false);
    });
  });

  describe("Invalid moves - Game status", () => {
    it("should return false when game is waiting", () => {
      const state = createMockGameState({ gameStatus: GameStatus.WAITING });
      expect(isValidMove(state, 4, true)).toBe(false);
    });

    it("should return false when game is completed", () => {
      const state = createMockGameState({ gameStatus: GameStatus.COMPLETED });
      expect(isValidMove(state, 4, true)).toBe(false);
    });
  });

  describe("Invalid moves - Winner exists", () => {
    it("should return false when there is a winner", () => {
      const state = createMockGameState({
        winner: PlayerSymbol.X,
        gameStatus: GameStatus.COMPLETED,
      });
      expect(isValidMove(state, 4, true)).toBe(false);
    });
  });

  describe("Invalid moves - Cell occupied", () => {
    it("should return false when cell has X", () => {
      const state = createMockGameState({
        board: [PlayerSymbol.X, null, null, null, null, null, null, null, null],
      });
      expect(isValidMove(state, 0, true)).toBe(false);
    });

    it("should return false when cell has O", () => {
      const state = createMockGameState({
        board: [PlayerSymbol.O, null, null, null, null, null, null, null, null],
        currentPlayer: PlayerSymbol.O,
      });
      expect(isValidMove(state, 0, true)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle all cells filled", () => {
      const state = createMockGameState({
        board: [
          PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.X,
          PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.O,
          PlayerSymbol.O, PlayerSymbol.X, PlayerSymbol.X,
        ],
        winner: "draw",
        gameStatus: GameStatus.COMPLETED,
      });
      
      for (let i = 0; i < 9; i++) {
        expect(isValidMove(state, i, true)).toBe(false);
      }
    });

    it("should validate correctly with partial board", () => {
      const state = createMockGameState({
        board: [
          PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.X,
          null, null, null,
          null, null, null,
        ],
      });
      
      expect(isValidMove(state, 0, true)).toBe(false);
      expect(isValidMove(state, 3, true)).toBe(true);
    });
  });
});