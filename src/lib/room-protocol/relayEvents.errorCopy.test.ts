import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { PEER_MAX_ERROR_LENGTH } from "@/lib/peer.wire";
import { peerMessage, type PeerRole, type PeerRoomState } from "./state";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";
import { reportError } from "@/lib/errorReporting";
import { setLocale } from "@/i18n/language";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

const mockedReportError = vi.mocked(reportError);

function makeDeps(
  game: GameState,
  role: PeerRole,
  roomInit: Partial<PeerRoomState> = {},
) {
  let roomState = { gameState: game, ...roomInit } as PeerRoomState;
  const deps: RelayEventDeps = {
    roomRef: { current: null },
    stateRef: { current: game },
    roleRef: { current: role },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: PlayerSymbol.X },
    guestSymbolRef: { current: PlayerSymbol.O },
    rematchPendingRef: { current: false },
    reconnectResetsRef: { current: { moveCount: -1 } },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
    pausedRef: { current: false },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: vi.fn(),
    broadcastGameState: vi.fn(),
    requestSync: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

function waitingGame(): GameState {
  return { ...freshGameState(), gameStatus: GameStatus.WAITING };
}

describe("relay error and welcome copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale("en");
  });

  it("a relay error shows the localized room-error line and reports the raw message", () => {
    setLocale("es");
    const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
      status: "connected",
      messageKey: null,
    });

    handleRelayEvent(deps, { type: "error", message: "Room is full" });

    expect(getRoom().messageKey).toBe("peer.roomError");
    expect(peerMessage(getRoom())).not.toContain("Room is full");
    expect(mockedReportError).toHaveBeenCalledWith(
      "Room is full",
      expect.objectContaining({ source: "relayEvents.error" }),
    );
  });

  it("caps the reported relay error at PEER_MAX_ERROR_LENGTH", () => {
    setLocale("es");
    const { deps } = makeDeps(waitingGame(), "guest", {
      status: "connected",
      messageKey: null,
    });
    const long = "x".repeat(PEER_MAX_ERROR_LENGTH + 50);

    handleRelayEvent(deps, { type: "error", message: long });

    expect(mockedReportError).toHaveBeenCalledWith(
      "x".repeat(PEER_MAX_ERROR_LENGTH),
      expect.objectContaining({ source: "relayEvents.error" }),
    );
  });

  it("a non-string relay error shows the localized line without reporting", () => {
    setLocale("es");
    const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
      status: "connected",
      messageKey: null,
    });

    handleRelayEvent(deps, { type: "error", message: 42 });

    expect(getRoom().messageKey).toBe("peer.roomError");
    expect(mockedReportError).not.toHaveBeenCalled();
  });

  it("host welcome before connect shows the localized waiting line, not the room id", () => {
    setLocale("es");
    const { deps, getRoom } = makeDeps(waitingGame(), "host", {
      role: "host",
      status: "creating",
      roomId: "ROOM42",
      messageKey: null,
    });

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: null,
    });

    expect(getRoom().status).toBe("waiting");
    expect(getRoom().messageKey).toBe("online.waitingOpponent");
    expect(peerMessage(getRoom())).not.toContain("ROOM42");
    expect(peerMessage(getRoom())).not.toContain("Waiting for opponent");
  });
});
