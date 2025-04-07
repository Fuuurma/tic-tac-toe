import {
  Color,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { hasColorConflict } from "./hasColorConflict";
import { findAlternativeColor } from "./findAlternativeColor";
import { PlayerConfig } from "@/app/types/types";

/**
 * Determines the appropriate color for a joining player
 * @param joiningSymbol The symbol of the joining player
 * @param opponentData The existing opponent player data (if any)
 * @param preferredColor The color preferred by the joining player
 * @returns The final color to use, and whether it was changed from the preferred color
 */
export function determinePlayerColor(
  joiningSymbol: PlayerSymbol,
  opponentData: PlayerConfig | undefined,
  preferredColor: Color
): { finalColor: Color; wasChanged: boolean } {
  // If no opponent or opponent is inactive, use preferred color
  if (!opponentData?.isActive) {
    const finalColor =
      preferredColor || PLAYER_CONFIG[joiningSymbol].defaultColor;
    return { finalColor, wasChanged: false };
  }

  // Check for color conflict
  if (hasColorConflict(opponentData.color, preferredColor)) {
    const alternativeColor = findAlternativeColor(opponentData.color);
    return { finalColor: alternativeColor, wasChanged: true };
  }

  // No conflict, use preferred or default
  const finalColor =
    preferredColor || PLAYER_CONFIG[joiningSymbol].defaultColor;
  return { finalColor, wasChanged: false };
}
