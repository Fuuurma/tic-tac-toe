import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Executes public/theme-init.js — the synchronous pre-paint script — against
 * a fake DOM so the theme it stamps can be asserted. The script is a public
 * asset, not an importable module, so the suite feeds it the three globals
 * it touches (localStorage, document, window) and reads back what it wrote.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const source = readFileSync(join(repoRoot, "public", "theme-init.js"), "utf8");

interface RunOptions {
  /** Raw value localStorage returns for the preferences key, or null. */
  stored?: string | null;
  /** What matchMedia("(prefers-color-scheme: dark)").matches reports. */
  osDark?: boolean;
  /** False simulates an engine with no matchMedia at all. */
  hasMatchMedia?: boolean;
}

function runThemeInit({ stored = null, osDark = false, hasMatchMedia = true }: RunOptions = {}) {
  const dataset: Record<string, string> = {};
  const themeColor = { content: "" };
  const document = {
    documentElement: { dataset },
    querySelector: (selector: string) => (selector.includes("theme-color") ? themeColor : null),
  };
  const window = {
    matchMedia: hasMatchMedia
      ? (query: string) => ({ matches: query.includes("prefers-color-scheme: dark") && osDark })
      : undefined,
  };
  const localStorage = { getItem: () => stored };
  // The script is an IIFE over bare globals; the wrapper binds them.
  new Function("window", "document", "localStorage", source)(window, document, localStorage);
  return { theme: dataset.theme, themeColor: themeColor.content };
}

describe("theme-init.js", () => {
  it("stamps a saved dark preference even when the OS is light", () => {
    const { theme, themeColor } = runThemeInit({
      stored: JSON.stringify({ theme: "dark" }),
      osDark: false,
    });
    expect(theme).toBe("dark");
    expect(themeColor).toBe("#152028");
  });

  it("stamps a saved light preference even when the OS is dark", () => {
    const { theme, themeColor } = runThemeInit({
      stored: JSON.stringify({ theme: "light" }),
      osDark: true,
    });
    expect(theme).toBe("light");
    expect(themeColor).toBe("#f8fafb");
  });

  it("falls back to a dark OS preference when nothing is saved", () => {
    const { theme, themeColor } = runThemeInit({ stored: null, osDark: true });
    expect(theme).toBe("dark");
    expect(themeColor).toBe("#152028");
  });

  it("falls back to light when nothing is saved and the OS is light", () => {
    const { theme } = runThemeInit({ stored: null, osDark: false });
    expect(theme).toBe("light");
  });

  it("treats corrupted storage as no saved preference and follows the OS", () => {
    const { theme } = runThemeInit({ stored: "{not json", osDark: true });
    expect(theme).toBe("dark");
  });

  it("falls back to light when matchMedia is unavailable", () => {
    const { theme } = runThemeInit({ stored: null, osDark: true, hasMatchMedia: false });
    expect(theme).toBe("light");
  });
});
