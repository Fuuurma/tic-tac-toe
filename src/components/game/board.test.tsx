// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Board } from "./board";
import {
  Color,
  PlayerSymbol,
  SymbolShape,
  type PlayerSymbol as PlayerSymbolType,
} from "@/game/constants";

afterEach(cleanup);

describe("Board accessibility semantics", () => {
  it("exposes native coordinate-labeled buttons inside a labeled group", () => {
    const onCellClick = vi.fn();
    render(
      <Board
        board={Array(9).fill(null)}
        colors={{ [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED }}
        shapes={{ [PlayerSymbol.X]: SymbolShape.X, [PlayerSymbol.O]: SymbolShape.O }}
        winningCombination={null}
        nextToRemove={{ [PlayerSymbol.X]: null, [PlayerSymbol.O]: null }}
        disabled={false}
        onCellClick={onCellClick}
      />,
    );

    expect(
      screen
        .getByRole("group", { name: "Tic Tac Toe game board" })
        .getAttribute("aria-keyshortcuts"),
    ).toBe("1 2 3 4 5 6 7 8 9");

    const cells = screen.getAllByRole("button");
    expect(cells).toHaveLength(9);
    expect(cells[0].getAttribute("aria-label")).toBe("Row 1 column 1, empty");
    expect(cells[8].getAttribute("aria-label")).toBe("Row 3 column 3, empty");

    fireEvent.click(cells[0]);
    expect(onCellClick).toHaveBeenCalledWith(0);
  });

  it("keeps occupied cells unavailable while retaining native button roles", () => {
    const board: (PlayerSymbolType | null)[] = Array(9).fill(null);
    board[0] = PlayerSymbol.X;
    const onCellClick = vi.fn();

    render(
      <Board
        board={board}
        colors={{ [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED }}
        shapes={{ [PlayerSymbol.X]: SymbolShape.X, [PlayerSymbol.O]: SymbolShape.O }}
        winningCombination={null}
        nextToRemove={{ [PlayerSymbol.X]: 0, [PlayerSymbol.O]: null }}
        disabled={false}
        onCellClick={onCellClick}
      />,
    );

    const occupiedCell = screen.getByRole("button", {
      name: "Row 1 column 1, occupied by X, next to be removed",
    });
    expect(occupiedCell.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(occupiedCell);
    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("names the picked shape, not the symbol letter, in occupied-cell labels", () => {
    const board: (PlayerSymbolType | null)[] = Array(9).fill(null);
    board[0] = PlayerSymbol.X;
    board[4] = PlayerSymbol.O;

    render(
      <Board
        board={board}
        colors={{ [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED }}
        shapes={{ [PlayerSymbol.X]: SymbolShape.TRIANGLE, [PlayerSymbol.O]: SymbolShape.HEART }}
        winningCombination={null}
        nextToRemove={{ [PlayerSymbol.X]: null, [PlayerSymbol.O]: null }}
        disabled={false}
        onCellClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Row 1 column 1, occupied by Triangle" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Row 2 column 2, occupied by Heart" }),
    ).toBeTruthy();
  });
});

// An unplayable cell used to announce as plain "empty" — no reason, so a
// screen-reader user was told the board looked interactive while every tap
// did nothing. The reason travels Board → BoardCell → accessible name.
describe("Board disabled reasons", () => {
  const base = {
    board: Array(9).fill(null),
    colors: { [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED },
    shapes: {
      [PlayerSymbol.X]: SymbolShape.X,
      [PlayerSymbol.O]: SymbolShape.O,
    },
    winningCombination: null,
    nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
    onCellClick: vi.fn(),
  };

  it("keeps the plain label when the board is playable", () => {
    render(<Board {...base} disabled={false} />);

    expect(
      screen.getByRole("button", { name: "Row 1 column 1, empty" }),
    ).toBeTruthy();
  });

  it("states the reason when the board is unplayable", () => {
    render(
      <Board {...base} disabled disabledReason="waiting for the computer to move" />,
    );

    expect(
      screen.getByRole("button", {
        name: "Row 1 column 1, empty, waiting for the computer to move",
      }),
    ).toBeTruthy();
  });

  it("does not claim a reason on an occupied cell", () => {
    const board = Array(9).fill(null);
    board[0] = PlayerSymbol.X;
    render(
      <Board {...base} board={board} disabled disabledReason="game is paused" />,
    );

    expect(
      screen.getByRole("button", { name: /occupied by/ }),
    ).toBeTruthy();
    expect(screen.queryByText(/game is paused/)).toBeNull();
  });
});
