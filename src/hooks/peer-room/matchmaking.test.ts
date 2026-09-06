import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abandonTicket, runQuickMatch, type MatchmakingDeps } from "./matchmaking";
import {
  buildRoomWsUrl,
  findMatch,
  leaveMatch,
  pollMatch,
} from "@/lib/matchmaking";
import { getOrCreateGuestIdentity } from "@/lib/identity";

vi.mock("@/lib/matchmaking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/matchmaking")>();
  return {
    ...actual,
    findMatch: vi.fn(),
    pollMatch: vi.fn(),
    leaveMatch: vi.fn(() => Promise.resolve()),
    buildRoomWsUrl: vi.fn(() => "wss://relay.example/room/r1"),
    // Zero backoff — real 1-4s sleeps would trip the test timeout.
    getMatchPollDelay: vi.fn(() => 0),
  };
});

vi.mock("@/lib/identity", () => ({
  getOrCreateGuestIdentity: vi.fn(() => ({ guestId: "guest-1" })),
}));

const mockedFindMatch = vi.mocked(findMatch);
const mockedPollMatch = vi.mocked(pollMatch);
const mockedLeaveMatch = vi.mocked(leaveMatch);
const mockedBuildRoomWsUrl = vi.mocked(buildRoomWsUrl);

function makeDeps(overrides: Partial<MatchmakingDeps> = {}) {
  const matchmakingTicketRef = { current: null as string | null };
  const hasStartedRef = { current: false };
  return {
    deps: {
      matchmakingTicketRef,
      hasStartedRef,
      stopTimer: vi.fn(),
      setStatus: vi.fn(),
      patchStatus: vi.fn(),
      hostDisplayName: "Host",
      startAsHost: vi.fn(),
      joinAsGuest: vi.fn(),
      // Shrink the poll ceiling so the timeout path runs in ms, and
      // zero the backoff so the loop doesn't sleep between polls.
      maxPollMs: 25,
      ...overrides,
    } satisfies MatchmakingDeps,
    matchmakingTicketRef,
    hasStartedRef,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("abandonTicket", () => {
  it("fires leaveMatch for a held ticket and nils the ref", () => {
    const { deps, matchmakingTicketRef } = makeDeps();
    matchmakingTicketRef.current = "t1";
    abandonTicket(deps, "test");
    expect(matchmakingTicketRef.current).toBeNull();
    expect(mockedLeaveMatch).toHaveBeenCalledWith(expect.any(String), "t1");
  });

  it("is a no-op when the ref is already nil", () => {
    const { deps } = makeDeps();
    abandonTicket(deps, "test");
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
  });
});

describe("runQuickMatch", () => {
  it("joins as guest immediately on an instant match without touching leave", async () => {
    const { deps, hasStartedRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({
      status: "matched",
      match: { roomId: "r2", wsUrl: "wss://relay.example/room/r2" },
    });

    await runQuickMatch(deps);

    expect(deps.joinAsGuest).toHaveBeenCalledWith("r2", "wss://relay.example/room/r2");
    expect(deps.startAsHost).not.toHaveBeenCalled();
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(hasStartedRef.current).toBe(false);
  });

  it("hosts + polls, and does NOT leaveMatch a ticket the poll consumed", async () => {
    const { deps, matchmakingTicketRef, hasStartedRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockResolvedValue({ status: "matched" });

    await runQuickMatch(deps);

    expect(deps.startAsHost).toHaveBeenCalledWith("r1", "wss://relay.example/room/r1");
    expect(mockedPollMatch).toHaveBeenCalledWith(expect.any(String), "t1");
    // The bug (fleet 2026-09-07): matched path must not fire leaveMatch
    // for the just-consumed ticket.
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(matchmakingTicketRef.current).toBeNull();
    expect(hasStartedRef.current).toBe(false);
    expect(deps.patchStatus).not.toHaveBeenCalled();
  });

  it("leaves the ticket and surfaces an error when polling times out", async () => {
    const { deps, matchmakingTicketRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockResolvedValue({ status: "waiting" });

    await runQuickMatch(deps);

    expect(mockedLeaveMatch).toHaveBeenCalledWith(expect.any(String), "t1");
    expect(matchmakingTicketRef.current).toBeNull();
    expect(deps.patchStatus).toHaveBeenCalledTimes(1);
    const updater = vi.mocked(deps.patchStatus).mock.calls[0][0] as (
      prev: { status: string },
    ) => { status: string; message?: string };
    const next = updater({ status: "waiting" });
    expect(next.status).toBe("error");
    expect(next.message).toContain("No opponent found");
  });

  it("does not surface the timeout error when the user cancelled via leave()", async () => {
    const { deps, matchmakingTicketRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    // First poll: the user's leave() nils the ticket ref mid-flight.
    mockedPollMatch.mockImplementation(async () => {
      matchmakingTicketRef.current = null;
      return { status: "waiting" };
    });

    await runQuickMatch(deps);

    // leave() itself owns the leaveMatch call — runQuickMatch must not
    // double-fire it, and must not show the timeout error.
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(deps.patchStatus).not.toHaveBeenCalled();
    expect(deps.setStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });

  it("gives up after 5 consecutive poll failures and shows the failure", async () => {
    const { deps, hasStartedRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockRejectedValue(new Error("relay down"));

    await runQuickMatch(deps);

    expect(mockedPollMatch).toHaveBeenCalledTimes(5);
    // The catch path nils the ref directly — no leaveMatch on a dead
    // session, and the UI is told.
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(deps.setStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error", message: expect.stringContaining("Matchmaking failed") }),
    );
    expect(hasStartedRef.current).toBe(false);
  });

  it("recovers from transient poll failures when a match then arrives", async () => {
    const { deps } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch
      .mockRejectedValueOnce(new Error("flash 502"))
      .mockRejectedValueOnce(new Error("flash 503"))
      .mockResolvedValue({ status: "matched" });

    await runQuickMatch(deps);

    expect(mockedPollMatch).toHaveBeenCalledTimes(3);
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(deps.setStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });

  it("is a no-op while a match attempt is already in flight... via hasStarted", async () => {
    const { deps, hasStartedRef } = makeDeps();
    hasStartedRef.current = true;
    mockedFindMatch.mockResolvedValue({ status: "matched", match: { roomId: "r", wsUrl: "wss://x" } });

    await runQuickMatch(deps);

    expect(mockedFindMatch).not.toHaveBeenCalled();
    expect(deps.joinAsGuest).not.toHaveBeenCalled();
  });

  it("builds the relay ws url from the waiting response's room", async () => {
    const { deps } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r9" });

    await runQuickMatch(deps);

    expect(mockedBuildRoomWsUrl).toHaveBeenCalledWith("r9", expect.any(String));
  });
});
