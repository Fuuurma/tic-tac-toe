import { v } from "convex/values";

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const ROOM_CODE_MIN_LENGTH = 4;
export const ROOM_CODE_MAX_LENGTH = 16;

export const displayNameValidator = v.string();
export const optionalIdentityValidator = v.optional(v.string());
export const playerSymbolValidator = v.union(v.literal("X"), v.literal("O"));
export const roomStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("completed")
);

export const playerIdentityArgs = {
  profileId: v.optional(v.id("profiles")),
  guestId: v.optional(v.string()),
  userId: v.optional(v.string()),
  displayNameSnapshot: v.string(),
};

export function sanitizeDisplayName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function requireDisplayName(value: string) {
  const displayName = sanitizeDisplayName(value);
  if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    throw new Error("Display name must be at least 2 characters.");
  }
  return displayName;
}

export function requireIdentity(args: { profileId?: unknown; guestId?: string }) {
  if (!args.profileId && !args.guestId) {
    throw new Error("A profileId or guestId is required.");
  }
}

export function normalizeRoomCode(value: string) {
  const roomCode = value
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, ROOM_CODE_MAX_LENGTH);

  if (roomCode.length < ROOM_CODE_MIN_LENGTH) {
    throw new Error("Room code must be at least 4 characters.");
  }

  return roomCode;
}

export function createRoomCode(now = Date.now()) {
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${now.toString(36).slice(-4).toUpperCase()}${randomPart}`;
}
