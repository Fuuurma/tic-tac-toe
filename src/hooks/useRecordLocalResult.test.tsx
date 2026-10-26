// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  AI_Difficulty,
  GameModes,
  GameStatus,
  PlayerSymbol,
  type PlayerSymbol as PlayerSymbolType,
} from "@/game/constants";
import { freshGameState, type GameState } from "@/game/logic";
import { useRecordLocalResult } from "./useRecordLocalResult";

/**
 * A finished vs Computer game must land in the record exactly once, whatever
 * the clock does to the state object afterwards. The turn timer spread-copies
 * the finished state on every tick of the same render window, and the
 * play-while-you-wait warm-up mounts and unmounts mid-search, so the dedupe
 * has to live with the hook rather than with whichever screen hosts it.
 */

const active = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.VS_COMPUTER,
  gameStatus: GameStatus.ACTIVE,
  aiDifficulty: AI_Difficulty.HARD,
  moveCount: 0,
});

const won = (winner: PlayerSymbol, moveCount = 5): GameState => ({
  ...active(),
  gameStatus: GameStatus.COMPLETED,
  winner,
  moveCount,
});

function setup(initial: GameState, humanSymbol: PlayerSymbolType = PlayerSymbol.X) {
  const record = { recordWin: vi.fn(), recordLoss: vi.fn() };
  const view = renderHook(
    ({ state }: { state: GameState }) => useRecordLocalResult(state, humanSymbol, record),
    { initialProps: { state: initial } },
  );
  return { record, rerender: (state: GameState) => view.rerender({ state }) };
}

describe("useRecordLocalResult", () => {
  it("records nothing while the game is still being played", () => {
    const { record, rerender } = setup(active());
    rerender({ ...active(), moveCount: 3 });
    expect(record.recordWin).not.toHaveBeenCalled();
    expect(record.recordLoss).not.toHaveBeenCalled();
  });

  it("files a human win under vs Computer at the difficulty the game was created at", () => {
    const { record, rerender } = setup(active());
    rerender(won(PlayerSymbol.X));
    expect(record.recordWin).toHaveBeenCalledTimes(1);
    expect(record.recordWin).toHaveBeenCalledWith({
      gameMode: GameModes.VS_COMPUTER,
      aiDifficulty: AI_Difficulty.HARD,
    });
    expect(record.recordLoss).not.toHaveBeenCalled();
  });

  it("files the computer's win as a loss", () => {
    const { record, rerender } = setup(active());
    rerender(won(PlayerSymbol.O));
    expect(record.recordLoss).toHaveBeenCalledTimes(1);
    expect(record.recordWin).not.toHaveBeenCalled();
  });

  it("counts a finished game once across clock-tick copies of the same state", () => {
    const { record, rerender } = setup(active());
    const finished = won(PlayerSymbol.X);
    rerender(finished);
    rerender({ ...finished });
    rerender({ ...finished, turnTimeRemaining: 4000 });
    expect(record.recordWin).toHaveBeenCalledTimes(1);
  });

  it("re-arms on a fresh game so a rematch with the same length counts", () => {
    const { record, rerender } = setup(active());
    rerender(won(PlayerSymbol.X, 5));
    rerender(active());
    rerender(won(PlayerSymbol.X, 5));
    expect(record.recordWin).toHaveBeenCalledTimes(2);
  });

  it("files a vs Friend result with no difficulty to attribute it to", () => {
    const friend = (): GameState => ({ ...active(), gameMode: GameModes.VS_FRIEND, aiDifficulty: undefined });
    const { record, rerender } = setup(friend());
    rerender({ ...friend(), gameStatus: GameStatus.COMPLETED, winner: PlayerSymbol.X, moveCount: 5 });
    expect(record.recordWin).toHaveBeenCalledWith({ gameMode: GameModes.VS_FRIEND, aiDifficulty: undefined });
  });

  it("attributes by the symbol the human actually holds after a reset", () => {
    const { record, rerender } = setup(active(), PlayerSymbol.O);
    rerender(won(PlayerSymbol.O));
    expect(record.recordWin).toHaveBeenCalledTimes(1);
  });
});
