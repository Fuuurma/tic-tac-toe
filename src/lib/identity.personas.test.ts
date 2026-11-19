import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n/language";
import type { Locale } from "@/lib/preferences";
import {
  generateGuestDisplayName,
  GUEST_NAME_POOLS,
  sanitizeDisplayName,
} from "@/lib/identity";
import { BANNED_NAME_FRAGMENTS, NPC_NAMES } from "@/game/npc-names";

/**
 * The persona pools — docs/ttt-ai-names-design-20261117.md §3. One authored
 * handle per entry per locale, dealt whole: the 30x30 adjective+noun
 * pairing they replaced produced 900 combos of vibe descriptions, and the
 * ES pool's all-masculine-noun workaround was the tell. These pins hold
 * the authored lists to the contract the Cast already keeps: length,
 * uniqueness, sanitizer survival, banned-fragment hygiene, and disjointness
 * from the AI Cast — a player sharing the bot's name is a collision the UI
 * cannot explain.
 *
 * Disjointness is checked against NPC_NAMES, the live Cast. isNpcName also
 * recognizes the retired gag roster for one release (design doc §5), and
 * the spec'd EN pool deliberately contains "Axel", which that roster once
 * dealt — so the pin is the Cast, not the wider recognition set.
 */
const LOCALES = ["en", "es"] as const satisfies readonly Locale[];
const ALL_PERSONAS: readonly string[] = LOCALES.flatMap(
  (locale) => GUEST_NAME_POOLS[locale],
);
const CAST = new Set<string>(NPC_NAMES);

afterEach(() => {
  setLocale("en");
});

describe("guest persona pools", () => {
  it("fields 100 authored names per locale — 200 total", () => {
    for (const locale of LOCALES) {
      expect(GUEST_NAME_POOLS[locale]).toHaveLength(100);
    }
    expect(ALL_PERSONAS).toHaveLength(200);
  });

  it("keeps every name unique within its pool", () => {
    for (const locale of LOCALES) {
      const pool = GUEST_NAME_POOLS[locale];
      expect(new Set(pool).size, `${locale} pool has duplicate names`).toBe(pool.length);
    }
  });

  it("keeps the two pools disjoint", () => {
    // A handle must not read as both an English and a Spanish persona.
    const esPool = new Set<string>(GUEST_NAME_POOLS.es);
    for (const name of GUEST_NAME_POOLS.en) {
      expect(esPool.has(name), `"${name}" appears in both persona pools`).toBe(false);
    }
  });

  it("stays disjoint from the AI Cast in both locales", () => {
    for (const locale of LOCALES) {
      for (const name of GUEST_NAME_POOLS[locale]) {
        expect(
          CAST.has(name),
          `"${name}" (${locale} pool) collides with an AI Cast name`,
        ).toBe(false);
      }
    }
  });

  it("keeps every name between 2 and 20 characters", () => {
    for (const name of ALL_PERSONAS) {
      expect(name.length, `"${name}" is ${name.length} characters`).toBeGreaterThanOrEqual(2);
      expect(name.length, `"${name}" is ${name.length} characters`).toBeLessThanOrEqual(20);
    }
  });

  it("survives the display-name sanitizer unchanged", () => {
    // Stored names and the name field both run sanitizeDisplayName; a pool
    // entry the sanitizer would alter would come back different from the
    // handle the lobby showed.
    for (const name of ALL_PERSONAS) {
      expect(sanitizeDisplayName(name)).toBe(name);
    }
  });

  it("clears every banned fragment, English and Spanish", () => {
    for (const name of ALL_PERSONAS) {
      const lowered = name.toLowerCase();
      for (const fragment of BANNED_NAME_FRAGMENTS) {
        expect(
          lowered.includes(fragment),
          `"${name}" contains banned fragment "${fragment}"`,
        ).toBe(false);
      }
    }
  });

  it("deals only single-word pool members, per locale", () => {
    // More draws than the pool holds, so repeats are exercised: every deal
    // must land inside the requested locale's pool and carry no whitespace —
    // the adjective+noun shape is gone for good.
    for (const locale of LOCALES) {
      const pool = GUEST_NAME_POOLS[locale];
      for (let i = 0; i < 250; i += 1) {
        const name = generateGuestDisplayName(locale);
        expect(pool, `"${name}" is not a ${locale} pool member`).toContain(name);
        expect(name, `"${name}" is not a single word`).not.toMatch(/\s/);
      }
    }
  });
});

describe("generateGuestDisplayName locale defaulting", () => {
  it("defaults to the live locale when no locale is passed", () => {
    expect(getLocale()).toBe("en");
    expect(GUEST_NAME_POOLS.en).toContain(generateGuestDisplayName());

    setLocale("es");
    expect(GUEST_NAME_POOLS.es).toContain(generateGuestDisplayName());

    setLocale("en");
    expect(GUEST_NAME_POOLS.en).toContain(generateGuestDisplayName());
  });

  it("honours an explicit locale over the live one", () => {
    setLocale("es");
    expect(GUEST_NAME_POOLS.en).toContain(generateGuestDisplayName("en"));
    expect(GUEST_NAME_POOLS.es).toContain(generateGuestDisplayName("es"));
  });
});
