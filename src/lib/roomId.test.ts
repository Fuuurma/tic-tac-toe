import { describe, expect, it } from "vitest";
import {
  canonicalRoomId,
  generateFriendRoomCode,
  normalizeRoomId,
} from "@/lib/roomId";

describe("normalizeRoomId", () => {
  it("canonicalizes case and whitespace, then validates", () => {
    expect(normalizeRoomId(" a1b2-c3_d4 ")).toBe("A1B2-C3_D4");
    expect(normalizeRoomId("k7q 2mx")).toBe("K7Q2MX");
    expect(normalizeRoomId("x".repeat(64))).toHaveLength(64);
  });

  it("rejects malformed room IDs", () => {
    expect(normalizeRoomId("../admin")).toBe("");
    expect(normalizeRoomId("abc")).toBe("");
    expect(normalizeRoomId("x".repeat(65))).toBe("");
    expect(normalizeRoomId(null)).toBe("");
    expect(normalizeRoomId("   ")).toBe("");
  });
});

describe("canonicalRoomId", () => {
  it("strips all whitespace and uppercases without validating", () => {
    expect(canonicalRoomId(" ab cd ")).toBe("ABCD");
    expect(canonicalRoomId("not a room!!")).toBe("NOTAROOM!!");
    expect(canonicalRoomId(null)).toBe("");
    expect(canonicalRoomId(undefined)).toBe("");
  });
});

describe("generateFriendRoomCode", () => {
  it("returns a 6-char code from the unambiguous alphabet", () => {
    const code = generateFriendRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("generates different codes", () => {
    expect(generateFriendRoomCode()).not.toBe(generateFriendRoomCode());
  });
});
