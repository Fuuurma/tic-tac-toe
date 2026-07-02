import { v } from "convex/values";

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;

export const displayNameValidator = v.string();
export const optionalIdentityValidator = v.optional(v.string());

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
