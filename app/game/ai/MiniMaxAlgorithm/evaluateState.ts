// Heuristic evaluation of a terminal state

import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

// Perspective of the AI (maximizing player)
export function evaluateState(
  state: GameState,
  aiSymbol: PlayerSymbol,
  depth: number
): number {
  const winner = state.winner;

  if (winner === aiSymbol) {
    return 1000 - depth; // AI wins - prefer winning sooner
  } else if (winner && winner !== "draw") {
    return -1000 + depth; // Opponent wins - prefer losing later
  } else {
    return 0; // Draw
  }
}
