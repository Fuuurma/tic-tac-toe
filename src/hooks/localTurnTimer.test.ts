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
    const { deps, getGame, getMessage } = makeDeps(activeGame());

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(1000);

    expect(getGame().board[0]).toBe(PlayerSymbol.X);
    expect(getGame().currentPlayer).toBe(PlayerSymbol.O);
    expect(getMessage()).toBe("Ada ran out of time");

    // The next applied move (human click / AI play) clears the notice.
    const prev = deps.stateRef.current;
    const next = makeMove(prev, 5);
    expect(next).not.toBeNull();
    if (!next) return;
    commitLocalMove(deps, prev, next);

    expect(getGame()).toBe(next);
    expect(getMessage()).toBe("");
  });

  it("falls back to 'Player' when the timed-out side has no name", () => {
    const { deps, getMessage } = makeDeps(
      activeGame({ players: freshGameState().players }),
    );

    startLocalTurnTimer(deps);
    vi.advanceTimersByTime(1000);

    expect(getMessage()).toBe("Player ran out of time");
  });

  it("a game-ending forced move keeps the notice and the winner", () => {
    const { deps, getGame, getMessage } = makeDeps(
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
    expect(getMessage()).toBe("Ada ran out of time");

    // No further move applies, so the notice survives into the end panel.
    vi.advanceTimersByTime(3000);
    expect(getGame().winner).toBe(PlayerSymbol.X);
    expect(getMessage()).toBe("Ada ran out of time");
  });
});
