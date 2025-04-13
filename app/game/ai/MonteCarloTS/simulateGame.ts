import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { makeMove } from "../../logic/makeMove";
import { checkWinner } from "../../logic/checkWinner";
import { getValidMoves } from "../../logic/getValidMoves";
import { isGameActive } from "../../logic/isGameActive";

/**
 * Simulates a random game from the given state until a terminal state is reached.
 * @param state The starting state for the simulation.
 * @param perspectivePlayer The player from whose perspective the result (+1 win, 0 draw, -1 loss) is calculated.
 * @returns 1 if perspectivePlayer wins, 0 for a draw, -1 if perspectivePlayer loses.
 */

export function simulateRandomGame(
  gameState: GameState,
  perspectivePlayer: PlayerSymbol
): number {
  let simulationState = structuredClone(gameState);

  // Play random moves until game over
  while (isGameActive(simulationState)) {
    const validMoves = getValidMoves(simulationState);
    if (validMoves.length === 0) break;

    const randomMoveIndex = Math.floor(Math.random() * validMoves.length);
    const randomMove = validMoves[randomMoveIndex];

    // Apply move
    const nextState = makeMove(simulationState, randomMove);

    // Update simulation state
    simulationState = nextState;
  }

  // Determine outcome from perspective of the starting player
  if (simulationState.winner === perspectivePlayer) {
    return 1; // Win
  } else if (simulationState.winner === "draw") {
    return 0; // Draw
  } else {
    return -1; // Loss
  }
}
