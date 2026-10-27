import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The test-environment contract.
 *
 * Measured 2026-10-27 on a shell that exports NODE_ENV=production:
 * `pnpm test` reported 32 failed files / 221 failed tests, 234 of them
 * `TypeError: React.act is not a function`, thrown from react-dom's production
 * build. The same tree passed 779/779 with NODE_ENV=test. Any lane, cron or CI
 * step that inherits the ambient value therefore reports the gate as broken
 * while the code is fine — 221 false failures per run, and a reader who trusts
 * the gate either re-verifies working code or declines to land.
 *
 * vitest.config.ts pins NODE_ENV=test for the run. This case proves the pin by
 * EXECUTING the real suite with the hostile value inherited, rather than
 * asserting a style value: if the assignment is ever removed from the config,
 * the child inherits `production` and this test fails.
 *
 * The child excludes this file, or the nested run recurses.
 */
const REPO = join(import.meta.dirname, "..", "..");
const VITEST = join(REPO, "node_modules", "vitest", "vitest.mjs");

describe("test environment", () => {
  it("the whole suite stays green with NODE_ENV=production inherited", () => {
    try {
      execFileSync(
        process.execPath,
        [VITEST, "run", "--exclude", "**/testEnv.test.ts"],
        {
          cwd: REPO,
          env: { ...process.env, NODE_ENV: "production" },
          stdio: "pipe",
          timeout: 300_000,
        },
      );
    } catch (error) {
      const out = String(
        (error as { stdout?: Buffer }).stdout ??
          (error as { stderr?: Buffer }).stderr ??
          error,
      );
      expect.fail(
        `vitest run exited non-zero under NODE_ENV=production — the pin is gone or broken:\n${out.slice(-2000)}`,
      );
    }
  }, 300_000);
});
