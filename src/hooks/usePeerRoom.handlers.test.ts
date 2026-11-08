// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerMessage } from "@/lib/peer.wire";
import type { RoomClient } from "@/lib/roomClient";
import type { PeerRole } from "@/lib/room-protocol/state";
import {
  applyHostPauseFrame,
  applyIncomingReaction,
  applyLocalPause,
  applyRematchAccept,
  applyRematchCancel,
  applyRematchDecline,
  commitRoleMove,
  expireRematchRequest,
  handlePeerRoomEvent,
  leavePeerRoom,
  sendRematchRequest,
  sendSocialReaction,
  syncTurnTimer,
} from "./usePeerRoom";

/**
 * The handlers the hook used to inline. Each one is a pure function over an
 * explicit dependency bag, so the behaviour the hook depends on is pinned
 * here without rendering anything.
 */

const activeGame = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.ONLINE,
  gameStatus: GameStatus.ACTIVE,
  currentPlayer: PlayerSymbol.X,
  turnDeadlineAt: 5000,
});

const completedGame = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.ONLINE,
  gameStatus: GameStatus.COMPLETED,
  winner: PlayerSymbol.X,
});

const roomDouble = (sendResult = true) =>
  ({
    current: { send: vi.fn(() => sendResult) } as unknown as RoomClient,
  }) as { current: RoomClient | null };

afterEach(() => {
  vi.useRealTimers();
});

describe("reaction handlers", () => {
  it("accepts a reaction outside the cooldown window and stamps it", () => {
    const lastReactionRef = { current: 0 };
    const setReaction = vi.fn();
    const message: PeerMessage = { type: "social_reaction", id: "nice_move" };

    vi.useFakeTimers();
    vi.setSystemTime(5000);

    applyIncomingReaction({ lastReactionRef, setReaction }, message);

    expect(setReaction).toHaveBeenCalledWith({ id: "nice_move", at: 5000 });
    expect(lastReactionRef.current).toBe(5000);
  });

  it("ignores a reaction inside the cooldown window", () => {
    const lastReactionRef = { current: 4000 };
    const setReaction = vi.fn();

    vi.useFakeTimers();
    vi.setSystemTime(5000);

    applyIncomingReaction(
      { lastReactionRef, setReaction },
      { type: "social_reaction", id: "nice_move" },
    );

    expect(setReaction).not.toHaveBeenCalled();
    expect(lastReactionRef.current).toBe(4000);
  });

  it("ignores a message that is not a reaction", () => {
    const lastReactionRef = { current: 0 };
    const setReaction = vi.fn();

    applyIncomingReaction({ lastReactionRef, setReaction }, { type: "move", index: 0 });

    expect(setReaction).not.toHaveBeenCalled();
  });

  it("sends a reaction when connected and outside the cooldown window", () => {
    const roomRef = roomDouble();
    const lastSentReactionRef = { current: 0 };

    vi.useFakeTimers();
    vi.setSystemTime(5000);

    const sent = sendSocialReaction(
      { status: "connected", roomRef, lastSentReactionRef },
      "nice_move",
    );

    expect(sent).toBe(true);
    expect(roomRef.current?.send).toHaveBeenCalledWith({
      type: "social_reaction",
      id: "nice_move",
    });
    expect(lastSentReactionRef.current).toBe(5000);
  });

  it("refuses a reaction while disconnected and inside the cooldown window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(5000);

    const disconnectedRoom = roomDouble();
    expect(
      sendSocialReaction(
        { status: "disconnected", roomRef: disconnectedRoom, lastSentReactionRef: { current: 0 } },
        "nice_move",
      ),
    ).toBe(false);
    expect(disconnectedRoom.current?.send).not.toHaveBeenCalled();

    const coolingRoom = roomDouble();
    expect(
      sendSocialReaction(
        { status: "connected", roomRef: coolingRoom, lastSentReactionRef: { current: 4000 } },
        "nice_move",
      ),
    ).toBe(false);
    expect(coolingRoom.current?.send).not.toHaveBeenCalled();
  });
});

describe("applyLocalPause", () => {
  it("ignores a repeated pause so the clock is not frozen twice", () => {
    const deps = {
      pausedRef: { current: true },
      roleRef: { current: "host" as PeerRole },
      roomRef: roomDouble(),
      stateRef: { current: activeGame() },
      setState: vi.fn(),
      setPausedState: vi.fn(),
      stopTimer: vi.fn(),
      broadcastGameState: vi.fn(),
    };

    applyLocalPause(deps, true);

    expect(deps.setPausedState).not.toHaveBeenCalled();
    expect(deps.stopTimer).not.toHaveBeenCalled();
  });

  it("freezes the clock and tells the guest when the host pauses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const game = activeGame();
    const deps = {
      pausedRef: { current: false },
      roleRef: { current: "host" as PeerRole },
      roomRef: roomDouble(),
      stateRef: { current: game },
      setState: vi.fn(),
      setPausedState: vi.fn(),
      stopTimer: vi.fn(),
      broadcastGameState: vi.fn(),
    };

    applyLocalPause(deps, true);

    expect(deps.pausedRef.current).toBe(true);
    expect(deps.setPausedState).toHaveBeenCalledWith(true);
    expect(deps.roomRef.current?.send).toHaveBeenCalledWith({ type: "pause", paused: true });
    expect(deps.stopTimer).toHaveBeenCalled();
    expect(deps.stateRef.current.turnTimeRemaining).toBe(4000);
    expect(deps.broadcastGameState).not.toHaveBeenCalled();
  });

  it("rebuilds the deadline and broadcasts when the host resumes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const game = { ...activeGame(), turnTimeRemaining: 4000 };
    const deps = {
      pausedRef: { current: true },
      roleRef: { current: "host" as PeerRole },
      roomRef: roomDouble(),
      stateRef: { current: game },
      setState: vi.fn(),
      setPausedState: vi.fn(),
      stopTimer: vi.fn(),
      broadcastGameState: vi.fn(),
    };

    applyLocalPause(deps, false);

    expect(deps.pausedRef.current).toBe(false);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(5000);
    expect(deps.broadcastGameState).toHaveBeenCalledWith(
      expect.objectContaining({ turnDeadlineAt: 5000 }),
    );
  });

  it("never rebuilds the deadline for a guest resume (F226)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const game = { ...activeGame(), turnTimeRemaining: 4000 };
    const deps = {
      pausedRef: { current: true },
      roleRef: { current: "guest" as PeerRole },
      roomRef: roomDouble(),
      stateRef: { current: game },
      setState: vi.fn(),
      setPausedState: vi.fn(),
      stopTimer: vi.fn(),
      broadcastGameState: vi.fn(),
    };

    applyLocalPause(deps, false);

    expect(deps.stateRef.current.turnDeadlineAt).toBe(5000);
    expect(deps.broadcastGameState).not.toHaveBeenCalled();
  });

  it("does not touch the clock when the game is not active", () => {
    const deps = {
      pausedRef: { current: false },
      roleRef: { current: "host" as PeerRole },
      roomRef: roomDouble(),
      stateRef: { current: freshGameState() },
      setState: vi.fn(),
      setPausedState: vi.fn(),
      stopTimer: vi.fn(),
      broadcastGameState: vi.fn(),
    };

    applyLocalPause(deps, true);

    expect(deps.setPausedState).toHaveBeenCalledWith(true);
    expect(deps.stopTimer).not.toHaveBeenCalled();
  });
});

describe("applyHostPauseFrame", () => {
  it("ignores a repeated frame", () => {
    const deps = {
      hostPausedRef: { current: true },
      stateRef: { current: activeGame() },
      setState: vi.fn(),
      setHostPausedState: vi.fn(),
      stopTimer: vi.fn(),
    };

    applyHostPauseFrame(deps, true);

    expect(deps.setHostPausedState).not.toHaveBeenCalled();
    expect(deps.stopTimer).not.toHaveBeenCalled();
  });

  it("freezes the countdown and mirrors the flag on a host pause", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const deps = {
      hostPausedRef: { current: false },
      stateRef: { current: activeGame() },
      setState: vi.fn(),
      setHostPausedState: vi.fn(),
      stopTimer: vi.fn(),
    };

    applyHostPauseFrame(deps, true);

    expect(deps.hostPausedRef.current).toBe(true);
    expect(deps.setHostPausedState).toHaveBeenCalledWith(true);
    expect(deps.stopTimer).toHaveBeenCalled();
    expect(deps.setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("leaves the deadline alone when the host resumes", () => {
    const game = activeGame();
    const deps = {
      hostPausedRef: { current: true },
      stateRef: { current: game },
      setState: vi.fn(),
      setHostPausedState: vi.fn(),
      stopTimer: vi.fn(),
    };

    applyHostPauseFrame(deps, false);

    expect(deps.hostPausedRef.current).toBe(false);
    expect(deps.setHostPausedState).toHaveBeenCalledWith(false);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(game.turnDeadlineAt);
    expect(deps.setState).not.toHaveBeenCalled();
  });
});

describe("commitRoleMove", () => {
  it("refuses every move while the clock is frozen", () => {
    const applyHostMove = vi.fn();
    const deps = {
      role: "host" as PeerRole,
      status: "connected" as const,
      pausedRef: { current: true },
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbol: null,
      roomRef: roomDouble(),
      stateRef: { current: activeGame() },
      pendingGuestStateRef: { current: null as GameState | null },
      setState: vi.fn(),
      applyHostMove,
    };

    commitRoleMove(deps, 0);

    expect(applyHostMove).not.toHaveBeenCalled();
  });

  it("applies a host move with the host symbol", () => {
    const applyHostMove = vi.fn();
    const deps = {
      role: "host" as PeerRole,
      status: "connected" as const,
      pausedRef: { current: false },
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbol: null,
      roomRef: roomDouble(),
      stateRef: { current: activeGame() },
      pendingGuestStateRef: { current: null as GameState | null },
      setState: vi.fn(),
      applyHostMove,
    };

    commitRoleMove(deps, 4);

    expect(applyHostMove).toHaveBeenCalledWith(4, PlayerSymbol.X);
  });

  it("refuses a host move while the socket is down", () => {
    const applyHostMove = vi.fn();
    const deps = {
      role: "host" as PeerRole,
      status: "reconnecting" as const,
      pausedRef: { current: false },
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbol: null,
      roomRef: roomDouble(),
      stateRef: { current: activeGame() },
      pendingGuestStateRef: { current: null as GameState | null },
      setState: vi.fn(),
      applyHostMove,
    };

    commitRoleMove(deps, 4);

    expect(applyHostMove).not.toHaveBeenCalled();
  });

  it("dispatches an optimistic guest move", () => {
    const game = { ...activeGame(), currentPlayer: PlayerSymbol.O };
    const roomRef = roomDouble();
    const deps = {
      role: "guest" as PeerRole,
      status: "connected" as const,
      pausedRef: { current: false },
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbol: PlayerSymbol.O,
      roomRef,
      stateRef: { current: game },
      pendingGuestStateRef: { current: null as GameState | null },
      setState: vi.fn(),
      applyHostMove: vi.fn(),
    };

    commitRoleMove(deps, 0);

    expect(roomRef.current?.send).toHaveBeenCalledWith({ type: "move", index: 0 });
    expect(deps.stateRef.current.board[0]).toBe(PlayerSymbol.O);
  });
});

describe("rematch handlers", () => {
  it("sends the request, arms the timeout and updates the message", () => {
    vi.useFakeTimers();

    const roomRef = roomDouble();
    const rematchPendingRef = { current: false };
    const rematchTimeoutRef = { current: null as number | null };
    const clearRematchTimeout = vi.fn();
    const setState = vi.fn();

    sendRematchRequest({
      role: "host",
      status: "connected",
      gameState: completedGame(),
      rematchIncoming: false,
      rematchPendingRef,
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbolRef: { current: null },
      roomRef,
      rematchTimeoutRef,
      setState,
      clearRematchTimeout,
      expireRematch: vi.fn(),
    });

    expect(rematchPendingRef.current).toBe(true);
    expect(roomRef.current?.send).toHaveBeenCalledWith({
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.X,
    });
    expect(clearRematchTimeout).toHaveBeenCalled();
    expect(rematchTimeoutRef.current).not.toBeNull();
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("refuses a request while the game is still running", () => {
    const roomRef = roomDouble();
    const rematchPendingRef = { current: false };

    sendRematchRequest({
      role: "host",
      status: "connected",
      gameState: activeGame(),
      rematchIncoming: false,
      rematchPendingRef,
      hostSymbolRef: { current: PlayerSymbol.X },
      guestSymbolRef: { current: null },
      roomRef,
      rematchTimeoutRef: { current: null },
      setState: vi.fn(),
      clearRematchTimeout: vi.fn(),
      expireRematch: vi.fn(),
    });

    expect(roomRef.current?.send).not.toHaveBeenCalled();
    expect(rematchPendingRef.current).toBe(false);
  });

  it("accepts a guest request locally on the host", () => {
    const acceptIncomingRematch = vi.fn();
    const roomRef = roomDouble();

    applyRematchAccept({
      role: "host",
      status: "connected",
      gameState: completedGame(),
      rematchIncoming: true,
      roomRef,
      setState: vi.fn(),
      acceptIncomingRematch,
    });

    expect(acceptIncomingRematch).toHaveBeenCalled();
    expect(roomRef.current?.send).not.toHaveBeenCalled();
  });

  it("asks the host when a guest accepts", () => {
    const acceptIncomingRematch = vi.fn();
    const roomRef = roomDouble();
    const setState = vi.fn();

    applyRematchAccept({
      role: "guest",
      status: "connected",
      gameState: completedGame(),
      rematchIncoming: true,
      roomRef,
      setState,
      acceptIncomingRematch,
    });

    expect(roomRef.current?.send).toHaveBeenCalledWith({ type: "rematchAccept" });
    expect(acceptIncomingRematch).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("refuses an accept when nothing is incoming", () => {
    const acceptIncomingRematch = vi.fn();
    const roomRef = roomDouble();

    applyRematchAccept({
      role: "host",
      status: "connected",
      gameState: completedGame(),
      rematchIncoming: false,
      roomRef,
      setState: vi.fn(),
      acceptIncomingRematch,
    });

    expect(acceptIncomingRematch).not.toHaveBeenCalled();
    expect(roomRef.current?.send).not.toHaveBeenCalled();
  });

  it("declines an incoming request", () => {
    const roomRef = roomDouble();
    const setState = vi.fn();

    applyRematchDecline({ rematchIncoming: true, roomRef, setState });

    expect(roomRef.current?.send).toHaveBeenCalledWith({ type: "rematchDecline" });
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does nothing when there is no incoming request to decline", () => {
    const roomRef = roomDouble();
    const setState = vi.fn();

    applyRematchDecline({ rematchIncoming: false, roomRef, setState });

    expect(roomRef.current?.send).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it("cancels an outgoing request", () => {
    const roomRef = roomDouble();
    const rematchPendingRef = { current: true };
    const clearRematchTimeout = vi.fn();
    const setState = vi.fn();

    applyRematchCancel({ rematchPendingRef, roomRef, setState, clearRematchTimeout });

    expect(rematchPendingRef.current).toBe(false);
    expect(clearRematchTimeout).toHaveBeenCalled();
    expect(roomRef.current?.send).toHaveBeenCalledWith({ type: "rematchCancel" });
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does nothing when there is no outgoing request to cancel", () => {
    const roomRef = roomDouble();
    const clearRematchTimeout = vi.fn();

    applyRematchCancel({
      rematchPendingRef: { current: false },
      roomRef,
      setState: vi.fn(),
      clearRematchTimeout,
    });

    expect(roomRef.current?.send).not.toHaveBeenCalled();
    expect(clearRematchTimeout).not.toHaveBeenCalled();
  });

  it("expires a pending request and tells the guest", () => {
    const roomRef = roomDouble();
    const rematchPendingRef = { current: true };
    const rematchTimeoutRef = { current: 1234 };
    const setState = vi.fn();

    expireRematchRequest({ rematchTimeoutRef, rematchPendingRef, roomRef, setState });

    expect(rematchTimeoutRef.current).toBeNull();
    expect(rematchPendingRef.current).toBe(false);
    expect(roomRef.current?.send).toHaveBeenCalledWith({ type: "rematchCancel" });
    expect(setState).toHaveBeenCalledWith(expect.any(Function));
  });

  it("expires nothing when no request is pending", () => {
    const roomRef = roomDouble();
    const rematchTimeoutRef = { current: 1234 };
    const setState = vi.fn();

    expireRematchRequest({
      rematchTimeoutRef,
      rematchPendingRef: { current: false },
      roomRef,
      setState,
    });

    expect(rematchTimeoutRef.current).toBeNull();
    expect(roomRef.current?.send).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });
});

describe("handlePeerRoomEvent", () => {
  it("clears the reaction overlay when the peer left and forwards the event", () => {
    const setReaction = vi.fn();
    const handleRelayEvent = vi.fn();

    handlePeerRoomEvent({ setReaction, handleRelayEvent }, { type: "peer-left" });

    expect(setReaction).toHaveBeenCalledWith(null);
    expect(handleRelayEvent).toHaveBeenCalledWith({ type: "peer-left" });
  });

  it("keeps the reaction overlay for other events", () => {
    const setReaction = vi.fn();
    const handleRelayEvent = vi.fn();

    handlePeerRoomEvent({ setReaction, handleRelayEvent }, { type: "state_snapshot" });

    expect(setReaction).not.toHaveBeenCalled();
    expect(handleRelayEvent).toHaveBeenCalledWith({ type: "state_snapshot" });
  });
});

describe("leavePeerRoom", () => {
  it("tears the room down, clears the pause flags and marks the state", () => {
    const setReaction = vi.fn();
    const teardown = vi.fn();
    const resetRoomScopedRefs = vi.fn();
    const setState = vi.fn();
    const pausedRef = { current: true };
    const hostPausedRef = { current: true };
    const setPausedState = vi.fn();
    const setHostPausedState = vi.fn();

    leavePeerRoom({
      setReaction,
      teardown,
      pausedRef,
      setPausedState,
      hostPausedRef,
      setHostPausedState,
      resetRoomScopedRefs,
      setState,
    });

    expect(setReaction).toHaveBeenCalledWith(null);
    expect(teardown).toHaveBeenCalled();
    expect(pausedRef.current).toBe(false);
    expect(setPausedState).toHaveBeenCalledWith(false);
    expect(hostPausedRef.current).toBe(false);
    expect(setHostPausedState).toHaveBeenCalledWith(false);
    expect(resetRoomScopedRefs).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith(expect.any(Function));

    const patch = setState.mock.calls[0]![0] as (prev: unknown) => Record<string, unknown>;
    expect(patch({})).toMatchObject({
      status: "disconnected",
      queue: "none",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: true,
    });
  });
});

describe("syncTurnTimer", () => {
  it("starts the timer when the game is live and stops it otherwise", () => {
    const startTimer = vi.fn();
    const stopTimer = vi.fn();

    syncTurnTimer(true, startTimer, stopTimer);
    expect(startTimer).toHaveBeenCalled();
    expect(stopTimer).not.toHaveBeenCalled();

    syncTurnTimer(false, startTimer, stopTimer);
    expect(stopTimer).toHaveBeenCalled();
  });
});
