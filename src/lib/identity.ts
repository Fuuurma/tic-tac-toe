export const IDENTITY_STORAGE_KEYS = {
  guestId: "tic-tac-toe:guestId",
  displayName: "tic-tac-toe:displayName",
} as const;

const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 20;

/**
 * F121: characters that render as nothing but are not `\s` and are well above
 * 31, so a `codePoint > 31` filter passes them straight through. A name built
 * from them reads as blank while the length check counts them as content, and
 * the whitespace collapse cannot help because they are not whitespace. Two
 * distinct harms, so the set covers both: a name whose visible content does
 * not match its stored content (impersonation, via the bidi controls), and
 * invisible padding that games the 20-character cap.
 *
 * The set is Unicode's `Default_Ignorable_Code_Point` property MINUS the three
 * families that are legitimate glyph modifiers rather than invisible padding,
 * because stripping those would visibly corrupt real names:
 *
 *   - variation selectors  U+FE00-FE0F, U+E0100-E01EF, U+180B-U+180D,
 *     U+1BCA0-U+1BCA3, U+1D173-U+1D17A
 *     (dropping VS16 turns a red heart into a monochrome one)
 *   - tag characters       U+E0000-U+E0FFF and the tag planes
 *   - Khmer inherent vowels U+17B4, U+17B5
 *
 * Regex set subtraction needs the `v` flag, which needs an ES2024 target, and
 * this project targets ES2022, so the closed set is written out. It was
 * derived by diffing the property against each excluded family, not guessed;
 * `identity.test.ts` pins that derivation so a future Unicode release cannot
 * silently drift the set.
 *
 * The cost is honest: a new default-ignorable character will not appear here
 * on its own. Re-deriving is mechanical and the test tells you when it is
 * needed.
 */
// `no-misleading-character-class` flags U+034F and U+180E because they are
// combining marks that could join a preceding character. That is precisely why
// they are here: matching a combining mark is the job, and the rule exists to
// catch one that arrived by accident in a range. The derivation test in
// identity.test.ts holds the set to its Unicode property, so the contents
// are pinned.
const INVISIBLE_CHARS =
  // eslint-disable-next-line no-misleading-character-class
  /[\u00AD\u034F\u061C\u115F\u1160\u180E\u180F\u200B-\u200F\u202A-\u202E\u2060-\u2066\u2066-\u206F\u3164\uFEFF\uFFA0\uFFF0-\uFFF8]/g;

type GuestIdentity = {
  kind: "guest";
  guestId: string;
  displayName: string;
};

const GUEST_NAME_ADJECTIVES = [
  "Crimson", "Neon", "Silent", "Swift", "Cosmic",
  "Shadow", "Solar", "Lunar", "Frozen", "Velvet",
  "Iron", "Golden", "Azure", "Coral", "Jade",
  "Onyx", "Ruby", "Storm", "Wild", "Clever",
  "Noble", "Stellar", "Vivid", "Dusk", "Ember",
  "Frost", "Mystic", "Electric", "Magnetic", "Radiant",
] as const;

const GUEST_NAME_NOUNS = [
  "Fox", "Wolf", "Raven", "Falcon", "Tiger",
  "Dragon", "Phoenix", "Cipher", "Echo", "Nova",
  "Pulse", "Spark", "Blade", "Arrow", "Comet",
  "Ghost", "Prism", "Atlas", "Orion", "Vega",
  "Lyra", "Bolt", "Flint", "Sage", "Hawk",
  "Lynx", "Crow", "Koi", "Panther", "Sparrow",
] as const;

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const generateGuestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest:${crypto.randomUUID()}`;
  }
  return `guest:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const generateGuestDisplayName = (): string => {
  const adjective =
    GUEST_NAME_ADJECTIVES[Math.floor(Math.random() * GUEST_NAME_ADJECTIVES.length)];
  const noun =
    GUEST_NAME_NOUNS[Math.floor(Math.random() * GUEST_NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
};

const isAllowedCharacter = (character: string): boolean => {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint > 31 && codePoint !== 127 && character !== "<" && character !== ">";
};

/**
 * The single gate every display-name string passes through: drop what is never
 * legal, then drop what is invisible. Both steps happen before any length work,
 * so a length check can only ever count characters the user can actually see.
 *
 * sanitizeDisplayName and filterDisplayNameInput used to carry their own copy of
 * this, and they drifted: the sanitizer learned to strip invisibles while the
 * input filter did not, which is exactly the F121 defect. One seam, so that
 * class of drift is not representable.
 */
const stripDisallowedCharacters = (value: string): string =>
  Array.from(value).filter(isAllowedCharacter).join("").replace(INVISIBLE_CHARS, "");

/**
 * F469: the cap is a UTF-16 unit budget — the wire bound
 * (PEER_MAX_NAME_LENGTH) counts `.length` units, so the producers must
 * honor the same unit count. Slicing the rejoined string at unit 20 splits
 * an astral character's surrogate pair and emits a lone surrogate, which
 * renders as U+FFFD opponent-side. The cut therefore lands on a code-point
 * boundary: a pair that does not fit is dropped whole.
 */
const truncateToUtf16Length = (value: string, maxUnits: number): string => {
  let units = 0;
  let end = 0;
  for (const character of value) {
    if (units + character.length > maxUnits) break;
    units += character.length;
    end += character.length;
  }
  return value.slice(0, end);
};

export const sanitizeDisplayName = (
  value: string | null | undefined,
  fallback = generateGuestDisplayName(),
): string => {
  // F121: stripping happens before the length checks below, or a name that is
  // only zero-widths passes `>= MIN_LENGTH` on characters nobody can see.
  const safeValue = stripDisallowedCharacters(value || "");
  const normalized = truncateToUtf16Length(
    safeValue.replace(/\s+/g, " ").trim(),
    DISPLAY_NAME_MAX_LENGTH,
  );

  return normalized.length >= DISPLAY_NAME_MIN_LENGTH ? normalized : fallback;
};

/**
 * Per-keystroke filter for the name input — strips only characters that are
 * never legal, and deliberately does NOT trim, collapse spaces, or substitute
 * a fallback. sanitizeDisplayName's fallback made clearing the field snap back
 * to a random guest name and ate trailing spaces mid-word, so retyping a name
 * was impossible (needs-work 2026-09-10). Validation still runs the full
 * sanitize at save time.
 *
 * F121: it shares the sanitizer's strip, and that matters because this is the
 * field the user actually types into — when the two drifted, a pasted name
 * carried invisibles straight into storage. The cap is applied last so it
 * counts characters the user can see.
 */
export const filterDisplayNameInput = (value: string): string =>
  truncateToUtf16Length(
    stripDisallowedCharacters(value),
    DISPLAY_NAME_MAX_LENGTH,
  );

export const getOrCreateGuestIdentity = (
  storage: Storage | null = getBrowserStorage(),
): GuestIdentity => {
  const existingGuestId = storage?.getItem(IDENTITY_STORAGE_KEYS.guestId);
  const guestId = existingGuestId || generateGuestId();
  const savedDisplayName = storage?.getItem(IDENTITY_STORAGE_KEYS.displayName);
  const displayName = sanitizeDisplayName(savedDisplayName);

  try {
    storage?.setItem(IDENTITY_STORAGE_KEYS.guestId, guestId);
    storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, displayName);
  } catch {
    // QuotaExceededError or SecurityError — continue with in-memory identity
  }

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

  try {
    storage?.setItem(IDENTITY_STORAGE_KEYS.displayName, sanitizedDisplayName);
  } catch {
    // QuotaExceededError or SecurityError — continue with in-memory identity
  }

  return { ...identity, displayName: sanitizedDisplayName };
};
