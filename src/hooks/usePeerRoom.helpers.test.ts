import { describe, expect, it, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
  TURN_DURATION_MS,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerMessage } from "@/lib/peer.wire";
import type { RoomClient } from "@/lib/roomClient";
import type { PendingPlayerSettings } from "./usePeerRoom";
import {
  canAcceptRematch,
  canRequestRematch,
  canSendHostMove,
  canSendReaction,
  clearTimerRef,
  clearWaitingForHost,
  dispatchGuestMove,
  freezeGameState,
  isRematchEligibleGame,
  rebuildDeadlineGameState,
  resetRoomScopedRefs,
  shouldAcceptReaction,
  shouldRunTurnTimer,
  teardownActiveRoom,
  SOCIAL_COOLDOWN_MS,
} from "./usePeerRoom";

describe("usePeerRoom helpers", () => {
  describe("freezeGameState & rebuildDeadlineGameState", () => {
    it("preserves state when turnDeadlineAt is undefined", () => {
      const state = freshGameState();
      expect(freezeGameState(state, 1000)).toBe(state);
      expect(rebuildDeadlineGameState(state, 1000)).toBe(state);
    });

    it("freezes remaining turn time using current timestamp", () => {
      const state: GameState = {
        ...freshGameState(),
        turnDeadlineAt: 5000,
      };
      const frozen = freezeGameState(state, 3000);
      expect(frozen.turnTimeRemaining).toBe(2000);
      expect(frozen.turnDeadlineAt).toBe(5000);
    });

    it("rebuilds absolute turn deadline from remaining time", () => {
      const state: GameState = {
        ...freshGameState(),
        turnDeadlineAt: 5000,
        turnTimeRemaining: 4000,
      };
      const rebuilt = rebuildDeadlineGameState(state, 10000);
      expect(rebuilt.turnDeadlineAt).toBe(14000);
    });
  });

  describe("canSendHostMove", () => {
    it("allows move only when connected and host symbol is assigned", () => {
      expect(canSendHostMove("connected", PlayerSymbol.X)).toBe(true);
      expect(canSendHostMove("connected", null)).toBe(false);
      expect(canSendHostMove("reconnecting", PlayerSymbol.X)).toBe(false);
      expect(canSendHostMove("disconnected", PlayerSymbol.X)).toBe(false);
    });
  });

  describe("dispatchGuestMove", () => {
    it("returns false if guest symbol is null", () => {
      const stateRef = { current: freshGameState() };
      const roomRef = { current: { send: vi.fn() } as unknown as RoomClient };
      const pendingGuestStateRef = { current: null };
      const setState = vi.fn();

      const result = dispatchGuestMove(
        { roomRef, stateRef, pendingGuestStateRef, setState },
        0,
        null,
      );

      expect(result).toBe(false);
      expect(roomRef.current.send).not.toHaveBeenCalled();
    });

    it("returns false if move is rejected by rules", () => {
      const game: GameState = {
        ...freshGameState(),
        currentPlayer: PlayerSymbol.X, // guest is O
      };
      const stateRef = { current: game };
      const roomRef = { current: { send: vi.fn() } as unknown as RoomClient };
      const pendingGuestStateRef = { current: null };
      const setState = vi.fn();

      const result = dispatchGuestMove(
        { roomRef, stateRef, pendingGuestStateRef, setState },
        0,
        PlayerSymbol.O,
      );

      expect(result).toBe(false);
      expect(roomRef.current.send).not.toHaveBeenCalled();
    });

    it("returns false if socket send fails", () => {
      const game: GameState = {
        ...freshGameState(),
        gameStatus: GameStatus.ACTIVE,
        currentPlayer: PlayerSymbol.O,
      };
      const stateRef = { current: game };
      const roomRef = {
        current: { send: vi.fn(() => false) } as unknown as RoomClient,
      };
      const pendingGuestStateRef = { current: null };
      const setState = vi.fn();

      const result = dispatchGuestMove(
        { roomRef, stateRef, pendingGuestStateRef, setState },
        0,
        PlayerSymbol.O,
      );

      expect(result).toBe(false);
      expect(roomRef.current.send).toHaveBeenCalledWith({ type: "move", index: 0 });
      expect(pendingGuestStateRef.current).toBeNull();
    });

    it("dispatches optimistic move and preserves initial rollback snapshot", () => {
      const initialGame: GameState = {
        ...freshGameState(),
        gameStatus: GameStatus.ACTIVE,
        currentPlayer: PlayerSymbol.O,
      };
      const stateRef = { current: initialGame };
      const roomRef = {
        current: { send: vi.fn(() => true) } as unknown as RoomClient,
      };
      const pendingGuestStateRef = { current: null as GameState | null };
      const setState = vi.fn();

      const success = dispatchGuestMove(
        { roomRef, stateRef, pendingGuestStateRef, setState },
        4,
        PlayerSymbol.O,
      );

      expect(success).toBe(true);
      expect(roomRef.current.send).toHaveBeenCalledWith({ type: "move", index: 4 });
      expect(pendingGuestStateRef.current).toBe(initialGame);
      expect(stateRef.current.board[4]).toBe(PlayerSymbol.O);
      expect(setState).toHaveBeenCalledWith(expect.any(Function));

      // Second move does not overwrite the rollback snapshot
      dispatchGuestMove(
        { roomRef, stateRef, pendingGuestStateRef, setState },
        0,
        PlayerSymbol.O,
      );
      expect(pendingGuestStateRef.current).toBe(initialGame);
    });
  });

  describe("rematch eligibility predicates", () => {
    const completedGame: GameState = {
      ...freshGameState(),
      gameMode: GameModes.ONLINE,
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    };

    it("evaluates isRematchEligibleGame correctly", () => {
      expect(isRematchEligibleGame(completedGame)).toBe(true);
      expect(
        isRematchEligibleGame({
          ...completedGame,
          gameStatus: GameStatus.ACTIVE,
        }),
      ).toBe(false);
      expect(
        isRematchEligibleGame({
          ...completedGame,
          winner: null,
        }),
      ).toBe(false);
    });

    it("evaluates canRequestRematch correctly", () => {
      expect(
        canRequestRematch("connected", completedGame, false, false, PlayerSymbol.X),
      ).toBe(true);
      expect(
        canRequestRematch("disconnected", completedGame, false, false, PlayerSymbol.X),
      ).toBe(false);
      expect(
        canRequestRematch("connected", completedGame, true, false, PlayerSymbol.X),
      ).toBe(false);
      expect(
        canRequestRematch("connected", completedGame, false, true, PlayerSymbol.X),
      ).toBe(false);
      expect(
        canRequestRematch("connected", completedGame, false, false, null),
      ).toBe(false);
    });

    it("evaluates canAcceptRematch correctly", () => {
      expect(canAcceptRematch("connected", completedGame, true)).toBe(true);
      expect(canAcceptRematch("disconnected", completedGame, true)).toBe(false);
      expect(canAcceptRematch("connected", completedGame, false)).toBe(false);
      expect(
        canAcceptRematch("connected", { ...completedGame, winner: null }, true),
      ).toBe(false);
    });
  });

  describe("timer cleanup helpers", () => {
    it("clearTimerRef clears and nulls active timeout", () => {
      const timer = setTimeout(() => {}, 10_000);
      const ref = { current: timer };
      clearTimerRef(ref);
      expect(ref.current).toBeNull();
    });

    it("clearWaitingForHost clears timer and nulls deadline timestamp", () => {
      const timer = setTimeout(() => {}, 10_000);
      const timeoutRef = { current: timer };
      const deadlineRef = { current: 12345 };
      clearWaitingForHost(timeoutRef, deadlineRef);
      expect(timeoutRef.current).toBeNull();
      expect(deadlineRef.current).toBeNull();
    });
  });

  describe("resetRoomScopedRefs", () => {
    it("resets all protocol refs to clean initial state", () => {
      const dummySettings: PendingPlayerSettings = {
        displayName: "Alice",
        color: Color.BLUE,
        playerShape: SymbolShape.O,
      };
      const refs = {
        guestJoinedRef: { current: true },
        lastSyncReplyAtRef: { current: 5000 },
        hostPendingSettingsRef: { current: dummySettings },
        reconnectResetsRef: { current: { moveCount: 5 } },
        pendingGuestStateRef: { current: freshGameState() },
        syncPendingRef: { current: true },
      };

      resetRoomScopedRefs(refs);

      expect(refs.guestJoinedRef.current).toBe(false);
      expect(refs.lastSyncReplyAtRef.current).toBeLessThan(0);
      expect(refs.hostPendingSettingsRef.current).toBeNull();
      expect(refs.reconnectResetsRef.current.moveCount).toBe(-1);
      expect(refs.pendingGuestStateRef.current).toBeNull();
      expect(refs.syncPendingRef.current).toBe(false);
    });
  });

  describe("teardownActiveRoom", () => {
    it("abandons ticket, resets flags, clears timers, closes room, and stops timer", () => {
      const roomRef = {
        current: { send: vi.fn(), close: vi.fn() } as unknown as RoomClient,
      };
      const matchmakingTicketRef = { current: "ticket-1" };
      const hasStartedRef = { current: true };
      const rematchPendingRef = { current: true };
      const quickMatchHostRef = { current: true };
      const rematchTimeoutRef = { current: setTimeout(() => {}, 1000) };
      const waitingForHostTimeoutRef = { current: setTimeout(() => {}, 1000) };
      const waitingForHostDeadlineAtRef = { current: 9999 };
      const stopTimer = vi.fn();

      teardownActiveRoom(
        {
          roomRef,
          matchmakingTicketRef,
          hasStartedRef,
          rematchPendingRef,
          quickMatchHostRef,
          rematchTimeoutRef,
          waitingForHostTimeoutRef,
          waitingForHostDeadlineAtRef,
          stopTimer,
        },
        "test teardown",
      );

      expect(matchmakingTicketRef.current).toBeNull();
      expect(hasStartedRef.current).toBe(false);
      expect(rematchPendingRef.current).toBe(false);
      expect(quickMatchHostRef.current).toBe(false);
      expect(rematchTimeoutRef.current).toBeNull();
      expect(waitingForHostTimeoutRef.current).toBeNull();
      expect(waitingForHostDeadlineAtRef.current).toBeNull();
      expect(roomRef.current).toBeNull();
      expect(stopTimer).toHaveBeenCalled();
    });
  });

  describe("social reactions helpers", () => {
    it("checks canSendReaction rate limit and status", () => {
      expect(SOCIAL_COOLDOWN_MS).toBe(3000);
      expect(canSendReaction("connected", 0, 3000)).toBe(true);
      expect(canSendReaction("connected", 1000, 3000)).toBe(false);
      expect(canSendReaction("disconnected", 0, 3000)).toBe(false);
    });

    it("checks shouldAcceptReaction message type and rate limit", () => {
      const reactionMsg: PeerMessage = { type: "social_reaction", id: "nice_move" };
      const moveMsg: PeerMessage = { type: "move", index: 0 };

      expect(shouldAcceptReaction(reactionMsg, 0, 3000)).toBe(true);
      expect(shouldAcceptReaction(reactionMsg, 1000, 3000)).toBe(false);
      expect(shouldAcceptReaction(moveMsg, 0, 3000)).toBe(false);
    });
  });

  describe("shouldRunTurnTimer", () => {
    const activeGame: GameState = {
      ...freshGameState(),
      gameMode: GameModes.ONLINE,
      gameStatus: GameStatus.ACTIVE,
      winner: null,
      turnDeadlineAt: Date.now() + TURN_DURATION_MS,
    };

    it("returns true only when game is active, connected, and unpaused for host or guest", () => {
      expect(shouldRunTurnTimer("host", "connected", false, false, activeGame)).toBe(true);
      expect(shouldRunTurnTimer("guest", "connected", false, false, activeGame)).toBe(true);
      expect(shouldRunTurnTimer(null, "connected", false, false, activeGame)).toBe(false);
      expect(shouldRunTurnTimer("host", "reconnecting", false, false, activeGame)).toBe(false);
      expect(shouldRunTurnTimer("host", "connected", true, false, activeGame)).toBe(false);
      expect(shouldRunTurnTimer("host", "connected", false, true, activeGame)).toBe(false);
      expect(
        shouldRunTurnTimer("host", "connected", false, false, {
          ...activeGame,
          gameStatus: GameStatus.COMPLETED,
          winner: PlayerSymbol.X,
        }),
      ).toBe(false);
    });
  });
});
