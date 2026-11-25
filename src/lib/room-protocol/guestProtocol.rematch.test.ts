import { describe, it, expect, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerRoomState } from "./state";
import { handleGuestMessage, type GuestProtocolDeps } from "./guestProtocol";

function terminalGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Host",
      playerOName: "Guest",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
      humanSymbol: PlayerSymbol.X,
    }),
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
    winningCombination: [0, 1, 2],
    board: [
      PlayerSymbol.X,
      PlayerSymbol.X,
      PlayerSymbol.X,
      PlayerSymbol.O,
      PlayerSymbol.O,
      null,
      null,
      null,
      null,
    ],
    moves: { X: [0, 1, 2], O: [3, 4] },
    moveCount: 5,
    ...overrides,
  };
}

function makeDeps(game: GameState, roomInit: Partial<PeerRoomState> = {}) {
  let roomState = { gameState: game, status: "connected", ...roomInit } as PeerRoomState;
  const deps: GuestProtocolDeps = {
    stateRef: { current: game },
    guestSymbolRef: { current: PlayerSymbol.O },
    pendingGuestStateRef: { current: null },
    rematchPendingRef: { current: false },
    syncPendingRef: { current: false },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
    onHostPause: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

function withOutgoingRequest(deps: GuestProtocolDeps) {
  deps.rematchPendingRef.current = true;
}

describe("handleGuestMessage rematchDecline", () => {
  it("clears the outgoing request, cancels the expiry timer and reports the decline", () => {
    const { deps, getRoom } = makeDeps(terminalGame(), {
      rematchOutgoing: true,
      messageKey: "peer.waitingAccept",
    });
    withOutgoingRequest(deps);

    handleGuestMessage(deps, { type: "rematchDecline" });

    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
    expect(getRoom().rematchOutgoing).toBe(false);
    expect(getRoom().messageKey).toBe("peer.rematchDeclined");
  });

  it("lets the guest answer the next host rematch request", () => {
    const { deps, getRoom } = makeDeps(terminalGame(), {
      rematchOutgoing: true,
      messageKey: "peer.waitingAccept",
    });
    withOutgoingRequest(deps);

    handleGuestMessage(deps, { type: "rematchDecline" });
    handleGuestMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.X,
    });

    expect(getRoom().rematchIncoming).toBe(true);
  });

  it("ignores a stray decline with no outgoing request", () => {
    const { deps, getRoom } = makeDeps(terminalGame(), {
      rematchOutgoing: false,
      messageKey: null,
    });

    handleGuestMessage(deps, { type: "rematchDecline" });

    expect(getRoom().messageKey).toBeNull();
    expect(getRoom().rematchOutgoing).toBe(false);
    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).not.toHaveBeenCalled();
  });
});

describe("handleGuestMessage host leave", () => {
  it("clears the outgoing request and cancels the expiry timer over the host-left notice", () => {
    const { deps, getRoom } = makeDeps(terminalGame(), {
      rematchOutgoing: true,
      messageKey: "peer.waitingAccept",
    });
    withOutgoingRequest(deps);

    handleGuestMessage(deps, { type: "leave" });

    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
    expect(getRoom().rematchOutgoing).toBe(false);
    expect(getRoom().messageKey).toBe("peer.hostLeft");
  });
});
