import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the store-listing privacy contract at repo level: mobile-stores-1116.md
 * Phase 0 §3 requires a privacy page before any store submission, and both
 * stores re-check the URL behind the listing. The page is a static Pages
 * asset — public/privacy.html served at /privacy.html (with /privacy as a
 * rewrite alias) — so this suite reads it from disk the way
 * pwaManifest.test.ts reads the manifest, and fails here instead of at
 * review time.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const privacyPath = join(repoRoot, "public", "privacy.html");
const privacyHtml = existsSync(privacyPath)
  ? readFileSync(privacyPath, "utf8")
  : "";

const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

describe("privacy page", () => {
  it("exists at public/privacy.html", () => {
    expect(existsSync(privacyPath), "public/privacy.html is missing").toBe(true);
  });

  it("states the guest-only, no-account model", () => {
    expect(privacyHtml).toMatch(/guest/i);
    expect(privacyHtml).toMatch(/no account/i);
  });

  it("names the on-device storage keys", () => {
    for (const key of [
      "tic-tac-toe:guestId",
      "tic-tac-toe:displayName",
      "tic-tac-toe:stats",
      "tic-tac-toe:preferences",
      "tic-tac-toe:language",
    ]) {
      expect(privacyHtml, `privacy.html must mention ${key}`).toContain(key);
    }
  });

  it("limits sharing to the room opponent", () => {
    expect(privacyHtml).toMatch(/display name/i);
    expect(privacyHtml).toMatch(/opponent/i);
  });

  it("disclaims third-party analytics and tracking", () => {
    expect(privacyHtml).toMatch(/no (third-party )?(analytics|tracking)/i);
  });

  it("provides a contact address", () => {
    expect(privacyHtml).toMatch(/contact/i);
    expect(privacyHtml).toContain("@");
  });

  it("carries the Spanish note that the same facts hold", () => {
    expect(privacyHtml).toMatch(/español|spanish/i);
  });
});

describe("README link", () => {
  it("links to /privacy.html", () => {
    expect(readme).toMatch(/\]\([^)]*\/privacy\.html[^)]*\)/);
  });
});
