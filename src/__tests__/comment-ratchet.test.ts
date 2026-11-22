import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
  new URL("../../scripts/check-comments.mjs", import.meta.url),
);
const BASELINE_REL = path.join("scripts", "comment-baseline.json");

const fixtures: string[] = [];

afterEach(() => {
  while (fixtures.length > 0) {
    fs.rmSync(fixtures.pop() as string, { recursive: true, force: true });
  }
});

function git(dir: string, args: string[]): void {
  execFileSync("git", args, { cwd: dir, stdio: "pipe" });
}

function writeFile(dir: string, rel: string, content: string): void {
  const target = path.join(dir, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeFixture(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comment-ratchet-"));
  fixtures.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    writeFile(dir, rel, content);
  }
  git(dir, ["init", "-q"]);
  git(dir, ["add", "-A"]);
  return dir;
}

function stage(dir: string, rel: string): void {
  git(dir, ["add", "--", rel]);
}

function cli(dir: string, args: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

function baselineFile(dir: string): string {
  return path.join(dir, BASELINE_REL);
}

function baselineBytes(dir: string): string {
  return fs.readFileSync(baselineFile(dir), "utf8");
}

function readBaseline(dir: string) {
  return JSON.parse(baselineBytes(dir)) as {
    version: number;
    files: Record<string, Record<string, number>>;
  };
}

function totalCount(entry: Record<string, number> | undefined): number {
  return Object.values(entry ?? {}).reduce((sum, n) => sum + n, 0);
}

describe("check-comments baseline lifecycle", () => {
  it(
    "creates a baseline once, then passes on an unchanged tree",
    () => {
      const dir = makeFixture({
        "src/a.ts": "export const a = 1;\n// keep me\n",
      });
      const init = cli(dir, ["--init"]);
      expect(init.status).toBe(0);
      expect(fs.existsSync(baselineFile(dir))).toBe(true);
      expect(baselineBytes(dir).endsWith("\n")).toBe(true);
      expect(cli(dir).status).toBe(0);
    },
    30000,
  );

  it(
    "refuses a second --init without touching the baseline",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// one\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const before = baselineBytes(dir);
      const again = cli(dir, ["--init"]);
      expect(again.status).not.toBe(0);
      expect(baselineBytes(dir)).toBe(before);
    },
    30000,
  );

  it(
    "fails lint when the baseline is missing",
    () => {
      const dir = makeFixture({ "src/a.ts": "// c\n" });
      const res = cli(dir);
      expect(res.status).toBe(2);
      expect(res.stderr + res.stdout).toContain("--init");
    },
    30000,
  );

  it(
    "fails lint when the baseline is corrupt JSON",
    () => {
      const dir = makeFixture({ "src/a.ts": "// c\n" });
      writeFile(dir, BASELINE_REL, "{ not json");
      expect(cli(dir).status).toBe(2);
    },
    30000,
  );

  it(
    "fails lint when baseline path keys are unsorted",
    () => {
      const dir = makeFixture({ "src/a.ts": "// c\n" });
      const hash = "a".repeat(64);
      writeFile(
        dir,
        BASELINE_REL,
        `${JSON.stringify({
          version: 1,
          files: { "src/b.ts": { [hash]: 1 }, "src/a.ts": { [hash]: 1 } },
        })}\n`,
      );
      expect(cli(dir).status).toBe(2);
    },
    30000,
  );

  it(
    "fails lint when baseline hash keys are unsorted",
    () => {
      const dir = makeFixture({ "src/a.ts": "// c\n" });
      writeFile(
        dir,
        BASELINE_REL,
        `${JSON.stringify({
          version: 1,
          files: {
            "src/a.ts": { ["b".repeat(64)]: 1, ["a".repeat(64)]: 1 },
          },
        })}\n`,
      );
      expect(cli(dir).status).toBe(2);
    },
    30000,
  );

  it(
    "rejects unsupported arguments",
    () => {
      const dir = makeFixture({ "src/a.ts": "// c\n" });
      expect(cli(dir, ["--init"]).status).toBe(0);
      for (const args of [
        ["--bogus"],
        ["--init", "--prune"],
        ["--prune", "--init"],
        ["positional"],
        ["--init", "extra"],
      ]) {
        expect(cli(dir, args).status).toBe(2);
      }
    },
    30000,
  );
});

describe("check-comments ratchet", () => {
  it(
    "fails lint when a comment is added to a tracked file",
    () => {
      const dir = makeFixture({
        "src/a.ts": "export const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "export const a = 1;\n// added\n");
      const res = cli(dir);
      expect(res.status).toBe(1);
      expect(res.stderr + res.stdout).toContain("src/a.ts");
    },
    30000,
  );

  it(
    "fails lint when a comment appears in a newly tracked file",
    () => {
      const dir = makeFixture({
        "src/a.ts": "export const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/b.ts", "// brand new\nexport const b = 2;\n");
      stage(dir, "src/b.ts");
      expect(cli(dir).status).toBe(1);
    },
    30000,
  );

  it(
    "counts duplicate comments and fails when a copy is added",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// dup\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "// dup\n// dup\nexport const a = 1;\n");
      expect(cli(dir).status).toBe(1);
    },
    30000,
  );

  it(
    "fails when a comment's text changes at the same count",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// alpha\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "// beta\nexport const a = 1;\n");
      expect(cli(dir).status).toBe(1);
    },
    30000,
  );

  it(
    "treats moving a comment to another file as growth",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// moving\nexport const a = 1;\n",
        "src/b.ts": "export const b = 2;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "export const a = 1;\n");
      writeFile(dir, "src/b.ts", "// moving\nexport const b = 2;\n");
      const res = cli(dir);
      expect(res.status).toBe(1);
      expect(res.stderr + res.stdout).toContain("src/b.ts");
    },
    30000,
  );

  it(
    "prune accepts a deletion-only diff and lint passes afterwards",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// first\n// second\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "// first\nexport const a = 1;\n");
      expect(cli(dir).status).toBe(1);
      expect(cli(dir, ["--prune"]).status).toBe(0);
      expect(cli(dir).status).toBe(0);
      const entry = readBaseline(dir).files["src/a.ts"];
      expect(Object.keys(entry ?? {})).toHaveLength(1);
      expect(totalCount(entry)).toBe(1);
    },
    30000,
  );

  it(
    "a comment deleted and pruned cannot be restored",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// gone\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "export const a = 1;\n");
      expect(cli(dir, ["--prune"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "// gone\nexport const a = 1;\n");
      expect(cli(dir).status).toBe(1);
    },
    30000,
  );

  it(
    "prune refuses growth and leaves the baseline bytes untouched",
    () => {
      const dir = makeFixture({
        "src/a.ts": "export const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/a.ts", "// growth\nexport const a = 1;\n");
      const before = baselineBytes(dir);
      const res = cli(dir, ["--prune"]);
      expect(res.status).toBe(1);
      expect(baselineBytes(dir)).toBe(before);
    },
    30000,
  );

  it(
    "repeating prune on identical input leaves identical bytes",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// one\n// two\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const seeded = baselineBytes(dir);
      expect(cli(dir, ["--prune"]).status).toBe(0);
      expect(baselineBytes(dir)).toBe(seeded);
      writeFile(dir, "src/a.ts", "// one\nexport const a = 1;\n");
      expect(cli(dir, ["--prune"]).status).toBe(0);
      const pruned = baselineBytes(dir);
      expect(cli(dir, ["--prune"]).status).toBe(0);
      expect(baselineBytes(dir)).toBe(pruned);
      expect(cli(dir).status).toBe(0);
    },
    30000,
  );
});

describe("check-comments extraction", () => {
  it(
    "ignores comment lookalikes in JS strings, templates and regexes",
    () => {
      const dir = makeFixture({
        "src/str.ts": [
          'export const a = "// line";',
          "export const b = `/* block */`;",
          "export const c = /\\/\\//;",
          'export const d = "<!-- html -->";',
          "",
        ].join("\n"),
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      expect(readBaseline(dir).files["src/str.ts"]).toBeUndefined();
    },
    30000,
  );

  it(
    "counts JSX expression comments but not JSX attribute strings",
    () => {
      const dir = makeFixture({
        "src/el.tsx":
          'export const el = <div title="/* attr */">{/* real */}</div>;\n',
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const entry = readBaseline(dir).files["src/el.tsx"];
      expect(entry).toBeDefined();
      expect(Object.keys(entry ?? {})).toHaveLength(1);
      expect(totalCount(entry)).toBe(1);
    },
    30000,
  );

  it(
    "parses plain JS, MJS and root config grammars",
    () => {
      const dir = makeFixture({
        "scripts/x.mjs": "// mjs note\nexport const x = 1;\n",
        "public/theme-init.js": "// theme note\n",
        "eslint.config.js": "// eslint note\nexport default {};\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const files = readBaseline(dir).files;
      for (const rel of [
        "scripts/x.mjs",
        "public/theme-init.js",
        "eslint.config.js",
      ]) {
        expect(totalCount(files[rel])).toBe(1);
      }
    },
    30000,
  );

  it(
    "counts CSS comments but not strings or line-looking text",
    () => {
      const dir = makeFixture({
        "src/x.css":
          '.a { content: "/* string */"; } /* real */\n// not css\n',
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const entry = readBaseline(dir).files["src/x.css"];
      expect(entry).toBeDefined();
      expect(Object.keys(entry ?? {})).toHaveLength(1);
      expect(totalCount(entry)).toBe(1);
    },
    30000,
  );

  it(
    "counts HTML comments including template content only",
    () => {
      const dir = makeFixture({
        "index.html": [
          "<!doctype html><html><body>",
          "<!-- real -->",
          '<div data-x="<!-- attr -->"></div>',
          "<template><!-- tpl --><span></span></template>",
          '<script>const s = "<!-- js -->"; // js line</script>',
          "</body></html>",
          "",
        ].join("\n"),
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      const entry = readBaseline(dir).files["index.html"];
      expect(entry).toBeDefined();
      expect(Object.keys(entry ?? {})).toHaveLength(2);
      expect(totalCount(entry)).toBe(2);
    },
    30000,
  );
});

describe("check-comments scope", () => {
  it(
    "ignores untracked files and tracked files outside the scope",
    () => {
      const dir = makeFixture({
        "src/a.ts": "// scoped\nexport const a = 1;\n",
        "docs/guide.ts": "// docs out of scope\nexport const d = 1;\n",
        "diagrams/x.html": "<!-- diagram -->\n",
        "public/other.js": "// not theme-init\n",
      });
      writeFile(dir, "src/untracked.ts", "// not added to git\n");
      expect(cli(dir, ["--init"]).status).toBe(0);
      expect(Object.keys(readBaseline(dir).files)).toEqual(["src/a.ts"]);
      stage(dir, "src/untracked.ts");
      expect(cli(dir).status).toBe(1);
    },
    30000,
  );
});

describe("check-comments fail-closed parsing", () => {
  it(
    "--init fails when a tracked file cannot be parsed",
    () => {
      const dir = makeFixture({
        "src/bad.ts": "export const = ;\n",
        "src/a.ts": "// ok\nexport const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).not.toBe(0);
      expect(fs.existsSync(baselineFile(dir))).toBe(false);
    },
    30000,
  );

  it(
    "lint fails when a tracked file cannot be parsed",
    () => {
      const dir = makeFixture({
        "src/a.ts": "export const a = 1;\n",
      });
      expect(cli(dir, ["--init"]).status).toBe(0);
      writeFile(dir, "src/bad.ts", "export const = ;\n");
      stage(dir, "src/bad.ts");
      const res = cli(dir);
      expect(res.status).not.toBe(0);
      expect(res.stderr + res.stdout).not.toContain("comment ratchet: OK");
    },
    30000,
  );
});
