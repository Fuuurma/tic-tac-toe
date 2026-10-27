import { describe, expect, it } from "vitest";
import { isPeerMessage } from "./peer";

describe("social messages", () => {
  it("accepts supported reaction IDs and rejects free text", () => {
    expect(isPeerMessage({ type: "social_reaction", id: "nice_move" })).toBe(true);
    expect(isPeerMessage({ type: "social_reaction", id: "anything" })).toBe(false);
  });
});
