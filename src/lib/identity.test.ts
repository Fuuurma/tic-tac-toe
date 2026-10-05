import { describe, expect, it, beforeEach } from "vitest";
import {
  filterDisplayNameInput,
  generateGuestDisplayName,
  getOrCreateGuestIdentity,
  IDENTITY_STORAGE_KEYS,
  sanitizeDisplayName,
  saveDisplayName,
} from "@/lib/identity";

class MockStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(): string | null {
    return null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("sanitizeDisplayName", () => {
  it("returns a fallback for short or empty input", () => {
    // Fallback is a generated "Adjective Noun" name
    expect(sanitizeDisplayName("")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(sanitizeDisplayName("a")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("strips control characters and limits length", () => {
    expect(sanitizeDisplayName("Al\u0000ice<>")).toBe("Alice");
    expect(sanitizeDisplayName("x".repeat(50))).toHaveLength(20);
  });

  it("trims and collapses internal whitespace to single spaces", () => {
    expect(sanitizeDisplayName("  Alice   Bob  ")).toBe("Alice Bob");
  });

  // F121: U+200B/U+200C/U+200D are codepoints 8203-8205, so they clear a
  // `> 31` filter, are not `<`/`>`, and are not \s — the whitespace collapse
  // does not catch them either. A name made only of them read as empty while
  // occupying bytes, and the length check counted them as real characters.
  it("strips zero-width characters that are invisible but counted as length", () => {
    expect(sanitizeDisplayName("Al\u200Bice")).toBe("Alice");
    expect(sanitizeDisplayName("\u200C\u200D")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    // A name that is only wide padding must not look like real content.
    expect(sanitizeDisplayName(" \u200B \u200B ")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("strips the wider invisible-format family, not just the zero-width trio", () => {
    // U+FEFF BOM and U+2060 word-joiner have the same failure mode.
    expect(sanitizeDisplayName("Al\uFEFFice")).toBe("Alice");
    expect(sanitizeDisplayName("Jo\u2060hn")).toBe("John");
    // Soft hyphen is invisible too.
    expect(sanitizeDisplayName("Ma\u00ADrio")).toBe("Mario");
  });
});

describe("filterDisplayNameInput", () => {
  it("keeps empty and below-min input raw — clearing the field must not snap to a guest fallback", () => {
    expect(filterDisplayNameInput("")).toBe("");
    expect(filterDisplayNameInput("A")).toBe("A");
  });

  it("keeps internal and trailing spaces so multi-word names are typeable", () => {
    expect(filterDisplayNameInput("John ")).toBe("John ");
    expect(filterDisplayNameInput("John  Doe")).toBe("John  Doe");
  });

  it("still strips control characters and angle brackets, and caps length", () => {
    expect(filterDisplayNameInput("Al\u0000ice<>")).toBe("Alice");
    expect(filterDisplayNameInput("x".repeat(50))).toHaveLength(20);
  });

  // F121: the per-keystroke filter has the same blind spot as the sanitizer,
  // and it is the one the user actually types into. Leaving it out means a
  // pasted name carries the invisibles into the field and then into storage.
  it("strips invisible characters as they are typed", () => {
    expect(filterDisplayNameInput("Al\u200Bice")).toBe("Alice");
    expect(filterDisplayNameInput("Jo\u2060hn\uFEFF")).toBe("John");
    // Stripping must not eat the spaces that make a name typeable.
    expect(filterDisplayNameInput("Jo\u200Bhn Doe")).toBe("John Doe");
  });

  // A field that is only invisible characters must read as empty, not as a
  // 20-character name the user cannot see.
  it("reduces an all-invisible field to empty rather than counting it as length", () => {
    expect(filterDisplayNameInput("\u200B\u200C\u200D\uFEFF\u2060")).toBe("");
  });

  // INVISIBLE_CHARS is written out by hand because ES2022 has no regex set
  // subtraction, which means it can silently drift from the Unicode property it
  // was derived from. This pins that derivation.
  //
  // It earns its place twice over: it fails if someone edits the set and drops
  // coverage, and it fails when the toolchain's Unicode data gains a new
  // default-ignorable character — which is precisely the moment the set should
  // be re-derived rather than left to rot.
  it("covers every default-ignorable character that is not a legitimate modifier", () => {
    const DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;

    // These change how a PRECEDING base character renders instead of adding
    // invisible content of their own, so stripping them corrupts real names.
    const isVariationSelector = (cp: number) =>
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0xe0100 && cp <= 0xe01ef) ||
      (cp >= 0x180b && cp <= 0x180d) ||
      (cp >= 0x1bca0 && cp <= 0x1bca3) ||
      (cp >= 0x1d173 && cp <= 0x1d17a);
    const isTag = (cp: number) => cp >= 0xe0000 && cp <= 0xe0fff;
    // Khmer inherent vowels render as real vowels.
    const isKhmerInherentVowel = (cp: number) => cp === 0x17b4 || cp === 0x17b5;

    const missed: string[] = [];
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue; // lone surrogates
      if (isVariationSelector(cp) || isTag(cp) || isKhmerInherentVowel(cp)) continue;
      const character = String.fromCodePoint(cp);
      if (!DEFAULT_IGNORABLE.test(character)) continue;
      if (filterDisplayNameInput(character) !== "") {
        missed.push(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
      }
    }
    expect(missed).toEqual([]);
  });

  // The mirror image: the three excluded families must SURVIVE. Without this
  // the derivation test above would still pass if the set were widened to
  // "strip all default-ignorables", silently breaking emoji and Khmer names.
  it("preserves the legitimate modifiers it deliberately excludes", () => {
    const VS16 = "\uFE0F";
    const variationSelectorAstral = "\u{E0100}";
    expect(filterDisplayNameInput(`\u2764${VS16}`)).toBe(`\u2764${VS16}`);
    expect(filterDisplayNameInput(`\u2764${variationSelectorAstral}`)).toBe(
      `\u2764${variationSelectorAstral}`,
    );
    expect(filterDisplayNameInput("\u17B4")).toBe("\u17B4");
    expect(filterDisplayNameInput("\u180B")).toBe("\u180B");
  });
});

describe("generateGuestDisplayName", () => {
  it("returns an Adjective Noun style name", () => {
    const name = generateGuestDisplayName();
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(name.length).toBeLessThanOrEqual(20);
  });

  it("produces variety across many calls", () => {
    const names = new Set<string>();
    for (let i = 0; i < 50; i++) {
      names.add(generateGuestDisplayName());
    }
    // With 30x30 = 900 combinations, 50 calls should produce at least 30 unique names
    expect(names.size).toBeGreaterThan(30);
  });
});

describe("getOrCreateGuestIdentity", () => {
  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
  });

  it("creates a guest id and stores it on first call", () => {
    const identity = getOrCreateGuestIdentity(storage);
    expect(identity.guestId).toMatch(/^guest:/);
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.guestId)).toBe(identity.guestId);
  });

  it("reuses an existing guest id", () => {
    const first = getOrCreateGuestIdentity(storage);
    const second = getOrCreateGuestIdentity(storage);
    expect(second.guestId).toBe(first.guestId);
  });
});

describe("saveDisplayName", () => {
  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
  });

  it("persists the sanitized display name and preserves the guest id", () => {
    const identity = getOrCreateGuestIdentity(storage);
    const updated = saveDisplayName("Alice", storage);
    expect(updated.displayName).toBe("Alice");
    expect(updated.guestId).toBe(identity.guestId);
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.displayName)).toBe("Alice");
  });
});
