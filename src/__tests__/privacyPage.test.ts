import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pins the store-required privacy page at repo level: the static asset Pages
 * serves, the facts app-store reviewers look for (guest-only, on-device
 * storage, no tracking), and the README link that makes it findable. The
 * page is a plain file — nothing renders it — so a missing phrase fails here
 * instead of silently shipping a non-compliant listing.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const privacyPath = join(repoRoot, "public", "privacy.html");
const privacyHtml = existsSync(privacyPath) ? readFileSync(privacyPath, "utf8") : "";
const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

describe("privacy page", () => {
  it("exists at public/privacy.html", () => {
    expect(existsSync(privacyPath), "public/privacy.html is missing").toBe(true);
  });

  it("states the guest-only, account-free model", () => {
    expect(privacyHtml).toMatch(/guest/i);
    expect(privacyHtml).toMatch(/no account/i);
  });

  it("names the on-device storage keys", () => {
    expect(privacyHtml).toContain("tic-tac-toe:guestId");
    expect(privacyHtml).toContain("tic-tac-toe:displayName");
    expect(privacyHtml).toContain("tic-tac-toe:stats");
    expect(privacyHtml).toContain("tic-tac-toe:preferences");
    expect(privacyHtml).toContain("tic-tac-toe:language");
  });

  it("limits name sharing to the room opponent and disclaims tracking", () => {
    expect(privacyHtml).toMatch(/opponent/i);
    expect(privacyHtml).toMatch(/analytics/i);
    expect(privacyHtml).toMatch(/tracking/i);
  });

  it("gives a contact address and the Spanish summary", () => {
    expect(privacyHtml).toMatch(/contact/i);
    expect(privacyHtml).toMatch(/mailto:/);
    expect(privacyHtml).toMatch(/privacidad/i);
  });

  it("is linked from README.md", () => {
    expect(readme).toContain("/privacy.html");
  });
});
