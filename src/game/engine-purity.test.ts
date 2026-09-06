/// <reference types="node" />
/**
 * Engine-purity structural pin (F-engine-purity, 2026-09-06).
 *
 * The audit found `Date.now()` called directly inside pure game
 * engine functions (`createInitialGameState`, `makeMove`). Engine
 * code is required to be deterministic and replayable — production
 * callers may read the wall clock, but the engine itself must
 * accept an injected `now` parameter so unit tests + replay can
 * pin the time without monkey-patching `Date`.
 *
 * The engine's signature uses `Date.now()` as the default value
 * for `now`, so existing production callers (that pass nothing)
 * still get the wall clock — that's intentional. The structural
 * guarantee is that no Date.now() call leaks into the body of
 * those functions, only into the default expression.
 *
 * This test reads the source and asserts:
 *   - `Date.now()` appears ONLY in the default-value position of
 *     a `now` parameter (line-start, no semicolon before it).
 *   - `createInitialGameState` and `makeMove` both accept a `now`
 *     parameter.
 *
 * If a future refactor re-introduces a wall-clock read inside
 * the function body of `logic.ts`, this pin fires.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readLogic(): string {
  // `import.meta.url` is the Vite-blessed way to resolve the current
  // file path; no `__dirname` (which requires `@types/node`).
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, "./logic.ts"), "utf8");
}

describe("F-engine-purity — game engine accepts injected `now`", () => {
  it("Date.now() in logic.ts only appears as a default for `now`", () => {
    const src = readLogic();
    // Walk every line and check what surrounds each Date.now() hit.
    const lines = src.split("\n");
    const offending: number[] = [];
    lines.forEach((line, idx) => {
      // The only allowed Date.now() in logic.ts is the default
      // expression for a `now` parameter on an exported function
      // signature. Any other hit is a wall-clock leak.
      const isDefault = /^\s*now\s*:\s*number\s*=\s*Date\.now\(\)/.test(line);
      if (line.includes("Date.now(") && !isDefault) {
        offending.push(idx + 1);
      }
    });
    expect(
      offending,
      `Date.now() leaked into logic.ts at lines: ${offending.join(", ")}`,
    ).toEqual([]);
  });

  it("createInitialGameState accepts an injectable `now` parameter", () => {
    const src = readLogic();
    // Match the function head (signature up through the return-type
    // colon + arrow + opening brace) using a non-greedy match across
    // the multi-line signature.
    const fnMatch = src.match(
      /export\s+const\s+createInitialGameState\s*=\s*\([\s\S]*?\)\s*:\s*GameState\s*=>\s*\{/,
    );
    expect(fnMatch, "createInitialGameState function head not found").not.toBeNull();
    expect(fnMatch![0]).toMatch(/\bnow\s*:\s*number\s*=\s*Date\.now\(\)/);
  });

  it("makeMove accepts an injectable `now` parameter", () => {
    const src = readLogic();
    const fnMatch = src.match(
      /export\s+const\s+makeMove\s*=\s*\([\s\S]*?\)\s*:\s*GameState\s*\|\s*null\s*=>\s*\{/,
    );
    expect(fnMatch, "makeMove function head not found").not.toBeNull();
    expect(fnMatch![0]).toMatch(/\bnow\s*:\s*number\s*=\s*Date\.now\(\)/);
  });
});
