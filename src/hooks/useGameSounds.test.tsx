// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useGameSounds } from "./useGameSounds";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState, makeMove, type GameState } from "@/game/logic";
import { armSoundUnlock, playSound } from "@/lib/sound";

// The hook only diffs GameState snapshots; the palette itself is covered by
// sound.test.ts. Mocking the module keeps these cases about WHICH cue fires.
vi.mock("@/lib/sound", () => ({
  playSound: vi.fn(),
  armSoundUnlock: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function Harness({ state }: { state: GameState }) {
  useGameSounds(state);
  return null;
}

const input = {
  gameMode: GameModes.VS_COMPUTER,
  playerXName: "Ada",
  playerOName: "CPU",
  playerColor: Color.BLUE,
  opponentColor: Color.RED,
  aiDifficulty: AI_Difficulty.EASY,
  humanSymbol: PlayerSymbol.X,
};

/** X is the human, O the computer — the vs-Computer surface under test. */
const freshVsComputer = (): GameState => createInitialGameState(input);

/** Applies a move, asserting the engine accepted it. */
const play = (state: GameState, index: number): GameState => {
  const next = makeMove(state, index);
  if (!next) throw new Error(`move ${index} rejected`);
  return next;
};

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.mocked(armSoundUnlock).mockClear();
});

describe("useGameSounds", () => {
  it("arms the gesture unlock once on mount and stays silent", () => {
    render(<Harness state={freshVsComputer()} />);

    expect(armSoundUnlock).toHaveBeenCalledTimes(1);
    expect(playSound).not.toHaveBeenCalled();
  });

  it("toks on a committed move but stays quiet on a computer turn", () => {
    const { rerender } = render(<Harness state={freshVsComputer()} />);
    const afterHumanMove = play(freshVsComputer(), 4);

    rerender(<Harness state={afterHumanMove} />);

    // X (human) placed; O (computer) is to move — place only, no turn tick.
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("place");
  });

  it("ticks the turn a beat behind the AI's answer", () => {
    let state = freshVsComputer();
    const { rerender } = render(<Harness state={state} />);

    state = play(state, 4); // X places; computer to move
    rerender(<Harness state={state} />);
    state = play(state, 8); // O places; human to move
    rerender(<Harness state={state} />);

    expect(vi.mocked(playSound).mock.calls).toEqual([
      ["place"],
      ["place"],
      ["turn", 0.16],
    ]);
  });

  it("ignores the once-a-second clock tick", () => {
    const state = play(freshVsComputer(), 4);
    const { rerender } = render(<Harness state={state} />);
    vi.mocked(playSound).mockClear();

    // A fresh object with identical play fields is the turn-clock tick.
    rerender(<Harness state={{ ...state, turnTimeRemaining: 4000 }} />);

    expect(playSound).not.toHaveBeenCalled();
  });

  it("pairs the vanish poof a beat behind the place tok", () => {
    let state = freshVsComputer();
    const { rerender } = render(<Harness state={state} />);

    // X's fourth mark retires her oldest: 0,2,7 then 4 removes cell 0.
    // (Cells chosen so no three ever line up before the vanish.)
    const cells = [0, 8, 2, 3, 7, 5, 4];
    for (const cell of cells) {
      state = play(state, cell);
      rerender(<Harness state={state} />);
    }

    const last = vi.mocked(playSound).mock.calls.at(-1);
    expect(last).toEqual(["vanish", 0.09]);
    // The place tok for the same move precedes it.
    expect(vi.mocked(playSound).mock.calls.at(-2)).toEqual(["place"]);
  });

  it("replaces the place tok with the win arpeggio on the finishing move", () => {
    let state = freshVsComputer();
    const { rerender } = render(<Harness state={state} />);

    // X takes the 0-4-8 diagonal on her third mark.
    for (const cell of [0, 3, 4, 6, 8]) {
      state = play(state, cell);
      rerender(<Harness state={state} />);
    }

    expect(state.winner).toBe(PlayerSymbol.X);
    expect(vi.mocked(playSound).mock.calls.at(-1)).toEqual(["win"]);
    // The win cue stands alone — no place tok under it.
    expect(vi.mocked(playSound).mock.calls.at(-2)).not.toEqual(["place"]);
  });

  it("plays no move cues on reset; the human's opening turn still ticks", () => {
    let state = freshVsComputer();
    const { rerender } = render(<Harness state={state} />);

    state = play(state, 4); // X places; the computer is to move.
    rerender(<Harness state={state} />);
    vi.mocked(playSound).mockClear();

    // A fresh game: moveCount drops, currentPlayer returns to human X.
    const fresh = freshVsComputer();
    rerender(<Harness state={fresh} />);

    expect(playSound).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("turn", 0);
  });
});
