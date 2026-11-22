import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import tseslint from "typescript-eslint";
import { JSDOM } from "jsdom";
import { tokenize, TokenType } from "@csstools/css-tokenizer";

const BASELINE_REL = join("scripts", "comment-baseline.json");
const JS_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const JS_FILES = new Set([
  "eslint.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.setup.ts",
  "playwright.config.ts",
  "public/theme-init.js",
]);
const EXCLUDED_SEGMENTS = new Set([
  "assets",
  "build",
  "coverage",
  "dist",
  "docs",
  "generated",
  "node_modules",
  "vendor",
]);

function cmpCodePoints(a, b) {
  const ai = a[Symbol.iterator]();
  const bi = b[Symbol.iterator]();
  for (;;) {
    const x = ai.next();
    const y = bi.next();
    if (x.done || y.done) return x.done === y.done ? 0 : x.done ? -1 : 1;
    const d = x.value.codePointAt(0) - y.value.codePointAt(0);
    if (d !== 0) return d;
  }
}

function isSorted(keys) {
  for (let i = 1; i < keys.length; i += 1) {
    if (cmpCodePoints(keys[i - 1], keys[i]) >= 0) return false;
  }
  return true;
}

function grammarFor(path) {
  if (path.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
    return null;
  }
  if (path === "index.html") return "html";
  const ext = extname(path);
  const inScopeDir =
    path.startsWith("src/") ||
    path.startsWith("e2e/") ||
    path.startsWith("scripts/");
  if (JS_FILES.has(path) || (inScopeDir && JS_EXTENSIONS.has(ext))) return "js";
  if (path.startsWith("src/") && ext === ".css") return "css";
  return null;
}

const HASH_BYTES = 9;
const HASH_PATTERN = /^[A-Za-z0-9_-]{12}$/;

const sha256 = (text) =>
  createHash("sha256")
    .update(text, "utf8")
    .digest()
    .subarray(0, HASH_BYTES)
    .toString("base64url");

function jsLexemes(source, filePath) {
  const { ast } = tseslint.parser.parseForESLint(source, {
    filePath,
    jsDocParsingMode: "none",
    loggerFn: false,
    range: true,
  });
  return (ast.comments ?? []).map((comment) => {
    if (!comment.range) throw new Error(`comment without range in ${filePath}`);
    return source.slice(comment.range[0], comment.range[1]);
  });
}

function htmlLexemes(source) {
  const dom = new JSDOM(source);
  const lexemes = [];
  const walk = (node) => {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 8) lexemes.push(child.data);
      if (child.nodeType === 1 && child.tagName === "TEMPLATE") {
        walk(child.content);
      }
      walk(child);
    }
  };
  walk(dom.window.document);
  return lexemes;
}

function cssLexemes(source) {
  const lexemes = [];
  const tokens = tokenize(
    { css: source },
    {
      onParseError(error) {
        throw error;
      },
    },
  );
  for (const token of tokens) {
    if (token[0] === TokenType.Comment) {
      lexemes.push(source.slice(token[2], token[3]));
    }
  }
  return lexemes;
}

function gitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error("not inside a git checkout");
  }
}

function trackedFiles(root) {
  const out = execFileSync("git", ["-C", root, "ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean);
}

function inventory(root) {
  const counts = new Map();
  for (const path of trackedFiles(root)) {
    const grammar = grammarFor(path);
    if (!grammar) continue;
    const absolute = join(root, path);
    const stat = lstatSync(absolute, { throwIfNoEntry: false });
    if (!stat) throw new Error(`tracked file missing: ${path}`);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;
    const source = readFileSync(absolute, "utf8");
    const lexemes =
      grammar === "html"
        ? htmlLexemes(source)
        : grammar === "css"
          ? cssLexemes(source)
          : jsLexemes(source, absolute);
    if (lexemes.length === 0) continue;
    const hashes = new Map();
    for (const lexeme of lexemes) {
      const hash = sha256(lexeme);
      hashes.set(hash, (hashes.get(hash) ?? 0) + 1);
    }
    counts.set(path, hashes);
  }
  return counts;
}

function serialize(counts) {
  const files = {};
  for (const path of [...counts.keys()].sort(cmpCodePoints)) {
    const inner = {};
    const hashes = counts.get(path);
    for (const hash of [...hashes.keys()].sort(cmpCodePoints)) {
      inner[hash] = hashes.get(hash);
    }
    files[path] = inner;
  }
  return `${JSON.stringify({ version: 1, files })}\n`;
}

function corrupt(reason) {
  return new Error(`corrupt baseline ${BASELINE_REL}: ${reason}`);
}

function loadBaseline(root) {
  const file = join(root, BASELINE_REL);
  if (!existsSync(file)) {
    throw new Error(`missing baseline ${BASELINE_REL}: run --init`);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw corrupt("invalid JSON");
  }
  if (
    data?.version !== 1 ||
    typeof data.files !== "object" ||
    data.files === null ||
    Array.isArray(data.files)
  ) {
    throw corrupt("unexpected shape");
  }
  const paths = Object.keys(data.files);
  if (!isSorted(paths)) throw corrupt("paths not sorted");
  const baseline = new Map();
  for (const path of paths) {
    const inner = data.files[path];
    if (
      typeof inner !== "object" ||
      inner === null ||
      Array.isArray(inner) ||
      Object.keys(inner).length === 0
    ) {
      throw corrupt(`bad entry for ${path}`);
    }
    const hashes = Object.keys(inner);
    if (!isSorted(hashes)) throw corrupt(`hashes not sorted for ${path}`);
    const map = new Map();
    for (const hash of hashes) {
      const count = inner[hash];
      if (!HASH_PATTERN.test(hash) || !Number.isInteger(count) || count < 1) {
        throw corrupt(`bad count for ${path}`);
      }
      map.set(hash, count);
    }
    baseline.set(path, map);
  }
  return baseline;
}

function diff(current, baseline) {
  const added = [];
  const stale = [];
  for (const [path, hashes] of current) {
    const base = baseline.get(path);
    for (const [hash, count] of hashes) {
      const allowed = base?.get(hash) ?? 0;
      if (count > allowed) {
        added.push(`${path} ${hash} (+${count - allowed})`);
      }
    }
  }
  for (const [path, hashes] of baseline) {
    const cur = current.get(path);
    for (const [hash, count] of hashes) {
      const actual = cur?.get(hash) ?? 0;
      if (count > actual) {
        stale.push(`${path} ${hash} (-${count - actual})`);
      }
    }
  }
  added.sort();
  stale.sort();
  return { added, stale };
}

function report(added, stale) {
  console.log(
    `comment ratchet: ${added.length} added, ${stale.length} stale baseline entr${stale.length === 1 ? "y" : "ies"}`,
  );
  for (const line of added) console.log(`  + ${line}`);
  for (const line of stale) console.log(`  - ${line}`);
  if (stale.length > 0) {
    console.log(
      "comments were deleted: run `node scripts/check-comments.mjs --prune` to shrink the baseline",
    );
  }
  if (added.length > 0) {
    console.log("new or changed comments are not permitted by this ratchet");
  }
}

function main() {
  const args = process.argv.slice(2);
  let mode = "check";
  if (args.length === 1) {
    if (args[0] === "--init") mode = "init";
    else if (args[0] === "--prune") mode = "prune";
    else throw new Error(`unsupported argument: ${args[0]}`);
  } else if (args.length > 1) {
    throw new Error(`unsupported arguments: ${args.join(" ")}`);
  }
  const root = gitRoot();
  const file = join(root, BASELINE_REL);
  if (mode === "init") {
    if (existsSync(file)) {
      throw new Error(`${BASELINE_REL} already exists; --init refuses to overwrite`);
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, serialize(inventory(root)));
    console.log(`comment baseline written: ${BASELINE_REL}`);
    return;
  }
  const baseline = loadBaseline(root);
  const current = inventory(root);
  const { added, stale } = diff(current, baseline);
  if (mode === "prune") {
    if (added.length > 0) {
      report(added, []);
      console.log("prune refused: baseline would grow");
      process.exit(1);
    }
    writeFileSync(file, serialize(current));
    console.log(`comment baseline pruned: ${BASELINE_REL}`);
    return;
  }
  if (added.length > 0 || stale.length > 0) {
    report(added, stale);
    process.exit(1);
  }
  console.log("comment ratchet: ok");
}

try {
  main();
} catch (error) {
  console.error(`check-comments: ${error?.message ?? error}`);
  process.exit(2);
}
