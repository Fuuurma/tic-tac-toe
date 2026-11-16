// Copies the app's brand assets into public/brand so the video uses the same
// mark and the same font files the app ships. The app stays the source of
// truth: rerun this (it runs before every render) instead of editing the copies.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const promoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = resolve(promoRoot, "..");
const out = join(promoRoot, "public", "brand");
mkdirSync(out, { recursive: true });

const fonts = join(appRoot, "node_modules", "@fontsource-variable");
const copies = [
  [join(appRoot, "public", "favicon.svg"), "mark.svg"],
  [join(fonts, "syne", "files", "syne-latin-wght-normal.woff2"), "syne-latin-wght.woff2"],
  [
    join(fonts, "source-sans-3", "files", "source-sans-3-latin-wght-normal.woff2"),
    "source-sans-3-latin-wght.woff2",
  ],
];
for (const [from, name] of copies) {
  copyFileSync(from, join(out, name));
  console.log(`brand: ${name}`);
}
