import { BoardPosition, GameState } from "@/app/types/types";
import { isPositionAvailable } from "./isPositionAvailable";

export function takeRandomPositionFrom(
  gameState: GameState,
  positions: BoardPosition[]
): BoardPosition | null {
  const available = positions.filter((position) =>
    isPositionAvailable(gameState, position)
  );

  return available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : null;
}
