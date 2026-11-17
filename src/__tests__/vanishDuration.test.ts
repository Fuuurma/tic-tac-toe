import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The ghost mark's teardown timeout in `boardCell.tsx` (VANISH_MS) and the
 * `vanish` keyframe duration in `index.css` are coupled by hand: the timeout
 * must be >= the animation so the fading span is not removed mid-fade. A
 * previous edit left the constant at 600ms against a 550ms keyframe while its
 * comment still claimed the two matched — lint, tsc and the behaviour suites
 * all stay green on that drift, and the only signal is the eye.
 *
 * This pin reads BOTH sides from source and compares them, so it fails when
 * either moves alone. It is a repo-level source pin like `agentsStructure.test.ts`,
 * not a behaviour test — neither value is reachable through the public UI.
 */

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");
const css = readFileSync(join(repoRoot, "src", "index.css"), "utf8");
const cell = readFileSync(join(repoRoot, "src", "components", "game", "boardCell.tsx"), "utf8");

/** Duration (ms) of `animation: vanish …` inside `@utility animate-vanish`. */
function vanishKeyframeMs(): number {
  const utility = css.match(/@utility\s+animate-vanish\s*\{([^}]*)\}/);
  expect(utility, "src/index.css should define @utility animate-vanish").not.toBeNull();
  const duration = utility![1]!.match(/animation:\s*vanish\s+([\d.]+)s\b/);
  expect(duration, "@utility animate-vanish should set a `vanish` duration in seconds").not.toBeNull();
  return Number(duration![1]) * 1000;
}

/** Timeout (ms) from `const VANISH_MS = …;` in boardCell.tsx. */
function vanishTimeoutMs(): number {
  const constant = cell.match(/const\s+VANISH_MS\s*=\s*(\d+)\s*;/);
  expect(constant, "boardCell.tsx should define `const VANISH_MS = <ms>;`").not.toBeNull();
  return Number(constant![1]);
}

describe("board-cell vanish timeout", () => {
  it("matches the CSS vanish keyframe duration", () => {
    const keyframeMs = vanishKeyframeMs();
    const timeoutMs = vanishTimeoutMs();
    // Each parser asserts its own match above, so this cannot pass on two
    // undefineds; changing either source alone drives the two numbers apart.
    expect(timeoutMs).toBe(keyframeMs);
  });
});
