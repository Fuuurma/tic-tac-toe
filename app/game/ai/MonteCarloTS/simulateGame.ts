/**
 * Simulates a random game from the given state until a terminal state is reached.
 * @param state The starting state for the simulation.
 * @param perspectivePlayer The player from whose perspective the result (+1 win, 0 draw, -1 loss) is calculated.
 * @returns 1 if perspectivePlayer wins, 0 for a draw, -1 if perspectivePlayer loses.
 */

import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

export function simulateRandomGame(
  state: GameState,
  perspectivePlayer: PlayerSymbol
): number {
  let currentState = state; // Start from the given state

  // is game active
  while (!isTerminal(currentState)) {
    const validMoves = getValidMoves(currentState);
    if (validMoves.length === 0) break; // Should not happen in TicTacToe unless already terminal
    const randomMove =
      validMoves[Math.floor(Math.random() * validMoves.length)];
    currentState = applyMove(currentState, randomMove); // Update the state
  }

  const winner = getWinner(currentState); // Or use currentState.winner

  if (winner === perspectivePlayer) {
    return 1; // Win for the perspective player
  } else if (winner === "draw") {
    return 0; // Draw
  } else {
    return -1; // Loss for the perspective player (opponent won)
  }
}
