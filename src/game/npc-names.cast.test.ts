import { afterEach, describe, expect, it } from "vitest";
import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "./constants";
import { setLocale } from "@/i18n/language";
import type { Locale } from "@/lib/preferences";
import { sanitizeDisplayName } from "@/lib/identity";
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
 * characters per difficulty tier per locale — proper nouns, not generated
 * gags. This suite pins the authored roster itself; npc-names.test.ts keeps
 * the draw-pile mechanics.
 */

const LOCALES = ["en", "es"] as const;
const DIFFICULTIES = Object.values(AI_Difficulty);

const tierNames = (locale: Locale, difficulty: AI_DifficultyType): readonly string[] =>
  NPC_NAME_TIERS[locale][difficulty];

const castNames = (): string[] =>
  LOCALES.flatMap((locale) =>
    DIFFICULTIES.flatMap((difficulty) => [...tierNames(locale, difficulty)]),
  );

/** The §2 tables, verbatim — the roster is authored, so the test restates it. */
const AUTHORED_CAST: Record<Locale, Record<AI_DifficultyType, readonly string[]>> = {
  en: {
    [AI_Difficulty.EASY]: [
      "Pip", "Momo", "Biscuit", "Tilda", "Gus", "Pogo", "Waffles", "Juno", "Bramble", "Noodle",
    ],
    [AI_Difficulty.NORMAL]: [
      "Ada", "Bex", "Cleo", "Dex", "Marlo", "Hank", "Iris", "Joss", "Kit", "Silas",
    ],
    [AI_Difficulty.HARD]: [
      "Sable", "Cipher", "Vesper", "Mason", "Onyx", "Vector", "Null", "Axiom", "Warden", "Rook",
    ],
  },
  es: {
    [AI_Difficulty.EASY]: [
      "Nico", "Lolo", "Galleta", "Nube", "Toby", "Chispa", "Chocolate", "Sol", "Erizo", "Pulpo",
    ],
    [AI_Difficulty.NORMAL]: [
      "Dama", "Torre", "Zorro", "Lince", "Bruno", "Vera", "Iker", "Pícaro", "Sofía", "Nora",
    ],
    [AI_Difficulty.HARD]: [
      "Jaque", "Niebla", "Centinela", "Vértice", "Eje", "Vacío", "Teorema", "Cenit", "Oráculo", "Rey",
    ],
  },
};

describe("the authored cast", () => {
  it("fields the §2 roster verbatim, ten names per tier per locale", () => {
    expect(Object.keys(NPC_NAME_TIERS).sort()).toEqual(["en", "es"]);
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        expect(
          tierNames(locale, difficulty),
          `${locale}/${difficulty} drifted from the authored cast`,
        ).toEqual(AUTHORED_CAST[locale][difficulty]);
      }
    }
  });

  it("keeps every name between 2 and 14 characters", () => {
    for (const name of castNames()) {
      expect(name.length, `"${name}" is under 2 characters`).toBeGreaterThanOrEqual(2);
      expect(
        name.length,
        `"${name}" is ${name.length} characters; the cap is ${NPC_NAME_MAX_LENGTH}`,
      ).toBeLessThanOrEqual(NPC_NAME_MAX_LENGTH);
    }
  });

  it("survives the display-name sanitizer unchanged", () => {
    for (const name of castNames()) {
      expect(sanitizeDisplayName(name)).toBe(name);
    }
  });

  it("clears every banned fragment, the Spanish set included", () => {
    // §4: the fragment list grew before the ES cast landed. "Zorro" is the
    // known near-miss — "zorra" must not match it.
    const spanishFragments = [
      "puto", "zorra", "joder", "hostia", "coño", "verga",
      "mierda", "gilipollas", "cabrón", "maricón", "subnormal", "retrasado",
    ];
    for (const fragment of spanishFragments) {
      expect(BANNED_NAME_FRAGMENTS).toContain(fragment);
    }
    for (const name of castNames()) {
      const lowered = name.toLowerCase();
      for (const fragment of BANNED_NAME_FRAGMENTS) {
        expect(
          lowered.includes(fragment),
          `"${name}" contains banned fragment "${fragment}"`,
        ).toBe(false);
      }
    }
  });

  it("keeps the three tiers within a locale disjoint", () => {
    // Cross-locale overlap is permitted by design; within a locale a name
    // belongs to exactly one tier so a draw never straddles personalities.
    for (const locale of LOCALES) {
      const flat = DIFFICULTIES.flatMap((difficulty) => [...tierNames(locale, difficulty)]);
      expect(new Set(flat).size, `${locale} roster has duplicates`).toBe(flat.length);
    }
  });

  it("exports NPC_NAMES as the union of both locales' casts", () => {
    expect(NPC_NAMES).toHaveLength(60);
    for (const name of castNames()) {
      expect(NPC_NAMES).toContain(name);
    }
  });
});

describe("locale-aware draws", () => {
  afterEach(() => {
    setLocale("en");
  });

  it("draws from the tier of the locale passed explicitly", () => {
    const session = createNpcNameSession(() => 0.5);
    for (const locale of LOCALES) {
      for (const difficulty of DIFFICULTIES) {
        const name = session.pick(difficulty, locale);
        expect(tierNames(locale, difficulty)).toContain(name);
        expect(isNpcName(name)).toBe(true);
      }
    }
  });

  it("lets an explicit locale override the live one", () => {
    setLocale("en");
    const session = createNpcNameSession(() => 0);
    expect(tierNames("es", AI_Difficulty.EASY)).toContain(
      session.pick(AI_Difficulty.EASY, "es"),
    );
  });

  it("defaults to the live locale when none is passed", () => {
    // The pinned contract: callers that never learned about locales
    // (useLocalGame, lobbyForm, queuePlay) still draw the player's language.
    setLocale("es");
    const session = createNpcNameSession(() => 0);
    expect(tierNames("es", AI_Difficulty.NORMAL)).toContain(session.pick(AI_Difficulty.NORMAL));

    setLocale("en");
    expect(tierNames("en", AI_Difficulty.NORMAL)).toContain(session.pick(AI_Difficulty.NORMAL));
  });

  it("recognises personas from both locales", () => {
    expect(isNpcName("Pip")).toBe(true);
    expect(isNpcName("Rook")).toBe(true);
    expect(isNpcName("Nico")).toBe(true);
    expect(isNpcName("Jaque")).toBe(true);
  });
});
