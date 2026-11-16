// UI self-review captures for TTT-NPC-NAMES1 (personas on the vs-computer flow).
// Serves the production dist/ build (already built by deploy:check) and saves
// phone + desktop screenshots of the lobby card, the in-game panel and the
// thinking turn line. Run: node scripts/capture-personas.mjs
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;
const PORT = 4173;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json",
};

const server = createServer(async (req, res) => {
  const path = req.url.split("?")[0];
  const file = join(DIST, path === "/" ? "index.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    const body = await readFile(join(DIST, "index.html"));
    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

const browser = await chromium.launch();
for (const [name, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("tic-tac-toe:onboarding", "skipped");
    } catch {}
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.getByRole("button", { name: "Edit opponent settings" }).waitFor();
  await page.screenshot({ path: `reports/npc-personas-${name}-lobby.png`, fullPage: false });

  await page.getByRole("button", { name: "Start Game" }).click();
  await page.getByRole("group", { name: "Tic Tac Toe game board" }).waitFor();
  // Give the AI its turn if the human opened, so the thinking line is up.
  const empty = page.locator('button[aria-label$=", empty"]');
  if ((await empty.count()) === 9) {
    await empty.first().click();
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `reports/npc-personas-${name}-game.png`, fullPage: false });
  await context.close();
}
await browser.close();
server.close();
console.log("captured");
