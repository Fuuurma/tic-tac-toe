import { continueRender, delayRender, staticFile } from "remotion";

/**
 * The app's dark theme, as the video needs it. Sources: DESIGN.md (brand
 * cyan, cool hue-220 neutrals) and src/game/palette.ts (player chips). The
 * mark and the font files are copied from the app by scripts/sync-brand.mjs.
 */
export const COLORS = {
  pageTop: "#152028", // the app's dark theme-color
  pageBottom: "#090e11",
  cyan: "oklch(0.7 0.12 205)", // dark-theme ring
  cyanDeep: "oklch(0.55 0.16 205)", // brand primary
  text: "oklch(0.97 0.008 220)",
  muted: "oklch(0.76 0.02 220)",
  rim: "rgb(255 255 255 / 0.14)",
  x: "#007df3", // palette blue chip
  o: "#f53131", // palette red chip
} as const;

// Quoted: an unquoted family containing "3" is not a valid CSS identifier,
// so the whole declaration drops and the captions fall back to a serif.
export const FONTS = {
  display: '"Syne Variable", sans-serif', // wordmark only
  body: '"Source Sans 3 Variable", sans-serif',
} as const;

/** Standard ease-out for entrances; one curve family throughout. */
export const EASE_OUT = [0.2, 0, 0, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

let fontsRequested = false;

/** Loads the self-hosted brand faces before the first frame is captured. */
export function loadBrandFonts(): void {
  if (fontsRequested || typeof document === "undefined") return;
  fontsRequested = true;
  const handle = delayRender("brand fonts");
  const faces = [
    new FontFace("Syne Variable", `url(${staticFile("brand/syne-latin-wght.woff2")}) format("woff2")`, {
      weight: "400 800",
    }),
    new FontFace(
      "Source Sans 3 Variable",
      `url(${staticFile("brand/source-sans-3-latin-wght.woff2")}) format("woff2")`,
      { weight: "200 900" },
    ),
  ];
  Promise.all(faces.map((f) => f.load()))
    .then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      continueRender(handle);
    })
    .catch((err) => {
      throw err;
    });
}
