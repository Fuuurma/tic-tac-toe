import { GameState } from "@/app/types/types";
import {
  CENTER_POSITION,
  CORNER_POSITIONS,
  PlayerSymbol,
  SIDE_POSITIONS,
} from "../../constants/constants";
import { isGameActive } from "../../logic/isGameActive";
import { getValidMoves } from "../../logic/getValidMoves";
import { takeRandomPositionFrom } from "./takeRandomPosition";
import { isPositionAvailable } from "./isPositionAvailable";
import { findStrategicMove } from "./findStrategicMove";

/**
 * Finds the best move using simple rule-based logic.
 * @param gameState The current game state.
 * @param aiSymbol The symbol the AI is playing as (needed for perspective).
 * @returns The index of the best move found, or -1 if no move is possible.
 */
export function findBestMoveEasyAI(
  gameState: GameState,
  aiSymbol: PlayerSymbol
): number {
  if (!gameState || !isGameActive(gameState)) return -1;

  const humanSymbol =
    aiSymbol === PlayerSymbol.O ? PlayerSymbol.X : PlayerSymbol.O;

  // Strategy Order:
  // 1. Win: Find winning move for AI
  const winningMove = findStrategicMove(gameState, aiSymbol);
  if (winningMove !== null) return winningMove;

  // 2. Block: Find winning move for Human and block it
  const blockingMove = findStrategicMove(gameState, humanSymbol);
  if (blockingMove !== null) return blockingMove;

  // 3. Center: Take the center if available
  if (isPositionAvailable(gameState, CENTER_POSITION)) return CENTER_POSITION;

  // 4. Corner: Take a random available corner
  const cornerMove = takeRandomPositionFrom(gameState, CORNER_POSITIONS);
  if (cornerMove !== null) return cornerMove;

  // 5. Side: Take a random available side
  const sideMove = takeRandomPositionFrom(gameState, SIDE_POSITIONS);
  if (sideMove !== null) return sideMove;

  // 6. Fallback: Take the first available empty cell
  const validMoves = getValidMoves(gameState);
  return validMoves.length > 0 ? validMoves[0] : -1;
}
