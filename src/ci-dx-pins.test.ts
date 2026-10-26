import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * F799 / F797 — package metadata and CI wiring that silently rotted
 * because nothing read them. These are source pins: they fail when the
 * file drifts from the documented contract, not when behavior does.
 */

describe("package engines (F799)", () => {
  it("declares only Node versions the locked tools support", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      engines: { node: string };
    };
    // The range is the INTERSECTION of the locked tools' floors:
    //   Vite 8.3.2       requires ^20.19.0 || >=22.12.0
    //   ESLint 10.7.0    requires ^20.19.0 || ^22.13.0 || >=24
    // → ^20.19.0 || ^22.13.0 || >=24. The old `>=20.9.0` advertised
    // runtimes neither tool supports. If a tool bump changes the
    // intersection, this pin breaks on purpose: re-derive, then update.
    expect(pkg.engines.node).toBe("^20.19.0 || ^22.13.0 || >=24");
  });

  it("the locked tools still match the documented version families", () => {
    // The derivation above cites Vite 8.x and ESLint 10.x; if either
    // major moves, re-derive the engines range instead of trusting this
    // file's comment.
    const lock = readFileSync("pnpm-lock.yaml", "utf8");
    expect(lock).toContain("vite@8.");
    expect(lock).toContain("eslint@10.");
  });
});

describe("CI concurrency (F797)", () => {
  it("keys the cancel group on the checkout target, not just the dispatch site", () => {
    const wf = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(wf).toContain(
      "group: ci-${{ github.ref }}-${{ inputs.ref }}",
    );
    // The checkout and the cancel group must resolve the SAME ref, or
    // the group protects a run against its own target.
    expect(wf).toMatch(/ref: \$\{\{ inputs\.ref \}\}/);
  });
});
