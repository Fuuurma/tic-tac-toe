import { describe, it, expect, beforeEach } from "vitest";
import { makeMove } from "@/app/game/logic/makeMove";
import { PlayerSymbol, GameStatus, GAME_RULES } from "@/app/game/constants/constants";
import { GameState } from "@/app/types/types";
import { createMockGameState } from "../helpers/gameUtils";

describe("makeMove", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createMockGameState();
  });

  describe("Valid moves", () => {
    it("should place X in center position", () => {
      const newState = makeMove(gameState, 4);
      expect(newState.board[4]).toBe(PlayerSymbol.X);
      expect(newState.currentPlayer).toBe(PlayerSymbol.O);
    });

    it("should place X in corner position", () => {
      const newState = makeMove(gameState, 0);
      expect(newState.board[0]).toBe(PlayerSymbol.X);
      expect(newState.currentPlayer).toBe(PlayerSymbol.O);
    });

    it("should switch player after valid move", () => {
      const newState = makeMove(gameState, 4);
      expect(newState.currentPlayer).toBe(PlayerSymbol.O);
    });

    it("should track moves in moves array", () => {
      const state1 = makeMove(gameState, 4);
      expect(state1.moves[PlayerSymbol.X]).toEqual([4]);
      
      const state2 = makeMove(state1, 0);
      expect(state2.moves[PlayerSymbol.O]).toEqual([0]);
    });

    it("should not mutate original state", () => {
      const originalBoard = [...gameState.board];
      const originalMovesX = [...gameState.moves[PlayerSymbol.X]];
      
      makeMove(gameState, 4);
      
      expect(gameState.board).toEqual(originalBoard);
      expect(gameState.moves[PlayerSymbol.X]).toEqual(originalMovesX);
    });
  });

  describe("Invalid moves", () => {
    it("should return unchanged state for negative index", () => {
      const newState = makeMove(gameState, -1);
      expect(newState).toEqual(gameState);
    });

    it("should return unchanged state for index out of bounds", () => {
      const newState = makeMove(gameState, 9);
      expect(newState).toEqual(gameState);
    });

    it("should return unchanged state when cell is already occupied", () => {
      const state1 = makeMove(gameState, 4);
      const state2 = makeMove(state1, 4);
      
      expect(state2).toEqual(state1);
    });

    it("should return unchanged state when there is already a winner", () => {
      const winningState = createMockGameState({
        winner: PlayerSymbol.X,
        board: [
          PlayerSymbol.X, PlayerSymbol.X, PlayerSymbol.X,
          null, null, null,
          null, null, null,
        ],
      });
      
      const newState = makeMove(winningState, 4);
      expect(newState).toEqual(winningState);
    });
  });

  describe("3-piece rule (piece removal)", () => {
    it("should remove oldest piece when player tries to place 4th piece", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 3);
      state = makeMove(state, 5);
      state = makeMove(state, 4);
      state = makeMove(state, 1);
      state = makeMove(state, 6);
      state = makeMove(state, 8);
      
      expect(state.board[0]).toBe(null);
      expect(state.moves[PlayerSymbol.X]).toEqual([5, 1, 8]);
    });

    it("should maintain exactly 3 pieces per player max", () => {
      let state = gameState;
      
      for (let i = 0; i < 12; i++) {
        state = makeMove(state, i % 9);
      }
      
      const xCount = state.board.filter((c) => c === PlayerSymbol.X).length;
      const oCount = state.board.filter((c) => c === PlayerSymbol.O).length;
      
      expect(xCount).toBeLessThanOrEqual(GAME_RULES.MAX_MOVES_PER_PLAYER);
      expect(oCount).toBeLessThanOrEqual(GAME_RULES.MAX_MOVES_PER_PLAYER);
    });

    it("should update nextToRemove when player has 3 pieces", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 3);
      state = makeMove(state, 5);
      state = makeMove(state, 4);
      state = makeMove(state, 1);
      
      expect(state.nextToRemove[PlayerSymbol.X]).toBe(0);
    });

    it("should reset nextToRemove after piece is removed", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 3);
      state = makeMove(state, 5);
      state = makeMove(state, 4);
      state = makeMove(state, 1);
      state = makeMove(state, 6);
      state = makeMove(state, 8);
      
      expect(state.nextToRemove[PlayerSymbol.X]).toBe(5);
    });
  });

  describe("Winner detection", () => {
    it("should detect X winning on top row", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 3);
      state = makeMove(state, 1);
      state = makeMove(state, 4);
      state = makeMove(state, 2);
      
      expect(state.winner).toBe(PlayerSymbol.X);
    });

    it("should detect O winning on diagonal", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 2);
      state = makeMove(state, 1);
      state = makeMove(state, 4);
      state = makeMove(state, 3);
      state = makeMove(state, 6);
      
      expect(state.winner).toBe(PlayerSymbol.O);
    });

    it("should not switch player when game is won", () => {
      let state = gameState;
      
      state = makeMove(state, 0);
      state = makeMove(state, 3);
      state = makeMove(state, 1);
      state = makeMove(state, 4);
      state = makeMove(state, 2);
      
      expect(state.currentPlayer).toBe(PlayerSymbol.X);
    });
  });

  describe("Turn timer", () => {
    it("should reset turn time remaining after each move", () => {
      const state1 = makeMove(gameState, 4);
      expect(state1.turnTimeRemaining).toBe(10000);
    });
  });
});