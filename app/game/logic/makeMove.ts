import { GameState } from "@/app/types/types";
import { checkWinner } from "./checkWinner";
import { PlayerSymbol } from "../constants/constants";

export const makeMove = (gameState: GameState, index: number): GameState => {
  if (gameState.board[index] !== null || gameState.winner) {
    return gameState;
  }

  const newGameState = {
    ...gameState,
    nextToRemove: { ...gameState.nextToRemove },
  };
  const player = newGameState.currentPlayer;
  const playerMoves = [...newGameState.moves[player]];

  // Check if player already has 3 pieces on board
  if (playerMoves.length >= 3) {
    // Remove the oldest piece
    const oldestMoveIndex = playerMoves.shift() as number;
    newGameState.board[oldestMoveIndex] = null;

    // Update nextToRemove for this player to null since we just removed a piece
    newGameState.nextToRemove[player] = null;
  }

  // Add new move
  playerMoves.push(index);
  newGameState.moves[player] = playerMoves;
  newGameState.board[index] = player;

  // Check for winner
  newGameState.winner = checkWinner(newGameState.board);

  // If no winner, switch player and update nextToRemove
  if (!newGameState.winner) {
    // Update nextToRemove before switching player
    // If player will have 3 pieces after this move, set the oldest as next to remove
    if (playerMoves.length === 3) {
      newGameState.nextToRemove[player] = playerMoves[0];
    }

    // Switch player
    // newGameState.currentPlayer = player === "X" ? "O" : "X";
    newGameState.currentPlayer =
      player === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  }

  return newGameState;
};
