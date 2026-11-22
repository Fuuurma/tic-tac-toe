import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenize, TokenType } from "@csstools/css-tokenizer";
import ts from "typescript";

export const SOURCE_DIRS = ["src", "scripts", "e2e", "public"];
export const SOURCE_FILES = [
  "eslint.config.js",
  "playwright.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.setup.ts",
];

const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
]);
const SKIPPED_DIRS = new Set(["node_modules", "dist"]);
const COMMENT_KINDS = new Set([
  ts.SyntaxKind.SingleLineCommentTrivia,
  ts.SyntaxKind.MultiLineCommentTrivia,
]);

export function collectComments(filePath, source) {
  const extension = path.extname(filePath).toLowerCase();
  if (!SCANNABLE_EXTENSIONS.has(extension)) return [];
  if (extension === ".css") return collectCssComments(source);
  const jsx = extension === ".tsx" || extension === ".jsx";
  const variant = jsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, variant, source);
  const blocks = [];
  // Raw scanning loses template context at each `${`: without the parser's
  // re-scan, backticks mis-pair and template text swallows later comments.
  // Brace depth per open interpolation tells which `}` closes one.
  const interpolations = [];
  while (true) {
    let token = scanner.scan();
    if (token === ts.SyntaxKind.EndOfFileToken) break;
    if (interpolations.length > 0) {
      const depth = interpolations[interpolations.length - 1];
      if (token === ts.SyntaxKind.OpenBraceToken) {
        interpolations[interpolations.length - 1] = depth + 1;
        continue;
      }
      if (token === ts.SyntaxKind.CloseBraceToken) {
        if (depth > 0) {
          interpolations[interpolations.length - 1] = depth - 1;
          continue;
        }
        token = scanner.reScanTemplateToken(false);
        if (token === ts.SyntaxKind.TemplateTail) interpolations.pop();
        continue;
      }
    }
    if (token === ts.SyntaxKind.TemplateHead || token === ts.SyntaxKind.TemplateMiddle) {
      interpolations.push(0);
      continue;
    }
    if (!COMMENT_KINDS.has(token)) continue;
    const start = scanner.getTokenStart();
    const end = scanner.getTokenEnd();
    blocks.push({ text: source.slice(start, end), start, end });
  }
  return blocks;
}

// Token end offsets are inclusive, so the half-open interval is token[3] + 1.
// The tokenizer never throws on malformed CSS; it emits error tokens instead.
function collectCssComments(source) {
  const blocks = [];
  for (const token of tokenize({ css: source })) {
    if (token[0] !== TokenType.Comment) continue;
    blocks.push({ text: source.slice(token[2], token[3] + 1), start: token[2], end: token[3] + 1 });
  }
  return blocks;
}

// 16 hex chars (64 bits) stays collision-safe at this corpus size and keeps
// comment-baseline.json small enough for review-pack token budgets.
export function fingerprint(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function countsOf(blocks) {
  const counts = {};
  for (const block of blocks) {
    const hash = fingerprint(block.text);
    counts[hash] = (counts[hash] ?? 0) + 1;
  }
  return counts;
}

export function inventoryAt(root, dirs) {
  const inventory = {};
  for (const dir of dirs) {
    walk(path.join(root, dir), root, inventory);
  }
  return inventory;
}

export function inventoryFiles(root, files) {
  const inventory = {};
  for (const relative of files) {
    const full = path.join(root, relative);
    if (!existsSync(full)) continue;
    inventoryEntry(full, root, inventory);
  }
  return inventory;
}

function inventoryEntry(full, root, inventory) {
  const relative = path.relative(root, full).split(path.sep).join("/");
  const counts = countsOf(collectComments(full, readFileSync(full, "utf8")));
  if (Object.keys(counts).length === 0) return;
  inventory[relative] = counts;
}

function walk(dir, root, inventory) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIPPED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, root, inventory);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SCANNABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    inventoryEntry(full, root, inventory);
  }
}

export function compareBaseline(baseline, actual) {
  let before = 0;
  for (const counts of Object.values(baseline)) {
    for (const count of Object.values(counts)) before += count;
  }
  let now = 0;
  const added = [];
  for (const [relative, counts] of Object.entries(actual)) {
    const expectedCounts = baseline[relative] ?? {};
    for (const [hash, count] of Object.entries(counts)) {
      now += count;
      const expected = expectedCounts[hash] ?? 0;
      if (count > expected) {
        added.push({ path: relative, hash, extra: count - expected });
      }
    }
  }
  return { before, now, added };
}

export function serializeBaseline(actual) {
  const sorted = {};
  for (const relative of Object.keys(actual).sort()) {
    const hashes = {};
    for (const hash of Object.keys(actual[relative]).sort()) {
      hashes[hash] = actual[relative][hash];
    }
    sorted[relative] = hashes;
  }
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

function runCli() {
  const update = process.argv.includes("--update-baseline");
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const baselinePath = path.join(root, "scripts", "comment-baseline.json");
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    console.error("FAIL: scripts/comment-baseline.json is missing or unreadable");
    return 1;
  }
  const actual = {
    ...inventoryAt(root, SOURCE_DIRS),
    ...inventoryFiles(root, SOURCE_FILES),
  };
  const { before, now, added } = compareBaseline(baseline, actual);
  if (update) {
    writeFileSync(baselinePath, serializeBaseline(actual));
    console.log(`Updated comment baseline: ${before} -> ${now}`);
    return 0;
  }
  for (const entry of added) {
    console.log(`${entry.path}: ${entry.extra} new or changed comment(s) (${entry.hash.slice(0, 12)})`);
  }
  if (added.length > 0) {
    console.error(`FAIL: ${added.length} added comment count(s) since baseline`);
    return 1;
  }
  console.log(`OK: ${now} existing comments; ${before - now} removed since baseline`);
  return 0;
}

// Compare real paths: on macOS, /tmp symlinks make resolve(argv[1]) and
// fileURLToPath(import.meta.url) disagree even for the same entry script.
if (
  process.argv[1] &&
  realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
) {
  process.exitCode = runCli();
}
