import { describe, it, expect, vi } from "vitest";
import { RoomClient } from "@/lib/room";
import { Color, GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import { createInitialGameState, type GameState } from "@/game/logic";
import { leaveRoom, joinAsGuest, startAsHost, buildRoomClient, type RoomLifecycleDeps } from "./roomLifecycle";
import { handleRelayEvent } from "./relayEvents";
import { SYNC_REPLY_COOLDOWN_MS } from "./hostProtocol";
import type { PendingPlayerSettings } from "../usePeerRoom";

// F7 regression pin: every close path must send `{type:"leave"}` BEFORE
// closing the socket. A frame sent after close is silently dropped, so the
// peer/relay never learns the room was left deliberately.

function mockRoom() {
  const calls: string[] = [];
  let sendOk = true;
  const room = {
    send: vi.fn((msg: { type: string }) => {
      calls.push(`send:${msg.type}`);
      return sendOk;
    }),
    close: vi.fn(() => {
      calls.push("close");
    }),
  };
  return { room, calls, failNextSend: () => (sendOk = false) };
}

function refFor(room: unknown) {
  return { current: room as RoomClient | null };
}

describe("leaveRoom", () => {
  it("sends leave before close, then nulls the ref", () => {
    const { room, calls } = mockRoom();
    const ref = refFor(room);
    leaveRoom(ref);
    expect(room.send).toHaveBeenCalledTimes(1);
    expect(room.send).toHaveBeenCalledWith({ type: "leave" });
    expect(room.close).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["send:leave", "close"]);
    expect(ref.current).toBeNull();
  });

  it("is a no-op on a null ref", () => {
    const ref = refFor(null);
    expect(() => leaveRoom(ref)).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it("still closes when send reports failure (best-effort leave)", () => {
    const { room, calls, failNextSend } = mockRoom();
    failNextSend();
    const ref = refFor(room);
    leaveRoom(ref);
    expect(calls).toEqual(["send:leave", "close"]);
    expect(ref.current).toBeNull();
  });
});

describe("joinAsGuest rematch-flag reset", () => {
  // needs-work 2026-09-10 P2: rematchPendingRef was never reset by the
  // room-entry paths — a stray rematchAccept landing just after a room swap
  // would be honored against a game that never asked for one.
  function lifecycleDeps(
    rematchPendingRef: { current: boolean },
    hostPendingSettingsRef = { current: null as PendingPlayerSettings | null },
  ) {
    const guestSymbolRef = { current: PlayerSymbol.X as PlayerSymbol | null };
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
      hostSymbolRef: { current: null },
      guestSymbolRef,
      hostDisplayName: "Host",
      hostColor: "blue" as never,
      setState: vi.fn(),
      update: vi.fn(),
      handleWsEvent: vi.fn(),
      handleHostData: vi.fn(),
      handleGuestData: vi.fn(),
      stopTimer: vi.fn(),
      rematchPendingRef,
      lastSyncReplyAtRef: { current: 0 },
      guestJoinedRef: { current: false },
      hostPendingSettingsRef,
      reconnectResetsRef: { current: { moveCount: -1 } },
      pendingGuestStateRef: { current: null as GameState | null },
    };
    return { deps, guestSymbolRef };
  }

  it("F241: clears stale pending identity settings on room entry", () => {
    const rematchPendingRef = { current: false };
    const hostPendingSettingsRef = {
      current: { displayName: "OldHost" } as PendingPlayerSettings,
    };
    joinAsGuest(
      lifecycleDeps(rematchPendingRef, hostPendingSettingsRef).deps,
      "ROOM42",
      "ws://127.0.0.1:1",
    );
    expect(hostPendingSettingsRef.current).toBeNull();
  });

  it("F252: guest resends join when the host reconnects and the game is still WAITING", () => {
    const { deps } = lifecycleDeps({ current: false });
    const captured: { handler?: (msg: { type: string }) => void } = {};
    vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
      (h) => {
        captured.handler = h;
      },
    );
    const send = vi
      .spyOn(RoomClient.prototype, "send")
      .mockReturnValue(true);
    buildRoomClient(deps, "ws://relay.test/room", "guest");
    // The F252 window: guest joined while the host was down — join fanned
    // out to zero peers, so the game never left WAITING.
    deps.stateRef.current = {
      ...deps.stateRef.current,
      gameStatus: GameStatus.WAITING,
    };
    send.mockClear();

    captured.handler?.({ type: "peer-reconnected" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "join" }),
    );
  });

  it("F252: an ACTIVE game does not resend join on peer-reconnected", () => {
    const { deps } = lifecycleDeps({ current: false });
    const captured: { handler?: (msg: { type: string }) => void } = {};
    vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
      (h) => {
        captured.handler = h;
      },
    );
    const send = vi
      .spyOn(RoomClient.prototype, "send")
      .mockReturnValue(true);
    buildRoomClient(deps, "ws://relay.test/room", "guest");
    send.mockClear();

    captured.handler?.({ type: "peer-reconnected" });
    expect(send).not.toHaveBeenCalled();
  });

  it("guest welcome mid-game wires sync_request BEFORE the auto join resend (combined reconnect path)", () => {
    const { deps } = lifecycleDeps({ current: false });
    const captured: {
      handler?: (msg: { type: string; [k: string]: unknown }) => void;
    } = {};
    vi.spyOn(RoomClient.prototype, "setMessageHandler").mockImplementation(
      (h) => {
        captured.handler = h;
      },
    );
    const send = vi
      .spyOn(RoomClient.prototype, "send")
      .mockReturnValue(true);
    // Wire the real relay-event path the composition root uses:
    // welcome → handleRelayEvent → requestSync → roomRef.send. The
    // message handler runs handleWsEvent BEFORE the auto-join send, so
    // the pull lands on the wire first — pin that order (review
    // 2026-10-03 P2).
    deps.handleWsEvent = (event) =>
      handleRelayEvent(
        {
          roomRef: deps.roomRef,
          stateRef: deps.stateRef,
          roleRef: deps.roleRef,
          hostSymbolRef: deps.hostSymbolRef,
          guestSymbolRef: deps.guestSymbolRef,
          rematchPendingRef: deps.rematchPendingRef,
          reconnectResetsRef: { current: { moveCount: -1 } },
          pausedRef: { current: false },
          setState: deps.setState,
          commitHostState: vi.fn(),
          broadcastGameState: vi.fn(),
          requestSync: () =>
            deps.roomRef.current?.send({ type: "sync_request" }) ?? false,
          startTimer: vi.fn(),
          stopTimer: vi.fn(),
          clearRematchTimeout: vi.fn(),
        },
        event,
      );
    buildRoomClient(deps, "ws://relay.test/room", "guest");
    // Mid-game guest state — this welcome is a REconnect, not a join.
    deps.stateRef.current = {
      ...deps.stateRef.current,
      gameStatus: GameStatus.ACTIVE,
    };
    send.mockClear();

    captured.handler?.({ type: "welcome", role: "guest", opponent: { guestId: "h", displayName: "Host" } });

    const types = send.mock.calls.map(
      ([m]) => (m as { type: string }).type,
    );
    expect(types).toEqual(["sync_request", "join"]);
  });

  it("clears the sync-pull gate + throttle on room entry (review 2026-10-03 repair P2)", () => {
    // A new room must not inherit the previous room's joined flag (a
    // never-joined peer would be served snapshots) or its reply
    // cooldown (the first legitimate pull would be dropped).
    const { deps } = lifecycleDeps({ current: false });
    deps.guestJoinedRef.current = true;
    deps.lastSyncReplyAtRef.current = performance.now();

    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");

    expect(deps.guestJoinedRef.current).toBe(false);
    expect(performance.now() - deps.lastSyncReplyAtRef.current).toBeGreaterThanOrEqual(
      SYNC_REPLY_COOLDOWN_MS,
    );
  });

  it("startAsHost clears the sync-pull gate + throttle for the new room", () => {
    const { deps } = lifecycleDeps({ current: false });
    deps.guestJoinedRef.current = true;
    deps.lastSyncReplyAtRef.current = performance.now();

    startAsHost(deps, "ROOM42", "ws://127.0.0.1:1");

    expect(deps.guestJoinedRef.current).toBe(false);
    expect(performance.now() - deps.lastSyncReplyAtRef.current).toBeGreaterThanOrEqual(
      SYNC_REPLY_COOLDOWN_MS,
    );
  });

  it("F362: room entry re-arms the reconnect-reset budget alongside the other room-scoped refs", () => {
    // Same leak class as guestJoinedRef/lastSyncReplyAtRef: the budget is
    // keyed on moveCount which restarts each game — a budget consumed in
    // the old room's last round must not carry into the new room.
    const { deps } = lifecycleDeps({ current: false });
    deps.reconnectResetsRef.current.moveCount = 5;

    startAsHost(deps, "ROOM42", "ws://127.0.0.1:1");
    expect(deps.reconnectResetsRef.current.moveCount).toBe(-1);

    deps.reconnectResetsRef.current.moveCount = 7;
    joinAsGuest(deps, "ROOM43", "ws://127.0.0.1:1");
    expect(deps.reconnectResetsRef.current.moveCount).toBe(-1);
  });

  it("clears a stale pending-rematch flag on room entry", () => {
    const rematchPendingRef = { current: true };
    joinAsGuest(lifecycleDeps(rematchPendingRef).deps, "ROOM42", "ws://127.0.0.1:1");
    expect(rematchPendingRef.current).toBe(false);
  });

  it("clears a stale guest symbol on room entry so a pre-join leave crowns nobody", () => {
    const { deps, guestSymbolRef } = lifecycleDeps({ current: false });
    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");
    expect(guestSymbolRef.current).toBeNull();
  });

  it("F275: resets the carried-over game state on room entry so a dead room's status cannot gate the new room", () => {
    const { deps } = lifecycleDeps({ current: false });
    deps.stateRef.current = {
      ...deps.stateRef.current,
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    };

    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");

    expect(deps.stateRef.current.gameStatus).toBe(GameStatus.WAITING);
    expect(deps.stateRef.current.winner).toBeNull();
    expect(deps.update).toHaveBeenCalledWith(
      expect.objectContaining({ gameState: deps.stateRef.current }),
    );
  });

  it("F275: drops the carried-over optimistic snapshot on room entry — it could resurrect the same stale state via a stray Invalid move", () => {
    const { deps } = lifecycleDeps({ current: false });
    deps.pendingGuestStateRef.current = {
      ...deps.stateRef.current,
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    };

    joinAsGuest(deps, "ROOM42", "ws://127.0.0.1:1");

    expect(deps.pendingGuestStateRef.current).toBeNull();
  });
});
