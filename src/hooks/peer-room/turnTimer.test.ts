import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState, makeMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerRoomState } from "../usePeerRoom";
import {
  startTurnTimer,
  stopTurnTimer,
  type TurnTimerDeps,
} from "./turnTimer";

// F313 — the peer-room turn clock owns the host's forced random move on
// expiry and the guest's deadline-freeze display, with real wire traffic
// (broadcastGameState) on the forced move. This file pins that contract.

function activeGame(overrides: Partial<GameState> = {}): GameState {
  const base = freshGameState();
  return {
    ...base,
    gameStatus: GameStatus.ACTIVE,
    players: {
      ...base.players,
      [PlayerSymbol.X]: { ...base.players[PlayerSymbol.X], username: "Ada" },
      [PlayerSymbol.O]: { ...base.players[PlayerSymbol.O], username: "Bob" },
    },
    turnTimeRemaining: 0,
    // Already expired — the first tick forces a random move.
    turnDeadlineAt: Date.now() - 1,
    ...overrides,
  };
}

function roomState(game: GameState, role: "host" | "guest"): PeerRoomState {
  return {
    role,
    status: "connected",
    roomId: "room-1",
    hostSymbol: PlayerSymbol.X,
    guestSymbol: PlayerSymbol.O,
    message: "",
    pausedMessage: null,
    pausedStash: null,
    rematchIncoming: false,
    rematchOutgoing: false,
    gameState: game,
  } as PeerRoomState;
}

function makeDeps(
  game: GameState,
  role: "host" | "guest",
  broadcast: (gameState: GameState) => void = () => {},
) {
  const deps: TurnTimerDeps & {
    setStateCalls: Array<Partial<PeerRoomState>>;
    roomRef: { current: PeerRoomState };
  } = {
    stateRef: { current: game },
    roleRef: { current: role },
    tickRef: { current: null },
    setState: (updater) => {
      // Mirror the hook: committed state lands back in the ref.
      deps.setStateCalls.push(
        typeof updater === "function"
          ? (updater as (prev: PeerRoomState) => PeerRoomState)(deps.roomRef.current)
          : updater
      );
      // Apply the gameState portion so stateRef/room stay coherent, the
      // way the hook's re-render + effect sync would.
      const applied = deps.setStateCalls[deps.setStateCalls.length - 1];
      if (applied && "gameState" in applied && applied.gameState) {
        deps.stateRef.current = applied.gameState;
        deps.roomRef.current = {
          ...deps.roomRef.current,
          gameState: applied.gameState,
          message: applied.message ?? deps.roomRef.current.message,
        };
      }
    },
    broadcastGameState: broadcast,
    // Test plumbing (not part of TurnTimerDeps):
    setStateCalls: [] as Array<Partial<PeerRoomState>>,
    roomRef: { current: roomState(game, role) },
  };
  return deps;
}

beforeEach(() => {
  vi.useFakeTimers();
  // @ts-expect-error — installing a partial window for node test env
  globalThis.window = {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  };
  // Math.random() = 0 pins the forced move to the first free cell.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("peer-room turnTimer", () => {
  it("stopTurnTimer clears the interval and nulls the handle", () => {
    const deps = makeDeps(activeGame(), "host");
    startTurnTimer(deps);
    expect(deps.tickRef.current).not.toBeNull();
    stopTurnTimer(deps);
    expect(deps.tickRef.current).toBeNull();
    stopTurnTimer(deps); // idempotent
    expect(deps.tickRef.current).toBeNull();
  });

  it("the host's expired turn forces a random move and broadcasts it", () => {
    const game = activeGame();
    const broadcasts: GameState[] = [];
    const deps = makeDeps(game, "host", (g) => broadcasts.push(g));
    startTurnTimer(deps);

    vi.advanceTimersByTime(1000);

    // The forced move landed: X in the first free cell (Math.random=0).
    expect(deps.stateRef.current.board[0]).toBe(PlayerSymbol.X);
    expect(deps.setStateCalls.at(-1)).toMatchObject({
      message: expect.stringContaining("ran out of time"),
    });
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].board[0]).toBe(PlayerSymbol.X);
  });

  it("a guest's expired turn freezes the display at 0 without a broadcast", () => {
    const game = activeGame();
    const broadcasts: GameState[] = [];
    const deps = makeDeps(game, "guest", (g) => broadcasts.push(g));
    startTurnTimer(deps);

    vi.advanceTimersByTime(1000);

    expect(deps.setStateCalls.at(-1)).toMatchObject({
      gameState: expect.objectContaining({ turnTimeRemaining: 0 }),
    });
    expect(broadcasts).toHaveLength(0);
    // Guests stop their clock after the freeze — only the host's clock
    // is authoritative.
    expect(deps.tickRef.current).toBeNull();
  });

  it("stops quietly when the board is full and no move can be forced", () => {
    // Fill the board — every cell taken, makeRandomMove returns null.
    const full = activeGame();
    const base = freshGameState();
    full.board = base.board.map(() => PlayerSymbol.X);
    full.gameStatus = GameStatus.ACTIVE;
    const broadcasts: GameState[] = [];
    const deps = makeDeps(full, "host", (g) => broadcasts.push(g));
    startTurnTimer(deps);

    vi.advanceTimersByTime(1000);

    expect(broadcasts).toHaveLength(0);
    expect(deps.tickRef.current).toBeNull();
  });

  it("stops when the game is no longer active", () => {
    const game = activeGame({ gameStatus: GameStatus.COMPLETED });
    const deps = makeDeps(game, "host");
    startTurnTimer(deps);

    vi.advanceTimersByTime(1000);

    expect(deps.tickRef.current).toBeNull();
  });

  it("ticks the display while time remains, honoring the stored deadline", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const game = activeGame({
      turnDeadlineAt: now + 5000,
      turnTimeRemaining: 5000,
    });
    const deps = makeDeps(game, "host");
    startTurnTimer(deps);

    vi.advanceTimersByTime(1000);

    expect(deps.setStateCalls.at(-1)).toMatchObject({
      gameState: expect.objectContaining({ turnTimeRemaining: 4000 }),
    });
  });

  it("drops the display write when the deadline moved underneath (stale-tick guard)", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const game = activeGame({
      turnDeadlineAt: now + 5000,
      turnTimeRemaining: 5000,
    });
    const deps = makeDeps(game, "guest");
    startTurnTimer(deps);

    // The tick's captured deadline (stateRef) moves to a new snapshot,
    // but the render state (setState's prev) still carries the OLD one —
    // the updater's identity guard returns prev unchanged, so the
    // display keeps its old clock instead of writing a number for a
    // deadline the rendered frame never saw.
    deps.stateRef.current = { ...game, turnDeadlineAt: now + 9000 };
    deps.setStateCalls.length = 0;

    vi.advanceTimersByTime(1000);

    expect(deps.roomRef.current.gameState.turnTimeRemaining).toBe(5000);
  });
});

// makeMove smoke: the forced move is a legal makeMove on a real board —
// pin the contract the expiry branch relies on.
describe("peer-room turnTimer — forced-move legality", () => {
  it("the forced move switches the current player", () => {
    const game = activeGame();
    const after = makeMove(game, 0);
    expect(after).not.toBeNull();
    expect(after!.currentPlayer).not.toBe(game.currentPlayer);
  });
});
