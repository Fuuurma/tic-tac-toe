/**
 * After-shots + measurement probe for UX-audit findings F3 and F8
 * (touch-target fixes: `max-sm:min-h-11` on the sm LanguageSwitcher and the
 * online reaction summary / quick-chat / mute buttons).
 *
 * Mirrors the audit's probe (reports/ux-audit-1116/audit/results.json):
 * screenshots at 390px + 1440px (light), bounding-box measurement of the
 * touched controls, and an axe run on each state (CDN axe-core).
 *
 * Serves the production bundle (`pnpm preview --port 3117`) and the local
 * matchmaking Worker on 127.0.0.1:8787 for the online-host state.
 *
 *   node reports/ux-audit-1116/audit/capture-after-f3-f8.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3117";
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "after");
mkdirSync(OUT, { recursive: true });

const ONBOARDING_KEY = "tic-tac-toe:onboarding";
const VIEWPORTS = [
  { tag: "phone", width: 390, height: 844 },
  { tag: "desktop", width: 1440, height: 900 },
];

const results = { base: BASE, states: [] };

async function axeRun(page) {
  try {
    await page.addScriptTag({
      url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js",
    });
    const r = await page.evaluate(async () => {
      const axe = window.axe;
      const res = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] },
      });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
    return r;
  } catch (e) {
    return `axe unavailable: ${String(e).slice(0, 120)}`;
  }
}

async function measure(page, selectors) {
  const out = [];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const n = await loc.count();
    for (let i = 0; i < n; i++) {
      const box = await loc.nth(i).boundingBox();
      if (!box) continue;
      out.push({
        sel,
        w: Math.round(box.width),
        h: Math.round(box.height),
      });
    }
  }
  return out;
}

async function newContext(browser, viewport, skipOnboardingFlag) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  if (skipOnboardingFlag) {
    await ctx.addInitScript((key) => {
      try { window.localStorage.setItem(key, "skipped"); } catch { /* ignore */ }
    }, ONBOARDING_KEY);
  }
  return ctx;
}

async function captureWelcome(viewport) {
  const browser = await chromium.launch();
  const ctx = await newContext(browser, viewport, false);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "English" }).waitFor({ timeout: 15_000 });
  const file = join(OUT, `onboarding-welcome-${viewport.tag}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const measured = await measure(page, [
    '[role="group"] button:has-text("English")',
    '[role="group"] button:has-text("Español")',
  ]);
  const axe = await axeRun(page);
  results.states.push({ state: "onboarding-welcome", tag: viewport.tag, shot: file, measured, axe });
  await browser.close();
}

async function captureOnlineHost(viewport) {
  const browser = await chromium.launch();
  const hostCtx = await newContext(browser, { width: 1280, height: 720 }, true);
  const guestCtx = await newContext(browser, { width: 1280, height: 720 }, true);
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  const configure = async (page, name) => {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("radio", { name: "Online", exact: true }).click();
    await page.getByRole("radio", { name: "Quick", exact: true }).click();
    await page.getByRole("button", { name: "Edit your player settings" }).click();
    await page.getByLabel("Your name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Close" }).click();
  };

  await configure(hostPage, "Host");
  await hostPage.setViewportSize({ width: viewport.width, height: viewport.height });
  await hostPage.getByRole("button", { name: "Quick Match" }).click();
  await configure(guestPage, "Guest");
  await guestPage.getByRole("button", { name: "Quick Match" }).click();

  await hostPage
    .getByRole("group", { name: /^Guest,/ })
    .waitFor({ timeout: 90_000 });
  await guestCtx.close();

  const file = join(OUT, `online-game-host-${viewport.tag}.png`);
  await hostPage.screenshot({ path: file, fullPage: false });

  const measured = await measure(hostPage, [
    'button:has-text("Mute reactions")',
    'summary[aria-label="Reactions"]',
  ]);

  // Open the quick-chat dropdown and measure its reaction buttons too.
  let measuredMenu = [];
  let menuFile = null;
  try {
    await hostPage.locator('summary[aria-label="Reactions"]').click();
    await hostPage.locator('details[open] button:has-text("Hello!")').waitFor({ timeout: 5_000 });
    measuredMenu = await measure(hostPage, ['details[open] .grid button']);
    if (viewport.tag === "phone") {
      menuFile = join(OUT, `online-game-host-reactions-${viewport.tag}.png`);
      await hostPage.screenshot({ path: menuFile, fullPage: false });
    }
  } catch (e) {
    measuredMenu = `menu open failed: ${String(e).slice(0, 80)}`;
  }

  const axe = await axeRun(hostPage);
  results.states.push({
    state: "online-game-host",
    tag: viewport.tag,
    shot: file,
    reactionsOpenShot: menuFile,
    measured,
    measuredMenu,
    axe,
  });
  await browser.close();
}

for (const viewport of VIEWPORTS) {
  await captureWelcome(viewport);
  await captureOnlineHost(viewport);
}

writeFileSync(join(OUT, "measurements-f3-f8.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
