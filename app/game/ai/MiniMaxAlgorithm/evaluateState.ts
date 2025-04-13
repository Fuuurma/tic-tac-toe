// Heuristic evaluation of a terminal state

import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

// Perspective of the AI (maximizing player)
export function evaluateState(
  state: GameState,
  AI_Symbol: PlayerSymbol
): number {
  const winner = state.winner;
  if (winner === AI_Symbol) {
    return 10; // AI wins - High positive score
  } else if (winner && winner !== "draw") {
    return -10; // Opponent wins - High negative score
  } else {
    return 0; // Draw or non-terminal state (less useful here)
  }
}
