import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abandonTicket, runQuickMatch, type MatchmakingDeps } from "./matchmaking";
import {
  buildRoomWsUrl,
  findMatch,
  leaveMatch,
  pollMatch,
  type MatchmakingResponse,
} from "@/lib/matchmaking";

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

function makeMatch(overrides: { roomId: string; wsUrl?: string }) {
  return {
    roomId: overrides.roomId,
    role: "guest" as const,
    host: { peerId: "p1", displayName: "Host", guestId: "g1" },
    guest: { peerId: "p2", displayName: "Guest", guestId: "g2" },
    wsUrl: overrides.wsUrl,
  };
}

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
      match: makeMatch({ roomId: "r2", wsUrl: "wss://relay.example/room/r2" }),
      slotToken: "guest-slot-tok",
    });

    await runQuickMatch(deps);

    expect(deps.joinAsGuest).toHaveBeenCalledWith("r2", "wss://relay.example/room/r2", "guest-slot-tok");
    expect(deps.startAsHost).not.toHaveBeenCalled();
    expect(mockedLeaveMatch).not.toHaveBeenCalled();
    expect(hasStartedRef.current).toBe(false);
  });

  it("hosts + polls, and does NOT leaveMatch a ticket the poll consumed", async () => {
    const { deps, matchmakingTicketRef, hasStartedRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockResolvedValue({ status: "matched", match: makeMatch({ roomId: "r1" }) });

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

  it("publishes the FIFO queue position from join and poll responses", async () => {
    const { deps } = makeDeps();
    mockedFindMatch.mockResolvedValue({
      status: "waiting",
      ticket: "t1",
      roomId: "r1",
      position: 4,
    });
    mockedPollMatch
      .mockResolvedValueOnce({ status: "waiting", ticket: "t1", roomId: "r1", position: 2 })
      .mockResolvedValue({ status: "matched", match: makeMatch({ roomId: "r1" }) });

    await runQuickMatch(deps);

    expect(deps.setStatus).toHaveBeenCalledWith({ queuePosition: 4 });
    expect(deps.setStatus).toHaveBeenCalledWith({ queuePosition: 2 });
  });

  it("leaves the ticket and surfaces an error when polling times out", async () => {
    const { deps, matchmakingTicketRef } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });

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
      return { status: "waiting", ticket: "t1", roomId: "r1" };
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
    // The default 25ms poll ceiling is a WALL-CLOCK budget: under load the
    // five back-to-back attempts can outrun it and the loop exits on the
    // timer rather than on the failure rule, so this test asserted a race.
    // Bound it by the rule under test instead — the failure count — and give
    // the loop room it can never exhaust.
    const { deps, hasStartedRef } = makeDeps({ maxPollMs: 60_000 });
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    mockedPollMatch.mockRejectedValue(new Error("relay down"));

    await runQuickMatch(deps);

    expect(mockedPollMatch).toHaveBeenCalledTimes(5);
    // The catch path fires a best-effort leave: when the failure is partial
    // (poll route down, service up) it frees the still-queued ticket; when
    // the service is truly unreachable the leave fails harmlessly (fleet
    // 2026-09-13 ticket-leak finding). The UI is told either way.
    expect(mockedLeaveMatch).toHaveBeenCalledWith("tictactoe", "t1");
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
      .mockResolvedValue({ status: "matched", match: makeMatch({ roomId: "r1" }) });

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
    mockedFindMatch.mockResolvedValue({ status: "matched", match: makeMatch({ roomId: "r", wsUrl: "wss://x" }) });

    await runQuickMatch(deps);

    expect(mockedFindMatch).not.toHaveBeenCalled();
    expect(deps.joinAsGuest).not.toHaveBeenCalled();
  });

  it("builds the relay ws url from the waiting response's room", async () => {
    const { deps } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r9" });

    await runQuickMatch(deps);

    expect(mockedBuildRoomWsUrl).toHaveBeenCalledWith("r9");
  });
});

/** Deferred promise: the test resolves a pending network call on its own schedule. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Mirrors usePeerRoom.leave(): the user-cancel path shared with unmount. */
function cancelLikeLeave(deps: MatchmakingDeps, hasStartedRef: { current: boolean }) {
  abandonTicket(deps, "on leave");
  hasStartedRef.current = false;
}

describe("runQuickMatch cancellation and attempt identity (F86, F307)", () => {
  it("(A) cancel while findMatch is pending starts no room and abandons the ticket it got back", async () => {
    const { deps, matchmakingTicketRef, hasStartedRef } = makeDeps();
    const join = deferred<MatchmakingResponse>();
    mockedFindMatch.mockReturnValue(join.promise);

    const attempt = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedFindMatch).toHaveBeenCalledTimes(1));

    // The user cancels while the initial join request is still in flight.
    cancelLikeLeave(deps, hasStartedRef);
    join.resolve({ status: "waiting", ticket: "t1", roomId: "r1" });
    await attempt;

    expect(deps.startAsHost).not.toHaveBeenCalled();
    expect(deps.joinAsGuest).not.toHaveBeenCalled();
    expect(mockedLeaveMatch).toHaveBeenCalledWith(expect.any(String), "t1");
    expect(matchmakingTicketRef.current).toBeNull();
    expect(hasStartedRef.current).toBe(false);
    expect(deps.setStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });

  it("(A) cancel while findMatch is pending does not join a room on an instant match", async () => {
    const { deps, hasStartedRef } = makeDeps();
    const join = deferred<MatchmakingResponse>();
    mockedFindMatch.mockReturnValue(join.promise);

    const attempt = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedFindMatch).toHaveBeenCalledTimes(1));
    cancelLikeLeave(deps, hasStartedRef);
    join.resolve({
      status: "matched",
      match: makeMatch({ roomId: "r2", wsUrl: "wss://relay.example/room/r2" }),
      slotToken: "guest-slot-tok",
    });
    await attempt;

    expect(deps.joinAsGuest).not.toHaveBeenCalled();
    expect(deps.startAsHost).not.toHaveBeenCalled();
    expect(hasStartedRef.current).toBe(false);
  });

  it("(B1) a stale poll loop from attempt 1 does not leave or abandon attempt 2's live ticket", async () => {
    const { deps, matchmakingTicketRef, hasStartedRef } = makeDeps();
    const stalePoll = deferred<MatchmakingResponse>();
    const livePoll = deferred<MatchmakingResponse>();
    mockedFindMatch
      .mockResolvedValueOnce({ status: "waiting", ticket: "t1", roomId: "r1" })
      .mockResolvedValueOnce({ status: "waiting", ticket: "t2", roomId: "r2" });
    mockedPollMatch.mockImplementation((_game, ticket) =>
      ticket === "t1" ? stalePoll.promise : livePoll.promise,
    );

    const attempt1 = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedPollMatch).toHaveBeenCalledWith(expect.any(String), "t1"));
    cancelLikeLeave(deps, hasStartedRef);
    mockedLeaveMatch.mockClear();

    const attempt2 = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedPollMatch).toHaveBeenCalledWith(expect.any(String), "t2"));
    expect(matchmakingTicketRef.current).toBe("t2");

    // The stale loop's poll lands while attempt 2 owns the live ticket.
    stalePoll.resolve({ status: "waiting", ticket: "t1", roomId: "r1" });
    await attempt1;

    expect(mockedLeaveMatch).not.toHaveBeenCalledWith(expect.any(String), "t2");
    expect(matchmakingTicketRef.current).toBe("t2");

    livePoll.resolve({ status: "matched", match: makeMatch({ roomId: "r2" }) });
    await attempt2;
    expect(mockedLeaveMatch).not.toHaveBeenCalledWith(expect.any(String), "t2");
  });

  it("(B2) a stale poll loop does not clobber attempt 2's hasStarted flag or post a timeout error", async () => {
    // maxPollMs 25 (makeDeps default): attempt 1's budget expires while its
    // poll is pending, so the stale loop reaches its timeout branch.
    const { deps, matchmakingTicketRef, hasStartedRef } = makeDeps();
    const stalePoll = deferred<MatchmakingResponse>();
    const livePoll = deferred<MatchmakingResponse>();
    mockedFindMatch
      .mockResolvedValueOnce({ status: "waiting", ticket: "t1", roomId: "r1" })
      .mockResolvedValueOnce({ status: "waiting", ticket: "t2", roomId: "r2" });
    mockedPollMatch.mockImplementation((_game, ticket) =>
      ticket === "t1" ? stalePoll.promise : livePoll.promise,
    );

    const attempt1 = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedPollMatch).toHaveBeenCalledWith(expect.any(String), "t1"));
    cancelLikeLeave(deps, hasStartedRef);

    const attempt2 = runQuickMatch(deps);
    await vi.waitFor(() => expect(mockedPollMatch).toHaveBeenCalledWith(expect.any(String), "t2"));
    await new Promise((resolve) => setTimeout(resolve, 40));

    stalePoll.resolve({ status: "waiting", ticket: "t1", roomId: "r1" });
    await attempt1;

    expect(hasStartedRef.current).toBe(true);
    expect(matchmakingTicketRef.current).toBe("t2");
    expect(deps.patchStatus).not.toHaveBeenCalled();

    livePoll.resolve({ status: "matched", match: makeMatch({ roomId: "r2" }) });
    await attempt2;
  });
});
