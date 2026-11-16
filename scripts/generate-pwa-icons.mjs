// Generates the PWA PNG icons in public/ from public/favicon.svg — the single
// source of the XO mark, so the icons can never drift from the brand.
//
//   node scripts/generate-pwa-icons.mjs
//
// Variants:
//   icon-192 / icon-512   — the favicon as-is (rounded corners, "any" purpose)
//   icon-maskable-512     — full-bleed background, mark scaled to 0.75 so it
//                           stays inside the maskable 80% safe zone
//   apple-touch-icon      — full-bleed 180px; iOS applies its own mask and
//                           composites transparency as black
//
// Requires the repo's Playwright Chromium (pnpm exec playwright install).

import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const faviconPath = path.join(root, "public", "favicon.svg");
const svg = readFileSync(faviconPath, "utf8");

if (!svg.includes('rx="11"')) {
  throw new Error("favicon.svg lost its rounded background — icon variants need updating");
}

const MARK_OPEN = '<g transform="translate(-1 0)">';
if (!svg.includes(MARK_OPEN)) {
  throw new Error("favicon.svg lost its mark group — icon variants need updating");
}

const atSize = (markup, size) =>
  markup.replace('width="32" height="32"', `width="${size}" height="${size}"`);

// Full-bleed square: maskable and touch icons must paint to the edges.
const fullBleed = svg.replace('rx="11"', 'rx="0"');

// Wrap the mark group in a scale-about-center transform. The mark's own
// translate(-1 0) stays inside, so optical centering is preserved.
const wrapMark = (markup, transform) => {
  let out = markup.replace(MARK_OPEN, `<g transform="${transform}">${MARK_OPEN}`);
  const close = out.lastIndexOf("</g>");
  return out.slice(0, close + 4) + "</g>" + out.slice(close + 4);
};

const maskable = wrapMark(fullBleed, "translate(24 24) scale(0.75) translate(-24 -24)");

const targets = [
  { file: "icon-192.png", size: 192, markup: svg },
  { file: "icon-512.png", size: 512, markup: svg },
  { file: "icon-maskable-512.png", size: 512, markup: maskable },
  { file: "apple-touch-icon.png", size: 180, markup: fullBleed },
];

const browser = await chromium.launch();
try {
  for (const target of targets) {
    const page = await browser.newPage({
      viewport: { width: target.size, height: target.size },
    });
    await page.setContent(
      `<!doctype html><body style="margin:0">${atSize(target.markup, target.size)}</body>`,
    );
    await page.screenshot({
      path: path.join(root, "public", target.file),
      omitBackground: true,
    });
    await page.close();
    console.log(`wrote public/${target.file} (${target.size}x${target.size})`);
  }
} finally {
  await browser.close();
}
