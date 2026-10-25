import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRoomWsUrl,
  getMatchPollDelay,
  MATCH_POLL_INITIAL_DELAY_MS,
  MATCH_POLL_MAX_DELAY_MS,
  parseMatchmakingHealth,
  parseMatchmakingResponse,
  totalOnlinePlayers,
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

  it("ignores fields the Worker contract does not define", () => {
    expect(
      parseMatchmakingResponse({ status: "waiting", ticket: "t1", roomId: "r1", position: 3 }),
    ).toEqual({ status: "waiting", ticket: "t1", roomId: "r1" });
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

// Create/Join build their socket URL from the same base as the HTTP calls.
// buildRoomWsUrl used to fall back to the 127.0.0.1 dev default on its own, so
// a production build with no backend dialled the visitor's own machine.
describe("buildRoomWsUrl backend resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function freshModule(env: { PROD: boolean; url: string }) {
    vi.stubEnv("PROD", env.PROD);
    vi.stubEnv("VITE_MATCHMAKING_URL", env.url);
    vi.resetModules();
    return import("@/lib/matchmaking");
  }

  it("refuses a production build with no backend instead of dialling localhost", async () => {
    const mod = await freshModule({ PROD: true, url: "" });
    expect(mod.ONLINE_UNAVAILABLE).toBe(true);
    expect(() => mod.buildRoomWsUrl("abc")).toThrow(mod.MATCHMAKING_UNAVAILABLE_MESSAGE);
  });

  it("uses the configured backend in a production build", async () => {
    const mod = await freshModule({ PROD: true, url: "https://relay.example" });
    expect(mod.ONLINE_UNAVAILABLE).toBe(false);
    expect(mod.buildRoomWsUrl("abc")).toBe("wss://relay.example/room/abc");
  });

  it("keeps the local-dev default when no backend is configured", async () => {
    const mod = await freshModule({ PROD: false, url: "" });
    expect(mod.ONLINE_UNAVAILABLE).toBe(false);
    expect(mod.buildRoomWsUrl("abc")).toBe("ws://127.0.0.1:8787/room/abc");
  });

  it("still honours an explicit base URL", () => {
    expect(buildRoomWsUrl("abc", "https://other.example")).toBe("wss://other.example/room/abc");
  });
});

describe("parseMatchmakingHealth", () => {
  it("accepts a well-formed health body", () => {
    expect(
      parseMatchmakingHealth({ ok: true, game: "tictactoe", waiting: 3, matches: 2 }),
    ).toEqual({ game: "tictactoe", waiting: 3, matches: 2 });
  });

  it("accepts an empty queue", () => {
    expect(
      parseMatchmakingHealth({ ok: true, game: "tictactoe", waiting: 0, matches: 0 }),
    ).toEqual({ game: "tictactoe", waiting: 0, matches: 0 });
  });

  // The readout sits next to the Quick Match button. A confident 0 read as
  // "nobody is playing" and talked people out of pressing it, so anything
  // unexpected has to collapse to "unknown" instead of to a number.
  it("rejects bodies that are not a healthy service report", () => {
    expect(parseMatchmakingHealth(null)).toBeNull();
    expect(parseMatchmakingHealth("nope")).toBeNull();
    expect(parseMatchmakingHealth({})).toBeNull();
    expect(parseMatchmakingHealth({ ok: false, game: "g", waiting: 1, matches: 1 })).toBeNull();
    expect(parseMatchmakingHealth({ ok: true, waiting: 1, matches: 1 })).toBeNull();
  });

  it("rejects counts that are not whole non-negative numbers", () => {
    const base = { ok: true, game: "tictactoe", matches: 0 };
    expect(parseMatchmakingHealth({ ...base, waiting: -1 })).toBeNull();
    expect(parseMatchmakingHealth({ ...base, waiting: 1.5 })).toBeNull();
    expect(parseMatchmakingHealth({ ...base, waiting: "3" })).toBeNull();
    expect(parseMatchmakingHealth({ ...base, waiting: Number.NaN })).toBeNull();
    expect(parseMatchmakingHealth({ ok: true, game: "g", waiting: 1, matches: null })).toBeNull();
  });
});

describe("totalOnlinePlayers", () => {
  it("counts both players of every live match alongside the queue", () => {
    expect(totalOnlinePlayers({ game: "g", waiting: 3, matches: 2 })).toBe(7);
    expect(totalOnlinePlayers({ game: "g", waiting: 0, matches: 0 })).toBe(0);
    expect(totalOnlinePlayers({ game: "g", waiting: 1, matches: 0 })).toBe(1);
  });
});
