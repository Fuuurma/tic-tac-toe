import { Color } from "@/app/game/constants/constants";

/**
 * Checks if a player's preferred color conflicts with an existing player's color
 * @param player1_Color The color of the existing player
 * @param player2_Color The color preferred by the joining player
 * @returns True if there's a color conflict, false otherwise
 */
export function hasColorConflict(
  player1_Color: Color,
  player2_Color: Color
): boolean {
  return player1_Color === player2_Color;
}
