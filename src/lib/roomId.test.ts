import { describe, expect, it } from "vitest";
import { generateRoomId, normalizeRoomId, readRoomInvite } from "@/lib/roomId";

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

describe("readRoomInvite", () => {
  it("keeps the code the link carried, trimmed and decoded", () => {
    expect(readRoomInvite("?room=friday-game")).toEqual({
      seed: "friday-game",
      present: true,
    });
    expect(readRoomInvite("?room=bad%20code")).toEqual({
      seed: "bad code",
      present: true,
    });
    expect(readRoomInvite("?room=%20friday-game%20")).toEqual({
      seed: "friday-game",
      present: true,
    });
  });

  it("tells an empty room parameter apart from no room parameter", () => {
    expect(readRoomInvite("?room=")).toEqual({ seed: "", present: true });
    expect(readRoomInvite("")).toEqual({ seed: "", present: false });
    expect(readRoomInvite("?mode=online")).toEqual({ seed: "", present: false });
  });
});

describe("generateRoomId", () => {
  it("returns a room id long enough that guessing is not trivial", () => {
    const roomId = generateRoomId();
    expect(roomId.length).toBeGreaterThanOrEqual(32);
    expect(roomId.length).toBeLessThanOrEqual(64);
  });
});
