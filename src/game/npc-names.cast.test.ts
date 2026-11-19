import { afterEach, describe, expect, it } from "vitest";
import { AI_Difficulty } from "./constants";
import { sanitizeDisplayName } from "@/lib/identity";
import { setLocale } from "@/i18n/language";
import type { Locale } from "@/lib/preferences";
import {
  BANNED_NAME_FRAGMENTS,
  NPC_NAME_MAX_LENGTH,
  NPC_NAME_TIERS,
  NPC_NAMES,
  createNpcNameSession,
  isNpcName,
} from "./npc-names";

/**
 * The Cast (docs/ttt-ai-names-design-20261117.md §2): ten authored
 * characters per difficulty tier per locale — 60 names total. These pins
 * hold the authored roster itself: exact membership, per-locale counts,
 * hygiene against the display-name gate, and locale-correct draws.
 */

const LOCALES = ["en", "es"] as const satisfies readonly Locale[];
const DIFFICULTIES = Object.values(AI_Difficulty);

const CAST: Record<Locale, Record<(typeof DIFFICULTIES)[number], readonly string[]>> = {
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

const allCastNames = (): string[] =>
  LOCALES.flatMap((locale) =>
    DIFFICULTIES.flatMap((difficulty) => [...NPC_NAME_TIERS[locale][difficulty]]),
  );

afterEach(() => {
  // The session draws follow getLocale(); leave the ambient language as found.
  setLocale("en");
});

describe("the authored cast", () => {
  it("matches the design doc roster verbatim, per locale and tier", () => {
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(
          [...NPC_NAME_TIERS[locale][difficulty]],
          `${locale}/${difficulty} drifted from the authored cast`,
        ).toEqual([...CAST[locale][difficulty]]);
      }
    }
  });

  it("authors exactly 10 names per tier per locale — 60 total", () => {
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toHaveLength(10);
      }
    }
    expect(allCastNames()).toHaveLength(60);
  });

  it("keeps tiers disjoint within each locale", () => {
    for (const locale of LOCALES) {
      const tiers = DIFFICULTIES.map((difficulty) =>
        NPC_NAME_TIERS[locale][difficulty],
      );
      const flattened = tiers.flat();
      expect(
        new Set(flattened).size,
        `${locale} tiers share a name`,
      ).toBe(flattened.length);
    }
  });

  it("unions both locales into NPC_NAMES — 60 unique names", () => {
    const cast = allCastNames();
    expect(NPC_NAMES).toHaveLength(60);
    expect(new Set(NPC_NAMES).size).toBe(60);
    expect([...NPC_NAMES].sort()).toEqual([...cast].sort());
  });
});

describe("cast hygiene", () => {
  it("keeps every name between 2 and NPC_NAME_MAX_LENGTH characters", () => {
    for (const name of allCastNames()) {
      expect(name.length).toBeGreaterThanOrEqual(2);
      expect(
        name.length,
        `"${name}" is ${name.length} characters; the cap is ${NPC_NAME_MAX_LENGTH}`,
      ).toBeLessThanOrEqual(NPC_NAME_MAX_LENGTH);
    }
  });

  it("survives sanitizeDisplayName unchanged, accents included", () => {
    for (const name of allCastNames()) {
      expect(sanitizeDisplayName(name)).toBe(name);
    }
  });

  it("contains no banned fragment in either language, case-insensitively", () => {
    for (const name of allCastNames()) {
      const lowered = name.toLowerCase();
      for (const fragment of BANNED_NAME_FRAGMENTS) {
        expect(
          lowered.includes(fragment),
          `"${name}" contains banned fragment "${fragment}"`,
        ).toBe(false);
      }
    }
  });
});

describe("locale-aware draws", () => {
  it("pick(locale, difficulty) draws from that locale's tier", () => {
    const session = createNpcNameSession(() => 0.5);
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        const name = session.pick(locale, difficulty);
        expect(
          NPC_NAME_TIERS[locale][difficulty],
          `pick("${locale}", ${difficulty}) returned "${name}"`,
        ).toContain(name);
      }
    }
  });

  it("never draws the other locale's cast", () => {
    const enNames = new Set(
      DIFFICULTIES.flatMap((difficulty) => [...NPC_NAME_TIERS.en[difficulty]]),
    );
    const esNames = new Set(
      DIFFICULTIES.flatMap((difficulty) => [...NPC_NAME_TIERS.es[difficulty]]),
    );
    const session = createNpcNameSession();
    // Each locale's roster is exactly 30 names, so a full drain stays
    // inside that locale's cast — widening never crosses the locale line.
    for (let i = 0; i < 30; i += 1) {
      const name = session.pick("es", DIFFICULTIES[i % DIFFICULTIES.length]!);
      expect(esNames.has(name)).toBe(true);
    }
    for (let i = 0; i < 30; i += 1) {
      const name = session.pick("en", DIFFICULTIES[i % DIFFICULTIES.length]!);
      expect(enNames.has(name)).toBe(true);
    }
  });

  it("follows getLocale() when pick gets no explicit locale", () => {
    const session = createNpcNameSession(() => 0);
    setLocale("es");
    // rng 0 deals the first fresh name of the resolved tier.
    expect(session.pick(AI_Difficulty.EASY)).toBe("Nico");
    setLocale("en");
    expect(session.pick(AI_Difficulty.NORMAL)).toBe("Ada");
  });

  it("accepts an explicit undefined locale and still follows getLocale()", () => {
    const session = createNpcNameSession(() => 0);
    setLocale("es");
    expect(session.pick(undefined, AI_Difficulty.HARD)).toBe("Jaque");
  });

  it("isNpcName recognizes draws from both locales", () => {
    const session = createNpcNameSession();
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(isNpcName(session.pick(locale, difficulty))).toBe(true);
      }
    }
  });
});
