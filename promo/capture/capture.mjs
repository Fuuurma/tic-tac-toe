// Scripted gameplay captures for the promo video.
//
// Drives the real app (a local `vite preview` of the repo's dist/) in a phone
// viewport and records it with the Chrome DevTools screencast, which keeps
// the device-pixel-ratio-3 frames sharp where Playwright's recordVideo would
// re-encode them soft. Each clip lands in public/captures/<clip>.mp4 with a
// <clip>.json beside it: the tap points and the moments the composition cuts
// on, measured from the clip's first frame.
//
// Prerequisites (see README): the app built against the local Worker, and the
// matchmaking Worker on 127.0.0.1:8787 for the online clip.

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const promoRoot = resolve(here, "..");
const appRoot = resolve(promoRoot, "..");
const framesRoot = join(here, ".frames");
const outDir = join(promoRoot, "public", "captures");

const PORT = 3199;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKER_URL = "http://127.0.0.1:8787";
const VIEWPORT = { width: 390, height: 844 };
const DPR = 3;
const FPS = 30;
const OUTPUT_WIDTH = 1080; // 1170 css*3 scaled to the video width

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`server at ${url} did not come up`);
}

async function reachable(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** Seeds Math.random so the easy AI and the room code repeat run to run. */
function seedScript(seed) {
  return `(() => {
    let a = ${seed} >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();`;
}

async function newPhoneContext(browser, { name, seed }) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE_URL });
  await ctx.addInitScript(
    ({ name }) => {
      localStorage.setItem("tic-tac-toe:onboarding", "skipped");
      localStorage.setItem("tic-tac-toe:displayName", name);
      localStorage.setItem(
        "tic-tac-toe:preferences",
        JSON.stringify({ theme: "dark", aiDifficulty: "EASY" }),
      );
    },
    { name },
  );
  if (seed !== undefined) await ctx.addInitScript(seedScript(seed));
  return ctx;
}

/**
 * Screencast recorder. Frames arrive only when the page paints, each with a
 * wall-clock timestamp, so the concat list gives every frame its true
 * on-screen duration and the clip plays back at real speed.
 */
class Recorder {
  constructor(page, clip) {
    this.page = page;
    this.clip = clip;
    this.dir = join(framesRoot, clip);
    this.frames = [];
    this.events = [];
    this.taps = [];
  }

  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      const file = join(this.dir, `${String(this.frames.length).padStart(5, "0")}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      this.frames.push({ file, t: metadata.timestamp });
      await this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 92,
      maxWidth: VIEWPORT.width * DPR,
      maxHeight: VIEWPORT.height * DPR,
      everyNthFrame: 1,
    });
    // Screencast timestamps are wall-clock seconds; anchor events to them.
    while (this.frames.length === 0) await sleep(20);
  }

  now() {
    return Date.now() / 1000 - this.frames[0].t;
  }

  mark(name) {
    this.events.push({ name, t: this.now() });
  }

  /** Taps a locator like a finger and logs the point for the overlay. */
  async tap(locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("tap target has no box");
    this.taps.push({
      t: this.now(),
      x: (box.x + box.width / 2) / VIEWPORT.width,
      y: (box.y + box.height / 2) / VIEWPORT.height,
    });
    await locator.tap();
  }

  async stop() {
    // Hold the last state so the final frame has a real duration.
    await sleep(600);
    await this.cdp.send("Page.stopScreencast");
    await sleep(100);
    const end = Date.now() / 1000;
    const lines = [];
    this.frames.forEach((f, i) => {
      const next = i + 1 < this.frames.length ? this.frames[i + 1].t : end;
      lines.push(`file '${f.file}'`, `duration ${Math.max(next - f.t, 1 / FPS).toFixed(4)}`);
    });
    // The concat demuxer ignores the last duration unless the file repeats.
    lines.push(`file '${this.frames.at(-1).file}'`);
    const list = join(this.dir, "list.txt");
    writeFileSync(list, lines.join("\n"));
    mkdirSync(outDir, { recursive: true });
    const mp4 = join(outDir, `${this.clip}.mp4`);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", list,
      "-vf", `fps=${FPS},scale=${OUTPUT_WIDTH}:-2:flags=lanczos,format=yuv420p`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "20",
      "-movflags", "+faststart",
      mp4,
    ]);
    const duration = end - this.frames[0].t;
    const meta = {
      clip: this.clip,
      fps: FPS,
      durationSec: Number(duration.toFixed(3)),
      viewport: VIEWPORT,
      events: this.events.map((e) => ({ ...e, t: Number(e.t.toFixed(3)) })),
      taps: this.taps.map((p) => ({
        t: Number(p.t.toFixed(3)),
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(4)),
      })),
    };
    writeFileSync(join(outDir, `${this.clip}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`captured ${this.clip}: ${duration.toFixed(2)}s, ${this.frames.length} frames`);
  }
}

const board = (page) => page.getByRole("group", { name: "Tic Tac Toe game board" });

async function readBoard(page) {
  const labels = await board(page)
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  return labels.map((l) => (l.endsWith("by X") ? "X" : l.endsWith("by O") ? "O" : null));
}

const cellLocator = (page, i) =>
  board(page).getByRole("button", { name: new RegExp(`^Row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1},`) });

const lineOf = (marks) => LINES.some((l) => l.every((c) => marks.includes(c)));

/**
 * Picks the human's move. The rule is "three marks each, the oldest
 * disappears", so a candidate is judged on the marks that survive placing it.
 * `allowWin` holds the finish back until the clip has shown a mark vanish.
 */
function chooseMove(cells, mine, theirs, allowWin) {
  const empty = cells.flatMap((c, i) => (c === null ? [i] : []));
  const after = (list, c) => [...list, c].slice(-3);
  const wins = empty.filter((c) => lineOf(after(mine, c)));
  if (wins.length && allowWin) return wins[0];
  const blocks = empty.filter((c) => lineOf(after(theirs, c)));
  const safe = empty.filter((c) => !wins.includes(c));
  const pool = blocks.filter((c) => !wins.includes(c));
  if (pool.length) return pool[0];
  for (const c of [4, 0, 8, 2, 6, 1, 3, 5, 7]) if (safe.includes(c)) return c;
  return empty[0];
}

async function captureVsComputer(browser) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const seed = 1116 + attempt;
    const ctx = await newPhoneContext(browser, { name: "You", seed });
    const page = await ctx.newPage();
    await page.goto(BASE_URL);
    await page.getByRole("radio", { name: "Computer" }).waitFor();
    await sleep(900); // let the symbol field settle in
    const rec = new Recorder(page, "vs-computer");
    await rec.start();
    await sleep(700);
    await rec.tap(page.getByRole("radio", { name: "Computer" }));
    await sleep(500);
    await rec.tap(page.getByRole("button", { name: "Start Game" }));
    await board(page).waitFor();
    rec.mark("gameStart");

    const mine = [];
    const theirs = [];
    let prev = Array(9).fill(null);
    let outcome = null;
    for (let turn = 0; turn < 40 && !outcome; turn++) {
      // Wait for the AI to move or for our turn to open up.
      const deadline = Date.now() + 8000;
      let cells;
      for (;;) {
        cells = await readBoard(page);
        if (await page.getByRole("button", { name: "Play again" }).isVisible()) break;
        const empty = cells.findIndex((c) => c === null);
        if (empty >= 0 && (await cellLocator(page, empty).isEnabled())) break;
        if (Date.now() > deadline) break;
        await sleep(60);
      }
      cells.forEach((c, i) => {
        if (c === "O" && prev[i] !== "O") theirs.push(i);
      });
      if (await page.getByRole("button", { name: "Play again" }).isVisible()) {
        outcome = lineOf(theirs.slice(-3)) ? "loss" : "other";
        break;
      }
      await sleep(450 + (turn % 3) * 120); // a human beat before tapping
      const vanished = mine.length >= 3;
      const move = chooseMove(cells, mine, theirs, mine.length >= 3);
      if (vanished) rec.mark("disappear");
      await rec.tap(cellLocator(page, move));
      mine.push(move);
      await sleep(250);
      prev = await readBoard(page);
      if (lineOf(mine.slice(-3))) {
        rec.mark("win");
        outcome = "win";
      }
    }

    if (outcome === "win" && rec.events.some((e) => e.name === "disappear")) {
      await page.getByRole("button", { name: "Play again" }).waitFor();
      await sleep(1800); // the crown and line flourish, then a beat of rest
      await rec.stop();
      await ctx.close();
      console.log(`vs-computer: seed ${seed} won after ${mine.length} moves`);
      return;
    }
    console.log(`vs-computer: seed ${seed} ended ${outcome ?? "unfinished"}, retrying`);
    await rec.cdp.send("Page.stopScreencast").catch(() => {});
    await ctx.close();
  }
  throw new Error("no winning vs-computer take in 16 seeds");
}

async function captureOnlineInvite(browser) {
  const hostCtx = await newPhoneContext(browser, { name: "You", seed: 7 });
  const guestCtx = await newPhoneContext(browser, { name: "Maya" });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  await host.goto(BASE_URL);
  await host.getByRole("radio", { name: "Online" }).waitFor();
  await sleep(900);

  const rec = new Recorder(host, "online-invite");
  await rec.start();
  await sleep(600);
  await rec.tap(host.getByRole("radio", { name: "Online" }));
  await sleep(600);
  await rec.tap(host.getByRole("radio", { name: "Create", exact: true }));
  await sleep(500);
  await rec.tap(host.getByRole("button", { name: "Create Room" }));
  await host.getByText("Room ready").waitFor({ timeout: 30_000 });
  rec.mark("roomReady");
  await sleep(900);
  await rec.tap(host.getByRole("button", { name: "Copy link" }));
  rec.mark("copied");
  const code = ((await host.getByText(/^Room code \S+/).textContent()) ?? "")
    .replace(/^Room code\s+/, "")
    .trim();
  await sleep(1400);

  await guest.goto(`${BASE_URL}/?room=${code}`);
  await guest.getByRole("radio", { name: "Join", exact: true }).click().catch(() => {});
  await guest.getByRole("button", { name: "Join Room" }).click();
  await host.getByText("Opponent joined").waitFor({ timeout: 30_000 });
  rec.mark("joined");
  await board(host).waitFor({ timeout: 30_000 });
  rec.mark("board");
  await sleep(1500);

  // One opening move each, so the clip ends on a live online board.
  const hostFirst = await cellLocator(host, 4).isEnabled();
  if (hostFirst) {
    await rec.tap(cellLocator(host, 4));
    await sleep(900);
    await cellLocator(guest, 0).click();
  } else {
    await sleep(700);
    await cellLocator(guest, 0).click();
    await sleep(800);
    await rec.tap(cellLocator(host, 4));
  }
  rec.mark("moves");
  await sleep(1200);
  await rec.stop();
  await hostCtx.close();
  await guestCtx.close();
}

async function main() {
  if (!existsSync(join(appRoot, "dist", "index.html"))) {
    throw new Error("no dist/: run `VITE_MATCHMAKING_URL=http://127.0.0.1:8787 pnpm build` in the repo root");
  }
  const only = process.argv[2];
  const wantOnline = !only || only === "online-invite";
  if (wantOnline && !(await reachable(WORKER_URL))) {
    throw new Error(`matchmaking Worker not reachable on ${WORKER_URL}; the online clip needs it`);
  }
  const server = spawn(
    join(appRoot, "node_modules", ".bin", "vite"),
    ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"],
    { cwd: appRoot, stdio: "ignore" },
  );
  try {
    await waitForServer(BASE_URL);
    const browser = await chromium.launch();
    try {
      if (!only || only === "vs-computer") await captureVsComputer(browser);
      if (wantOnline) await captureOnlineInvite(browser);
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

await main();
