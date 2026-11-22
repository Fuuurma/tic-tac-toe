import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  collectComments,
  compareBaseline,
  countsOf,
  fingerprint,
  inventoryAt,
  serializeBaseline,
  SOURCE_DIRS,
  type Baseline,
} from "../../scripts/check-comments.mjs";

/**
 * The ratchet counts complete comment lexemes, not comment-like text: every
 * fixture below is a string literal in this file, so the ratchet itself will
 * never count these fixtures as comments, while `collectComments` still sees
 * them as source text.
 */

/** Asserts slice-exact lexemes and start-ordered blocks, returns the blocks. */
function assertLexemes(source: string, file: string) {
  const blocks = collectComments(file, source);
  for (const block of blocks) {
    expect(block.text).toBe(source.slice(block.start, block.end));
  }
  for (let i = 1; i < blocks.length; i += 1) {
    expect(blocks[i].start).toBeGreaterThan(blocks[i - 1].start);
  }
  return blocks;
}

const HEADER = "// header";
// Pinned literal — the ratchet hash algorithm is load-bearing for the baseline.
const HEADER_SHA256 =
  "8f9ed983ca9de7721e9069b2f608429476f114970748574960c369e0aded43bc";

describe("collectComments", () => {
  it("collects a line comment header", () => {
    const source = `${HEADER}\nconst x = 1;\n`;
    const blocks = assertLexemes(source, "a.ts");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ text: HEADER, start: 0, end: HEADER.length });
  });

  it("collects a block inside a template-literal interpolation", () => {
    const source = "const s = `head ${/* pin */ value} tail`;\n";
    const blocks = assertLexemes(source, "a.ts");
    const start = source.indexOf("/* pin */");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("/* pin */");
    expect(blocks[0].start).toBe(start);
    expect(blocks[0].end).toBe(start + "/* pin */".length);
  });

  it("collects a block inside a JSX expression", () => {
    const source = "const el = <div>{/* pin */ ok}</div>;\n";
    const blocks = assertLexemes(source, "a.tsx");
    const start = source.indexOf("/* pin */");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ text: "/* pin */", start, end: start + 9 });
  });

  it("excludes comment-like text inside double and single strings", () => {
    const source = `const a = "// fake";\nconst b = '/* fake */';\n`;
    expect(assertLexemes(source, "a.ts")).toEqual([]);
  });

  it("collects a multiline block as one lexeme", () => {
    const source = [
      "const x = 1;",
      "/* first",
      "   second */",
      "const y = 2;",
    ].join("\n");
    const blocks = assertLexemes(source, "a.ts");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("/* first\n   second */");
    expect(blocks[0].start).toBe(source.indexOf("/* first"));
  });

  it("collects a trailing line comment at EOF", () => {
    const source = "const x = 1;\n// trailing";
    const blocks = assertLexemes(source, "a.ts");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("// trailing");
    expect(blocks[0].start).toBe(source.indexOf("// trailing"));
  });

  it("collects comments around interpolated template literals", () => {
    const source = [
      "const a = `x ${p} y`;",
      "// between",
      "const b = `z ${q} w`;",
      "// after",
    ].join("\n");
    const blocks = assertLexemes(source, "a.ts");
    expect(blocks.map((block) => block.text)).toEqual(["// between", "// after"]);
  });

  it("collects a CSS block comment with exact source intervals", () => {
    const source = "a { color: red; } /* hi */";
    const blocks = assertLexemes(source, "a.css");
    expect(blocks).toEqual([{ text: "/* hi */", start: 18, end: 26 }]);
  });

  it("excludes comment-like text inside CSS strings", () => {
    const source =
      "a { content: \"/* fake */\"; }\nb { content: '/* fake */'; }\n/* real */";
    const blocks = assertLexemes(source, "a.css");
    expect(blocks).toEqual([{ text: "/* real */", start: 58, end: 68 }]);
  });

  it("collects a multiline CSS comment as one lexeme", () => {
    const source = "/* first\n   second */\nx {}";
    const blocks = assertLexemes(source, "a.css");
    expect(blocks).toEqual([{ text: "/* first\n   second */", start: 0, end: 21 }]);
  });

  it("collects an unterminated trailing CSS comment through EOF", () => {
    const source = "a { color: red; } /* dangling";
    const blocks = assertLexemes(source, "a.css");
    expect(blocks).toEqual([{ text: "/* dangling", start: 18, end: 29 }]);
  });
});

describe("fingerprint", () => {
  it("pins the sha256 of the header lexeme", () => {
    expect(fingerprint(HEADER)).toBe(HEADER_SHA256);
  });
});

describe("countsOf", () => {
  it("counts duplicate identical lexemes under one hash", () => {
    const blocks = collectComments(
      "a.ts",
      "// dup\n// dup\n// other\n",
    );
    expect(countsOf(blocks)).toEqual({
      [fingerprint("// dup")]: 2,
      [fingerprint("// other")]: 1,
    });
  });
});

describe("compareBaseline", () => {
  it("reports no additions when the inventory matches the baseline", () => {
    const hash = fingerprint("// one");
    const inventory = { "a.ts": { [hash]: 1 } };
    const result = compareBaseline(inventory, inventory);
    expect(result.added).toEqual([]);
    expect(result.before).toBe(1);
    expect(result.now).toBe(1);
  });

  it("flags a second identical lexeme with extra 1", () => {
    const hash = fingerprint("// one");
    const baseline = { "a.ts": { [hash]: 1 } };
    const actual = { "a.ts": { [hash]: 2 } };
    const result = compareBaseline(baseline, actual);
    expect(result.added).toEqual([{ path: "a.ts", hash, extra: 1 }]);
    expect(result.now).toBe(2);
  });

  it("passes deletions: removed lexemes never appear in added", () => {
    const hash = fingerprint("// gone");
    const baseline = { "a.ts": { [hash]: 1 } };
    const result = compareBaseline(baseline, {});
    expect(result.added).toEqual([]);
    expect(result.before).toBe(1);
    expect(result.now).toBe(0);
  });
});

describe("inventoryAt", () => {
  it("inventories a tmp tree: duplicates counted, zero-comment and skipped entries excluded", () => {
    const root = mkdtempSync(path.join(tmpdir(), "comment-ratchet-"));
    const src = path.join(root, "src");
    mkdirSync(src);
    mkdirSync(path.join(src, "dist"));
    mkdirSync(path.join(src, "node_modules", "dep"), { recursive: true });
    writeFileSync(path.join(src, "dup.ts"), "// dup\n// dup\n");
    writeFileSync(path.join(src, "once.js"), "// once\n");
    writeFileSync(path.join(src, "style.css"), "a {}\n/* css */\n");
    writeFileSync(path.join(src, "clean.tsx"), "const el = <div />;\n");
    writeFileSync(path.join(src, ".hidden.ts"), "// hidden\n");
    writeFileSync(path.join(src, "dist", "bundled.ts"), "// bundled\n");
    writeFileSync(path.join(src, "node_modules", "dep", "index.js"), "// dep\n");

    const inventory = inventoryAt(root, ["src"]);

    expect(Object.keys(inventory).sort()).toEqual(["src/dup.ts", "src/once.js", "src/style.css"]);
    expect(inventory["src/dup.ts"]).toEqual({ [fingerprint("// dup")]: 2 });
    expect(inventory["src/once.js"]).toEqual({ [fingerprint("// once")]: 1 });
    expect(inventory["src/style.css"]).toEqual({ [fingerprint("/* css */")]: 1 });
  });
});

describe("serializeBaseline", () => {
  it("serializes deterministically: sorted paths and hashes, trailing newline", () => {
    const inventory = {
      "b.js": { [fingerprint("// b")]: 1 },
      "a.ts": { ccc: 2, aaa: 1 },
    };
    const first = serializeBaseline(inventory);
    const second = serializeBaseline(inventory);
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(first) as unknown as Record<string, Record<string, number>>;
    expect(Object.keys(parsed)).toEqual(["a.ts", "b.js"]);
    expect(Object.keys(parsed["a.ts"])).toEqual(["aaa", "ccc"]);
    expect(first).toBe(`${JSON.stringify(parsed, null, 2)}\n`);
  });
});

describe("baseline freeze", () => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const baseline = JSON.parse(
    readFileSync(path.join(repoRoot, "scripts", "comment-baseline.json"), "utf8"),
  ) as Baseline;

  it("matches the live inventory under the frozen dirs", () => {
    const actual = inventoryAt(repoRoot, SOURCE_DIRS);
    expect(compareBaseline(baseline, actual).added).toEqual([]);
  });

  it("freezes only the core dirs: no src/components or src/index.css keys", () => {
    for (const key of Object.keys(baseline)) {
      expect(key.startsWith("src/components/")).toBe(false);
      expect(key).not.toBe("src/index.css");
    }
  });
});
