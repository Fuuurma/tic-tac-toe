import { describe, it, expect, vi } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState, makeMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { isPeerMessage, type PeerMessage } from "@/lib/peer.wire";
import { applyHostPauseFrame } from "@/hooks/usePeerRoom";
import type { PeerRoomState } from "./state";
import { handleGuestMessage, type GuestProtocolDeps } from "./guestProtocol";

const FROZEN_REMAINING = 4_000;

function baseGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Host",
      playerOName: "Guest",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
      humanSymbol: PlayerSymbol.X,
    }),
    ...overrides,
  };
}

function realActiveGame(): GameState {
  let state = baseGame();
  state = makeMove(state, 0)!;
  state = makeMove(state, 4)!;
  state = makeMove(state, 1)!;
  return state;
}

function wireGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...realActiveGame(),
    turnDeadlineAt: undefined,
    turnTimeRemaining: FROZEN_REMAINING,
    ...overrides,
  };
}

function makeDeps(game: GameState) {
  const stateRef = { current: game };
  let roomState = {
    gameState: game,
    status: "connected",
    message: "",
    guestSymbol: PlayerSymbol.O,
    pausedStash: null,
    rematchIncoming: false,
    rematchOutgoing: false,
  } as PeerRoomState;
  const hostPausedRef = { current: false };
  const setHostPausedState = vi.fn();
  const hostPauseStopTimer = vi.fn();
  const setState: GuestProtocolDeps["setState"] = (updater) => {
    roomState = typeof updater === "function" ? updater(roomState) : updater;
  };
  const deps: GuestProtocolDeps = {
    stateRef,
    guestSymbolRef: { current: PlayerSymbol.O },
    pendingGuestStateRef: { current: null },
    rematchPendingRef: { current: false },
    syncPendingRef: { current: false },
    clearRematchTimeout: vi.fn(),
    onHostPause: (paused) =>
      applyHostPauseFrame(
        {
          hostPausedRef,
          stateRef,
          setState,
          setHostPausedState,
          stopTimer: hostPauseStopTimer,
        },
        paused,
      ),
    setState,
    stopTimer: vi.fn(),
  };
  return {
    deps,
    getRoom: () => roomState,
    hostPausedRef,
    setHostPausedState,
    hostPauseStopTimer,
  };
}

interface PauseHarness {
  deps: GuestProtocolDeps;
  getRoom: () => PeerRoomState;
  hostPausedRef: { current: boolean };
  setHostPausedState: ReturnType<typeof vi.fn>;
  hostPauseStopTimer: ReturnType<typeof vi.fn>;
}

function expectPausedOnFrozenRemaining(harness: PauseHarness) {
  const { deps, getRoom, hostPausedRef, setHostPausedState, hostPauseStopTimer } =
    harness;
  expect(hostPausedRef.current).toBe(true);
  expect(setHostPausedState).toHaveBeenCalledWith(true);
  expect(hostPauseStopTimer).toHaveBeenCalled();
  const applied = deps.stateRef.current;
  expect(applied.turnTimeRemaining).toBe(FROZEN_REMAINING);
  expect(applied.turnDeadlineAt).toBeGreaterThanOrEqual(
    Date.now() + FROZEN_REMAINING - 500,
  );
  expect(applied.turnDeadlineAt).toBeLessThanOrEqual(
    Date.now() + FROZEN_REMAINING + 500,
  );
  expect(getRoom().gameState.turnTimeRemaining).toBeLessThanOrEqual(
    FROZEN_REMAINING,
  );
  expect(getRoom().gameState.turnTimeRemaining).toBeGreaterThan(
    FROZEN_REMAINING - 500,
  );
  expect(getRoom().message).toBe("Your host paused the game");
}

describe("guestProtocol ordered pause resync frames", () => {
  it("joined + gameUpdate + pause leaves the guest paused on the host's frozen remaining", () => {
    const harness = makeDeps(realActiveGame());
    const wire = wireGame();
    const joined: PeerMessage = {
      type: "joined",
      symbol: PlayerSymbol.O,
      color: Color.RED,
      gameState: wire,
    };
    const update: PeerMessage = { type: "gameUpdate", gameState: wire };
    expect(isPeerMessage(joined)).toBe(true);
    expect(isPeerMessage(update)).toBe(true);

    handleGuestMessage(harness.deps, joined);
    handleGuestMessage(harness.deps, update);
    handleGuestMessage(harness.deps, { type: "pause", paused: true });

    expectPausedOnFrozenRemaining(harness);
    expect(harness.deps.guestSymbolRef.current).toBe(PlayerSymbol.O);
  });

  it("state_snapshot + pause leaves a reconnected guest paused on the frozen remaining", () => {
    const harness = makeDeps(realActiveGame());
    harness.deps.syncPendingRef.current = true;
    const frame: PeerMessage = {
      type: "state_snapshot",
      symbol: PlayerSymbol.O,
      gameState: wireGame(),
    };
    expect(isPeerMessage(frame)).toBe(true);

    handleGuestMessage(harness.deps, frame);
    handleGuestMessage(harness.deps, { type: "pause", paused: true });

    expectPausedOnFrozenRemaining(harness);
    expect(harness.deps.syncPendingRef.current).toBe(false);
  });

  it("joined + gameStart + pause pauses a guest whose first join lands mid-pause", () => {
    const harness = makeDeps(
      baseGame({ gameStatus: GameStatus.WAITING }),
    );
    const wire = wireGame({
      moveCount: 0,
      moves: { X: [], O: [] },
      board: Array(9).fill(null),
      lastMoveIndex: null,
      nextToRemove: { X: null, O: null },
      currentPlayer: PlayerSymbol.X,
    });
    const start: PeerMessage = {
      type: "gameStart",
      symbol: PlayerSymbol.O,
      gameState: wire,
    };
    expect(isPeerMessage(start)).toBe(true);

    handleGuestMessage(harness.deps, {
      type: "joined",
      symbol: PlayerSymbol.O,
      color: Color.RED,
      gameState: wire,
    });
    handleGuestMessage(harness.deps, start);
    handleGuestMessage(harness.deps, { type: "pause", paused: true });

    expectPausedOnFrozenRemaining(harness);
  });

  it("unpaused resync frames leave the guest running with a rebuilt clock", () => {
    const harness = makeDeps(realActiveGame());
    const wire = wireGame();

    handleGuestMessage(harness.deps, { type: "gameUpdate", gameState: wire });

    expect(harness.hostPausedRef.current).toBe(false);
    expect(harness.hostPauseStopTimer).not.toHaveBeenCalled();
    expect(harness.getRoom().message).toBe("");
    expect(harness.deps.stateRef.current.turnTimeRemaining).toBe(
      FROZEN_REMAINING,
    );
    expect(harness.deps.stateRef.current.turnDeadlineAt).toBeGreaterThanOrEqual(
      Date.now() + FROZEN_REMAINING - 500,
    );
    expect(harness.deps.stateRef.current.turnDeadlineAt).toBeLessThanOrEqual(
      Date.now() + FROZEN_REMAINING + 500,
    );
  });
});
