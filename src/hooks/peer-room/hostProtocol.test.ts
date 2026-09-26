import { describe, it, expect, vi } from "vitest";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/room";
import type { PeerRoomState } from "../usePeerRoom";
import { applyHostMove, handleHostMessage, type HostProtocolDeps } from "./hostProtocol";

// Regression pins for the rematch deadline wiring — every path that
// resolves a pending host rematch request must clear its timeout
// (fleet 09-13 finding: host waited forever on a silent guest).

function terminalGame(): GameState {
  return {
    ...freshGameState(),
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
  };
}

function makeDeps(game: GameState) {
  let roomState = { gameState: game } as PeerRoomState;
  const deps: HostProtocolDeps = {
    stateRef: { current: game },
    roomRef: { current: { send: vi.fn() } as unknown as RoomClient },
    hostSymbolRef: { current: PlayerSymbol.X },
    hostRematchPendingRef: { current: true },
    hostPendingSettingsRef: { current: null },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: (g) => {
      deps.stateRef.current = g;
      roomState = { ...roomState, gameState: g };
    },
    broadcastGameState: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

describe("handleHostMessage rematch deadline", () => {
  it("rematchAccept clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "rematchAccept" });

    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("rematchDecline clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "rematchDecline" });

    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("F254: a stray rematchDecline with no pending request writes nothing", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.hostRematchPendingRef.current = false;
    const before = getRoom().message;

    handleHostMessage(deps, { type: "rematchDecline" });

    expect(getRoom().message).toBe(before);
    expect(deps.clearRematchTimeout).not.toHaveBeenCalled();
  });

  it("leave clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "leave" });

    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("leave during WAITING does not crown a phantom host win (F146)", () => {
    const waiting: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.WAITING,
    };
    const { deps, getRoom } = makeDeps(waiting);

    handleHostMessage(deps, { type: "leave" });

    expect(getRoom().status).toBe("disconnected");
    expect(getRoom().gameState.winner).toBeNull();
    expect(getRoom().gameState.gameStatus).toBe(GameStatus.WAITING);
  });
});

describe("handleHostMessage invalid guest move", () => {
  it("replies 'Invalid move' so the guest rolls back its optimistic move", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.X, // host's turn — a guest move is illegal
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current).toBe(game);
    expect(deps.roomRef.current?.send).toHaveBeenCalledWith({
      type: "error",
      message: "Invalid move",
    });
  });

  it("does not send a wire error for the host's own rejected move", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O, // guest's turn — host move is illegal
    };
    const { deps } = makeDeps(game);

    applyHostMove(deps, 0, PlayerSymbol.X);

    expect(deps.stateRef.current).toBe(game);
    expect(deps.roomRef.current?.send).not.toHaveBeenCalled();
  });
});

describe("handleHostMessage unassigned host symbol", () => {
  it("rejects a guest move with an error so the guest rolls back (F159)", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O,
    };
    const { deps } = makeDeps(game);
    deps.hostSymbolRef.current = null;

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current).toBe(game);
    expect(deps.roomRef.current?.send).toHaveBeenCalledWith({
      type: "error",
      message: "Invalid move",
    });
  });

  it("answers a guest join with 'Room not ready' instead of a silent drop", () => {
    const { deps } = makeDeps(freshGameState());
    deps.hostSymbolRef.current = null;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });

    expect(deps.roomRef.current?.send).toHaveBeenCalledWith({
      type: "error",
      message: "Room not ready",
    });
  });
});
