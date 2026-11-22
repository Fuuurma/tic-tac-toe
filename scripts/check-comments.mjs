import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { tokenize, TokenType } from "@csstools/css-tokenizer";
import { parser } from "typescript-eslint";

const BASELINE_REL = path.join("scripts", "comment-baseline.json");
const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const ROOT_FILES = new Set([
  "eslint.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.setup.ts",
  "playwright.config.ts",
]);
const COMMENT_NODE = 8;

function fail(message) {
  console.error(`check-comments: ${message}`);
  process.exit(2);
}

function violate(message) {
  console.error(`check-comments: ${message}`);
  process.exit(1);
}

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function repoRoot() {
  try {
    return git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  } catch (err) {
    fail(`cannot locate git worktree: ${err.message}`);
  }
}

function inScope(rel) {
  if (rel === "index.html") return true;
  if (ROOT_FILES.has(rel)) return true;
  if (rel === "public/theme-init.js") return true;
  const ext = path.posix.extname(rel);
  if (rel.startsWith("src/") && ext === ".css") return true;
  if (!JS_EXTENSIONS.has(ext)) return false;
  return (
    rel.startsWith("src/") ||
    rel.startsWith("e2e/") ||
    rel.startsWith("scripts/")
  );
}

function grammarOf(rel) {
  if (rel.endsWith(".css")) return "css";
  if (rel.endsWith(".html")) return "html";
  return "js";
}

function sliceLexeme(source, label, range) {
  const ok =
    Array.isArray(range) &&
    range.length === 2 &&
    Number.isInteger(range[0]) &&
    Number.isInteger(range[1]) &&
    range[0] >= 0 &&
    range[1] <= source.length &&
    range[0] < range[1];
  if (!ok) throw new Error(`malformed comment range in ${label}`);
  return source.slice(range[0], range[1]);
}

function jsComments(absPath, source) {
  const result = parser.parseForESLint(source, {
    filePath: absPath,
    sourceType: "unambiguous",
  });
  const comments = result.ast.comments;
  if (!Array.isArray(comments)) {
    throw new Error(`parser returned no comment list for ${absPath}`);
  }
  return comments.map((comment) =>
    sliceLexeme(source, absPath, comment.range),
  );
}

function cssComments(source, label) {
  const out = [];
  for (const token of tokenize({ css: source })) {
    if (token[0] !== TokenType.Comment) continue;
    out.push(sliceLexeme(source, label, [token[2], token[3]]));
  }
  return out;
}

function htmlComments(source) {
  const dom = new JSDOM(source);
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === COMMENT_NODE) {
        out.push(String(child.data));
      } else {
        walk(child);
        if (child.tagName === "TEMPLATE" && child.content) {
          walk(child.content);
        }
      }
    }
  };
  walk(dom.window.document);
  return out;
}

function extractComments(absPath, rel, source) {
  const grammar = grammarOf(rel);
  if (grammar === "css") return cssComments(source, rel);
  if (grammar === "html") return htmlComments(source);
  return jsComments(absPath, source);
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function collectComments(root) {
  const tracked = git(root, ["ls-files", "-z"]).split("\0");
  const files = new Map();
  for (const rel of tracked) {
    if (!rel || !inScope(rel)) continue;
    const abs = path.join(root, rel);
    let stat;
    try {
      stat = fs.lstatSync(abs);
    } catch (err) {
      fail(`cannot stat tracked file ${rel}: ${err.message}`);
    }
    if (!stat.isFile()) continue;
    let source;
    try {
      source = fs.readFileSync(abs, "utf8");
    } catch (err) {
      fail(`cannot read tracked file ${rel}: ${err.message}`);
    }
    let lexemes;
    try {
      lexemes = extractComments(abs, rel, source);
    } catch (err) {
      fail(`cannot extract comments from ${rel}: ${err.message}`);
    }
    if (lexemes.length === 0) continue;
    const counts = new Map();
    for (const lexeme of lexemes) {
      const hash = sha256(lexeme);
      counts.set(hash, (counts.get(hash) ?? 0) + 1);
    }
    files.set(rel, counts);
  }
  return files;
}

function compareCodePoints(a, b) {
  const pa = Array.from(a);
  const pb = Array.from(b);
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    const ca = pa[i].codePointAt(0);
    const cb = pb[i].codePointAt(0);
    if (ca !== cb) return ca - cb;
  }
  return pa.length - pb.length;
}

function isSorted(keys) {
  for (let i = 1; i < keys.length; i += 1) {
    if (compareCodePoints(keys[i - 1], keys[i]) > 0) return false;
  }
  return true;
}

function validateBaseline(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    fail("baseline is not a JSON object");
  }
  if (data.version !== 1) {
    fail(`unsupported baseline version: ${JSON.stringify(data.version)}`);
  }
  const files = data.files;
  if (typeof files !== "object" || files === null || Array.isArray(files)) {
    fail("baseline.files is not an object");
  }
  const paths = Object.keys(files);
  if (!isSorted(paths)) fail("baseline file paths are not sorted");
  for (const p of paths) {
    const counts = files[p];
    if (
      typeof counts !== "object" ||
      counts === null ||
      Array.isArray(counts)
    ) {
      fail(`baseline entry for ${p} is not an object`);
    }
    const hashes = Object.keys(counts);
    if (!isSorted(hashes)) {
      fail(`baseline hashes for ${p} are not sorted`);
    }
    for (const h of hashes) {
      if (!/^[0-9a-f]{64}$/.test(h)) {
        fail(`baseline hash for ${p} is malformed`);
      }
      const n = counts[h];
      if (!Number.isSafeInteger(n) || n < 1) {
        fail(`baseline count for ${p} is not a positive integer`);
      }
    }
  }
  return files;
}

function readBaseline(root) {
  const file = path.join(root, BASELINE_REL);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    fail(
      `baseline missing at ${BASELINE_REL}; run: node scripts/check-comments.mjs --init`,
    );
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail(`baseline at ${BASELINE_REL} is not valid JSON: ${err.message}`);
  }
  const files = validateBaseline(data);
  const map = new Map();
  for (const [p, counts] of Object.entries(files)) {
    map.set(p, new Map(Object.entries(counts)));
  }
  return map;
}

function serializeBaseline(files) {
  const paths = [...files.keys()].sort(compareCodePoints);
  const out = Object.fromEntries(
    paths.map((p) => [
      p,
      Object.fromEntries(
        [...files.get(p).keys()]
          .sort(compareCodePoints)
          .map((h) => [h, files.get(p).get(h)]),
      ),
    ]),
  );
  return `${JSON.stringify({ version: 1, files: out }, null, 2)}\n`;
}

function diffComments(current, baseline) {
  const additions = [];
  const stale = [];
  for (const [p, counts] of current) {
    const allowed = baseline.get(p);
    for (const [h, n] of counts) {
      const have = allowed?.get(h) ?? 0;
      if (n > have) additions.push({ path: p, hash: h, count: n, have });
    }
  }
  for (const [p, counts] of baseline) {
    const actual = current.get(p);
    for (const [h, n] of counts) {
      const present = actual?.get(h) ?? 0;
      if (n > present) {
        stale.push({ path: p, hash: h, count: n, present });
      }
    }
  }
  return { additions, stale };
}

function printDiff(additions, stale) {
  for (const a of additions) {
    console.error(
      `  + ${a.path} ${a.hash.slice(0, 12)} (present x${a.count}, baseline allows ${a.have})`,
    );
  }
  for (const s of stale) {
    console.error(
      `  - ${s.path} ${s.hash.slice(0, 12)} (baseline x${s.count}, present x${s.present})`,
    );
  }
}

function totalComments(files) {
  let n = 0;
  for (const counts of files.values()) {
    for (const c of counts.values()) n += c;
  }
  return n;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (
    args.length > 1 ||
    (mode !== undefined && mode !== "--init" && mode !== "--prune")
  ) {
    fail("usage: node scripts/check-comments.mjs [--init|--prune]");
  }
  const root = repoRoot();
  if (mode === "--init") {
    const file = path.join(root, BASELINE_REL);
    if (fs.existsSync(file)) {
      fail(`baseline already exists at ${BASELINE_REL}; refusing overwrite`);
    }
    const current = collectComments(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, serializeBaseline(current), { flag: "wx" });
    } catch (err) {
      fail(`cannot create baseline: ${err.message}`);
    }
    console.log(
      `check-comments: wrote ${BASELINE_REL} (${totalComments(current)} comments)`,
    );
    return;
  }
  const baseline = readBaseline(root);
  const current = collectComments(root);
  const { additions, stale } = diffComments(current, baseline);
  if (mode === "--prune") {
    if (additions.length > 0) {
      printDiff(additions, []);
      violate(
        "prune refused: comment counts grew; remove additions and re-run",
      );
    }
    fs.writeFileSync(
      path.join(root, BASELINE_REL),
      serializeBaseline(current),
    );
    console.log(`check-comments: pruned ${BASELINE_REL}`);
    return;
  }
  if (additions.length > 0 || stale.length > 0) {
    console.error("check-comments: comment ratchet violations");
    printDiff(additions, stale);
    if (additions.length > 0) {
      console.error(
        "new or changed comments are not allowed; remove them, then re-run",
      );
      if (stale.length > 0) {
        console.error(
          "after the additions are gone, run `node scripts/check-comments.mjs --prune` to accept the deletions",
        );
      }
    } else {
      console.error(
        "comments were only deleted; run `node scripts/check-comments.mjs --prune` and commit scripts/comment-baseline.json",
      );
    }
    process.exit(1);
  }
  console.log("check-comments: OK");
}

main();
