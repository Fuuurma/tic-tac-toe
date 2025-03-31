import { GameState } from "@/app/types/types";
import { checkWinner } from "./checkWinner";

export const makeMove = (gameState: GameState, index: number): GameState => {
  if (gameState.board[index] !== null || gameState.winner) {
    return gameState;
  }

  const newGameState = { ...gameState };
  const player = newGameState.currentPlayer;
  const playerMoves = [...newGameState.moves[player]];

  // Check if player already has 3 pieces on board
  if (playerMoves.length >= 3) {
    // Remove the oldest piece
    const oldestMoveIndex = playerMoves.shift() as number;
    newGameState.board[oldestMoveIndex] = null;
  }

  // Add new move
  playerMoves.push(index);
  newGameState.moves[player] = playerMoves;
  newGameState.board[index] = player;

  // Check for winner
  newGameState.winner = checkWinner(newGameState.board);

  // Switch player if no winner
  if (!newGameState.winner) {
    newGameState.currentPlayer = player === "X" ? "O" : "X";
  }

  return newGameState;
};
