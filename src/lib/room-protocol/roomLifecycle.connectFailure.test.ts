import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "@/lib/roomClient";
import { Color, GameModes } from "@/game/constants";
import { createInitialGameState, type GameState } from "@/game/logic";
import type { PlayerSettings } from "@/game/constants";
import { joinAsGuest, startAsHost, type RoomLifecycleDeps } from "./roomLifecycle";
import { peerMessage } from "./state";
import type { StringKey } from "@/i18n/en";
import { reportError } from "@/lib/errorReporting";
import { setLocale } from "@/i18n/language";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const mockedReportError = vi.mocked(reportError);

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

function lifecycleDeps() {
  const update = vi.fn();
  const deps: RoomLifecycleDeps = {
    roomRef: { current: null },
    stateRef: {
      current: createInitialGameState({
        gameMode: GameModes.ONLINE,
        playerXName: "Host",
        playerOName: "Guest",
        playerColor: Color.BLUE,
        opponentColor: Color.RED,
      }),
    },
    roleRef: { current: null },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: null },
    guestSymbolRef: { current: null },
    hostDisplayName: "Host",
    hostColor: Color.BLUE,
    setState: vi.fn(),
    update,
    handleWsEvent: vi.fn(),
    handleHostData: vi.fn(),
    handleGuestData: vi.fn(),
    stopTimer: vi.fn(),
    rematchPendingRef: { current: false },
    lastSyncReplyAtRef: { current: 0 },
    guestJoinedRef: { current: false },
    hostPendingSettingsRef: { current: null as PlayerSettings | null },
    reconnectResetsRef: { current: { moveCount: -1 } },
    pendingGuestStateRef: { current: null as GameState | null },
    syncPendingRef: { current: false },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
  };
  return { deps, update };
}

function lastUpdate(update: ReturnType<typeof vi.fn>) {
  const calls = update.mock.calls;
  return calls[calls.length - 1][0] as { status: string; messageKey: StringKey | null };
}

describe("room connect failure copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale("en");
  });

  it("startAsHost shows the localized connect-fail line, not the raw socket error", async () => {
    setLocale("es");
    const socketBoom = new Error("socket boom");
    vi.spyOn(RoomClient.prototype, "connect").mockRejectedValue(socketBoom);
    const { deps, update } = lifecycleDeps();

    startAsHost(deps, "ROOM42", "ws://127.0.0.1:1");
    await flushAsync();

    const last = lastUpdate(update);
    expect(last.status).toBe("error");
    expect(last.messageKey).toBe("online.connectFail");
    expect(peerMessage(last)).not.toContain("socket boom");
    expect(peerMessage(last)).not.toContain("Room connect failed");
    expect(mockedReportError).toHaveBeenCalledTimes(1);
    expect(mockedReportError).toHaveBeenCalledWith(
      socketBoom,
      expect.objectContaining({ source: "roomLifecycle.connect", role: "host" }),
    );
  });

  it("joinAsGuest shows the localized connect-fail line, not the raw socket error", async () => {
    setLocale("es");
    const socketBoom = new Error("socket boom");
    vi.spyOn(RoomClient.prototype, "connect").mockRejectedValue(socketBoom);
    const { deps, update } = lifecycleDeps();

    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");
    await flushAsync();

    const last = lastUpdate(update);
    expect(last.status).toBe("error");
    expect(last.messageKey).toBe("online.connectFail");
    expect(peerMessage(last)).not.toContain("socket boom");
    expect(peerMessage(last)).not.toContain("Room connect failed");
    expect(mockedReportError).toHaveBeenCalledTimes(1);
    expect(mockedReportError).toHaveBeenCalledWith(
      socketBoom,
      expect.objectContaining({ source: "roomLifecycle.connect", role: "guest" }),
    );
  });

  it("joinAsGuest announces the localized joining line while connecting", () => {
    setLocale("es");
    vi.spyOn(RoomClient.prototype, "connect").mockReturnValue(
      new Promise<never>(() => {}),
    );
    const { deps, update } = lifecycleDeps();

    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");

    const first = update.mock.calls[0][0] as { status: string; messageKey: StringKey | null };
    expect(first.status).toBe("connecting");
    expect(first.messageKey).toBe("online.joining");
    expect(peerMessage(first)).not.toBe("Connecting...");
  });
});
