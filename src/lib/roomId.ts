export const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

export const normalizeRoomId = (value: string | null | undefined): string => {
  const roomId = value?.trim() ?? "";
  return ROOM_ID_PATTERN.test(roomId) ? roomId : "";
};

export interface RoomInvite {
  seed: string;
  present: boolean;
}

export const NO_ROOM_INVITE: RoomInvite = { seed: "", present: false };

export const roomInvite = (seed: string): RoomInvite => ({
  seed: seed.trim(),
  present: true,
});

export const readRoomInvite = (search: string): RoomInvite => {
  const raw = new URLSearchParams(search).get("room");
  return raw === null ? NO_ROOM_INVITE : roomInvite(raw);
};

const fallbackRoomId = (): string =>
  `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.padEnd(32, "0").slice(0, 32);

/**
 * A fresh room id. `crypto.randomUUID` where it exists, a padded double
 * `Math.random` otherwise — it lived in `lib/peer.ts`, next to the wire
 * protocol, while this module owned the pattern that validates it.
 */
export const generateRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return fallbackRoomId();
};
