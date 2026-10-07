import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState, makeMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import {
  commitLocalMove,
  startLocalTurnTimer,
  type LocalTurnTimerDeps,
} from "./localTurnTimer";

// Regression pins for the local "ran out of time" notice — the local
// turn timer had no message channel, so a deadline-forced move left the
// status line showing only the next player's turn label.

function activeGame(overrides: Partial<GameState> = {}): GameState {
  const base = freshGameState();
  return {
    ...base,
    gameStatus: GameStatus.ACTIVE,
    players: {
      ...base.players,
      [PlayerSymbol.X]: { ...base.players[PlayerSymbol.X], username: "Ada" },
    },
    turnTimeRemaining: 0,
    // Already expired — the first tick forces a random move.
    turnDeadlineAt: Date.now() - 1,
    ...overrides,
  };
}

function makeDeps(game: GameState) {
  let message = "";
  const deps: LocalTurnTimerDeps = {
    stateRef: { current: game },
    tickRef: { current: null },
    pausedRef: { current: false },
    setGameState: (updater) => {
      // Committed state lands in the ref — mirrors the hook's
      // post-render effect that syncs gameStateRef.
      deps.stateRef.current =
        typeof updater === "function"
          ? updater(deps.stateRef.current)
          : updater;
    },
    setMessage: (updater) => {
      message = typeof updater === "function" ? updater(message) : updater;
    },
  };
  return { deps, getGame: () => deps.stateRef.current, getMessage: () => message };
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
  // @ts-expect-error — cleaning up
  delete globalThis.window;
});

describe("startLocalTurnTimer forced move", () => {
  it("sets 'ran out of time' on a forced move and the next commit clears it", () => {
    const { deps, getGame } = makeDeps(activeGame());

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(1000);

    expect(getGame().board[0]).toBe(PlayerSymbol.X);
    expect(getGame().currentPlayer).toBe(PlayerSymbol.O);
    expect(getGame().turnNotice).toBe("Ada ran out of time");

    // The next applied move (human click / AI play) clears the notice.
    const prev = deps.stateRef.current;
    const next = makeMove(prev, 5);
    expect(next).not.toBeNull();
    if (!next) return;
    commitLocalMove(deps, prev, next);

    expect(getGame()).toBe(next);
    expect(getGame().turnNotice).toBeUndefined();
  });

  it("falls back to 'Player' when the timed-out side has no name", () => {
    const { deps, getGame } = makeDeps(
      activeGame({ players: freshGameState().players }),
    );

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(1000);

    expect(getGame().turnNotice).toBe("Player ran out of time");
  });

  it("a game-ending forced move keeps the notice and the winner", () => {
    const { deps, getGame } = makeDeps(
      activeGame({
        // X at 1+2, O at 3+4; the forced move lands on index 0 (the
        // first free cell) and completes the top row.
        board: [
          null,
          PlayerSymbol.X,
          PlayerSymbol.X,
          PlayerSymbol.O,
          PlayerSymbol.O,
          null,
          null,
          null,
          null,
        ],
        moves: { [PlayerSymbol.X]: [1, 2], [PlayerSymbol.O]: [3, 4] },
        moveCount: 4,
      }),
    );

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(1000);

    expect(getGame().winner).toBe(PlayerSymbol.X);
    expect(getGame().gameStatus).toBe(GameStatus.COMPLETED);
    expect(getGame().turnNotice).toBe("Ada ran out of time");

    // No further move applies, so the notice survives into the end panel.
    vi.advanceTimersByTime(3000);
    expect(getGame().winner).toBe(PlayerSymbol.X);
    expect(getGame().turnNotice).toBe("Ada ran out of time");
  });
});

// Pausing stops the interval in the hook, but React only runs the passive
// effect that clears it on the NEXT commit. A tick landing in that window
// read the still-expired deadline and played a forced random move for the
// player who had just paused — their clock froze, the board took a move,
// and the turn flipped with nothing on screen explaining why.
describe("startLocalTurnTimer pause gate", () => {
  it("never forces a move while paused, even against an expired deadline", () => {
    const { deps, getGame } = makeDeps(activeGame());
    deps.pausedRef.current = true;

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(10_000);

    // Board untouched, no forced move, no notice, turn not flipped.
    expect(getGame().board[0]).toBeNull();
    expect(getGame().currentPlayer).toBe(PlayerSymbol.X);
    expect(getGame().turnNotice).toBeUndefined();
    expect(getGame().moveCount).toBe(0);
  });

  it("still freezes the displayed countdown rather than draining it", () => {
    const { deps, getGame } = makeDeps(
      activeGame({
        turnTimeRemaining: 4_000,
        turnDeadlineAt: Date.now() + 4_000,
      }),
    );
    deps.pausedRef.current = true;

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(10_000);

    expect(getGame().turnTimeRemaining).toBe(4_000);
  });

  it("resumes normally once the pause is lifted", () => {
    const { deps, getGame } = makeDeps(activeGame());

    startLocalTurnTimer(deps);
    deps.pausedRef.current = true;
    vi.advanceTimersByTime(3_000);
    expect(getGame().board[0]).toBeNull();

    deps.pausedRef.current = false;
    vi.advanceTimersByTime(1_000);

    expect(getGame().board[0]).toBe(PlayerSymbol.X);
    expect(getGame().turnNotice).toBe("Ada ran out of time");
  });
});
