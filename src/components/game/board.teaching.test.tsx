// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Board } from "./board";
import { Color, PlayerSymbol, SymbolShape } from "@/game/constants";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const empty = (): (PlayerSymbol | null)[] => Array(9).fill(null);
const withMark = (index: number): (PlayerSymbol | null)[] => {
  const board = empty();
  board[index] = PlayerSymbol.X;
  return board;
};

function renderBoard(
  board: (PlayerSymbol | null)[],
  extra: Partial<React.ComponentProps<typeof Board>> = {},
) {
  const props: React.ComponentProps<typeof Board> = {
    board,
    colors: { [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED },
    shapes: { [PlayerSymbol.X]: SymbolShape.X, [PlayerSymbol.O]: SymbolShape.O },
    winningCombination: null,
    nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
    disabled: false,
    onCellClick: vi.fn(),
    ...extra,
  };
  const view = render(<Board {...props} />);
  return {
    ...view,
    update: (next: Partial<React.ComponentProps<typeof Board>>) =>
      view.rerender(<Board {...props} {...next} />),
  };
}

const vanishing = (container: HTMLElement) =>
  container.querySelectorAll('[data-vanishing="true"]');

describe("Board teaching aids", () => {
  it("names the suggested cell for assistive tech, and only that cell", () => {
    renderBoard(empty(), { hintIndex: 4 });

    expect(
      screen.getByRole("button", { name: "Row 2 column 2, empty, suggested move" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /suggested move/ })).toHaveLength(1);
  });

  it("leaves a plain board untouched when no hint is given", () => {
    renderBoard(empty());
    expect(screen.queryAllByRole("button", { name: /suggested move/ })).toHaveLength(0);
  });

  it("lets a retired mark fade out instead of blinking away, then cleans up", () => {
    vi.useFakeTimers();
    const { container, update } = renderBoard(withMark(0), { showVanish: true });
    expect(vanishing(container)).toHaveLength(0);

    update({ board: empty() });
    expect(vanishing(container)).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(vanishing(container)).toHaveLength(0);
  });

  it("does not animate a vanish unless asked, so the real game is unchanged", () => {
    const { container, update } = renderBoard(withMark(0));
    update({ board: empty() });
    expect(vanishing(container)).toHaveLength(0);
  });

  it("drops the ghost if the cell is filled again", () => {
    vi.useFakeTimers();
    const { container, update } = renderBoard(withMark(0), { showVanish: true });
    update({ board: empty() });
    update({ board: withMark(0) });
    expect(vanishing(container)).toHaveLength(0);
  });
});
