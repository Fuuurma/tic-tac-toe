import { generateRoomCode } from "@fuurma/online-client";

export const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

/**
 * The one spelling a room code takes on the wire. The relay keys rooms by
 * the exact string, so the invite link, the join field and a custom create
 * code all fold here: whitespace out, case up. Entry is case-insensitive
 * because every path canonicalizes the same way — and a code pasted with
 * stray spaces still lands.
 */
export const canonicalRoomId = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, "").toUpperCase();

export const normalizeRoomId = (value: string | null | undefined): string => {
  const roomId = canonicalRoomId(value);
  return ROOM_ID_PATTERN.test(roomId) ? roomId : "";
};

/**
 * A friend-room invite code: six characters from the shared unambiguous
 * alphabet (the same set Gambit ships — no 0/O or 1/I/L confusables),
 * uppercase by construction. Quick-match rooms keep their worker-issued
 * ids; this is only for codes a person reads aloud, dictates or types.
 */
export const generateFriendRoomCode = (): string => generateRoomCode();
