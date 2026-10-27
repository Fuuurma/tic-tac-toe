import { describe, expect, it } from "vitest";
import { generateRoomId, normalizeRoomId } from "@/lib/roomId";

describe("normalizeRoomId", () => {
  it("accepts generated and URL-safe room IDs", () => {
    expect(normalizeRoomId(" a1b2-c3_d4 ")).toBe("a1b2-c3_d4");
    expect(normalizeRoomId("x".repeat(64))).toHaveLength(64);
  });

  it("rejects malformed room IDs", () => {
    expect(normalizeRoomId("../admin")).toBe("");
    expect(normalizeRoomId("abc")).toBe("");
    expect(normalizeRoomId("x".repeat(65))).toBe("");
    expect(normalizeRoomId(null)).toBe("");
  });
});

describe("generateRoomId", () => {
  it("returns a room id long enough that guessing is not trivial", () => {
    const roomId = generateRoomId();
    expect(roomId.length).toBeGreaterThanOrEqual(32);
    expect(roomId.length).toBeLessThanOrEqual(64);
  });
});
