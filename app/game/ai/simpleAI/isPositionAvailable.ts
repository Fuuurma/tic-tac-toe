import { BoardPosition, GameState } from "@/app/types/types";

export function isPositionAvailable(
  gameState: GameState,
  position: BoardPosition
): boolean {
  return gameState.board[position] === null;
}
