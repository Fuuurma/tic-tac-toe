import { GameState } from "@/app/types/types";
import { findWinningMove } from "../logic/findWinningMove";
import { makeMove } from "../logic/makeMove";
import { PlayerSymbol } from "../constants/constants";

// AI logic for computer opponent
export const computerMove = (gameState: GameState): GameState => {
  if (gameState.winner || gameState.currentPlayer !== PlayerSymbol.O) {
    return gameState;
  }

  // Create a copy of the game state
  const newGameState = { ...gameState };

  // Priority 1: Check if computer can win with next move
  const winningMove = findWinningMove(newGameState, PlayerSymbol.O);
  if (winningMove !== -1) {
    return makeMove(newGameState, winningMove);
  }

  // Priority 2: Block player from winning
  const blockingMove = findWinningMove(newGameState, PlayerSymbol.X);
  if (blockingMove !== -1) {
    return makeMove(newGameState, blockingMove);
  }

  // Priority 3: Take center if available
  if (newGameState.board[4] === null) {
    return makeMove(newGameState, 4);
  }

  // Priority 4: Take any available corner
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(
    (index) => newGameState.board[index] === null
  );
  if (availableCorners.length > 0) {
    const randomCorner =
      availableCorners[Math.floor(Math.random() * availableCorners.length)];
    return makeMove(newGameState, randomCorner);
  }

  // Priority 5: Take any available side
  const sides = [1, 3, 5, 7];
  const availableSides = sides.filter(
    (index) => newGameState.board[index] === null
  );
  if (availableSides.length > 0) {
    const randomSide =
      availableSides[Math.floor(Math.random() * availableSides.length)];
    return makeMove(newGameState, randomSide);
  }

  // Fallback: Choose first available move (should rarely happen)
  const availableMoves = newGameState.board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);

  if (availableMoves.length > 0) {
    return makeMove(newGameState, availableMoves[0]);
  }

  // No moves available - return unchanged state
  return newGameState;
};
