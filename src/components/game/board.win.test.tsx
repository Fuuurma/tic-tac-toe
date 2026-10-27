// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { Board } from "./board";

// The win state used to be a fixed emerald: the one surface whose job is to
// name a player was the only one not using that player's colour, so "green"
// meant "someone won" and nothing said who without the sentence under the
// board. These cases pin the replacement: the winning line wears the WINNER'S
// colour, which the cell takes from its own mark (the board-level
// --player-color tracks the NEXT player, for hover previews).

const board: (PlayerSymbol | null)[] = [
  PlayerSymbol.X, PlayerSymbol.X, PlayerSymbol.X,
  PlayerSymbol.O, null, null,
  PlayerSymbol.O, null, null,
];
const colors = { [PlayerSymbol.X]: Color.PURPLE, [PlayerSymbol.O]: Color.GREEN };
const shapes = {
  [PlayerSymbol.X]: SymbolShape.HEART,
  [PlayerSymbol.O]: SymbolShape.CRESCENT,
};
const nextToRemove = { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null };

function cellButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll("button"));
}

function renderWin(topRowWins = true) {
  render(
    <Board
      board={board}
      colors={colors}
      shapes={shapes}
      winningCombination={topRowWins ? ([0, 1, 2] as const) : null}
      nextToRemove={nextToRemove}
      disabled
      onCellClick={() => undefined}
    />,
  );
}

describe("winning line", () => {
  afterEach(cleanup);

  it("lights in the winner's colour rather than a fixed green", () => {
    renderWin();
    const [a, b, c] = cellButtons();
    for (const cell of [a!, b!, c!]) {
      expect(cell.className).toContain("animate-win-claim");
      expect(cell.className).toContain("var(--player-color)");
      // A colour that belongs to nobody must not appear on the board.
      expect(cell.className).not.toContain("emerald");
    }
  });

  it("sets the cell's own colour token, so the light is the winner's", () => {
    renderWin();
    const [a] = cellButtons();
    expect(a!.getAttribute("style")).toContain(COLOR_RGB[Color.PURPLE]);
  });

  it("leaves the rest of the board alone", () => {
    renderWin();
    const [, , , d, e] = cellButtons();
    for (const cell of [d!, e!]) {
      expect(cell.className).not.toContain("animate-win-claim");
    }
  });

  it("has no winning treatment before the game ends", () => {
    renderWin(false);
    for (const cell of cellButtons()) {
      expect(cell.className).not.toContain("animate-win-claim");
    }
  });
});
