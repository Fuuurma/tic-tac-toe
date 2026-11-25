import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const publicDir = join(repoRoot, "public");

const privacyPath = join(publicDir, "privacy.html");
const privacyHtml = existsSync(privacyPath) ? readFileSync(privacyPath, "utf8") : null;

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const redirects = readFileSync(join(publicDir, "_redirects"), "utf8");
const en = readFileSync(join(repoRoot, "src/i18n/en.ts"), "utf8");
const es = readFileSync(join(repoRoot, "src/i18n/es.ts"), "utf8");

describe("privacy page", () => {
  it("exists at public/privacy.html", () => {
    expect(privacyHtml, "public/privacy.html is missing").not.toBeNull();
  });

  it("states the guest-only, no-account model", () => {
    expect(privacyHtml).toMatch(/guest/i);
    expect(privacyHtml).toMatch(/no accounts?\b/i);
  });

  it("names every on-device storage key the app writes", () => {
    for (const key of [
      "tic-tac-toe:guestId",
      "tic-tac-toe:displayName",
      "tic-tac-toe:stats",
      "tic-tac-toe:preferences",
      "tic-tac-toe:language",
    ]) {
      expect(privacyHtml, `privacy page never mentions ${key}`).toContain(key);
    }
  });

  it("limits display-name sharing to the room opponent", () => {
    expect(privacyHtml).toMatch(/display name/i);
    expect(privacyHtml).toMatch(/opponent/i);
  });

  it("disclaims third-party analytics and tracking", () => {
    expect(privacyHtml).toMatch(/analytics/i);
    expect(privacyHtml).toMatch(/tracking/i);
  });

  it("publishes a contact address", () => {
    expect(privacyHtml).toMatch(/contact/i);
    expect(privacyHtml).toMatch(/[^\s"'<>]+@[^\s"'<>]+\.[^\s"'<>]+/);
  });

  it("carries the Spanish note that the same facts hold", () => {
    expect(privacyHtml).toContain('lang="es"');
  });

  it("makes no off-origin requests — the shell CSP needs no new connect-src", () => {
    expect(privacyHtml).not.toMatch(/<script\b/i);
    expect(privacyHtml).not.toMatch(new RegExp("https?://"));
  });
});

describe("privacy page reachability", () => {
  it("redirects /privacy to /privacy.html before the SPA fallback", () => {
    const lines = redirects.split("\n").map((line) => line.trim());
    const redirectAt = lines.findIndex((line) =>
      /^\/privacy\s+\/privacy\.html\s+301$/.test(line),
    );
    const fallbackAt = lines.indexOf("/* /index.html 200");
    expect(redirectAt, "/privacy redirect missing from public/_redirects").toBeGreaterThanOrEqual(0);
    expect(fallbackAt, "SPA fallback missing from public/_redirects").toBeGreaterThan(redirectAt);
  });

  it("is linked from README.md", () => {
    expect(readme).toContain("/privacy.html");
  });

  it("labels the Settings privacy row in English and Spanish", () => {
    expect(en).toContain('"settings.privacy": "Privacy"');
    expect(es).toContain('"settings.privacy": "Privacidad"');
  });
});
