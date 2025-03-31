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
