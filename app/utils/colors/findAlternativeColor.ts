import { Color } from "@/app/game/constants/constants";

/**
 * Finds an alternative color when there is a conflict
 * @param existingColor The color already taken by another player
 * @param allColors Array of all available colors
 * @returns A different color that isn't the existing one
 */

export function findAlternativeColor(
  existingColor: Color,
  allColors: Color[] = Object.values(Color)
): Color {
  const availableColors = allColors.filter((color) => color !== existingColor);

  // This should never happen if there are at least 2 colors, but provide a fallback
  if (availableColors.length === 0) return allColors[0];

  return availableColors[Math.floor(Math.random() * availableColors.length)];
}
