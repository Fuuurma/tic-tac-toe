// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Color, PlayerSymbol, SymbolShape } from "@/game/constants";

/**
 * Render-cost guard for the board subtree.
 *
 * The turn clock rewrites `turnTimeRemaining` once a second, and the clock
 * tick spread-copies the game state — so `board`, `winningCombination` and
 * `nextToRemove` keep their identities and nothing the board actually draws
 * changes. Nine cells re-rendering every second for an invisible reason is
 * pure main-thread cost on the device that is already animating the backdrop.
 *
 * `React.Profiler` is not a usable instrument here: its own element is
 * recreated on each parent render, so it fires for its own commit and masks
 * the bailout. Counting actual `BoardCell` renders is direct and honest.
 */

let cellRenders = 0;

vi.mock("./boardCell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./boardCell")>();
  return {
    ...actual,
    // BoardCell is a memo component, so it must be rendered as an element —
    // calling it directly does not work. The counter lives on this wrapper,
    // which Board re-renders on every pass; memo on BoardCell still holds
    // underneath, so the count reflects BOARD's decision to re-render.
    BoardCell: (props: React.ComponentProps<typeof actual.BoardCell>) => {
      cellRenders += 1;
      return <actual.BoardCell {...props} />;
    },
  };
});

const { Board } = await import("./board");

afterEach(() => {
  cleanup();
  cellRenders = 0;
});

const board = Array(9).fill(null);
const colors = { [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED };
const shapes = {
  [PlayerSymbol.X]: SymbolShape.X,
  [PlayerSymbol.O]: SymbolShape.O,
};
const nextToRemove = { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null };

// Must be stable across renders. An inline arrow here fails Board's shallow
// prop comparison on every tick and defeats the memo — which is precisely the
// mistake the real call sites were making with their `colors`/`shapes`
// literals, and the reason this file asserts on render counts rather than
// on the presence of `memo`.
const onCellClick = () => {};

/** A parent that re-renders on `tick` but never passes it down — exactly
 *  what the turn clock does to the tree. */
function Harness({ tick: _tick }: { tick: number }) {
  return (
    <Board
      board={board}
      colors={colors}
      shapes={shapes}
      winningCombination={null}
      nextToRemove={nextToRemove}
      disabled={false}
      onCellClick={onCellClick}
    />
  );
}

describe("Board render cost", () => {
  it("renders all nine cells once, then skips the subtree on a clock tick", () => {
    const { rerender } = render(<Harness tick={0} />);
    expect(cellRenders).toBe(9);

    rerender(<Harness tick={1} />);
    rerender(<Harness tick={2} />);

    expect(cellRenders).toBe(9);
  });

  it("still re-renders the affected cells when a move lands", () => {
    const { rerender } = render(<Harness tick={0} />);
    const baseline = cellRenders;
    expect(baseline).toBe(9);

    const moved = Array(9).fill(null);
    moved[0] = PlayerSymbol.X;
    rerender(
      <Board
        board={moved}
        colors={colors}
        shapes={shapes}
        winningCombination={null}
        nextToRemove={{ [PlayerSymbol.X]: 0, [PlayerSymbol.O]: null }}
        disabled={false}
        onCellClick={onCellClick}
      />,
    );

    // The parent re-rendered with a different board, so the memo must not
    // block the update — otherwise this guard would pass by freezing the UI.
    expect(cellRenders).toBeGreaterThan(baseline);
    expect(
      screen.getByRole("button", { name: /Row 1 column 1, occupied/ }),
    ).toBeTruthy();
  });

  it("re-renders when the disabled state flips", () => {
    const { rerender } = render(<Harness tick={0} />);
    const baseline = cellRenders;

    rerender(
      <Board
        board={board}
        colors={colors}
        shapes={shapes}
        winningCombination={null}
        nextToRemove={nextToRemove}
        disabled
        onCellClick={onCellClick}
      />,
    );

    expect(cellRenders).toBeGreaterThan(baseline);
  });
});