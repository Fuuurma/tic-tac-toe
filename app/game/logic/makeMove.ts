import { GameState, WinningLine } from "@/app/types/types";
import { checkWinner } from "./checkWinner";
import { PlayerSymbol, TURN_DURATION_MS } from "../constants/constants";

export const makeMove = (gameState: GameState, index: number): GameState => {
  // Validate index bounds
  if (index < 0 || index >= gameState.board.length) {
    console.error(`Invalid move index: ${index}`);
    return gameState;
  }

  if (gameState.board[index] !== null || gameState.winner) {
    return gameState;
  }

  // Deep clone all nested state to prevent mutations
  const newGameState: GameState = {
    ...gameState,
    board: [...gameState.board],
    moves: {
      [PlayerSymbol.X]: [...gameState.moves[PlayerSymbol.X]],
      [PlayerSymbol.O]: [...gameState.moves[PlayerSymbol.O]],
    },
    nextToRemove: { ...gameState.nextToRemove },
  };

  const player = newGameState.currentPlayer;
  const playerMoves = newGameState.moves[player];

  // Check if player already has 3 pieces on board
  if (playerMoves.length >= 3) {
    // Remove the oldest piece
    const oldestMoveIndex = playerMoves.shift();
    if (oldestMoveIndex !== undefined) {
      newGameState.board[oldestMoveIndex] = null;
    }

    // Update nextToRemove for this player to null since we just removed a piece
    newGameState.nextToRemove[player] = null;
  }

  // Add new move
  playerMoves.push(index);
  newGameState.board[index] = player;
  newGameState.lastMoveIndex = index;

  // Check for winner
  const winnerResult = checkWinner(newGameState.board);
  newGameState.winner = winnerResult.winner;
  newGameState.winningCombination = winnerResult.winningCombination;

  // If no winner, switch player and update nextToRemove
  if (!newGameState.winner) {
    // Update nextToRemove before switching player
    // If player will have 3 pieces after this move, set the oldest as next to remove
    if (playerMoves.length === 3) {
      newGameState.nextToRemove[player] = playerMoves[0];
    }

    // Switch player
    newGameState.currentPlayer =
      player === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  }

  newGameState.turnTimeRemaining = TURN_DURATION_MS;

  return newGameState;
};
