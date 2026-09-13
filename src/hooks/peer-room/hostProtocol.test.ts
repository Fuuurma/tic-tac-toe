import { describe, it, expect, vi } from "vitest";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/room";
import type { PeerRoomState } from "../usePeerRoom";
import { handleHostMessage, type HostProtocolDeps } from "./hostProtocol";

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

  it("leave clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "leave" });

    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });
});
