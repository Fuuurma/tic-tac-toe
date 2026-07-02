import { describe, expect, it } from "vitest";
import {
  createFreshGameState,
  PlayerSymbol,
  reduceGameAction,
} from "@/src/game/core";

describe("game core boundary", () => {
  it("exposes portable state and reducer helpers", () => {
    const state = createFreshGameState();
    const next = reduceGameAction(state, { type: "move", index: 4 });

    expect(next.board[4]).toBe(PlayerSymbol.X);
    expect(next.currentPlayer).toBe(PlayerSymbol.O);
  });

  it("can reset to a supplied serializable state", () => {
    const state = createFreshGameState();
    const moved = reduceGameAction(state, { type: "move", index: 4 });
    const reset = reduceGameAction(moved, { type: "reset", state });

    expect(reset).toEqual(state);
  });
});
