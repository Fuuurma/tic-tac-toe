import { Color } from "@/app/game/constants/constants";
import { GameIdentity, LoginPayload } from "@/app/types/types";

export const IDENTITY_STORAGE_KEYS = {
  guestId: "game_guest_id",
  displayName: "game_display_name",
  lastIdentityKind: "game_last_identity_kind",
  legacyUsername: "tictactoe_username",
} as const;

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;

const GUEST_NAME_PREFIXES = ["Guest", "Player", "Tactician"] as const;

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const randomSuffix = () => Math.floor(Math.random() * 9000) + 1000;

const generateGuestId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest:${crypto.randomUUID()}`;
  }

  return `guest:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const generateGuestDisplayName = () => {
  const prefix = GUEST_NAME_PREFIXES[Math.floor(Math.random() * GUEST_NAME_PREFIXES.length)];
  return `${prefix}-${randomSuffix()}`;
};

export const sanitizeDisplayName = (
  value: string | null | undefined,
  fallback = generateGuestDisplayName()
) => {
  const normalized = (value || "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);

  return normalized.length >= DISPLAY_NAME_MIN_LENGTH ? normalized : fallback;
};

export const getOrCreateGuestIdentity = (
  storage: Storage | null = getBrowserStorage()
): GameIdentity & { kind: "guest" } => {
  const existingGuestId = storage?.getItem(IDENTITY_STORAGE_KEYS.guestId);
  const guestId = existingGuestId || generateGuestId();
  const savedDisplayName =
    storage?.getItem(IDENTITY_STORAGE_KEYS.displayName) ||
    storage?.getItem(IDENTITY_STORAGE_KEYS.legacyUsername);
  const displayName = sanitizeDisplayName(savedDisplayName);

  storage?.setItem(IDENTITY_STORAGE_KEYS.guestId, guestId);
  storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, displayName);
  storage?.setItem(IDENTITY_STORAGE_KEYS.legacyUsername, displayName);
  storage?.setItem(IDENTITY_STORAGE_KEYS.lastIdentityKind, "guest");

  return { kind: "guest", guestId, displayName };
};

export const saveDisplayName = (
  displayName: string,
  storage: Storage | null = getBrowserStorage()
): GameIdentity & { kind: "guest" } => {
  const identity = getOrCreateGuestIdentity(storage);
  const sanitizedDisplayName = sanitizeDisplayName(displayName, identity.displayName);

  storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, sanitizedDisplayName);
  storage?.setItem(IDENTITY_STORAGE_KEYS.legacyUsername, sanitizedDisplayName);
  storage?.setItem(IDENTITY_STORAGE_KEYS.lastIdentityKind, identity.kind);

  return { ...identity, displayName: sanitizedDisplayName };
};

export const identityForSocketLogin = (
  identity: GameIdentity,
  color: Color
): LoginPayload => ({
  displayName: identity.displayName,
  color,
  ...(identity.kind === "guest"
    ? { guestId: identity.guestId }
    : {
        guestId: identity.claimedGuestId,
        profileId: identity.profileId,
        userId: identity.userId,
      }),
});
