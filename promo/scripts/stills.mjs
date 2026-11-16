// Pulls review stills from the rendered cuts: the hook, the win and the end
// card. Usage: node scripts/stills.mjs [seconds...]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const promoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(promoRoot, "out", "stills");
mkdirSync(out, { recursive: true });
const times = process.argv.slice(2).length ? process.argv.slice(2) : ["0.0", "8.0", "18.0"];
for (const cut of ["vertical-1080x1920", "square-1080x1080"]) {
  for (const t of times) {
    const png = join(out, `${cut}-${t}s.png`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", t, "-i", join(promoRoot, "out", `ttt-promo-${cut}.mp4`), "-frames:v", "1", png]);
    console.log(png);
  }
}
