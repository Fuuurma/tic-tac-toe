import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n/language";
import { sanitizeDisplayName } from "@/lib/identity";
import type { Locale } from "@/lib/preferences";
import { AI_Difficulty } from "./constants";
import {
  BANNED_NAME_FRAGMENTS,
  NPC_NAME_MAX_LENGTH,
  NPC_NAME_TIERS,
  NPC_NAMES,
  createNpcNameSession,
  isNpcName,
} from "./npc-names";

/**
 * The Cast — docs/ttt-ai-names-design-20261117.md §2. Ten authored
 * characters per difficulty tier per locale; the names below are pinned
 * verbatim so a roster edit is a deliberate act, not drift. Role/quirk/
 * threat annotations live in the doc, not in shipped strings.
 */
const CAST: Record<Locale, Record<AI_Difficulty, readonly string[]>> = {
  en: {
    [AI_Difficulty.EASY]: [
      "Pip",
      "Momo",
      "Biscuit",
      "Tilda",
      "Gus",
      "Pogo",
      "Waffles",
      "Juno",
      "Bramble",
      "Noodle",
    ],
    [AI_Difficulty.NORMAL]: [
      "Ada",
      "Bex",
      "Cleo",
      "Dex",
      "Marlo",
      "Hank",
      "Iris",
      "Joss",
      "Kit",
      "Silas",
    ],
    [AI_Difficulty.HARD]: [
      "Sable",
      "Cipher",
      "Vesper",
      "Mason",
      "Onyx",
      "Vector",
      "Null",
      "Axiom",
      "Warden",
      "Rook",
    ],
  },
  es: {
    [AI_Difficulty.EASY]: [
      "Nico",
      "Lolo",
      "Galleta",
      "Nube",
      "Toby",
      "Chispa",
      "Chocolate",
      "Sol",
      "Erizo",
      "Pulpo",
    ],
    [AI_Difficulty.NORMAL]: [
      "Dama",
      "Torre",
      "Zorro",
      "Lince",
      "Bruno",
      "Vera",
      "Iker",
      "Pícaro",
      "Sofía",
      "Nora",
    ],
    [AI_Difficulty.HARD]: [
      "Jaque",
      "Niebla",
      "Centinela",
      "Vértice",
      "Eje",
      "Vacío",
      "Teorema",
      "Cenit",
      "Oráculo",
      "Rey",
    ],
  },
};

const LOCALES = ["en", "es"] as const satisfies readonly Locale[];
const DIFFICULTIES = Object.values(AI_Difficulty);
const ALL_CAST: readonly string[] = LOCALES.flatMap((locale) =>
  DIFFICULTIES.flatMap((difficulty) => CAST[locale][difficulty]),
);

afterEach(() => {
  setLocale("en");
});

describe("the authored cast", () => {
  it("matches the design doc verbatim, locale by locale and tier by tier", () => {
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toEqual(CAST[locale][difficulty]);
      }
    }
  });

  it("fields 10 names per tier per locale — 60 total", () => {
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toHaveLength(10);
      }
    }
    expect(ALL_CAST).toHaveLength(60);
  });

  it("keeps every name between 2 and 14 characters", () => {
    for (const name of ALL_CAST) {
      expect(
        name.length,
        `"${name}" is ${name.length} characters; the cap is ${NPC_NAME_MAX_LENGTH}`,
      ).toBeLessThanOrEqual(NPC_NAME_MAX_LENGTH);
      expect(name.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("survives the display-name sanitizer unchanged", () => {
    // The opponent-name field and the persisted preference both run
    // sanitizeDisplayName; a roster name the sanitizer would alter would
    // come back different from what the game shows.
    for (const name of ALL_CAST) {
      expect(sanitizeDisplayName(name)).toBe(name);
    }
  });

  it("clears every banned fragment, English and Spanish", () => {
    for (const name of ALL_CAST) {
      const lowered = name.toLowerCase();
      for (const fragment of BANNED_NAME_FRAGMENTS) {
        expect(
          lowered.includes(fragment),
          `"${name}" contains banned fragment "${fragment}"`,
        ).toBe(false);
      }
    }
  });

  it("keeps tiers disjoint within each locale", () => {
    // Cross-locale overlap is explicitly allowed — a name may exist in both
    // casts — but inside one locale the three tiers must not share a name,
    // or a difficulty badge could meet the same persona twice.
    for (const locale of LOCALES) {
      const names = DIFFICULTIES.flatMap((difficulty) => NPC_NAME_TIERS[locale][difficulty]);
      expect(new Set(names).size, `${locale} roster has duplicate names`).toBe(names.length);
    }
  });

  it("unions both locales into NPC_NAMES", () => {
    expect(NPC_NAMES).toHaveLength(60);
    const roster = new Set<string>(NPC_NAMES);
    for (const name of ALL_CAST) {
      expect(roster.has(name), `NPC_NAMES is missing "${name}"`).toBe(true);
    }
  });
});

describe("pick with a locale", () => {
  it("draws from the requested tier in either argument order", () => {
    // A fresh session with a zero rng deals index 0 of the tier, so the
    // expected name is the tier's first entry — deterministic on both
    // pick(locale, difficulty) and pick(difficulty, locale).
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        const expected = CAST[locale][difficulty][0];
        expect(createNpcNameSession(() => 0).pick(difficulty, locale)).toBe(expected);
        expect(createNpcNameSession(() => 0).pick(locale, difficulty)).toBe(expected);
      }
    }
  });

  it("stays inside the locale's tier across a full draw", () => {
    const session = createNpcNameSession();
    const tier = NPC_NAME_TIERS.es[AI_Difficulty.HARD];
    let last: string | null = null;
    for (let i = 0; i < 10; i += 1) {
      const name = session.pick("es", AI_Difficulty.HARD);
      expect(tier).toContain(name);
      expect(name).not.toBe(last);
      last = name;
    }
  });

  it("reads the live locale when none is passed", () => {
    const session = createNpcNameSession(() => 0);
    expect(getLocale()).toBe("en");
    setLocale("es");
    expect(session.pick(AI_Difficulty.EASY)).toBe(CAST.es[AI_Difficulty.EASY][0]);
    setLocale("en");
    expect(session.pick(AI_Difficulty.EASY)).toBe(CAST.en[AI_Difficulty.EASY][0]);
  });
});

describe("isNpcName across locales", () => {
  it("recognizes draws from both locales", () => {
    for (const locale of LOCALES) {
      const session = createNpcNameSession(() => 0);
      for (const difficulty of DIFFICULTIES) {
        expect(isNpcName(session.pick(difficulty, locale))).toBe(true);
      }
    }
  });

  it("still rejects non-roster names", () => {
    expect(isNpcName("AI")).toBe(false);
    expect(isNpcName("Zorro2")).toBe(false);
    expect(isNpcName(" Pip")).toBe(false);
  });
});
