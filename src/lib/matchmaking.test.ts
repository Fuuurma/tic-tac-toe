import { describe, expect, it } from "vitest";
import {
  getMatchPollDelay,
  MATCH_POLL_INITIAL_DELAY_MS,
  MATCH_POLL_MAX_DELAY_MS,
  parseMatchmakingResponse,
} from "@/lib/matchmaking";

describe("getMatchPollDelay", () => {
  it("starts with a short delay and backs off to the cap", () => {
    expect(getMatchPollDelay(0)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(1)).toBe(MATCH_POLL_INITIAL_DELAY_MS * 2);
    expect(getMatchPollDelay(2)).toBe(MATCH_POLL_MAX_DELAY_MS);
    expect(getMatchPollDelay(20)).toBe(MATCH_POLL_MAX_DELAY_MS);
  });

  it("uses the initial delay for invalid attempts", () => {
    expect(getMatchPollDelay(-1)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(Number.NaN)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
    expect(getMatchPollDelay(1.5)).toBe(MATCH_POLL_INITIAL_DELAY_MS);
  });
});

describe("parseMatchmakingResponse", () => {
  const match = {
    roomId: "room-1",
    role: "guest",
    host: { peerId: "h", displayName: "Host", guestId: "gh" },
    guest: { peerId: "g", displayName: "Guest", guestId: "gg" },
  };

  it("accepts well-formed waiting and matched responses", () => {
    expect(
      parseMatchmakingResponse({ status: "waiting", ticket: "t1", roomId: "r1" }),
    ).toEqual({ status: "waiting", ticket: "t1", roomId: "r1" });
    expect(parseMatchmakingResponse({ status: "matched", match })).toEqual({
      status: "matched",
      match,
    });
  });

  it("carries the FIFO queue position through when the Worker reports it", () => {
    expect(
      parseMatchmakingResponse({
        status: "waiting",
        ticket: "t1",
        roomId: "r1",
        position: 3,
      }),
    ).toEqual({ status: "waiting", ticket: "t1", roomId: "r1", position: 3 });
  });

  it("rejects malformed bodies instead of casting them through", () => {
    // `{}` would otherwise poll forever on `?ticket=undefined`; a matched
    // body without a match would crash on `match.roomId`.
    expect(() => parseMatchmakingResponse({})).toThrow("Malformed");
    expect(() => parseMatchmakingResponse(null)).toThrow("Malformed");
    expect(() => parseMatchmakingResponse("matched")).toThrow("Malformed");
    expect(() => parseMatchmakingResponse({ status: "waiting" })).toThrow("Malformed");
    expect(() => parseMatchmakingResponse({ status: "matched" })).toThrow("Malformed");
    expect(() =>
      parseMatchmakingResponse({ status: "matched", match: { roomId: 5 } }),
    ).toThrow("Malformed");
    expect(() => parseMatchmakingResponse({ status: "unknown" })).toThrow("Malformed");
    // A non-numeric or non-positive position must not flow through to
    // the searching UI as "Position 0 in queue" or a raw cast.
    expect(() =>
      parseMatchmakingResponse({ status: "waiting", ticket: "t", roomId: "r", position: "3" }),
    ).toThrow("Malformed");
    expect(() =>
      parseMatchmakingResponse({ status: "waiting", ticket: "t", roomId: "r", position: 0 }),
    ).toThrow("Malformed");
  });
});
