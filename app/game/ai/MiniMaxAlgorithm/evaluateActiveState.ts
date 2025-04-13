import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

export function evaluateActiveState(
  gameState: GameState,
  AI_Symbol: PlayerSymbol
): number {
  // Non-terminal state evaluation (heuristic scoring)
  const humanSymbol =
    AI_Symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  const board = gameState.board;
  let score = 0;

  return 0;
}
