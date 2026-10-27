import type { Color } from "./constants";

/**
 * The one definition of every player colour. `index.css` carries the same hex
 * values as tokens (`--color-<name>-500`, `--color-mark-<name>`); a test
 * parses the stylesheet and fails if the two drift, which is how the marks,
 * the HUD chips and the canvas background used to end up three shades apart.
 *
 * - `chip` is the identity colour: HUD chips, tints, the canvas field, and the
 *   mark in dark mode, where every colour clears 3:1 on the dark well.
 * - `markLight` is the mark on the light well. Hue-matched to `chip` (yellow
 *   was hue 71 there, which read as orange) and no darker than it needs to be.
 */
export interface PaletteEntry {
  chip: string;
  markLight: string;
}

export const PALETTE: Record<Color, PaletteEntry> = {
  blue: { chip: "#007df3", markLight: "#155dfc" },
  red: { chip: "#f53131", markLight: "#e7000b" },
  green: { chip: "#45ba50", markLight: "#059a46" },
  yellow: { chip: "#e5c226", markLight: "#ddbc0b" },
  orange: { chip: "#f37513", markLight: "#dc7106" },
  pink: { chip: "#fb5c99", markLight: "#e60076" },
  purple: { chip: "#8047e1", markLight: "#9810fa" },
  gray: { chip: "#6b7376", markLight: "#4a5565" },
};

/**
 * A pale yellow cannot reach 3:1 on a near-white tile without turning olive
 * (the fill alone is 1.7:1), so on light it carries a darker edge instead and
 * keeps its hue. Dark needs none.
 */
export const CASING_LIGHT: Partial<Record<Color, string>> = {
  yellow: "#977502",
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
