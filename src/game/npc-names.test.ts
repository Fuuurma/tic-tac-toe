import { describe, expect, it } from "vitest";
import { AI_Difficulty } from "./constants";
import { sanitizeDisplayName } from "@/lib/identity";
import type { Locale } from "@/lib/preferences";
import {
  BANNED_NAME_FRAGMENTS,
  NPC_NAME_MAX_LENGTH,
  NPC_NAME_TIERS,
  NPC_NAMES,
  createNpcNameSession,
  isNpcName,
} from "./npc-names";

const LOCALES = ["en", "es"] as const satisfies readonly Locale[];
const ALL_NAMES: readonly string[] = NPC_NAMES;

describe("npc name roster", () => {
  it("carries the authored cast: 60 names across two locales", () => {
    expect(ALL_NAMES.length).toBe(60);
  });

  it("gives every locale and difficulty a tier of exactly 10 names", () => {
    for (const locale of LOCALES) {
      for (const difficulty of Object.values(AI_Difficulty)) {
        expect(
          NPC_NAME_TIERS[locale][difficulty].length,
          `${locale}/${difficulty} should hold the authored ten`,
        ).toBe(10);
      }
    }
  });

  it("keeps every name between 2 and 14 characters", () => {
    for (const name of ALL_NAMES) {
      expect(
        name.length,
        `"${name}" is ${name.length} characters; the cap is ${NPC_NAME_MAX_LENGTH}`,
      ).toBeLessThanOrEqual(NPC_NAME_MAX_LENGTH);
      expect(name.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has no duplicate names across the whole cast", () => {
    expect(new Set(ALL_NAMES).size).toBe(ALL_NAMES.length);
  });

  it("avoids every banned fragment, case-insensitively", () => {
    for (const name of ALL_NAMES) {
      const lowered = name.toLowerCase();
      for (const fragment of BANNED_NAME_FRAGMENTS) {
        expect(
          lowered.includes(fragment),
          `"${name}" contains banned fragment "${fragment}"`,
        ).toBe(false);
      }
    }
  });

  it("survives the display-name sanitizer unchanged", () => {
    // The opponent-name field and the persisted preference both run
    // sanitizeDisplayName; a roster name the sanitizer would alter would
    // come back different from what the game shows.
    for (const name of ALL_NAMES) {
      expect(sanitizeDisplayName(name)).toBe(name);
    }
  });
});

describe("npcNameSession", () => {
  it("picks from the requested difficulty's tier", () => {
    const session = createNpcNameSession();
    for (const locale of LOCALES) {
      for (const difficulty of Object.values(AI_Difficulty)) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toContain(
          session.pick(locale, difficulty),
        );
      }
    }
  });

  it("is deterministic under a fixed rng", () => {
    const low = createNpcNameSession(() => 0);
    const hardEn = NPC_NAME_TIERS.en[AI_Difficulty.HARD];
    expect(low.pick("en", AI_Difficulty.HARD)).toBe(hardEn[0]);

    const high = createNpcNameSession(() => 0.9999);
    expect(high.pick("en", AI_Difficulty.HARD)).toBe(hardEn[hardEn.length - 1]);
  });

  it("never repeats a name within one session, locales and tiers mixed", () => {
    const session = createNpcNameSession();
    const order = [
      ["en", AI_Difficulty.EASY],
      ["es", AI_Difficulty.NORMAL],
      ["en", AI_Difficulty.HARD],
      ["es", AI_Difficulty.EASY],
    ] as const;
    const picked = new Set<string>();
    // Drain the entire cast the way a real player switching language and
    // difficulty would: different locales and tiers, one shared session.
    for (let i = 0; picked.size < ALL_NAMES.length; i += 1) {
      const [locale, difficulty] = order[i % order.length]!;
      const name = session.pick(locale, difficulty);
      expect(picked.has(name), `"${name}" was picked twice in one session`).toBe(false);
      picked.add(name);
    }
    expect(picked.size).toBe(ALL_NAMES.length);
  });

  it("starts over cleanly once the session has used every name", () => {
    const session = createNpcNameSession();
    for (let i = 0; i < ALL_NAMES.length + 5; i += 1) {
      session.pick("en", AI_Difficulty.NORMAL);
    }
    // Past the boundary the pile has forgotten everything; a session longer
    // than the roster restarts rather than dead-ends, and the draw keeps
    // honouring the one guarantee the product can make: the name just shown
    // is not dealt again immediately.
    let last = session.pick("es", AI_Difficulty.HARD);
    for (let i = 0; i < 20; i += 1) {
      const name = session.pick("en", AI_Difficulty.NORMAL);
      expect(name).not.toBe(last);
      last = name;
    }
  });
});

describe("isNpcName", () => {
  it("recognizes roster names from any tier and locale", () => {
    expect(isNpcName(ALL_NAMES[0]!)).toBe(true);
    expect(isNpcName(ALL_NAMES[ALL_NAMES.length - 1]!)).toBe(true);
    expect(isNpcName("Jaque")).toBe(true);
    expect(isNpcName("Pip")).toBe(true);
  });

  it("still recognizes the retired gag roster for one release", () => {
    // A persona saved before the Cast shipped must keep reading as
    // session-assigned so the rematch redraws instead of freezing it.
    expect(isNpcName("Gridlock Gary")).toBe(true);
  });

  it("rejects non-roster names", () => {
    expect(isNpcName("AI")).toBe(false);
    expect(isNpcName("")).toBe(false);
    expect(isNpcName("Zed")).toBe(false);
    expect(isNpcName(" Gridlock Gary")).toBe(false);
  });
});
