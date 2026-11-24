"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Board } from "./board";
import { Color, PlayerSymbol, SymbolShape } from "@/game/constants";

afterEach(cleanup);

const base = {
  board: Array(9).fill(null),
  colors: { [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED },
  shapes: {
    [PlayerSymbol.X]: SymbolShape.X,
    [PlayerSymbol.O]: SymbolShape.O,
  },
  winningCombination: null,
  nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
};

const boardCells = () => screen.getAllByRole("button") as HTMLButtonElement[];
const tabbableCells = () =>
  boardCells().filter((el) => el.getAttribute("tabindex") === "0");

describe("Board roving tabindex", () => {
  it("keeps exactly one cell in the tab order — the first empty cell", () => {
    render(<Board {...base} disabled={false} onCellClick={vi.fn()} />);

    const tabbable = tabbableCells();
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(boardCells()[0]);
    expect(
      boardCells().filter((el) => el.getAttribute("tabindex") === "-1"),
    ).toHaveLength(8);
  });

  it("starts the tab stop on the first empty cell when the board is partly filled", () => {
    const board: (PlayerSymbol | null)[] = Array(9).fill(null);
    board[0] = PlayerSymbol.X;
    board[1] = PlayerSymbol.O;

    render(<Board {...base} board={board} disabled={false} onCellClick={vi.fn()} />);

    expect(tabbableCells()).toEqual([boardCells()[2]]);
  });

  it("falls back to the center cell when no cell is empty", () => {
    const board: (PlayerSymbol | null)[] = Array(9).fill(PlayerSymbol.X);

    render(<Board {...base} board={board} disabled={false} onCellClick={vi.fn()} />);

    expect(tabbableCells()).toEqual([boardCells()[4]]);
  });
});

describe("Board arrow-key navigation", () => {
  it("moves focus right and down through the grid", () => {
    render(<Board {...base} disabled={false} onCellClick={vi.fn()} />);
    const cells = boardCells();

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1]);

    fireEvent.keyDown(cells[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cells[4]);
  });

  it("moves the tab stop along with focus", () => {
    render(<Board {...base} disabled={false} onCellClick={vi.fn()} />);
    const cells = boardCells();

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });

    expect(cells[1].getAttribute("tabindex")).toBe("0");
    expect(cells[0].getAttribute("tabindex")).toBe("-1");
    expect(tabbableCells()).toEqual([cells[1]]);
  });

  it("clamps at the grid edges instead of wrapping", () => {
    render(<Board {...base} disabled={false} onCellClick={vi.fn()} />);
    const cells = boardCells();

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowLeft" });
    fireEvent.keyDown(cells[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(cells[0]);

    cells[2].focus();
    fireEvent.keyDown(cells[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[2]);

    cells[8].focus();
    fireEvent.keyDown(cells[8], { key: "ArrowDown" });
    expect(document.activeElement).toBe(cells[8]);
  });

  it("jumps to the first and last cell of the row with Home and End", () => {
    render(<Board {...base} disabled={false} onCellClick={vi.fn()} />);
    const cells = boardCells();

    cells[4].focus();
    fireEvent.keyDown(cells[4], { key: "Home" });
    expect(document.activeElement).toBe(cells[3]);

    fireEvent.keyDown(cells[3], { key: "End" });
    expect(document.activeElement).toBe(cells[5]);

    cells[8].focus();
    fireEvent.keyDown(cells[8], { key: "Home" });
    expect(document.activeElement).toBe(cells[6]);
  });
});

describe("Board keyboard shortcuts unchanged", () => {
  it("still places the matching mark on digit keys", () => {
    const onCellClick = vi.fn();
    render(<Board {...base} disabled={false} onCellClick={onCellClick} />);

    fireEvent.keyDown(boardCells()[4], { key: "5" });

    expect(onCellClick).toHaveBeenCalledWith(4);
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it("does not move the board while typing in an input", () => {
    const onCellClick = vi.fn();
    render(
      <>
        <Board {...base} disabled={false} onCellClick={onCellClick} />
        <input aria-label="Name" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    input.focus();

    fireEvent.keyDown(input, { key: "5" });
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(onCellClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(input);
  });

  it("ignores digit keys pressed inside a modal dialog even while the board is locked", () => {
    const onCellClick = vi.fn();
    render(
      <>
        <Board {...base} disabled={false} moveLocked onCellClick={onCellClick} />
        <dialog open>
          <button type="button">Cancel</button>
        </dialog>
      </>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "2" });

    expect(onCellClick).not.toHaveBeenCalled();
  });
});

describe("Board move lock", () => {
  it("keeps the cells focusable while the moves are locked", () => {
    const onCellClick = vi.fn();
    render(<Board {...base} disabled={false} moveLocked onCellClick={onCellClick} />);
    const cells = boardCells();

    expect(cells[0].disabled).toBe(false);
    expect(cells[0].getAttribute("aria-disabled")).toBe("true");
    expect(tabbableCells()).toEqual([cells[0]]);

    cells[0].blur();
    cells[0].focus();
    expect(document.activeElement).toBe(cells[0]);
  });

  it("refuses the moves while the board is locked", () => {
    const onCellClick = vi.fn();
    render(<Board {...base} disabled={false} moveLocked onCellClick={onCellClick} />);
    const cells = boardCells();

    fireEvent.click(cells[0]);
    fireEvent.keyDown(cells[0], { key: "1" });

    expect(onCellClick).not.toHaveBeenCalled();
  });

  it("keeps the arrow keys working while the board is locked", () => {
    render(<Board {...base} disabled={false} moveLocked onCellClick={vi.fn()} />);
    const cells = boardCells();

    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });

    expect(document.activeElement).toBe(cells[1]);
    expect(tabbableCells()).toEqual([cells[1]]);
  });

  it("gives native disabling precedence over the lock", () => {
    render(
      <Board {...base} disabled moveLocked disabledReason="game is paused" onCellClick={vi.fn()} />,
    );
    const cells = boardCells();

    expect(cells[0].disabled).toBe(true);
    expect(cells[0].getAttribute("aria-disabled")).toBe("true");
  });

  it("takes the board out of the tab order at the end of the round", () => {
    render(
      <Board {...base} disabled disabledReason="game is over" onCellClick={vi.fn()} />,
    );
    const cells = boardCells();

    expect(cells[0].disabled).toBe(true);
    expect(cells[0].getAttribute("aria-label")).toContain("game is over");
  });
});
