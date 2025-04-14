import { GameState } from "@/app/types/types";
import { isGameActive } from "./isGameActive";

/**
 * Returns an array of valid move indices for the current game state
 *
 * This function determines which board positions are available for the current player
 * to make a move based on the game's rules and current state.
 *
 * @param state - The current game state
 * @returns An array of board indices (0-8) where moves are valid
 *
 * @complexity Time: O(n) where n is the board size (typically 9 for tic-tac-toe)
 * @complexity Space: O(n) in worst case if all cells are empty
 */
export function getValidMoves(gameState: GameState): number[] {
  if (!isGameActive(gameState)) return [];

  const validMoves: number[] = [];

  for (let i = 0; i < gameState.board.length; i++) {
    if (gameState.board[i] === null) {
      validMoves.push(i);
    }
  }

  return validMoves;
}
