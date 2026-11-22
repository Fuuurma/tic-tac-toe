import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const cliPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "scripts",
  "check-comments.mjs",
);
const baselineRel = join("scripts", "comment-baseline.json");
const tempDirs: string[] = [];

type Baseline = {
  version: number;
  comments: Record<string, Record<string, number>>;
};

function git(dir: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

function put(dir: string, rel: string, content: string): void {
  const abs = join(dir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "comment-ratchet-"));
  tempDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    put(dir, rel, content);
  }
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  return dir;
}

function run(dir: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return result;
}

function baselineFile(dir: string): string {
  return join(dir, baselineRel);
}

function baselineText(dir: string): string {
  return readFileSync(baselineFile(dir), "utf8");
}

function readBaseline(dir: string): Baseline {
  return JSON.parse(baselineText(dir)) as Baseline;
}

function totalComments(baseline: Baseline, path: string): number {
  const hashes = baseline.comments[path];
  if (!hashes) return 0;
  return Object.values(hashes).reduce((sum, n) => sum + n, 0);
}

function sortedKeys(record: Record<string, unknown>): string[] {
  return Object.keys(record).sort();
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("comment ratchet", () => {
  it("accepts an unchanged tree and writes a canonical baseline", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // line\n/* block */\n",
      "src/b.tsx": "export const B = () => <div>{/* jsx */}</div>;\n",
      "src/c.css": "a { color: red; } /* sheet */\n",
      "index.html": "<body><!-- page --></body>\n",
      "e2e/s.ts": "test('x', () => {}); // spec\n",
    });
    const init = run(dir, ["--init"]);
    expect(init.status, init.stderr).toBe(0);
    const text = baselineText(dir);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    const baseline = readBaseline(dir);
    expect(baseline.version).toBe(1);
    expect(Object.keys(baseline.comments)).toEqual(
      sortedKeys(baseline.comments),
    );
    for (const hashes of Object.values(baseline.comments)) {
      expect(Object.keys(hashes)).toEqual(sortedKeys(hashes));
    }
    const check = run(dir);
    expect(check.status, check.stderr).toBe(0);
  });

  it("scopes the inventory to tracked in-scope files only", () => {
    const dir = fixture({
      "src/a.ts": "const a = 1; // src ts\n",
      "src/deep/b.tsx": "const B = () => <i>{/* deep tsx */}</i>;\n",
      "src/style.css": "a{} /* css */\n",
      "src/deep/more.css": "/* deep css */\n",
      "e2e/spec.ts": "test('x', () => {}); // e2e\n",
      "scripts/tool.mjs": "console.log(1); // mjs\n",
      "scripts/other.cjs": "// cjs\n",
      "public/theme-init.js": "// theme\n",
      "public/skip.js": "// out\n",
      "public/theme-init.css": "/* out */\n",
      "index.html": "<body><!-- html --></body>\n",
      "diagrams/page.html": "<body><!-- out --></body>\n",
      "docs/x.js": "// docs out\n",
      "reports/x.js": "// reports out\n",
      "eslint.config.js": "// eslint\n",
      "vite.config.ts": "// vite\n",
      "vitest.config.ts": "// vitest\n",
      "vitest.setup.ts": "// setup\n",
      "playwright.config.ts": "// playwright\n",
      "root-file.ts": "// root out\n",
      "src/no-comments.ts": "export const n = 1;\n",
    });
    const init = run(dir, ["--init"]);
    expect(init.status, init.stderr).toBe(0);
    const baseline = readBaseline(dir);
    expect(Object.keys(baseline.comments)).toEqual([
      "e2e/spec.ts",
      "eslint.config.js",
      "index.html",
      "playwright.config.ts",
      "public/theme-init.js",
      "scripts/other.cjs",
      "scripts/tool.mjs",
      "src/a.ts",
      "src/deep/b.tsx",
      "src/deep/more.css",
      "src/style.css",
      "vite.config.ts",
      "vitest.config.ts",
      "vitest.setup.ts",
    ]);
    for (const hashes of Object.values(baseline.comments)) {
      expect(Object.keys(hashes)).toHaveLength(1);
    }
  });

  it("rejects a new comment in an existing file", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1; // added\n");
    const check = run(dir);
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("src/a.ts");
  });

  it("rejects a comment in a new tracked file", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/new.ts", "export const n = 1; // fresh\n");
    git(dir, ["add", "src/new.ts"]);
    const check = run(dir);
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("src/new.ts");
  });

  it("rejects a second copy of an existing comment", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // dup\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(
      dir,
      "src/a.ts",
      "export const a = 1; // dup\nexport const b = 2; // dup\n",
    );
    const check = run(dir);
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("src/a.ts");
  });

  it("rejects a same-count comment text replacement", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // old text\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1; // new text\n");
    const check = run(dir);
    expect(check.status).not.toBe(0);
    expect(check.stderr).toMatch(/added|stale/);
  });

  it("reports stale entries and prune accepts deletion-only diffs", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // keep\nexport const b = 2; // drop\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1; // keep\nexport const b = 2;\n");
    const before = run(dir);
    expect(before.status).not.toBe(0);
    expect(before.stderr).toContain("stale");
    const prune = run(dir, ["--prune"]);
    expect(prune.status, prune.stderr).toBe(0);
    const after = run(dir);
    expect(after.status, after.stderr).toBe(0);
    const baseline = readBaseline(dir);
    expect(Object.values(baseline.comments["src/a.ts"] ?? {})).toEqual([1]);
  });

  it("cannot restore a comment once it has been pruned", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n// marker\n" });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1;\n");
    expect(run(dir, ["--prune"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1;\n// marker\n");
    const check = run(dir);
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("src/a.ts");
  });

  it("prune refuses growth and leaves the baseline bytes unchanged", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // alpha\nexport const b = 2; // beta\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    const bytes = baselineText(dir);
    put(
      dir,
      "src/a.ts",
      "export const a = 1; // alpha\nexport const b = 2; // beta\nexport const c = 3; // gamma\n",
    );
    put(dir, "src/b.ts", "export const d = 4; // delta\n");
    git(dir, ["add", "src/b.ts"]);
    const prune = run(dir, ["--prune"]);
    expect(prune.status).not.toBe(0);
    expect(baselineText(dir)).toBe(bytes);
  });

  it("init refuses to overwrite an existing baseline", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1; // x\n" });
    expect(run(dir, ["--init"]).status).toBe(0);
    const bytes = baselineText(dir);
    const second = run(dir, ["--init"]);
    expect(second.status).not.toBe(0);
    expect(baselineText(dir)).toBe(bytes);
  });

  it("prune is byte-identical when repeated on the same input", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // one\n// two\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/a.ts", "export const a = 1; // one\n");
    expect(run(dir, ["--prune"]).status).toBe(0);
    const first = baselineText(dir);
    expect(run(dir, ["--prune"]).status).toBe(0);
    expect(baselineText(dir)).toBe(first);
    expect(run(dir).status).toBe(0);
  });

  it("fails closed on missing, corrupt, and unsorted baselines", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    expect(run(dir).status).not.toBe(0);
    expect(run(dir, ["--prune"]).status).not.toBe(0);
    mkdirSync(dirname(baselineFile(dir)), { recursive: true });
    writeFileSync(baselineFile(dir), "this is not json\n");
    expect(run(dir).status).not.toBe(0);
    writeFileSync(
      baselineFile(dir),
      `${JSON.stringify(
        {
          version: 1,
          comments: { "src/b.ts": {}, "src/a.ts": {} },
        },
        null,
        2,
      )}\n`,
    );
    expect(run(dir).status).not.toBe(0);
  });

  it("rejects unsupported arguments", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    for (const args of [
      ["--bogus"],
      ["init"],
      ["--init", "extra"],
      ["--init", "--prune"],
      ["--help"],
    ]) {
      const result = run(dir, args);
      expect(result.status, `args ${args.join(" ")}`).not.toBe(0);
    }
  });

  it("does not count comment lookalikes across grammars", () => {
    const dir = fixture({
      "src/strings.ts": [
        'const s = "// not a comment";',
        "const t = `/* template not */ ${s}`;",
        "const r = /\\/\\//;",
        "const ok = 8 / 2 / 2;",
        "// real ts",
        "/* real block */",
        "",
      ].join("\n"),
      "src/lookalikes.css": [
        '.a { content: "/* not */"; }',
        ".b { content: '// not'; }",
        ".c { background: url(//cdn.example/x.png); }",
        "/* real css */",
        "",
      ].join("\n"),
      "index.html": [
        "<!doctype html><html><body>",
        '<div title="<!-- attr -->">x</div>',
        "<script>var s = '<!-- js -->'; // js line</script>",
        "<style>/* css in html */</style>",
        "<template><span><!-- tpl --></span></template>",
        "<!-- real html -->",
        "</body></html>",
        "",
      ].join("\n"),
      "src/view.tsx": [
        "export const View = () => (",
        '  <div title="{/* not */}">',
        "    {/* real jsx */}",
        "    // text",
        "  </div>",
        ");",
        "",
      ].join("\n"),
    });
    const init = run(dir, ["--init"]);
    expect(init.status, init.stderr).toBe(0);
    const baseline = readBaseline(dir);
    expect(Object.keys(baseline.comments).sort()).toEqual([
      "index.html",
      "src/lookalikes.css",
      "src/strings.ts",
      "src/view.tsx",
    ]);
    expect(totalComments(baseline, "index.html")).toBe(2);
    expect(totalComments(baseline, "src/lookalikes.css")).toBe(1);
    expect(totalComments(baseline, "src/strings.ts")).toBe(2);
    expect(totalComments(baseline, "src/view.tsx")).toBe(1);
  });

  it("ignores untracked files but counts them once staged", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    put(dir, "src/untracked.ts", "export const u = 1; // untracked\n");
    const init = run(dir, ["--init"]);
    expect(init.status, init.stderr).toBe(0);
    expect(Object.keys(readBaseline(dir).comments)).toEqual([]);
    const check = run(dir);
    expect(check.status, check.stderr).toBe(0);
    git(dir, ["add", "src/untracked.ts"]);
    const staged = run(dir);
    expect(staged.status).not.toBe(0);
    expect(staged.stderr).toContain("src/untracked.ts");
  });

  it("treats a comment moved to another file as growth", () => {
    const dir = fixture({
      "src/a.ts": "export const a = 1; // movable\n",
      "src/b.ts": "export const b = 2;\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    const bytes = baselineText(dir);
    put(dir, "src/a.ts", "export const a = 1;\n");
    put(dir, "src/b.ts", "export const b = 2; // movable\n");
    expect(run(dir).status).not.toBe(0);
    const prune = run(dir, ["--prune"]);
    expect(prune.status).not.toBe(0);
    expect(baselineText(dir)).toBe(bytes);
  });

  it("fails closed on parse or read failure instead of treating it as empty", () => {
    const dir = fixture({
      "src/good.ts": "export const g = 1; // ok\n",
      "src/bad.ts": "export const fine = 1;\n",
    });
    expect(run(dir, ["--init"]).status).toBe(0);
    put(dir, "src/bad.ts", "export const x: = 1;\n");
    const parseFail = run(dir);
    expect(parseFail.status).not.toBe(0);
    expect(parseFail.stderr).toContain("check-comments:");
    put(dir, "src/bad.ts", "export const fine = 1;\n");
    rmSync(join(dir, "src", "good.ts"));
    const readFail = run(dir);
    expect(readFail.status).not.toBe(0);
    expect(readFail.stderr).toContain("check-comments:");
  });

  it("skips symlinks instead of following them", () => {
    const dir = fixture({
      "src/real.ts": "export const r = 1; // real\n",
    });
    symlinkSync("real.ts", join(dir, "src", "link.ts"));
    git(dir, ["add", "-A"]);
    const init = run(dir, ["--init"]);
    expect(init.status, init.stderr).toBe(0);
    expect(Object.keys(readBaseline(dir).comments)).toEqual(["src/real.ts"]);
  });
});
