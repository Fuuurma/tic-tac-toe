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

describe("handleHostMessage sync_request (DST-04 reconnect contract)", () => {
  it("replies state_snapshot with the wire state (deadline stripped)", () => {
    const game = {
      ...terminalGame(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
      turnDeadlineAt: Date.now() + 5_000,
      turnTimeRemaining: 5_000,
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).toHaveBeenCalledTimes(1);
    const frame = (deps.roomRef.current!.send as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { type: string; gameState: GameState };
    expect(frame.type).toBe("state_snapshot");
    expect(frame.gameState.turnDeadlineAt).toBeUndefined();
    expect(frame.gameState.turnTimeRemaining).toBeGreaterThanOrEqual(0);
    // Read-only contract: host state is untouched by the request.
    expect(deps.stateRef.current).toBe(game);
  });
});

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
