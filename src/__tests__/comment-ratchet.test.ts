import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
  new URL("../../scripts/check-comments.mjs", import.meta.url),
);
const BASELINE = join("scripts", "comment-baseline.json");
const dirs: string[] = [];

const git = (cwd: string, args: string[]) =>
  spawnSync("git", args, { cwd, encoding: "utf8" });

function fixture(files: Record<string, string>, stageAll = true) {
  const dir = mkdtempSync(join(tmpdir(), "comment-ratchet-"));
  dirs.push(dir);
  expect(git(dir, ["init", "-q"]).status).toBe(0);
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  mkdirSync(join(dir, "scripts"), { recursive: true });
  if (stageAll) expect(git(dir, ["add", "-A"]).status).toBe(0);
  return dir;
}

function cli(dir: string, args: string[] = []) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  return { code: res.status ?? 1, out: `${res.stdout}${res.stderr}` };
}

const baselineFile = (dir: string) => join(dir, BASELINE);
const baselineText = (dir: string) => readFileSync(baselineFile(dir), "utf8");

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("check-comments ratchet", () => {
  it("passes when the tree matches the baseline", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1; // pinned\n" });
    expect(cli(dir, ["--init"]).code).toBe(0);
    const res = cli(dir);
    expect(res.code).toBe(0);
    expect(res.out).toContain("baseline matches");
  }, 30000);

  it("rejects a new comment on an existing tracked file", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1; // pinned\n" });
    cli(dir, ["--init"]);
    writeFileSync(
      join(dir, "src/a.ts"),
      "export const a = 1; // pinned\n// added\n",
    );
    const res = cli(dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain("src/a.ts");
  }, 30000);

  it("rejects a comment in a newly tracked file", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/b.ts"), "// fresh\nexport {};\n");
    git(dir, ["add", "src/b.ts"]);
    expect(cli(dir).code).toBe(1);
  }, 30000);

  it("rejects a second copy and a same-count text replacement", () => {
    const dir = fixture({ "src/a.ts": "// once\nexport {};\n" });
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/a.ts"), "// once\n// once\nexport {};\n");
    expect(cli(dir).code).toBe(1);
    writeFileSync(join(dir, "src/a.ts"), "// twice\nexport {};\n");
    const res = cli(dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain("new comment");
    expect(res.out).toContain("baseline entry");
  }, 30000);

  it("prune accepts deletions and a pruned comment cannot return", () => {
    const dir = fixture({ "src/a.ts": "// keep\n// drop\nexport {};\n" });
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/a.ts"), "// keep\nexport {};\n");
    const stale = cli(dir);
    expect(stale.code).toBe(1);
    expect(stale.out).toContain("--prune");
    expect(cli(dir, ["--prune"]).code).toBe(0);
    expect(cli(dir).code).toBe(0);
    writeFileSync(join(dir, "src/a.ts"), "// keep\n// drop\nexport {};\n");
    expect(cli(dir).code).toBe(1);
  }, 30000);

  it("refuses prune on growth and init on existing baseline", () => {
    const dir = fixture({ "src/a.ts": "// a\n// b\nexport {};\n" });
    expect(cli(dir, ["--init"]).code).toBe(0);
    const before = baselineText(dir);
    writeFileSync(join(dir, "src/a.ts"), "// a\n// c\nexport {};\n");
    expect(cli(dir, ["--prune"]).code).toBe(1);
    expect(baselineText(dir)).toBe(before);
    expect(cli(dir, ["--init"]).code).toBe(1);
    expect(baselineText(dir)).toBe(before);
  }, 30000);

  it("leaves identical bytes when prune repeats on identical input", () => {
    const dir = fixture({ "src/a.ts": "// a\n// b\nexport {};\n" });
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/a.ts"), "// a\nexport {};\n");
    cli(dir, ["--prune"]);
    const first = baselineText(dir);
    cli(dir, ["--prune"]);
    expect(baselineText(dir)).toBe(first);
  }, 30000);

  it("counts only real comment lexemes in every grammar", () => {
    const dir = fixture({
      "src/strings.ts": [
        'const a = "// not a comment";',
        "const b = '/* nor this */';",
        "const c = `// template ${1} /* x */`;",
        "const r = /\\/\\//;",
        "const r2 = /a\\/\\*b/;",
        "// real ts",
        "export { a, b, c, r, r2 };",
        "",
      ].join("\n"),
      "src/view.tsx": [
        "export const view = (",
        '  <div data-x="<!-- attr -->">',
        "    {'// jsx string'}",
        "    <span>// jsx text</span>",
        "    {/* real jsx */}",
        "  </div>",
        ");",
        "",
      ].join("\n"),
      "src/look.css": [
        'a::after { content: "/* not css */"; }',
        "// not a css comment either",
        "/* real css */",
        "",
      ].join("\n"),
      "index.html": [
        "<!doctype html><html><body>",
        '<div data-x="<!-- attr -->">x</div>',
        "<script>const s = '<!-- script -->';</script>",
        "<!-- real html -->",
        "</body></html>",
        "",
      ].join("\n"),
    });
    expect(cli(dir, ["--init"]).code).toBe(0);
    const baseline = JSON.parse(baselineText(dir)) as {
      comments: Record<string, Record<string, number>>;
    };
    for (const p of [
      "src/strings.ts",
      "src/view.tsx",
      "src/look.css",
      "index.html",
    ])
      expect(Object.keys(baseline.comments[p] ?? {})).toHaveLength(1);
    expect(cli(dir).code).toBe(0);
  }, 30000);

  it("ignores untracked files and counts them once staged", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" }, false);
    git(dir, ["add", "src/a.ts"]);
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/evil.ts"), "// untracked\nexport {};\n");
    expect(cli(dir).code).toBe(0);
    git(dir, ["add", "src/evil.ts"]);
    expect(cli(dir).code).toBe(1);
  }, 30000);

  it("fails closed when a tracked file cannot be parsed or read", () => {
    const dir = fixture({ "src/a.ts": "export {};\n" });
    cli(dir, ["--init"]);
    writeFileSync(join(dir, "src/a.ts"), "const = ;\n");
    const res = cli(dir);
    expect(res.code).toBe(1);
    expect(res.out).toContain("src/a.ts");
    writeFileSync(join(dir, "src/a.ts"), "export {};\n");
    rmSync(join(dir, "src/a.ts"));
    expect(cli(dir).code).toBe(1);
  }, 30000);

  it("fails closed on missing, corrupt, or unsorted baselines", () => {
    const dir = fixture({ "src/a.ts": "export {};\n" });
    cli(dir, ["--init"]);
    const good = baselineText(dir);
    writeFileSync(baselineFile(dir), "{nope");
    expect(cli(dir).code).toBe(1);
    writeFileSync(
      baselineFile(dir),
      `{"version":1,"comments":{"src/a.ts":{"${"f".repeat(16)}":1,"${"0".repeat(16)}":2}}}\n`,
    );
    expect(cli(dir).code).toBe(1);
    writeFileSync(
      baselineFile(dir),
      '{"version":1,"comments":{"src/b.ts":{},"src/a.ts":{}}}\n',
    );
    expect(cli(dir).code).toBe(1);
    rmSync(baselineFile(dir));
    expect(cli(dir).code).toBe(1);
    writeFileSync(baselineFile(dir), good);
    expect(cli(dir).code).toBe(0);
    expect(cli(dir, ["--bogus"]).code).toBe(1);
    expect(cli(dir, ["--init", "--prune"]).code).toBe(1);
  }, 30000);
});
