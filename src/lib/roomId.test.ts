import { describe, expect, it } from "vitest";
import { normalizeRoomId } from "@/lib/roomId";

describe("normalizeRoomId", () => {
  it("accepts generated and URL-safe room IDs", () => {
    expect(normalizeRoomId(" a1b2-c3_d4 ")).toBe("a1b2-c3_d4");
  });

  it("rejects malformed room IDs", () => {
    expect(normalizeRoomId("../admin")).toBe("");
    expect(normalizeRoomId("abc")).toBe("");
    expect(normalizeRoomId(null)).toBe("");
  });
});
