import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parser } from "typescript-eslint";

const BASELINE = join("scripts", "comment-baseline.json");
const CODE = /\.(?:cjs|jsx?|mjs|tsx?)$/;
const EXTRA = new Set([
  "eslint.config.js",
  "playwright.config.ts",
  "public/theme-init.js",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.setup.ts",
]);
const SKIP_DIR = new Set([
  "assets",
  "build",
  "dist",
  "docs",
  "generated",
  "vendor",
]);

const byCodePoint = (a, b) => {
  const pa = [...a];
  const pb = [...b];
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const d = pa[i].codePointAt(0) - pb[i].codePointAt(0);
    if (d !== 0) return d;
  }
  return pa.length - pb.length;
};

const fail = (msg) => {
  console.error(`check-comments: ${msg}`);
  process.exit(1);
};

const root = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
  } catch {
    fail("not inside a git checkout");
  }
})();

const kindOf = (path) => {
  if (path === "index.html") return "html";
  const segs = path.split("/");
  if (segs.some((s) => SKIP_DIR.has(s))) return null;
  if (segs[0] === "src" || segs[0] === "e2e" || segs[0] === "scripts") {
    if (segs[0] === "src" && path.endsWith(".css")) return "css";
    return CODE.test(path) ? "code" : null;
  }
  return EXTRA.has(path) ? "code" : null;
};

const codeLexemes = (file, source) => {
  const { ast } = parser.parseForESLint(source, { filePath: join(root, file) });
  return (ast.comments ?? []).map((c) =>
    source.slice(c.range[0], c.range[1]),
  );
};

const cssLexemes = async (source) => {
  const { tokenize, TokenType } = await import("@csstools/css-tokenizer");
  return tokenize({ css: source })
    .filter((t) => t[0] === TokenType.Comment)
    .map((t) => source.slice(t[2], t[3]));
};

const htmlLexemes = async (source) => {
  const { JSDOM } = await import("jsdom");
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 8) out.push(`<!--${child.data}-->`);
      else if (child.nodeType === 1 && child.tagName === "TEMPLATE")
        walk(child.content);
      else walk(child);
    }
  };
  walk(new JSDOM(source).window.document);
  return out;
};

const lexemes = (kind, file, source) =>
  kind === "code"
    ? codeLexemes(file, source)
    : kind === "css"
      ? cssLexemes(source)
      : htmlLexemes(source);

const collect = async () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((p) => [p, kindOf(p)])
    .filter(([, kind]) => kind !== null);
  const comments = {};
  for (const [path, kind] of tracked) {
    const full = join(root, path);
    const st = lstatSync(full);
    if (st.isSymbolicLink() || !st.isFile()) continue;
    const source = readFileSync(full, "utf8");
    const hashes = {};
    let lexes;
    try {
      lexes = await lexemes(kind, path, source);
    } catch (e) {
      fail(
        `cannot parse ${path}: ${e instanceof Error ? e.message.split("\n")[0] : e}`,
      );
    }
    for (const lex of lexes) {
      const h = createHash("sha256")
        .update(lex, "utf8")
        .digest("hex")
        .slice(0, 16);
      hashes[h] = (hashes[h] ?? 0) + 1;
    }
    if (Object.keys(hashes).length > 0) comments[path] = hashes;
  }
  return comments;
};

const sortedKeys = (keys) =>
  keys.every((k, i) => i === 0 || byCodePoint(keys[i - 1], k) < 0);

const serialize = (comments) => {
  const sorted = {};
  for (const p of Object.keys(comments).sort(byCodePoint)) {
    const inner = {};
    for (const h of Object.keys(comments[p]).sort(byCodePoint))
      inner[h] = comments[p][h];
    sorted[p] = inner;
  }
  return `${JSON.stringify({ version: 1, comments: sorted })}\n`;
};

const corrupt = () => fail(`corrupt ${BASELINE}`);

const loadBaseline = () => {
  const file = join(root, BASELINE);
  if (!existsSync(file))
    fail(`missing ${BASELINE} — run with --init to create it`);
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    corrupt();
  }
  if (
    data === null ||
    typeof data !== "object" ||
    data.version !== 1 ||
    typeof data.comments !== "object" ||
    data.comments === null ||
    Array.isArray(data.comments)
  )
    corrupt();
  if (!sortedKeys(Object.keys(data.comments)))
    fail(`unsorted path map in ${BASELINE}`);
  for (const [p, m] of Object.entries(data.comments)) {
    if (typeof m !== "object" || m === null || Array.isArray(m)) corrupt();
    if (!sortedKeys(Object.keys(m))) fail(`unsorted hash map for ${p}`);
    for (const [h, c] of Object.entries(m)) {
      if (!/^[0-9a-f]{16}$/.test(h) || !Number.isSafeInteger(c) || c < 1)
        corrupt();
    }
  }
  return data.comments;
};

const diff = (baseline, current) => {
  const added = [];
  const stale = [];
  for (const [p, m] of Object.entries(current)) {
    for (const [h, c] of Object.entries(m)) {
      const b = baseline[p]?.[h] ?? 0;
      if (c > b) added.push(`${p} ${h} (${b} -> ${c})`);
    }
  }
  for (const [p, m] of Object.entries(baseline)) {
    for (const [h, c] of Object.entries(m)) {
      const n = current[p]?.[h] ?? 0;
      if (c > n) stale.push(`${p} ${h} (${c} -> ${n})`);
    }
  }
  return { added, stale };
};

const main = async () => {
  const args = process.argv.slice(2);
  const mode =
    args.length === 0
      ? "check"
      : args.length === 1 && args[0].startsWith("--")
        ? args[0].slice(2)
        : "";
  if (!["check", "init", "prune"].includes(mode)) {
    fail("usage: node scripts/check-comments.mjs [--init|--prune]");
  }
  const baselineFile = join(root, BASELINE);
  if (mode === "init") {
    if (existsSync(baselineFile))
      fail(`${BASELINE} already exists — refusing to overwrite`);
    mkdirSync(dirname(baselineFile), { recursive: true });
    writeFileSync(baselineFile, serialize(await collect()));
    console.log(`wrote ${BASELINE}`);
    return;
  }
  const baseline = loadBaseline();
  const current = await collect();
  if (mode === "prune") {
    for (const [p, m] of Object.entries(current)) {
      for (const [h, c] of Object.entries(m)) {
        const b = baseline[p]?.[h] ?? 0;
        if (c > b)
          fail(
            `--prune refused: comment count grew at ${p} (${b} -> ${c}); remove new comments first`,
          );
      }
    }
    writeFileSync(baselineFile, serialize(current));
    console.log(`pruned ${BASELINE}`);
    return;
  }
  const { added, stale } = diff(baseline, current);
  if (added.length === 0 && stale.length === 0) {
    console.log("check-comments: baseline matches");
    return;
  }
  for (const line of added) console.error(`new comment not in baseline: ${line}`);
  for (const line of stale)
    console.error(`baseline entry no longer present: ${line}`);
  if (added.length === 0) {
    console.error(
      "deletion-only diff — run `node scripts/check-comments.mjs --prune` to update the baseline",
    );
  } else {
    console.error("new or changed comments are not allowed");
  }
  process.exit(1);
};

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
