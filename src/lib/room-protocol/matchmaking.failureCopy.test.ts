import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runQuickMatch, type MatchmakingDeps } from "./matchmaking";
import { findMatch, pollMatch } from "@/lib/matchmaking";
import { reportError } from "@/lib/errorReporting";
import { setLocale, t } from "@/i18n/language";

vi.mock("@/lib/matchmaking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/matchmaking")>();
  return {
    ...actual,
    findMatch: vi.fn(),
    pollMatch: vi.fn(),
    leaveMatch: vi.fn(() => Promise.resolve()),
    buildRoomWsUrl: vi.fn(() => "wss://relay.example/room/r1"),
    getMatchPollDelay: vi.fn(() => 0),
  };
});

vi.mock("@/lib/identity", () => ({
  getOrCreateGuestIdentity: vi.fn(() => ({ guestId: "guest-1" })),
}));

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const mockedFindMatch = vi.mocked(findMatch);
const mockedPollMatch = vi.mocked(pollMatch);
const mockedReportError = vi.mocked(reportError);

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
      markQuickMatchHost: vi.fn(),
      maxPollMs: 60_000,
      ...overrides,
    } satisfies MatchmakingDeps,
    matchmakingTicketRef,
    hasStartedRef,
  };
}

describe("runQuickMatch failure copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale("en");
  });

  it("shows the localized failure line without raw poll detail and reports the error", async () => {
    setLocale("es");
    const { deps } = makeDeps();
    mockedFindMatch.mockResolvedValue({ status: "waiting", ticket: "t1", roomId: "r1" });
    const pollBoom = new Error("Matchmaking poll failed: 503 down");
    mockedPollMatch.mockRejectedValue(pollBoom);

    await runQuickMatch(deps);

    const errorPatch = vi
      .mocked(deps.setStatus)
      .mock.calls.map((call) => call[0] as { status?: string; message?: string })
      .filter((patch) => patch.status === "error")
      .at(-1);
    expect(errorPatch?.message).toBe(t("mm.failed"));
    expect(errorPatch?.message).not.toContain("503");
    expect(errorPatch?.message).not.toContain("Matchmaking poll failed");
    expect(errorPatch?.message).not.toContain("{detail}");
    expect(mockedReportError).toHaveBeenCalledTimes(1);
    expect(mockedReportError).toHaveBeenCalledWith(
      pollBoom,
      expect.objectContaining({ source: "matchmaking.failed" }),
    );
  });
});
