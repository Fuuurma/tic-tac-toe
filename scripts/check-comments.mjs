import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tokenize, TokenType } from "@csstools/css-tokenizer";
import { JSDOM } from "jsdom";
import { parser } from "typescript-eslint";

const BASELINE_RELPATH = join("scripts", "comment-baseline.json");

const ROOT_FILES = new Set([
  "eslint.config.js",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.setup.ts",
  "playwright.config.ts",
]);

const JS_PATTERN = /\.(?:cjs|jsx?|mjs|tsx?)$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SKIP_DIRS = new Set([
  "assets",
  "build",
  "dist",
  "docs",
  "generated",
  "vendor",
]);

function compareCodePoints(a, b) {
  const left = [...a];
  const right = [...b];
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    const diff = left[i].codePointAt(0) - right[i].codePointAt(0);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function inScope(relPath) {
  if (relPath.split("/").some((seg) => SKIP_DIRS.has(seg))) return false;
  if (relPath === "index.html") return true;
  if (relPath === "public/theme-init.js") return true;
  if (ROOT_FILES.has(relPath)) return true;
  if (relPath.startsWith("src/") && relPath.endsWith(".css")) return true;
  if (!JS_PATTERN.test(relPath)) return false;
  return (
    relPath.startsWith("src/") ||
    relPath.startsWith("e2e/") ||
    relPath.startsWith("scripts/")
  );
}

function jsComments(source, filePath) {
  const { ast } = parser.parseForESLint(source, { filePath });
  return (ast.comments ?? []).map((comment) => {
    if (!comment.range) {
      throw new Error(`missing comment range in ${filePath}`);
    }
    return source.slice(comment.range[0], comment.range[1]);
  });
}

function cssComments(source) {
  const lexemes = [];
  for (const token of tokenize({ css: source })) {
    if (token[0] === TokenType.Comment) {
      lexemes.push(source.slice(token[2], token[3] + 1));
    }
  }
  return lexemes;
}

function htmlComments(source) {
  const dom = new JSDOM(source);
  const lexemes = [];
  const walk = (node) => {
    if (node.nodeType === 8) {
      lexemes.push(`<!--${node.data}-->`);
      return;
    }
    if (node.nodeType === 1 && node.tagName === "TEMPLATE" && node.content) {
      walk(node.content);
    }
    for (const child of node.childNodes ?? []) {
      walk(child);
    }
  };
  walk(dom.window.document);
  return lexemes;
}

function commentsFor(relPath, source, filePath) {
  if (relPath.endsWith(".css")) return cssComments(source);
  if (relPath === "index.html") return htmlComments(source);
  return jsComments(source, filePath);
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function repoRoot() {
  return git(["rev-parse", "--show-toplevel"], process.cwd()).trim();
}

function collectInventory(root) {
  const inventory = new Map();
  const listed = git(["ls-files", "-z"], root).split("\0");
  for (const relPath of listed) {
    if (relPath.length === 0 || !inScope(relPath)) continue;
    const absPath = join(root, relPath);
    const stat = lstatSync(absPath);
    if (stat.isSymbolicLink() || !stat.isFile()) continue;
    const source = readFileSync(absPath, "utf8");
    let lexemes;
    try {
      lexemes = commentsFor(relPath, source, resolve(root, relPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `cannot parse ${relPath}: ${message.split("\n")[0]}`,
      );
    }
    if (lexemes.length === 0) continue;
    const hashes = new Map();
    for (const lexeme of lexemes) {
      const hash = sha256(lexeme);
      hashes.set(hash, (hashes.get(hash) ?? 0) + 1);
    }
    inventory.set(relPath, hashes);
  }
  return inventory;
}

function serializeBaseline(inventory) {
  const comments = {};
  for (const path of [...inventory.keys()].sort(compareCodePoints)) {
    const hashes = {};
    const counts = inventory.get(path);
    for (const hash of [...counts.keys()].sort(compareCodePoints)) {
      hashes[hash] = counts.get(hash);
    }
    comments[path] = hashes;
  }
  return `${JSON.stringify({ version: 1, comments }, null, 2)}\n`;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSortedKeys(record, label) {
  const keys = Object.keys(record);
  const sorted = [...keys].sort(compareCodePoints);
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== sorted[i]) {
      throw new Error(
        `${BASELINE_RELPATH}: ${label} keys are not in code-point order`,
      );
    }
  }
}

function validBaselinePath(path) {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.split("/").includes("..") &&
    !path.includes("\\")
  );
}

function parseBaseline(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${BASELINE_RELPATH}: invalid JSON`);
  }
  if (!isPlainObject(data)) {
    throw new Error(`${BASELINE_RELPATH}: not a JSON object`);
  }
  const topKeys = Object.keys(data).sort();
  if (topKeys.join(",") !== "comments,version") {
    throw new Error(`${BASELINE_RELPATH}: unexpected top-level keys`);
  }
  if (data.version !== 1) {
    throw new Error(`${BASELINE_RELPATH}: unsupported version`);
  }
  if (!isPlainObject(data.comments)) {
    throw new Error(`${BASELINE_RELPATH}: comments is not an object`);
  }
  assertSortedKeys(data.comments, "path");
  const inventory = new Map();
  for (const [path, hashes] of Object.entries(data.comments)) {
    if (!validBaselinePath(path)) {
      throw new Error(`${BASELINE_RELPATH}: invalid path ${JSON.stringify(path)}`);
    }
    if (!isPlainObject(hashes)) {
      throw new Error(`${BASELINE_RELPATH}: ${path} is not a hash map`);
    }
    assertSortedKeys(hashes, `hashes for ${path}`);
    const counts = new Map();
    for (const [hash, count] of Object.entries(hashes)) {
      if (!HASH_PATTERN.test(hash)) {
        throw new Error(`${BASELINE_RELPATH}: invalid hash ${hash}`);
      }
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(
          `${BASELINE_RELPATH}: invalid count for ${hash} under ${path}`,
        );
      }
      counts.set(hash, count);
    }
    inventory.set(path, counts);
  }
  return inventory;
}

function baselineInventory(root) {
  const path = join(root, BASELINE_RELPATH);
  if (!existsSync(path)) return null;
  return parseBaseline(readFileSync(path, "utf8"));
}

function diffInventories(baseline, current) {
  const additions = [];
  const stale = [];
  const paths = new Set([...baseline.keys(), ...current.keys()]);
  for (const path of paths) {
    const baseHashes = baseline.get(path) ?? new Map();
    const curHashes = current.get(path) ?? new Map();
    const hashes = new Set([...baseHashes.keys(), ...curHashes.keys()]);
    for (const hash of hashes) {
      const was = baseHashes.get(hash) ?? 0;
      const now = curHashes.get(hash) ?? 0;
      if (now > was) additions.push({ path, hash, was, now });
      else if (now < was) stale.push({ path, hash, was, now });
    }
  }
  return { additions, stale };
}

function shortHash(hash) {
  return hash.slice(0, 12);
}

function reportDiff(additions, stale) {
  const lines = [
    "comment ratchet: additions and stale entries vs baseline",
  ];
  for (const entry of additions) {
    lines.push(
      `  added ${entry.path} ${shortHash(entry.hash)} (${entry.was} -> ${entry.now})`,
    );
  }
  for (const entry of stale) {
    lines.push(
      `  stale ${entry.path} ${shortHash(entry.hash)} (${entry.was} -> ${entry.now})`,
    );
  }
  lines.push(
    "New or changed comments are not allowed. If this change only deletes comments, run: node scripts/check-comments.mjs --prune",
  );
  return lines.join("\n");
}

function checkCommand(root) {
  const baseline = baselineInventory(root);
  if (baseline === null) {
    console.error(
      `comment ratchet: ${BASELINE_RELPATH} is missing; create it with: node scripts/check-comments.mjs --init`,
    );
    return 1;
  }
  const current = collectInventory(root);
  const { additions, stale } = diffInventories(baseline, current);
  if (additions.length === 0 && stale.length === 0) {
    console.log("comment ratchet: baseline matches");
    return 0;
  }
  console.error(reportDiff(additions, stale));
  return 1;
}

function initCommand(root) {
  const baselinePath = join(root, BASELINE_RELPATH);
  if (existsSync(baselinePath)) {
    console.error(
      `comment ratchet: ${BASELINE_RELPATH} already exists; --init refuses to overwrite`,
    );
    return 1;
  }
  const current = collectInventory(root);
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, serializeBaseline(current));
  return 0;
}

function pruneCommand(root) {
  const baselinePath = join(root, BASELINE_RELPATH);
  const baseline = baselineInventory(root);
  if (baseline === null) {
    console.error(
      `comment ratchet: ${BASELINE_RELPATH} is missing; nothing to prune`,
    );
    return 1;
  }
  const current = collectInventory(root);
  const { additions } = diffInventories(baseline, current);
  if (additions.length > 0) {
    const lines = [
      "comment ratchet: refusing --prune; comment counts grew:",
    ];
    for (const entry of additions) {
      lines.push(
        `  added ${entry.path} ${shortHash(entry.hash)} (${entry.was} -> ${entry.now})`,
      );
    }
    lines.push(
      "Remove added or changed comments first; --prune only accepts deletions.",
    );
    console.error(lines.join("\n"));
    return 1;
  }
  writeFileSync(baselinePath, serializeBaseline(current));
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  const mode =
    args.length === 0
      ? "check"
      : args.length === 1 && (args[0] === "--init" || args[0] === "--prune")
        ? args[0]
        : null;
  if (mode === null) {
    console.error("usage: node scripts/check-comments.mjs [--init|--prune]");
    return 2;
  }
  const root = repoRoot();
  if (mode === "--init") return initCommand(root);
  if (mode === "--prune") return pruneCommand(root);
  return checkCommand(root);
}

try {
  process.exitCode = main(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`check-comments: ${message}`);
  process.exitCode = 1;
}
