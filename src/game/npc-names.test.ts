import { describe, expect, it } from "vitest";
import { AI_Difficulty } from "./constants";
import { sanitizeDisplayName } from "@/lib/identity";
import {
  BANNED_NAME_FRAGMENTS,
  NPC_NAME_MAX_LENGTH,
  NPC_NAME_TIERS,
  createNpcNameSession,
  isNpcName,
} from "./npc-names";

const LOCALES = ["en", "es"] as const;
const ALL_NAMES: readonly string[] = Object.values(NPC_NAME_TIERS).flatMap((tiers) =>
  Object.values(tiers).flat(),
);

describe("npc name roster", () => {
  it("carries 60 names — 10 per difficulty per locale", () => {
    expect(ALL_NAMES).toHaveLength(60);
    for (const locale of LOCALES) {
      for (const difficulty of Object.values(AI_Difficulty)) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toHaveLength(10);
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

  it("has no duplicate names within a locale", () => {
    // Tiers in one cast must not share a persona; a name appearing in both
    // locales is allowed — the casts are authored independently.
    for (const locale of LOCALES) {
      const names = Object.values(NPC_NAME_TIERS[locale]).flat();
      expect(new Set(names).size).toBe(names.length);
    }
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
  it("picks from the requested difficulty's tier in the requested locale", () => {
    const session = createNpcNameSession();
    for (const locale of LOCALES) {
      for (const difficulty of Object.values(AI_Difficulty)) {
        expect(NPC_NAME_TIERS[locale][difficulty]).toContain(
          session.pick(difficulty, locale),
        );
      }
    }
  });

  it("is deterministic under a fixed rng", () => {
    const low = createNpcNameSession(() => 0);
    expect(low.pick(AI_Difficulty.HARD, "en")).toBe(NPC_NAME_TIERS.en[AI_Difficulty.HARD][0]);

    const high = createNpcNameSession(() => 0.9999);
    const hidden = NPC_NAME_TIERS.en[AI_Difficulty.HARD];
    expect(high.pick(AI_Difficulty.HARD, "en")).toBe(hidden[hidden.length - 1]);
  });

  it("never repeats a name within one session, tiers and locales mixed", () => {
    const session = createNpcNameSession();
    const order = LOCALES.flatMap((locale) =>
      Object.values(AI_Difficulty).map((difficulty) => ({ locale, difficulty })),
    );
    const picked = new Set<string>();
    // Drain the entire roster the way a real player switching difficulty and
    // language would: every locale+tier combo, one after another, one shared
    // session. A pick stays inside its locale's cast, so 60 draws deal all
    // 60 names exactly once before any pile resets.
    for (let i = 0; picked.size < ALL_NAMES.length; i += 1) {
      const { locale, difficulty } = order[i % order.length]!;
      const name = session.pick(difficulty, locale);
      expect(picked.has(name), `"${name}" was picked twice in one session`).toBe(false);
      picked.add(name);
    }
    expect(picked.size).toBe(ALL_NAMES.length);
  });

  it("starts over cleanly once the session has used every name", () => {
    const session = createNpcNameSession();
    for (let i = 0; i < ALL_NAMES.length + 5; i += 1) {
      session.pick(AI_Difficulty.NORMAL, "en");
    }
    // Past the boundary the pile has forgotten everything; a session longer
    // than the roster restarts rather than dead-ends, and the draw keeps
    // honouring the one guarantee the product can make: the name just shown
    // is not dealt again immediately.
    let last = session.pick(AI_Difficulty.HARD, "en");
    for (let i = 0; i < 20; i += 1) {
      const name = session.pick(AI_Difficulty.NORMAL, "en");
      expect(name).not.toBe(last);
      last = name;
    }
  });
});

describe("isNpcName", () => {
  it("recognizes roster names from any locale and tier", () => {
    expect(isNpcName(ALL_NAMES[0]!)).toBe(true);
    expect(isNpcName(ALL_NAMES[ALL_NAMES.length - 1]!)).toBe(true);
  });

  it("rejects non-roster names", () => {
    expect(isNpcName("AI")).toBe(false);
    expect(isNpcName("")).toBe(false);
    expect(isNpcName("Zed")).toBe(false);
    expect(isNpcName(" Pip")).toBe(false);
  });
});
