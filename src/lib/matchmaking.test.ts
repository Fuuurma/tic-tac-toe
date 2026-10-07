import { describe, expect, it, vi } from "vitest";
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

// The module used to `throw` at import scope when VITE_MATCHMAKING_URL was
// unset. That throw shipped inside the lazily-loaded online chunk, so it
// escalated to the app-wide ErrorBoundary: one missing build variable
// replaced the WHOLE app — including the single-player games already in
// progress — with a developer-facing error screen. The blast radius is now
// confined to the online call that needs the URL.
describe("module import safety without VITE_MATCHMAKING_URL", () => {
  it("imports without throwing in a build with no backend configured", async () => {
    // This spec file already imports the module at the top, so simply
    // reaching here proves the import did not throw. Assert the exported
    // shape so a future regression fails loudly rather than silently.
    const mod = await import("@/lib/matchmaking");
    expect(typeof mod.findMatch).toBe("function");
    expect(typeof mod.pollMatch).toBe("function");
    expect(typeof mod.leaveMatch).toBe("function");
    expect(typeof mod.MATCHMAKING_UNAVAILABLE_MESSAGE).toBe("string");
    expect(mod.MATCHMAKING_UNAVAILABLE_MESSAGE.length).toBeGreaterThan(0);
  });

  it("reports the configured state as a boolean the UI can gate on", async () => {
    const mod = await import("@/lib/matchmaking");
    expect(typeof mod.MATCHMAKING_CONFIGURED).toBe("boolean");
  });

  it("resolves the base URL at call time, not at import time", async () => {
    const mod = await import("@/lib/matchmaking");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return {
          ok: true,
          json: async () => ({ status: "waiting", ticket: "t", roomId: "r" }),
        };
      }),
    );
    try {
      await mod.findMatch({
        game: "ttt",
        peerId: "p",
        displayName: "P",
        guestId: "g",
      });
    } finally {
      vi.unstubAllGlobals();
    }
    // The call reached a real URL rather than exploding at module scope.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/matchmaking/ttt/join");
  });
});
