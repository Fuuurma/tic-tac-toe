import { describe, it, expect, vi } from "vitest";
import {
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerRole } from "../usePeerRoom";
import type { PeerRoomState } from "../usePeerRoom";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";

// Regression pins for the peer-reconnected state machine — the fleet's
// most-fixed surface (host deadline reset, guest resync, lobby stranding).

function activeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...freshGameState(),
    gameStatus: GameStatus.ACTIVE,
    moveCount: 2,
    turnTimeRemaining: 12_000,
    turnDeadlineAt: Date.now() - 60_000, // stale — deadline pre-disconnect
    ...overrides,
  };
}

function makeDeps(game: GameState, role: PeerRole) {
  let roomState = { gameState: game } as PeerRoomState;
  const calls = { committed: [] as GameState[], broadcasts: [] as GameState[] };
  const deps: RelayEventDeps = {
    stateRef: { current: game },
    roleRef: { current: role },
    hostSymbolRef: { current: PlayerSymbol.X },
    guestSymbolRef: { current: PlayerSymbol.O },
    hostRematchPendingRef: { current: false },
    reconnectResetsRef: { current: { moveCount: -1 } },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: (g) => {
      calls.committed.push(g);
      deps.stateRef.current = g; // mirrors the real hook — commit updates the ref
      roomState = { ...roomState, gameState: g };
    },
    broadcastGameState: (g) => void calls.broadcasts.push(g),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
  };
  return { deps, calls, getRoom: () => roomState };
}

describe("handleRelayEvent peer-reconnected", () => {
  it("guest resynthesizes turnDeadlineAt from remaining time", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "guest");
    const before = Date.now();

    handleRelayEvent(deps, { type: "peer-reconnected" });

    const next = deps.stateRef.current;
    expect(next.turnDeadlineAt).toBeGreaterThanOrEqual(before + 12_000);
    expect(next.turnDeadlineAt).toBeLessThanOrEqual(Date.now() + 12_000 + 500);
    expect(next.turnDeadlineAt).not.toBe(game.turnDeadlineAt);
    expect(getRoom().gameState).toBe(next);
    expect(deps.startTimer).toHaveBeenCalledOnce();
  });

  it("guest with inactive game does not resync the deadline", () => {
    const game = activeGame({ gameStatus: GameStatus.WAITING });
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(deps.stateRef.current).toBe(game);
    expect(deps.startTimer).not.toHaveBeenCalled();
  });

  it("host resets the deadline once per move and commits", () => {
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    const before = Date.now();

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(calls.committed).toHaveLength(1);
    const committed = calls.committed[0];
    expect(committed.turnDeadlineAt).toBeGreaterThanOrEqual(
      before + TURN_DURATION_MS,
    );
    expect(committed.turnTimeRemaining).toBe(TURN_DURATION_MS);

    // Second reconnect on the SAME move keeps the remaining time —
    // the once-per-move bound stops a flapping peer from stalling.
    calls.committed.length = 0;
    handleRelayEvent(deps, { type: "peer-reconnected" });
    expect(calls.committed).toHaveLength(1);
    expect(calls.committed[0].turnDeadlineAt).toBe(committed.turnDeadlineAt);
  });
});
