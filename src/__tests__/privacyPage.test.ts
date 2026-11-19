import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the privacy page the app-store listings require (see
 * reports/mobile-stores-1116.md Phase 0 §3): a static asset under public/ that
 * states the guest-only data story — what lives on-device, what reaches an
 * opponent, and what is never collected — in both English and Spanish, plus
 * the README pointer reviewers and stores will cite. The page is covered by
 * the /* CSP block in public/_headers, so it must stay script-free.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const publicDir = join(repoRoot, "public");

const privacyPath = join(publicDir, "privacy.html");
const privacyHtml = existsSync(privacyPath)
  ? readFileSync(privacyPath, "utf8")
  : "";

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const redirects = readFileSync(join(publicDir, "_redirects"), "utf8");

describe("privacy page", () => {
  it("exists as a static Pages asset", () => {
    expect(existsSync(privacyPath), "public/privacy.html is missing").toBe(true);
  });

  it("states the guest-only, no-account model", () => {
    expect(privacyHtml).toMatch(/guest/i);
    expect(privacyHtml).toMatch(/no account/i);
  });

  it("names every on-device storage key the app writes", () => {
    for (const key of [
      "tic-tac-toe:guestId",
      "tic-tac-toe:displayName",
      "tic-tac-toe:stats",
      "tic-tac-toe:preferences",
      "tic-tac-toe:language",
    ]) {
      expect(privacyHtml, `privacy.html does not mention ${key}`).toContain(key);
    }
  });

  it("discloses what is shared with an opponent and what is never collected", () => {
    expect(privacyHtml).toMatch(/display name/i);
    expect(privacyHtml).toMatch(/opponent/i);
    expect(privacyHtml).toMatch(/analytics/i);
    expect(privacyHtml).toMatch(/tracking/i);
  });

  it("provides a contact address", () => {
    expect(privacyHtml).toMatch(/contact/i);
    expect(privacyHtml).toContain("mailto:");
  });

  it("carries the same facts in Spanish", () => {
    expect(privacyHtml).toMatch(/espa[nñ]ol/i);
    expect(privacyHtml).toContain('lang="es"');
  });
});

describe("privacy page reachability", () => {
  it("is linked from README.md", () => {
    expect(readme).toContain("/privacy.html");
  });

  it("has a /privacy alias in the Pages _redirects file", () => {
    expect(redirects).toMatch(/^\/privacy\s+\/privacy\.html\s+\d{3}/m);
  });
});
