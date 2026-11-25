import { describe, it, expect, vi, afterEach } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  HOST_ABSENT_TIMEOUT_MS,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState, freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { RoomClient } from "@/lib/roomClient";
import type { PeerRole, PeerRoomState } from "./state";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";
import { handleGuestMessage } from "./guestProtocol";
import { buildRoomClient, type RoomLifecycleDeps } from "./roomLifecycle";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

function waitingGame(): GameState {
  return { ...freshGameState(), gameMode: GameModes.ONLINE, gameStatus: GameStatus.WAITING };
}

function activeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Host",
      playerOName: "Guest",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
      humanSymbol: PlayerSymbol.X,
    }),
    ...overrides,
  };
}

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

function seatedRoom() {
  return {
    send: vi.fn(() => true),
    close: vi.fn(),
    isConnected: () => true,
  } as unknown as RoomClient;
}

const hostOpponent = { guestId: "h", displayName: "Host" };

describe("guest welcome before the first authoritative snapshot", () => {
  it("keeps a first-join guest connecting when the relay reports the host seated", () => {
    const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
      status: "connecting",
      message: "Joining room…",
    });

    handleRelayEvent(deps, {
      type: "welcome",
      role: "guest",
      opponent: hostOpponent,
    });

    expect(getRoom().status).toBe("connecting");
    expect(getRoom().role).toBe("guest");
    expect(deps.requestSync).not.toHaveBeenCalled();
  });

  it("arms the bounded wait on a first-join welcome even with an opponent present", () => {
    const { deps } = makeDeps(waitingGame(), "guest", { status: "connecting" });

    handleRelayEvent(deps, {
      type: "welcome",
      role: "guest",
      opponent: hostOpponent,
    });

    expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();
    expect(deps.waitingForHostDeadlineAtRef.current).not.toBeNull();
  });

  it("still marks a reconnecting guest with a live game connected", () => {
    const { deps, getRoom } = makeDeps(activeGame(), "guest", {
      status: "connecting",
    });

    handleRelayEvent(deps, {
      type: "welcome",
      role: "guest",
      opponent: hostOpponent,
    });

    expect(getRoom().status).toBe("connected");
    expect(deps.requestSync).toHaveBeenCalledOnce();
    expect(deps.waitingForHostTimeoutRef.current).toBeNull();
    expect(deps.waitingForHostDeadlineAtRef.current).toBeNull();
  });

  it("bounds the handshake: a seated but silent host cannot strand the guest", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostOpponent,
      });
      expect(getRoom().status).toBe("connecting");

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().canRetryReconnect).toBe(false);
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
      expect(deps.roomRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("peer-joined does not disarm the handshake wait while the game is still WAITING", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: null,
      });
      handleRelayEvent(deps, { type: "peer-joined" });
      expect(getRoom().status).toBe("connecting");

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("peer-reconnected keeps a first-join guest connecting until the snapshot lands", () => {
    const { deps, getRoom } = makeDeps(waitingGame(), "guest", {
      status: "reconnecting",
    });

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(getRoom().status).toBe("connecting");
    expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();
  });
});

describe("guest handshake deadline cleared by accepted authoritative state", () => {
  function lifecycleDeps() {
    const waiting = waitingGame();
    const deps: RoomLifecycleDeps = {
      roomRef: { current: null },
      stateRef: { current: waiting },
      roleRef: { current: "guest" },
      quickMatchHostRef: { current: false },
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbolRef: { current: PlayerSymbol.O },
      hostDisplayName: "Guest",
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
      hostPendingSettingsRef: { current: null },
      reconnectResetsRef: { current: { moveCount: -1 } },
      pendingGuestStateRef: { current: null },
      syncPendingRef: { current: false },
      waitingForHostTimeoutRef: { current: null },
      waitingForHostDeadlineAtRef: { current: null },
    };
    return { deps, waiting };
  }

  function wireRoomClient(over: Partial<RoomLifecycleDeps> = {}) {
    const { deps, waiting } = lifecycleDeps();
    const merged = { ...deps, ...over };
    const captured: {
      handler?: (msg: { type: string; [k: string]: unknown }) => void;
    } = {};
    vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
      (h) => {
        captured.handler = h;
      },
    );
    vi.spyOn(RoomClient.prototype, "send").mockReturnValue(true);
    const roomState = { gameState: waiting, status: "connecting" } as PeerRoomState;
    let room = roomState;
    merged.setState = (updater) => {
      room = typeof updater === "function" ? updater(room) : updater;
    };
    const relayDeps: RelayEventDeps = {
      roomRef: merged.roomRef,
      stateRef: merged.stateRef,
      roleRef: merged.roleRef,
      quickMatchHostRef: merged.quickMatchHostRef,
      hostSymbolRef: merged.hostSymbolRef,
      guestSymbolRef: merged.guestSymbolRef,
      rematchPendingRef: merged.rematchPendingRef,
      reconnectResetsRef: merged.reconnectResetsRef,
      pausedRef: { current: false },
      waitingForHostTimeoutRef: merged.waitingForHostTimeoutRef,
      waitingForHostDeadlineAtRef: merged.waitingForHostDeadlineAtRef,
      setState: merged.setState,
      commitHostState: vi.fn(),
      broadcastGameState: vi.fn(),
      requestSync: vi.fn(),
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
      clearRematchTimeout: vi.fn(),
    };
    merged.handleWsEvent = (event) => handleRelayEvent(relayDeps, event);
    merged.handleGuestData = (message) =>
      handleGuestMessage(
        {
          stateRef: merged.stateRef,
          guestSymbolRef: merged.guestSymbolRef,
          pendingGuestStateRef: merged.pendingGuestStateRef,
          rematchPendingRef: merged.rematchPendingRef,
          syncPendingRef: merged.syncPendingRef,
          clearRematchTimeout: vi.fn(),
          onHostPause: vi.fn(),
          setState: merged.setState,
          stopTimer: merged.stopTimer,
        },
        message,
      );
    buildRoomClient(merged, "ws://relay.test/room", "guest");
    return { merged, captured, getRoom: () => room };
  }

  it("clears the armed deadline when the host's joined snapshot lands", () => {
    vi.useFakeTimers();
    try {
      const { merged, captured, getRoom } = wireRoomClient();
      const room = seatedRoom();
      merged.roomRef.current = room;

      captured.handler?.({
        type: "welcome",
        role: "guest",
        opponent: hostOpponent,
      });
      expect(merged.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(getRoom().status).toBe("connecting");

      const joinedGame = activeGame();
      captured.handler?.({
        type: "joined",
        symbol: PlayerSymbol.O,
        color: joinedGame.players[PlayerSymbol.O].color,
        gameState: { ...joinedGame, turnDeadlineAt: undefined },
      });

      expect(merged.waitingForHostTimeoutRef.current).toBeNull();
      expect(merged.waitingForHostDeadlineAtRef.current).toBeNull();
      expect(merged.stateRef.current.gameStatus).toBe(GameStatus.ACTIVE);
      expect(getRoom().status).toBe("connected");

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS + 1_000);
      expect(getRoom().status).toBe("connected");
      expect(room.close).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("keeps the deadline armed while snapshots stay WAITING or unanswered", () => {
    vi.useFakeTimers();
    try {
      const { merged, captured } = wireRoomClient();
      merged.roomRef.current = seatedRoom();

      captured.handler?.({
        type: "welcome",
        role: "guest",
        opponent: hostOpponent,
      });
      expect(merged.waitingForHostTimeoutRef.current).not.toBeNull();

      const waitingWire = { ...waitingGame(), turnDeadlineAt: undefined };
      captured.handler?.({
        type: "gameUpdate",
        gameState: waitingWire,
      });
      expect(merged.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(merged.stateRef.current.gameStatus).toBe(GameStatus.WAITING);

      const live = activeGame();
      captured.handler?.({
        type: "state_snapshot",
        gameState: { ...live, turnDeadlineAt: undefined },
        symbol: PlayerSymbol.O,
      });
      expect(merged.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(merged.stateRef.current.gameStatus).toBe(GameStatus.WAITING);

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);
      expect(merged.waitingForHostTimeoutRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
