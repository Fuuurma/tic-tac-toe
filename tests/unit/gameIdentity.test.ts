import { describe, expect, it } from "vitest";
import { Color } from "@/app/game/constants/constants";
import {
  getOrCreateGuestIdentity,
  getStoredIdentityKind,
  identityForSocketLogin,
  IDENTITY_STORAGE_KEYS,
  sanitizeDisplayName,
  saveAccountIdentity,
  saveDisplayName,
} from "@/app/utils/identity/gameIdentity";

const createStorage = (initialValues: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(initialValues));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

describe("game identity", () => {
  it("sanitizes display names for the game profile", () => {
    expect(sanitizeDisplayName("  Ada   Player  ")).toBe("Ada Player");
    expect(sanitizeDisplayName("<script>VeryLongPlayerName123</script>")).toBe(
      "scriptVeryLongPlayer"
    );
    expect(sanitizeDisplayName("x", "Guest-1234")).toBe("Guest-1234");
  });

  it("creates and reuses a guest identity", () => {
    const storage = createStorage();
    const firstIdentity = getOrCreateGuestIdentity(storage);
    const secondIdentity = getOrCreateGuestIdentity(storage);

    expect(firstIdentity.kind).toBe("guest");
    expect(firstIdentity.guestId).toBe(secondIdentity.guestId);
    expect(secondIdentity.displayName).toBe(firstIdentity.displayName);
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.lastIdentityKind)).toBe("guest");
    expect(getStoredIdentityKind(storage)).toBe("guest");
  });

  it("migrates the legacy saved username key", () => {
    const storage = createStorage({
      [IDENTITY_STORAGE_KEYS.legacyUsername]: "Legacy Name",
    });

    const identity = getOrCreateGuestIdentity(storage);

    expect(identity.displayName).toBe("Legacy Name");
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.displayName)).toBe("Legacy Name");
  });

  it("saves edited display names and builds socket payloads", () => {
    const storage = createStorage();
    const identity = saveDisplayName("  Player One  ", storage);

    expect(identity.displayName).toBe("Player One");
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.displayName)).toBe("Player One");
    expect(identityForSocketLogin(identity, Color.GREEN)).toEqual({
      displayName: "Player One",
      guestId: identity.guestId,
      color: Color.GREEN,
    });
  });

  it("saves account identity without losing the claimed guest id", () => {
    const storage = createStorage({
      [IDENTITY_STORAGE_KEYS.guestId]: "guest:existing",
    });

    const identity = saveAccountIdentity(
      {
        userId: "user:1234",
        profileId: "profile:1234",
        displayName: "  Ada   Account  ",
      },
      storage
    );

    expect(identity).toEqual({
      kind: "account",
      userId: "user:1234",
      profileId: "profile:1234",
      displayName: "Ada Account",
      claimedGuestId: "guest:existing",
    });
    expect(storage.getItem(IDENTITY_STORAGE_KEYS.lastIdentityKind)).toBe("account");
    expect(getStoredIdentityKind(storage)).toBe("account");
    expect(identityForSocketLogin(identity, Color.PURPLE)).toEqual({
      displayName: "Ada Account",
      color: Color.PURPLE,
      guestId: "guest:existing",
      profileId: "profile:1234",
      userId: "user:1234",
    });
  });
});
