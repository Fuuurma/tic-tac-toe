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
  // Find the first color that differs from the existing one
  // TODO: change to random color better
  const alternativeColor = allColors.find((color) => color !== existingColor);

  // This should never happen if there are at least 2 colors, but provide a fallback
  return alternativeColor || allColors[0];
}
