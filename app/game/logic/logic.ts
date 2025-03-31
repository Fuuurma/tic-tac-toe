import { GameBoard, GameState, PlayerType } from "@/app/types/types";
import { checkWinner } from "./checkWinner";
import { winningCombinations } from "../constants/constants";

export const initialGameState: GameState = {
  board: Array(9).fill(null),
  currentPlayer: "X",
  winner: null,
  players: {
    X: null,
    O: null,
  },
  moves: {
    X: [],
    O: [],
  },
  gameMode: "human",
};

// Make a move and handle the 3-active-pieces rule
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

// Helper function to find a winning move for a player
export const findWinningMove = (
  gameState: GameState,
  player: PlayerType
): number => {
  // Check each winning combination
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    const values = [gameState.board[a], gameState.board[b], gameState.board[c]];

    // Check if we can win in this combination
    if (
      values.filter((v) => v === player).length === 2 &&
      values.includes(null)
    ) {
      // Find the empty position
      if (gameState.board[a] === null) return a;
      if (gameState.board[b] === null) return b;
      if (gameState.board[c] === null) return c;
    }
  }

  return -1; // No winning move found
};
