import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "@/lib/roomClient";
import { Color, GameModes, PlayerSymbol } from "@/game/constants";
import { createInitialGameState, freshGameState, type GameState } from "@/game/logic";
import type { PlayerSettings } from "@/game/constants";
import { buildRoomClient, type RoomLifecycleDeps } from "./roomLifecycle";
import type { PeerRoomState } from "./state";
import { reportError } from "@/lib/errorReporting";
import { setLocale, t } from "@/i18n/language";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const mockedReportError = vi.mocked(reportError);

function lifecycleDeps(): RoomLifecycleDeps {
  return {
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
    update: vi.fn(),
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
}

function roomState(overrides: Partial<PeerRoomState> = {}): PeerRoomState {
  return {
    role: "guest",
    status: "connected",
    queue: "none",
    roomId: "ROOM42",
    hostSymbol: PlayerSymbol.X,
    guestSymbol: PlayerSymbol.O,
    message: "",
    pausedStash: null,
    rematchIncoming: false,
    rematchOutgoing: false,
    leftBySelf: false,
    canRetryReconnect: false,
    gameState: freshGameState(),
    ...overrides,
  };
}

function captureStatusHandler(deps: RoomLifecycleDeps) {
  const captured: { status?: (s: string, detail?: string) => void } = {};
  vi.spyOn(RoomClient.prototype, "setStatusHandler").mockImplementation(
    ((h: (s: string, detail?: string) => void) => {
      captured.status = h;
    }) as never,
  );
  vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
    (() => undefined) as never,
  );
  buildRoomClient(deps, "ws://relay.test/room", "guest");
  return captured;
}

function nextState(deps: RoomLifecycleDeps, prev: PeerRoomState): PeerRoomState {
  const updater = (deps.setState as unknown as { mock: { calls: unknown[][] } })
    .mock.calls.at(-1)?.[0] as (p: PeerRoomState) => PeerRoomState;
  return updater(prev);
}

describe("transport status copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale("en");
  });

  it("reconnecting shows the localized line, not the transport countdown", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);

    captured.status?.("reconnecting", "Reconnecting in 1.2s");

    const next = nextState(deps, roomState());
    expect(next.status).toBe("reconnecting");
    expect(next.message).toBe(t("mm.reconnecting"));
    expect(next.message).not.toContain("Reconnecting in");
    expect(mockedReportError).toHaveBeenCalledWith(
      "Reconnecting in 1.2s",
      expect.objectContaining({ source: "roomLifecycle.transport" }),
    );
  });

  it("disconnected after reconnect gives up shows the localized line", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);

    captured.status?.("disconnected", "Reconnect gave up; retry when ready");

    const next = nextState(deps, roomState());
    expect(next.status).toBe("disconnected");
    expect(next.message).toBe(t("mm.disconnected"));
    expect(next.message).not.toContain("gave up");
    expect(mockedReportError).toHaveBeenCalledWith(
      "Reconnect gave up; retry when ready",
      expect.objectContaining({ source: "roomLifecycle.transport" }),
    );
  });

  it("disconnected on handshake timeout shows the localized line", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);

    captured.status?.("disconnected", "Connection timed out");

    const next = nextState(deps, roomState());
    expect(next.status).toBe("disconnected");
    expect(next.message).toBe(t("mm.disconnected"));
    expect(next.message).not.toContain("timed out");
    expect(mockedReportError).toHaveBeenCalledWith(
      "Connection timed out",
      expect.objectContaining({ source: "roomLifecycle.transport" }),
    );
  });

  it("transport error shows the localized connection-error line", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);

    captured.status?.("error", "socket boom");

    const next = nextState(deps, roomState());
    expect(next.status).toBe("error");
    expect(next.message).toBe(t("mm.connectionError"));
    expect(next.message).not.toContain("socket boom");
    expect(mockedReportError).toHaveBeenCalledWith(
      "socket boom",
      expect.objectContaining({ source: "roomLifecycle.transport" }),
    );
  });

  it("a relay grace line survives a later reconnecting tick", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);
    const grace = roomState({
      status: "reconnecting",
      message: t("peer.hostReconnecting"),
    });

    captured.status?.("reconnecting", "Reconnecting in 2s");

    const next = nextState(deps, grace);
    expect(next.message).toBe(t("peer.hostReconnecting"));
    expect(next.message).not.toContain("Reconnecting in");
  });

  it("a second reconnecting tick without detail leaves the localized line alone", () => {
    setLocale("es");
    const deps = lifecycleDeps();
    const captured = captureStatusHandler(deps);
    const reconnecting = roomState({
      status: "reconnecting",
      message: t("mm.reconnecting"),
    });

    captured.status?.("reconnecting");

    const next = nextState(deps, reconnecting);
    expect(next.message).toBe(t("mm.reconnecting"));
  });
});
