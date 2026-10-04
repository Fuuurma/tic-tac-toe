import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the path inventory in AGENTS.md.
 *
 * F411 recorded a bullet for `src/types.ts` — "(currently in logic.ts and
 * constants.ts)" — for a file that does not exist and never did, pointing at
 * two files that have lived under `src/game/` since the domain refactor and are
 * already listed one bullet above. The drift survived because a doc bullet is
 * invisible to every other gate: lint, tsc and vitest all pass on a wrong
 * path, and the only cost lands on whoever is navigating the repo cold.
 *
 * So the inventory is checked the same way the rest of the repo is: by a test.
 * Scoped to the "Project Structure" section on purpose — the rest of AGENTS.md
 * is prose that legitimately mentions things that are not paths.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const agents = readFileSync(join(repoRoot, "AGENTS.md"), "utf8");

const structureSection = (() => {
  const start = agents.indexOf("## Project Structure");
  expect(start, "AGENTS.md should still have a Project Structure section").toBeGreaterThan(-1);
  const next = agents.indexOf("\n## ", start + 1);
  return agents.slice(start, next === -1 ? undefined : next);
})();

/** Inline-code spans that look like repo paths, e.g. `src/game/logic.ts`. */
const referencedPaths = [
  ...new Set(
    [...structureSection.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1]!)
      // Trailing prose inside the backticks is not part of the path.
      .map((raw) => raw.split(/[ ,—]/)[0]!)
      .filter((p) => /^[./]|^[a-z0-9_-]+[/.]/.test(p) && !p.includes("*")),
  ),
];

describe("AGENTS.md project structure", () => {
  it("finds the paths it is meant to check", () => {
    // If the section format changes, this fails loudly rather than the checks
    // below silently passing on an empty list.
    expect(referencedPaths.length).toBeGreaterThan(5);
  });

  it.each(referencedPaths)("%s exists", (path) => {
    expect(
      existsSync(join(repoRoot, path)),
      `${path} is listed in AGENTS.md Project Structure but does not exist`,
    ).toBe(true);
  });

  it("still lists the directories the repo actually has", () => {
    // The other direction: a path that exists but is undocumented is a gap,
    // though a softer one. Only top-level src/ entries are required.
    for (const dir of ["src/game", "src/hooks", "src/components", "src/lib"]) {
      expect(existsSync(join(repoRoot, dir)), `${dir} should be documented`).toBe(true);
      expect(structureSection, `${dir} should be named in AGENTS.md`).toContain(dir);
    }
  });
});
