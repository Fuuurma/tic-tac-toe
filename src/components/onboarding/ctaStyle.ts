import type { CSSProperties } from "react";
import { COLOR_RGB, type Color } from "@/game/constants";

/** The lobby's Start button treatment: a glass CTA tinted to the player. */
export const ctaStyle = (color: Color): CSSProperties =>
  ({
    "--glass-sweep-color": COLOR_RGB[color],
    "--glass-tint": COLOR_RGB[color],
    "--glass-alpha": "0.15",
    "--glass-sheen": COLOR_RGB[color],
    "--glass-sheen-alpha": "0.25",
  }) as CSSProperties;
