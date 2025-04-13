import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { getValidMoves } from "../../logic/getValidMoves";
import { makeMove } from "../../logic/makeMove";

// Find immediate win or blocking move
export function findImmediateWinOrBlock(
  state: GameState,
  playerSymbol: PlayerSymbol
): number {
  const validMoves = getValidMoves(state);

  for (const move of validMoves) {
    // Create a simulation state where this move is played
    const simulationState = structuredClone(state);
    simulationState.currentPlayer = playerSymbol; // Set player for this simulation
    const nextState = makeMove(simulationState, move);

    // Check if this move results in a win
    if (nextState.winner === playerSymbol) {
      return move;
    }
  }

  return -1; // No immediate win found
}
