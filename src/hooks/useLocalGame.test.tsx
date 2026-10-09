// @vitest-environment jsdom

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  TURN_DURATION_MS,
} from "@/game/constants";
import { getAIMove } from "@/game/ai";
import { useLocalGame, type LocalGameInput } from "./useLocalGame";

// F578: the mock delegates to the real engine — every existing assertion
// keeps its exact behavior — while recording the difficulty the hook asks
// for, so a mid-game settings switch can be caught red-handed.
vi.mock("@/game/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/game/ai")>();
  return { ...actual, getAIMove: vi.fn(actual.getAIMove) };
});

// Hook-level coverage for the local "ran out of time" notice (F300):
// gameState.turnNotice must move atomically with the move that raises or
// clears it — through human clicks, the AI commit path, and reset/exit —
// and App.tsx renders it into the players panel's `message` prop.
//
// The turn clock ticks once per second and every tick commits through a
// `cur === prev` guard on the post-render snapshot (gameStateRef syncs in
// an effect). Tests must therefore step fake time one tick per act(): a
// single big advanceTimersByTime queues every tick against the same stale
// snapshot, the first decrement wins the guard, and the expiry tick —
// the very thing under test — is silently dropped.

beforeAll(() => {
  // act() needs the flag, but setting it at module load leaks it to every
  // test file sharing the worker's globalThis — scope it to this suite.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

function makeInput(overrides: Partial<LocalGameInput> = {}): LocalGameInput {
  return {
    gameMode: GameModes.VS_FRIEND,
    playerName: "Ada",
    opponentName: "Bob",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    aiDifficulty: AI_Difficulty.EASY,
    ...overrides,
  };
}

function makeComputerInput(overrides: Partial<LocalGameInput> = {}): LocalGameInput {
  return makeInput({
    gameMode: GameModes.VS_COMPUTER,
    opponentName: "CPU",
    ...overrides,
  });
}

// Steps the fake clock one second per act() so each interval tick commits
// and syncs gameStateRef before the next tick reads it (see header note).
function stepSeconds(count: number) {
  for (let i = 0; i < count; i += 1) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

beforeEach(() => {
  // Pin the faked API set: the turn clock ticks via setInterval, the AI
  // commit via setTimeout, and deadline math via Date.now — a default-set
  // change must not silently un-fake one of them.
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  // Math.random() = 0: human starts as X, AI jitter is 0, and forced
  // random moves land on the first free cell.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useLocalGame timeout notice", () => {
  it("names the timed-out player; the next human move applies and clears it", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));

    // X (Ada) lets the deadline lapse: the forced move lands for X and
    // the notice names her — same string online play raises.
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.board[0]).toBe(PlayerSymbol.X);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.O);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");

    // O's click is a real move: it applies AND clears the notice.
    act(() => {
      result.current.handleCellClick(4);
    });
    expect(result.current.gameState.board[4]).toBe(PlayerSymbol.O);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.X);
    expect(result.current.gameState.turnNotice).toBeUndefined();
  });

  it("keeps the notice when a click cannot apply", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");

    // Cell 0 is occupied by the forced move — a rejected click must not
    // erase the notice (the erase-on-lost-commit regression).
    act(() => {
      result.current.handleCellClick(0);
    });
    expect(result.current.gameState.moveCount).toBe(1);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");
  });

  it("keeps the notice through ordinary countdown ticks", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");

    // O's fresh deadline is ~10s out; the next tick is display-only and
    // must preserve the notice.
    stepSeconds(1);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");
  });

  it("clears the notice when the AI commits its move", () => {
    const { result } = renderHook(() => useLocalGame(makeComputerInput()));

    // Human (X) times out; the forced move hands the turn to the
    // computer (O), whose scheduled move is the next commit.
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.O);

    // AI delay = AI_MOVE_DELAY_MS + jitter·random (random pinned to 0).
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current.gameState.moveCount).toBe(2);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.X);
    expect(result.current.gameState.turnNotice).toBeUndefined();
  });

  it("names the side whose turn expired, not the mover", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));

    // X plays in time; O (Bob) then lets the deadline lapse — the
    // notice must name the timed-out side, not whoever moved last.
    act(() => {
      result.current.handleCellClick(0);
    });
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.moveCount).toBe(2);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.X);
    expect(result.current.gameState.turnNotice).toBe("Bob ran out of time");
  });

  it("clears the notice on reset and exit", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");

    act(() => {
      result.current.handleReset();
    });
    expect(result.current.gameState.turnNotice).toBeUndefined();
    expect(result.current.gameState.gameStatus).toBe(GameStatus.ACTIVE);
    expect(result.current.gameState.moveCount).toBe(0);

    // Re-raise the notice, then leave the game.
    stepSeconds(TURN_DURATION_MS / 1000);
    expect(result.current.gameState.turnNotice).toBe("Ada ran out of time");
    act(() => {
      result.current.exit();
    });
    expect(result.current.gameState.turnNotice).toBeUndefined();
    expect(result.current.gameState.gameStatus).toBe(GameStatus.WAITING);
  });
});

describe("useLocalGame computer-opening turn", () => {
  // The computer opens when randomPlayerSymbol() hands the human O, so the
  // AI owns X and the very first commit of the game belongs to it. The turn
  // clock is already ticking on that same opening turn, which is the only
  // place the clock tick and the AI's setTimeout overlap.
  function renderComputerOpening() {
    vi.mocked(Math.random).mockReturnValue(0.6);
    return renderHook(() => useLocalGame(makeComputerInput()));
  }

  it("gives the human O and the computer X", () => {
    const { result } = renderComputerOpening();
    expect(result.current.humanSymbol).toBe(PlayerSymbol.O);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.X);
    expect(result.current.gameState.players[PlayerSymbol.X].type).toBe(PlayerTypes.COMPUTER);
  });

  it("plays the opening move without waiting for the turn to expire", () => {
    const { result } = renderComputerOpening();

    // One clock tick passes before the AI's move lands
    // (AI delay = 700 + 0.6*600 = 1060ms, first tick at 1000ms).
    stepSeconds(1);
    expect(result.current.gameState.moveCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1060);
    });

    expect(result.current.gameState.moveCount).toBe(1);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.O);
    // The AI's own move, never the "ran out of time" forced move.
    expect(result.current.gameState.turnNotice).toBeUndefined();
  });

  it("still opens when the clock tick and the AI move land in one batch", () => {
    const { result } = renderComputerOpening();

    // Browser frames can deliver both timers in a single task; the AI's
    // commit must not be dropped by the stale-snapshot guard.
    act(() => {
      vi.advanceTimersByTime(1060);
    });

    expect(result.current.gameState.moveCount).toBe(1);
    expect(result.current.gameState.turnNotice).toBeUndefined();
  });
});

describe("useLocalGame click semantics", () => {
  it("re-validates same-tick clicks against the latest committed state", () => {
    const { result } = renderHook(() => useLocalGame(makeInput()));

    // Two clicks inside one batch: the second validates against the
    // post-first-click state (O to move) — functional-updater semantics
    // — not against a stale ref snapshot that would drop it.
    act(() => {
      result.current.handleCellClick(0);
      result.current.handleCellClick(1);
    });
    expect(result.current.gameState.board[0]).toBe(PlayerSymbol.X);
    expect(result.current.gameState.board[1]).toBe(PlayerSymbol.O);
    expect(result.current.gameState.moveCount).toBe(2);
    expect(result.current.gameState.currentPlayer).toBe(PlayerSymbol.X);
  });

  it("ignores clicks while the computer is to move", () => {
    const { result } = renderHook(() => useLocalGame(makeComputerInput()));

    act(() => {
      result.current.handleCellClick(0);
      result.current.handleCellClick(1);
    });
    expect(result.current.gameState.moveCount).toBe(1);
    expect(result.current.gameState.board[1]).toBeNull();
  });
});

describe("useLocalGame AI difficulty source (F578)", () => {
  it("plays the creation difficulty even when settings switch mid-game", () => {
    vi.mocked(getAIMove).mockClear();
    // Created at EASY (makeInput's default); the human (X) opens.
    const { result, rerender } = renderHook(
      (props: LocalGameInput) => useLocalGame(props),
      { initialProps: makeComputerInput() },
    );

    act(() => {
      result.current.handleCellClick(0);
    });

    // The in-game settings sheet switches the selection to HARD for the
    // NEXT match; the running game must keep playing the tier it was
    // created at — recording already reads the committed state (4073b1e),
    // so a HARD move here would be filed under EASY.
    rerender(makeComputerInput({ aiDifficulty: AI_Difficulty.HARD }));
    expect(result.current.gameState.aiDifficulty).toBe(AI_Difficulty.EASY);

    // AI delay = AI_MOVE_DELAY_MS + jitter·random (random pinned to 0).
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current.gameState.moveCount).toBe(2);
    expect(vi.mocked(getAIMove)).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentPlayer: PlayerSymbol.O }),
      AI_Difficulty.EASY,
      PlayerSymbol.O,
    );

    // Only a reset rebuilds the game: the next match picks up HARD.
    act(() => {
      result.current.handleReset();
    });
    expect(result.current.gameState.aiDifficulty).toBe(AI_Difficulty.HARD);
  });
});
