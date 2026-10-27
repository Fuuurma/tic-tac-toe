import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AVAILABLE_COLORS, COLOR_RGB, Color, oppositeColor } from "./constants";
import { CASING_LIGHT, PALETTE, hexToRgb } from "./palette";

// Read from disk: Vitest resolves `?raw` on a stylesheet to an empty string,
// which would turn every check below into a silent pass.
const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

// Same surfaces the board draws marks on: the frosted well's empty tile in
// light, the near-black well in dark.
const LIGHT_TILE = "#ecf3f6";
const DARK_TILE = "#0e1012";

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const oklab = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
/** Perceptual distance (OKLab x100). Under ~10 two colours are easy to mix up. */
const distance = (a: string, b: string) => {
  const [x, y] = [oklab(a), oklab(b)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

const cssBlocks = () => {
  // The light tokens live in @theme, the dark overrides in the dark-theme rule.
  const themeStart = indexCss.indexOf("@theme {");
  const theme = indexCss.slice(themeStart, indexCss.indexOf(':root[data-theme="dark"] {', themeStart));
  const darkStart = indexCss.lastIndexOf(':root[data-theme="dark"] {');
  const dark = indexCss.slice(darkStart, indexCss.indexOf("}", darkStart));
  return { theme, dark };
};
const token = (block: string, name: string) =>
  block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6}|transparent)\\s*;`))?.[1]?.toLowerCase();

describe("palette", () => {
  it("can read the stylesheet it guards", () => {
    expect(indexCss).toContain("@theme {");
  });

  it("has one entry per colour", () => {
    expect(Object.keys(PALETTE).sort()).toEqual([...AVAILABLE_COLORS].sort());
  });

  it("feeds COLOR_RGB, so the HUD, tints and canvas share the chip colour", () => {
    for (const color of AVAILABLE_COLORS) {
      expect(COLOR_RGB[color]).toBe(hexToRgb(PALETTE[color].chip).join(" "));
    }
  });

  describe("index.css agrees with it (the three-palettes-disagree bug)", () => {
    it.each(AVAILABLE_COLORS)("%s: chip, light mark and dark mark", (color) => {
      const { theme, dark } = cssBlocks();
      expect(token(theme, `color-${color}-500`)).toBe(PALETTE[color].chip);
      expect(token(theme, `color-mark-${color}`)).toBe(PALETTE[color].markLight);
      expect(token(dark, `color-mark-${color}`)).toBe(PALETTE[color].chip);
    });

    it("yellow's casing shows in light and disappears in dark", () => {
      const { theme, dark } = cssBlocks();
      expect(token(indexCss, "mark-casing-yellow")).toBe(CASING_LIGHT[Color.YELLOW]);
      expect(token(dark, "mark-casing-yellow")).toBe("transparent");
      expect(theme).toBeTruthy();
    });
  });

  describe("light marks on the board tile", () => {
    it.each(AVAILABLE_COLORS.filter((c) => c !== Color.YELLOW))("%s reads at about 3:1 or better", (color) => {
      expect(contrast(PALETTE[color].markLight, LIGHT_TILE)).toBeGreaterThanOrEqual(2.9);
    });

    it("yellow's fill is pale by nature, so its casing must carry 3:1", () => {
      const casing = CASING_LIGHT[Color.YELLOW];
      expect(casing).toBeDefined();
      expect(contrast(casing!, LIGHT_TILE)).toBeGreaterThanOrEqual(3.5);
    });

    it("yellow is yellow, not amber (hue 70 read as orange)", () => {
      const [, a, b] = oklab(PALETTE[Color.YELLOW].markLight);
      const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
      expect(hue).toBeGreaterThan(90);
      expect(hue).toBeLessThan(105);
    });

    it("no two colours are easy to confuse", () => {
      for (let i = 0; i < AVAILABLE_COLORS.length; i++) {
        for (let j = i + 1; j < AVAILABLE_COLORS.length; j++) {
          const [a, b] = [AVAILABLE_COLORS[i], AVAILABLE_COLORS[j]];
          expect(distance(PALETTE[a].markLight, PALETTE[b].markLight), `${a}/${b}`).toBeGreaterThanOrEqual(11);
        }
      }
    });
  });

  describe("dark marks on the dark well", () => {
    it.each(AVAILABLE_COLORS)("%s reads at 3:1 or better", (color) => {
      expect(contrast(PALETTE[color].chip, DARK_TILE)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("oppositeColor", () => {
  it.each(AVAILABLE_COLORS)("%s gets an opponent you can tell apart at a glance", (color) => {
    // Orange used to face yellow: the two nearest hues in the set.
    const opposite = oppositeColor(color);
    expect(opposite).not.toBe(color);
    expect(distance(PALETTE[color].markLight, PALETTE[opposite].markLight)).toBeGreaterThanOrEqual(25);
    expect(distance(PALETTE[color].chip, PALETTE[opposite].chip)).toBeGreaterThanOrEqual(25);
  });
});
