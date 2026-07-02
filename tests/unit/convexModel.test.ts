import { describe, expect, it, vi } from "vitest";
import { createRoomCode, normalizeRoomCode } from "@/convex/model";

describe("convex model helpers", () => {
  it("normalizes invite room codes", () => {
    expect(normalizeRoomCode(" ab-c_123 ")).toBe("ABC123");
  });

  it("rejects short invite room codes", () => {
    expect(() => normalizeRoomCode("a-1")).toThrow("Room code must be at least 4 characters.");
  });

  it("creates compact room codes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456);

    expect(createRoomCode(1_725_000_000_000)).toMatch(/^[A-Z0-9]{8}$/);
  });
});
