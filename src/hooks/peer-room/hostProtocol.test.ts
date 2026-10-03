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
    guestRematchPendingRef: { current: false },
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
    armRematchTimeout: vi.fn(),
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

describe("handleHostMessage guest-initiated rematch ask", () => {
  it("records the ask + prompts the host instead of starting", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.hostRematchPendingRef.current = false;

    handleHostMessage(deps, { type: "rematchAccept" });

    expect(deps.guestRematchPendingRef.current).toBe(true);
    expect(deps.armRematchTimeout).toHaveBeenCalledOnce();
    expect(getRoom().message).toBe("Guest wants a rematch. Click Play Again to start.");
    // No game started: nothing sent on the wire.
    const send = deps.roomRef.current?.send as ReturnType<typeof vi.fn>;
    expect(send).not.toHaveBeenCalled();
  });

  it("ignores a guest ask while the game is still live", () => {
    const { deps } = makeDeps({ ...freshGameState(), gameStatus: GameStatus.ACTIVE, winner: null });
    deps.hostRematchPendingRef.current = false;

    handleHostMessage(deps, { type: "rematchAccept" });

    expect(deps.guestRematchPendingRef.current).toBe(false);
    expect(deps.armRematchTimeout).not.toHaveBeenCalled();
  });

  it("accept with a host request pending starts and clears the guest ask too", () => {
    const { deps } = makeDeps(terminalGame());
    deps.guestRematchPendingRef.current = true;

    handleHostMessage(deps, { type: "rematchAccept" });

    const send = deps.roomRef.current?.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].type).toBe("gameStart");
    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.guestRematchPendingRef.current).toBe(false);
  });

  it("rematchDecline clears a guest ask", () => {
    const { deps } = makeDeps(terminalGame());
    deps.hostRematchPendingRef.current = false;
    deps.guestRematchPendingRef.current = true;

    handleHostMessage(deps, { type: "rematchDecline" });

    expect(deps.guestRematchPendingRef.current).toBe(false);
  });

  it("leave clears a guest ask", () => {
    const { deps } = makeDeps(terminalGame());
    deps.hostRematchPendingRef.current = false;
    deps.guestRematchPendingRef.current = true;

    handleHostMessage(deps, { type: "leave" });

    expect(deps.guestRematchPendingRef.current).toBe(false);
  });
});
