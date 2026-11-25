import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import {
  Color,
  GameModes,
  GameStatus,
  HOST_ABSENT_TIMEOUT_MS,
  PlayerSymbol,
  TURN_DURATION_MS,
  type PlayerSettings,
} from "@/game/constants";
import { createInitialGameState, freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerMessage } from "@/lib/peer.wire";
import type { RoomEnvelope } from "@fuurma/online-client";
import { RoomClient } from "@/lib/roomClient";
import type { PeerRole, PeerRoomState } from "./state";
import { handleGuestMessage, type GuestProtocolDeps } from "./guestProtocol";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";
import { buildRoomClient, type RoomLifecycleDeps } from "./roomLifecycle";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

function waitingGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.WAITING,
  };
}

function activeGame(): GameState {
  return { ...waitingGame(), gameStatus: GameStatus.ACTIVE, moveCount: 2 };
}

function completedGame(): GameState {
  return {
    ...waitingGame(),
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
    moveCount: 5,
  };
}

function liveGame(): GameState {
  const state = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    humanSymbol: PlayerSymbol.X,
  });
  return { ...state, turnDeadlineAt: undefined };
}

function wireWaiting(): GameState {
  const state = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    humanSymbol: PlayerSymbol.X,
  });
  return {
    ...state,
    gameStatus: GameStatus.WAITING,
    turnDeadlineAt: undefined,
    turnTimeRemaining: TURN_DURATION_MS,
  };
}

function seatedRoom() {
  return {
    send: vi.fn(() => true),
    close: vi.fn(),
    isConnected: () => true,
  } as unknown as RoomClient;
}

function makeDeps(game: GameState, roomInit: Partial<PeerRoomState> = {}) {
  let roomState = { gameState: game, ...roomInit } as PeerRoomState;
  const deps: RelayEventDeps = {
    roomRef: { current: null },
    stateRef: { current: game },
    roleRef: { current: "guest" },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: PlayerSymbol.X },
    guestSymbolRef: { current: null },
    rematchPendingRef: { current: false },
    reconnectResetsRef: { current: { moveCount: -1 } },
    pausedRef: { current: false },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
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

const hostSeated = {
  guestId: "h",
  displayName: "Host",
};

describe("guest welcome handshake", () => {
  it("a first join with the host already seated stays connecting and arms the bound", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      deps.roomRef.current = seatedRoom();

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });

      expect(getRoom().status).toBe("connecting");
      expect(getRoom().messageKey).toBe("peer.opponentConnecting");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(deps.waitingForHostDeadlineAtRef.current).not.toBeNull();
      expect(deps.requestSync).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a first join with no host seated stays connecting on the waiting-host copy", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      deps.roomRef.current = seatedRoom();

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: null,
      });

      expect(getRoom().status).toBe("connecting");
      expect(getRoom().messageKey).toBe("peer.waitingHost");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(deps.requestSync).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a reconnect holding ACTIVE or COMPLETED state still connects and pulls", () => {
    for (const game of [activeGame(), completedGame()]) {
      const { deps, getRoom } = makeDeps(game, { status: "connecting" });
      deps.roomRef.current = seatedRoom();

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });

      expect(getRoom().status).toBe("connected");
      expect(deps.requestSync).toHaveBeenCalledOnce();
      expect(deps.waitingForHostTimeoutRef.current).toBeNull();
      expect(deps.waitingForHostDeadlineAtRef.current).toBeNull();
    }
  });

  it("a reconnect holding live state with no opponent keeps the absent-host wait", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(activeGame(), {
        status: "connecting",
      });
      deps.roomRef.current = seatedRoom();

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: null,
      });

      expect(getRoom().status).toBe("connecting");
      expect(getRoom().messageKey).toBe("peer.waitingHost");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();
      expect(deps.requestSync).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a seated but silent host cannot strand the guest past the bound", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });
      expect(getRoom().status).toBe("connecting");

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().messageKey).toBe("mm.hostNever");
      expect(getRoom().canRetryReconnect).toBe(false);
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
      expect(deps.roomRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the host seating mid-wait does not disarm the handshake bound", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });
      handleRelayEvent(deps, { type: "peer-joined" });
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().messageKey).toBe("mm.hostNever");
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
      expect(deps.roomRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("peer-reconnected cannot clear the pre-snapshot bound either", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });
      handleRelayEvent(deps, { type: "peer-reconnected" });

      expect(getRoom().status).toBe("connecting");
      expect(getRoom().messageKey).toBe("peer.opponentConnecting");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().messageKey).toBe("mm.hostNever");
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a host flap mid-handshake keeps the guest connecting and the bound armed", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });
      handleRelayEvent(deps, { type: "peer-left", reason: "disconnect" });
      expect(getRoom().status).toBe("reconnecting");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();

      handleRelayEvent(deps, { type: "peer-reconnected" });

      expect(getRoom().status).toBe("connecting");
      expect(getRoom().messageKey).toBe("peer.opponentConnecting");
      expect(deps.waitingForHostTimeoutRef.current).not.toBeNull();

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("expiry while the guest renders reconnecting still terminalizes as hostNever", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });
      handleRelayEvent(deps, { type: "peer-left", reason: "disconnect" });
      expect(getRoom().status).toBe("reconnecting");

      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().messageKey).toBe("mm.hostNever");
      expect(getRoom().canRetryReconnect).toBe(false);
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
      expect(deps.roomRef.current).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("an opponent-present re-welcome keeps the original absolute deadline", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      const room = seatedRoom();
      deps.roomRef.current = room;

      handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });
      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS - 5_000);
      handleRelayEvent(deps, {
        type: "welcome",
        role: "guest",
        opponent: hostSeated,
      });
      expect(getRoom().status).toBe("connecting");

      vi.advanceTimersByTime(5_000);

      expect(getRoom().status).toBe("disconnected");
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a dropped timeout re-arms against the expired absolute deadline, never a fresh one", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      let connected = true;
      const room = {
        send: vi.fn(() => true),
        close: vi.fn(),
        isConnected: () => connected,
      } as unknown as RoomClient;
      deps.roomRef.current = room;

      handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });
      expect(deps.waitingForHostDeadlineAtRef.current).not.toBeNull();

      connected = false;
      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS + 1_000);
      expect(room.close).not.toHaveBeenCalled();
      expect(deps.waitingForHostTimeoutRef.current).toBeNull();
      expect(deps.waitingForHostDeadlineAtRef.current).not.toBeNull();

      connected = true;
      handleRelayEvent(deps, { type: "peer-joined" });
      vi.advanceTimersByTime(0);

      expect(getRoom().status).toBe("disconnected");
      expect(getRoom().messageKey).toBe("mm.hostNever");
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("expiry while our own socket is mid-reconnect does not close, and the next welcome applies the expired deadline", () => {
    vi.useFakeTimers();
    try {
      const { deps, getRoom } = makeDeps(waitingGame(), {
        status: "connecting",
      });
      let connected = false;
      const room = {
        send: vi.fn(() => false),
        close: vi.fn(),
        isConnected: () => connected,
      } as unknown as RoomClient;
      deps.roomRef.current = room;

      handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });
      getRoom().status = "reconnecting";
      vi.advanceTimersByTime(HOST_ABSENT_TIMEOUT_MS + 1_000);

      expect(getRoom().status).toBe("reconnecting");
      expect(room.close).not.toHaveBeenCalled();

      connected = true;
      handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });
      vi.advanceTimersByTime(0);

      expect(getRoom().status).toBe("disconnected");
      expect(room.send).toHaveBeenCalledWith({ type: "leave" });
      expect(room.close).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

function makeHandshake() {
  const game = waitingGame();
  let roomState = {
    role: "guest",
    status: "connecting",
    queue: "matched",
    roomId: "ROOM42",
    hostSymbol: PlayerSymbol.X,
    guestSymbol: null,
    message: "",
    messageKey: null,
    messageVars: undefined,
    pausedStash: null,
    rematchIncoming: false,
    rematchOutgoing: false,
    leftBySelf: false,
    canRetryReconnect: false,
    gameState: game,
  } as PeerRoomState;

  const setState: Dispatch<SetStateAction<PeerRoomState>> = (updater) => {
    roomState =
      typeof updater === "function" ? updater(roomState) : updater;
  };

  const roomRef: { current: RoomClient | null } = { current: null };
  const stateRef = { current: game };
  const roleRef: { current: PeerRole } = { current: "guest" };
  const quickMatchHostRef = { current: false };
  const hostSymbolRef: { current: PlayerSymbol | null } = {
    current: PlayerSymbol.X,
  };
  const guestSymbolRef: { current: PlayerSymbol | null } = {
    current: null,
  };
  const rematchPendingRef = { current: false };
  const reconnectResetsRef = { current: { moveCount: -1 } };
  const pausedRef = { current: false };
  const waitingForHostTimeoutRef: {
    current: ReturnType<typeof setTimeout> | null;
  } = { current: null };
  const waitingForHostDeadlineAtRef = { current: null as number | null };
  const pendingGuestStateRef = { current: null as GameState | null };
  const syncPendingRef = { current: false };
  const lastSyncReplyAtRef = { current: 0 };
  const guestJoinedRef = { current: false };
  const hostPendingSettingsRef = {
    current: null as PlayerSettings | null,
  };
  const stopTimer = vi.fn();
  const clearRematchTimeout = vi.fn();

  const relayDeps: RelayEventDeps = {
    roomRef,
    stateRef,
    roleRef,
    quickMatchHostRef,
    hostSymbolRef,
    guestSymbolRef,
    rematchPendingRef,
    reconnectResetsRef,
    pausedRef,
    waitingForHostTimeoutRef,
    waitingForHostDeadlineAtRef,
    setState,
    commitHostState: vi.fn(),
    broadcastGameState: vi.fn(),
    requestSync: vi.fn(),
    startTimer: vi.fn(),
    stopTimer,
    clearRematchTimeout,
  };

  const guestDeps: GuestProtocolDeps = {
    stateRef,
    guestSymbolRef,
    pendingGuestStateRef,
    rematchPendingRef,
    syncPendingRef,
    clearRematchTimeout,
    onHostPause: vi.fn(),
    setState,
    stopTimer,
  };

  const lifecycleDeps: RoomLifecycleDeps = {
    roomRef,
    stateRef,
    roleRef,
    quickMatchHostRef,
    hostSymbolRef,
    guestSymbolRef,
    hostDisplayName: "Guest",
    hostColor: Color.BLUE,
    setState,
    update: vi.fn(),
    handleWsEvent: (event) => handleRelayEvent(relayDeps, event),
    handleHostData: vi.fn(),
    handleGuestData: (message) => handleGuestMessage(guestDeps, message),
    stopTimer,
    rematchPendingRef,
    lastSyncReplyAtRef,
    guestJoinedRef,
    hostPendingSettingsRef,
    reconnectResetsRef,
    pendingGuestStateRef,
    syncPendingRef,
    waitingForHostTimeoutRef,
    waitingForHostDeadlineAtRef,
  };

  const captured: { handler?: (msg: RoomEnvelope) => void } = {};
  vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
    (h) => {
      captured.handler = h;
    },
  );
  vi.spyOn(RoomClient.prototype, "setStatusHandler").mockImplementation(
    (() => undefined) as never,
  );
  vi.spyOn(RoomClient.prototype, "send").mockReturnValue(true);
  buildRoomClient(lifecycleDeps, "ws://relay.test/room", "guest");

  return {
    fire: (msg: RoomEnvelope) => captured.handler?.(msg),
    getRoom: () => roomState,
    stateRef,
    waitingForHostTimeoutRef,
    waitingForHostDeadlineAtRef,
    syncPendingRef,
  };
}

describe("buildRoomClient handshake deadline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("an accepted joined carrying live state clears the armed deadline and connects", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    expect(h.getRoom().status).toBe("connecting");
    expect(h.waitingForHostTimeoutRef.current).not.toBeNull();

    h.fire({
      type: "joined",
      symbol: PlayerSymbol.O,
      color: Color.RED,
      gameState: liveGame(),
    } satisfies PeerMessage);

    expect(h.waitingForHostTimeoutRef.current).toBeNull();
    expect(h.waitingForHostDeadlineAtRef.current).toBeNull();
    expect(h.getRoom().status).toBe("connected");
    expect(h.stateRef.current.gameStatus).toBe(GameStatus.ACTIVE);
    expect(h.getRoom().guestSymbol).toBe(PlayerSymbol.O);
  });

  it("an accepted gameStart clears the armed deadline", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    h.fire({
      type: "gameStart",
      symbol: PlayerSymbol.O,
      gameState: liveGame(),
    } satisfies PeerMessage);

    expect(h.waitingForHostTimeoutRef.current).toBeNull();
    expect(h.waitingForHostDeadlineAtRef.current).toBeNull();
    expect(h.getRoom().status).toBe("connected");
  });

  it("an accepted solicited non-WAITING snapshot clears the armed deadline", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    h.syncPendingRef.current = true;
    h.fire({
      type: "state_snapshot",
      symbol: PlayerSymbol.O,
      gameState: liveGame(),
    } satisfies PeerMessage);

    expect(h.syncPendingRef.current).toBe(false);
    expect(h.waitingForHostTimeoutRef.current).toBeNull();
    expect(h.waitingForHostDeadlineAtRef.current).toBeNull();
    expect(h.getRoom().status).toBe("connected");
  });

  it("an unsolicited snapshot leaves the deadline armed", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    h.fire({
      type: "state_snapshot",
      symbol: PlayerSymbol.O,
      gameState: liveGame(),
    } satisfies PeerMessage);

    expect(h.syncPendingRef.current).toBe(false);
    expect(h.stateRef.current.gameStatus).toBe(GameStatus.WAITING);
    expect(h.waitingForHostTimeoutRef.current).not.toBeNull();
    expect(h.getRoom().status).toBe("connecting");
  });

  it("an accepted joined still carrying WAITING is not authoritative — the bound stays and still expires from connected", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    h.fire({
      type: "joined",
      symbol: PlayerSymbol.O,
      color: Color.RED,
      gameState: wireWaiting(),
    } satisfies PeerMessage);

    expect(h.stateRef.current.gameStatus).toBe(GameStatus.WAITING);
    expect(h.getRoom().status).toBe("connected");
    expect(h.getRoom().guestSymbol).toBe(PlayerSymbol.O);
    expect(h.waitingForHostTimeoutRef.current).not.toBeNull();
    expect(h.waitingForHostDeadlineAtRef.current).not.toBeNull();
  });

  it("a solicited snapshot still carrying WAITING does not clear the bound", () => {
    vi.useFakeTimers();
    const h = makeHandshake();

    h.fire({
      type: "welcome",
      role: "guest",
      opponent: hostSeated,
    });
    h.syncPendingRef.current = true;
    h.fire({
      type: "state_snapshot",
      symbol: PlayerSymbol.O,
      gameState: wireWaiting(),
    } satisfies PeerMessage);

    expect(h.syncPendingRef.current).toBe(false);
    expect(h.stateRef.current.gameStatus).toBe(GameStatus.WAITING);
    expect(h.waitingForHostTimeoutRef.current).not.toBeNull();
  });
});
