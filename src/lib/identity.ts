export const IDENTITY_STORAGE_KEYS = {
  guestId: "tic-tac-toe:guestId",
  displayName: "tic-tac-toe:displayName",
} as const;

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;

export type GuestIdentity = {
  kind: "guest";
  guestId: string;
  displayName: string;
};

const GUEST_NAME_PREFIXES = ["Guest", "Player", "Tactician"] as const;

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const randomSuffix = () => Math.floor(Math.random() * 9000) + 1000;

const generateGuestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest:${crypto.randomUUID()}`;
  }
  return `guest:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const generateGuestDisplayName = (): string => {
  const prefix =
    GUEST_NAME_PREFIXES[Math.floor(Math.random() * GUEST_NAME_PREFIXES.length)];
  return `${prefix}-${randomSuffix()}`;
};

export const sanitizeDisplayName = (
  value: string | null | undefined,
  fallback = generateGuestDisplayName(),
): string => {
  const safeValue = Array.from(value || "")
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127 && character !== "<" && character !== ">";
    })
    .join("");
  const normalized = safeValue
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);

  return normalized.length >= DISPLAY_NAME_MIN_LENGTH ? normalized : fallback;
};

export const getOrCreateGuestIdentity = (
  storage: Storage | null = getBrowserStorage(),
): GuestIdentity => {
  const existingGuestId = storage?.getItem(IDENTITY_STORAGE_KEYS.guestId);
  const guestId = existingGuestId || generateGuestId();
  const savedDisplayName = storage?.getItem(IDENTITY_STORAGE_KEYS.displayName);
  const displayName = sanitizeDisplayName(savedDisplayName);

  storage?.setItem(IDENTITY_STORAGE_KEYS.guestId, guestId);
  storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, displayName);

  return { kind: "guest", guestId, displayName };
};

export const saveDisplayName = (
  displayName: string,
  storage: Storage | null = getBrowserStorage(),
): GuestIdentity => {
  const identity = getOrCreateGuestIdentity(storage);
  const sanitizedDisplayName = sanitizeDisplayName(
    displayName,
    identity.displayName,
  );

  storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, sanitizedDisplayName);

  return { ...identity, displayName: sanitizedDisplayName };
};
