import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the privacy page the app stores and PWA install flows point at:
 * public/privacy.html is the single static source, served at /privacy.html
 * with the shell's CSP (no script, no off-origin requests), and /privacy
 * redirects to it via public/_redirects. Store listings (mobile-stores-1116
 * Phase 0 §3) link this URL, so the facts it states — guest-only, on-device
 * keys, opponent-only name sharing, no analytics — are a contract, not copy.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const publicDir = join(repoRoot, "public");

const privacyPath = join(publicDir, "privacy.html");
const privacyHtml = existsSync(privacyPath) ? readFileSync(privacyPath, "utf8") : null;

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");
const redirects = readFileSync(join(publicDir, "_redirects"), "utf8");

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
    expect(privacyHtml).not.toMatch(/https?:\/\//);
  });
});

describe("privacy page reachability", () => {
  it("redirects /privacy to /privacy.html", () => {
    expect(redirects).toMatch(/^\/privacy\s+\/privacy\.html\s+301$/m);
  });

  it("is linked from README.md", () => {
    expect(readme).toContain("/privacy.html");
  });
});
