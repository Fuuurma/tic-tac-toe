import { BoardPosition, GameState } from "@/app/types/types";
import { PlayerSymbol, WINNING_COMBINATIONS } from "../../constants/constants";
import { getLineState } from "./getLineState";
import { findCriticalMoveInLine } from "./findCriticalMove";

export function findStrategicMove(
  gameState: GameState,
  symbol: PlayerSymbol
): BoardPosition | null {
  for (const line of WINNING_COMBINATIONS) {
    const lineContent = getLineState(gameState.board, line);

    const criticalMove = findCriticalMoveInLine(line, lineContent, symbol);
    if (criticalMove !== null) {
      return criticalMove;
    }
  }
  return null;
}
