/**
 * After-shots + axe re-run for UX-audit findings F2, F5, F6 and F7
 * (compact-mobile sheet close X, game-surface h1, focusable named sheet
 * body, HUD text floor — reports/ux-audit-1116.md @680792b).
 *
 * Mirrors the audit's probe (reports/ux-audit-1116/audit/results.json):
 * screenshots at 390px + 1440px, an axe run per state (CDN axe-core), and
 * a bounding-box measurement of the sheet close X for F2.
 *
 * Point BASE_URL at a running dev server or `pnpm preview`; the online
 * waiting state needs the local matchmaking Worker on 127.0.0.1:8787.
 *
 *   node reports/ux-audit-1116/audit/capture-after-f2-f5-f6-f7.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3117";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "after");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const results = [];

async function newPage(browser, tag, theme = "light") {
  const vp = VIEWPORTS[tag];
  const ctx = await browser.newContext({
    viewport: vp,
    hasTouch: tag === "phone",
    isMobile: tag === "phone",
  });
  await ctx.addInitScript((t) => {
    try {
      window.localStorage.setItem("tic-tac-toe:onboarding", "skipped");
      window.localStorage.setItem(
        "tic-tac-toe:preferences",
        JSON.stringify({ theme: t }),
      );
    } catch {}
  }, theme);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results.push(`PAGEERROR ${tag}: ${e.message}`));
  return { ctx, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("shot", name);
}

async function axe(page, name) {
  await page.addScriptTag({
    url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
  });
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
    }));
  });
  console.log(`axe ${name}:`, JSON.stringify(violations));
  results.push({ name, violations });
}

async function openPlayerSettings(page) {
  await page.getByRole("button", { name: "Edit your player settings" }).click();
}
async function closeDialog(page, title) {
  await page
    .getByRole("dialog", { name: title, exact: true })
    .getByRole("button", { name: "Close" })
    .click();
}

async function fillLobbyVsFriend(page) {
  await page.goto(`${BASE}/`);
  await page.getByRole("radio", { name: "vs Friend", exact: true }).click();
  await openPlayerSettings(page);
  await page.getByLabel("Your name", { exact: true }).fill("Alice");
  await closeDialog(page, "Players");
  await page.getByRole("button", { name: "Edit opponent settings" }).click();
  await page.getByLabel("Opponent name", { exact: true }).fill("Bob");
  await closeDialog(page, "Players");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page
    .getByRole("group", { name: "Tic Tac Toe game board" })
    .waitFor({ state: "visible" });
}

async function main() {
  const browser = await chromium.launch();

  for (const tag of ["phone", "desktop"]) {
    // --- F5/F7: local vs-Friend game, start + mid ---
    {
      const { ctx, page } = await newPage(browser, tag);
      await fillLobbyVsFriend(page);
      await shot(page, `game-vs-friend-start-${tag}-light`);
      await axe(page, `game-vs-friend-start-${tag}-light`);
      // one move for a "mid" HUD
      await page.getByRole("button", { name: "Row 1 column 1" }).click();
      await page.waitForTimeout(300);
      await shot(page, `game-vs-friend-mid-${tag}-light`);
      await axe(page, `game-vs-friend-mid-${tag}-light`);
      await ctx.close();
    }

    // --- F5: same game state in dark (audit flagged dark variants too) ---
    {
      const { ctx, page } = await newPage(browser, tag, "dark");
      await fillLobbyVsFriend(page);
      await page.getByRole("button", { name: "Row 1 column 1" }).click();
      await page.waitForTimeout(300);
      await shot(page, `game-vs-friend-mid-${tag}-dark`);
      await axe(page, `game-vs-friend-mid-${tag}-dark`);
      await ctx.close();
    }

    // --- F2/F6: lobby sheets (Settings prefs, Players) ---
    {
      const { ctx, page } = await newPage(browser, tag);
      await page.goto(`${BASE}/`);
      // Preferences sheet (compactMobile)
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Settings", exact: true })
        .waitFor({ state: "visible" });
      await shot(page, `lobby-settings-${tag}-light`);
      await axe(page, `lobby-settings-${tag}-light`);
      await closeDialog(page, "Settings");
      // Players sheet (compactMobile)
      await page.getByRole("button", { name: "Edit opponent settings" }).click();
      await page
        .getByRole("dialog", { name: "Players", exact: true })
        .waitFor({ state: "visible" });
      await shot(page, `lobby-players-opponent-${tag}-light`);
      await ctx.close();
    }

    // --- F2/F6: lobby help sheet (reached via Settings -> How to play) ---
    {
      const { ctx, page } = await newPage(browser, tag);
      await page.goto(`${BASE}/`);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Settings", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "How to play", exact: true }).click();
      await page
        .getByRole("dialog", { name: "How to play", exact: true })
        .waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      // F2 evidence: the labeled close X must be visible at this viewport.
      const closeBox = await page
        .getByRole("dialog", { name: "How to play", exact: true })
        .getByRole("button", { name: "Close" })
        .boundingBox()
        .catch(() => null);
      console.log(`close-x ${tag}-light:`, JSON.stringify(closeBox));
      results.push({ name: `lobby-help-${tag}-light`, closeX: closeBox });
      await shot(page, `lobby-help-${tag}-light`);
      await axe(page, `lobby-help-${tag}-light`);
      await ctx.close();
    }

    // --- F2/F6: lobby help sheet in dark ---
    {
      const { ctx, page } = await newPage(browser, tag, "dark");
      await page.goto(`${BASE}/`);
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Settings", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "How to play", exact: true }).click();
      await page
        .getByRole("dialog", { name: "How to play", exact: true })
        .waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      await shot(page, `lobby-help-${tag}-dark`);
      await axe(page, `lobby-help-${tag}-dark`);
      await ctx.close();
    }

    // --- F2/F6: in-game help sheet over the board ---
    {
      const { ctx, page } = await newPage(browser, tag);
      await fillLobbyVsFriend(page);
      // in-game gear opens Preferences; "How to play" inside opens HelpDrawer
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page
        .getByRole("dialog", { name: "Settings", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "How to play", exact: true }).click();
      await page
        .getByRole("dialog", { name: "How to play", exact: true })
        .waitFor({ state: "visible" });
      await page.waitForTimeout(400);
      await shot(page, `game-help-${tag}-light`);
      await axe(page, `game-help-${tag}-light`);
      await ctx.close();
    }

    // --- F5: online room-waiting state (needs worker on :8787) ---
    {
      const { ctx, page } = await newPage(browser, tag);
      await page.goto(`${BASE}/`);
      await page.getByRole("radio", { name: "Online", exact: true }).click();
      await page.getByRole("radio", { name: "Create", exact: true }).click();
      const createBtn = page.getByRole("button", { name: "Create Room", exact: true });
      if (await createBtn.isEnabled().catch(() => false)) {
        await createBtn.click();
        await page
          .getByText("Room ready", { exact: false })
          .waitFor({ state: "visible", timeout: 15_000 })
          .catch(() => {});
        await page.waitForTimeout(500);
        // Named for the audit state (online-waiting), not online-room-ready:
        // the F1/F3/F8 slice's after-shots already own that filename.
        await shot(page, `online-waiting-${tag}-light`);
        await axe(page, `online-waiting-${tag}-light`);
      } else {
        console.log(`online-waiting-${tag}: Create Room disabled (worker down?) — skipped`);
      }
      await ctx.close();
    }
  }

  await browser.close();
  console.log("DONE");
  for (const r of results) console.log(JSON.stringify(r));
  const measurements = results.filter((r) => r && typeof r === "object" && r.closeX !== undefined);
  writeFileSync(
    join(OUT, "measurements-f2-f5-f6-f7.json"),
    JSON.stringify(
      {
        slice: "TTT-UX-FIX3",
        findings: ["F2", "F5", "F6", "F7"],
        base: BASE,
        closeX: measurements,
        axe: results.filter((r) => r && typeof r === "object" && r.violations !== undefined),
      },
      null,
      2,
    ),
  );
  console.log("wrote measurements-f2-f5-f6-f7.json");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
