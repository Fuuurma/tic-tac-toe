import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "check-comments.mjs");

function git(dir: string, args: string[]): string {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

function cli(dir: string, args: string[] = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "comment-ratchet-"));
  git(dir, ["init", "-q"]);
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  git(dir, ["add", "-A"]);
  return dir;
}

function seeded(files: Record<string, string>): string {
  const dir = fixture(files);
  const init = cli(dir, ["--init"]);
  expect(init.status, init.stderr).toBe(0);
  return dir;
}

function baselineFile(dir: string): string {
  return join(dir, "scripts", "comment-baseline.json");
}

describe("comment ratchet", () => {
  it("passes against the committed baseline in this repository", () => {
    const res = cli(ROOT);
    expect(res.status, res.stdout + res.stderr).toBe(0);
  });

  it("rejects a new comment on an existing tracked file", () => {
    const dir = seeded({ "src/a.ts": "export const a = 1;\n" });
    expect(cli(dir).status).toBe(0);
    writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n// added\n");
    const res = cli(dir);
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toContain("src/a.ts");
  });

  it("rejects a comment on a newly tracked file but ignores untracked files", () => {
    const dir = seeded({ "src/a.ts": "export const a = 1;\n" });
    writeFileSync(join(dir, "src/b.ts"), "export const b = 2;\n// untracked\n");
    expect(cli(dir).status).toBe(0);
    git(dir, ["add", "src/b.ts"]);
    expect(cli(dir).status).not.toBe(0);
  });

  it("rejects a duplicate copy and a same-count text replacement", () => {
    const dir = seeded({ "src/a.ts": "// one\nexport const a = 1;\n" });
    writeFileSync(join(dir, "src/a.ts"), "// one\n// one\nexport const a = 1;\n");
    expect(cli(dir).status).not.toBe(0);
    writeFileSync(join(dir, "src/a.ts"), "// two\nexport const a = 1;\n");
    const res = cli(dir);
    expect(res.status).not.toBe(0);
    expect(res.stdout + res.stderr).toMatch(/added|stale/);
  });

  it("treats moving a comment to another file as growth", () => {
    const dir = seeded({
      "src/a.ts": "// moved\nexport const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
    });
    writeFileSync(join(dir, "src/a.ts"), "export const a = 1;\n");
    writeFileSync(join(dir, "src/b.ts"), "// moved\nexport const b = 2;\n");
    expect(cli(dir).status).not.toBe(0);
  });

  it("prunes deletions only and refuses to restore them", () => {
    const dir = seeded({ "src/a.ts": "// d1\n// d2\nexport const a = 1;\n" });
    writeFileSync(join(dir, "src/a.ts"), "// d2\nexport const a = 1;\n");
    expect(cli(dir).status).not.toBe(0);
    const prune = cli(dir, ["--prune"]);
    expect(prune.status, prune.stderr).toBe(0);
    expect(cli(dir).status).toBe(0);
    writeFileSync(join(dir, "src/a.ts"), "// d1\n// d2\nexport const a = 1;\n");
    expect(cli(dir).status).not.toBe(0);
    expect(cli(dir, ["--prune"]).status).not.toBe(0);
  });

  it("keeps baseline bytes stable across refused writes and repeats", () => {
    const dir = seeded({ "src/a.ts": "// keep\nexport const a = 1;\n" });
    const file = baselineFile(dir);
    const before = readFileSync(file, "utf8");
    expect(cli(dir, ["--init"]).status).not.toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
    writeFileSync(join(dir, "src/a.ts"), "// keep\n// extra\nexport const a = 1;\n");
    expect(cli(dir, ["--prune"]).status).not.toBe(0);
    expect(readFileSync(file, "utf8")).toBe(before);
    writeFileSync(join(dir, "src/a.ts"), "// keep\nexport const a = 1;\n");
    expect(cli(dir, ["--prune"]).status).toBe(0);
    const mid = readFileSync(file, "utf8");
    expect(cli(dir, ["--prune"]).status).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(mid);
    expect(mid).toBe(before);
  });

  it("fails closed on bad arguments and missing, corrupt or unsorted baselines", () => {
    const dir = fixture({ "src/a.ts": "export const a = 1;\n" });
    expect(cli(dir, ["--bogus"]).status).not.toBe(0);
    expect(cli(dir).status).not.toBe(0);
    expect(cli(dir, ["--prune"]).status).not.toBe(0);
    const file = baselineFile(dir);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "{not json");
    expect(cli(dir).status).not.toBe(0);
    const dir2 = seeded({
      "src/a.ts": "// x\n// x2\nexport const a = 1;\n",
      "src/b.ts": "// y\nexport const b = 2;\n",
    });
    const file2 = baselineFile(dir2);
    const data = JSON.parse(readFileSync(file2, "utf8")) as {
      files: Record<string, Record<string, number>>;
    };
    const inner = data.files["src/a.ts"];
    const hashes = Object.keys(inner);
    data.files["src/a.ts"] = { [hashes[1]]: inner[hashes[1]], [hashes[0]]: inner[hashes[0]] };
    data.files = { "src/b.ts": data.files["src/b.ts"], "src/a.ts": data.files["src/a.ts"] };
    writeFileSync(file2, JSON.stringify(data) + "\n");
    expect(cli(dir2).status).not.toBe(0);
  });

  it("counts only real comments in every supported grammar", () => {
    const dir = seeded({
      "src/js.ts": [
        'const s = "// not a comment";',
        "const t = `/* also not */`;",
        "const r = /[//]/;",
        "export const x = 1; // real js",
        "",
      ].join("\n"),
      "src/ui.tsx": "export const el = <div>{/* real jsx */}// text lookalike</div>;\n",
      "src/x.css": '/* real css */\na { content: "/* not css */"; }\n',
      "index.html":
        '<html><body><!-- real html --><div title="<!-- fake -->"></div><template><!-- tpl --></template><style>/* fake */</style></body></html>\n',
      "public/theme-init.js": 'const s = "<!-- not html -->";\n// real theme\n',
    });
    const baseline = JSON.parse(readFileSync(baselineFile(dir), "utf8")) as {
      files: Record<string, Record<string, number>>;
    };
    expect(Object.keys(baseline.files["src/js.ts"] ?? {})).toHaveLength(1);
    expect(Object.keys(baseline.files["src/ui.tsx"] ?? {})).toHaveLength(1);
    expect(Object.keys(baseline.files["src/x.css"] ?? {})).toHaveLength(1);
    expect(Object.keys(baseline.files["index.html"] ?? {})).toHaveLength(2);
    expect(Object.keys(baseline.files["public/theme-init.js"] ?? {})).toHaveLength(1);
    expect(cli(dir).status).toBe(0);
  });
});
