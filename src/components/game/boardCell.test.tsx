// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { BoardCell } from "./boardCell";

/**
 * BoardCell mounted on its own. The Board suites reach these behaviours only
 * through nine cells and a full game state; this suite pins each one at the
 * cell's own seam — the ghost lifecycle, the win/dim treatments, the
 * next-to-remove wiggle, and the hint/preview/disabledReason affordances.
 *
 * VANISH_MS is module-private, so the ghost-teardown ↔ CSS-duration coupling
 * is pinned through the observable seam instead of the source: the teardown
 * boundary is driven by the duration parsed out of src/index.css, and the
 * parsed value itself is pinned to 550ms. (src/__tests__/vanishDuration.test.ts
 * pins the same coupling by reading both sources; this one proves the
 * behaviour agrees with the stylesheet.)
 */

type CellProps = React.ComponentProps<typeof BoardCell>;

const css = readFileSync(
  join(dirname(new URL(import.meta.url).pathname), "..", "..", "index.css"),
  "utf8",
);

/** Duration (ms) of `animation: vanish …` inside `@utility animate-vanish`. */
function cssVanishMs(): number {
  const utility = css.match(/@utility\s+animate-vanish\s*\{([^}]*)\}/);
  expect(utility, "src/index.css should define @utility animate-vanish").not.toBeNull();
  const duration = utility![1]!.match(/animation:\s*vanish\s+([\d.]+)s\b/);
  expect(duration, "@utility animate-vanish should set a `vanish` duration in seconds").not.toBeNull();
  return Number(duration![1]) * 1000;
}

function renderCell(overrides: Partial<CellProps> = {}) {
  let props: CellProps = {
    index: 4,
    value: null,
    isNextToRemove: false,
    isWinningCell: false,
    isDisabled: false,
    isHovered: false,
    onClick: vi.fn(),
    ...overrides,
  };
  const view = render(<BoardCell {...props} />);
  return {
    ...view,
    update: (next: Partial<CellProps>) => {
      props = { ...props, ...next };
      view.rerender(<BoardCell {...props} />);
    },
  };
}

const cell = () => screen.getByRole("button");
const ghost = (container: HTMLElement) =>
  container.querySelector('[data-vanishing="true"]');

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("mark rendering and clicks", () => {
  it("renders the placed mark in the mark's colour token", () => {
    renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
    });

    const mark = cell().querySelector("svg");
    expect(mark?.getAttribute("class")).toContain("animate-pop-in");
    expect(mark?.getAttribute("class")).toContain("text-mark-blue");
    expect(cell().className).toContain("cell-tint");
    expect(cell().getAttribute("aria-label")).toBe(
      "Row 2 column 2, occupied by X",
    );
    expect(cell().getAttribute("style")).toContain(COLOR_RGB[Color.BLUE]);
  });

  it("reports a click with its index while the cell is playable", () => {
    const onClick = vi.fn();
    renderCell({ index: 2, onClick });

    fireEvent.click(cell());
    expect(onClick).toHaveBeenCalledWith(2);
  });

  it("ignores clicks on an occupied cell while still announcing it", () => {
    const onClick = vi.fn();
    renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
      onClick,
    });

    fireEvent.click(cell());
    expect(onClick).not.toHaveBeenCalled();
    expect(cell().getAttribute("aria-disabled")).toBe("true");
  });
});

describe("vanish ghost", () => {
  it("keeps a retired mark as a fading ghost when showVanish is on", () => {
    const { container, update } = renderCell({
      value: PlayerSymbol.O,
      valueColor: Color.PINK,
      valueShape: SymbolShape.HEART,
      showVanish: true,
    });

    update({ value: null });

    const ghostEl = ghost(container);
    expect(ghostEl).not.toBeNull();
    expect(ghostEl!.className).toContain("animate-vanish");
    // The ghost keeps the RETIRED mark's identity, not the empty cell's.
    expect(ghostEl!.querySelector("svg")?.getAttribute("class")).toContain(
      "text-mark-pink",
    );
  });

  it("removes a retired mark in one frame when showVanish is off", () => {
    const { container, update } = renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
    });

    update({ value: null });

    expect(ghost(container)).toBeNull();
    expect(cell().querySelector("svg")).toBeNull();
  });

  it("drops the ghost when the cell is filled again mid-fade", () => {
    const { container, update } = renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
      showVanish: true,
    });
    update({ value: null });
    expect(ghost(container)).not.toBeNull();

    update({
      value: PlayerSymbol.O,
      valueColor: Color.RED,
      valueShape: SymbolShape.O,
    });
    expect(ghost(container)).toBeNull();
  });

  it("tears the ghost down exactly when the CSS vanish animation ends", () => {
    vi.useFakeTimers();
    const vanishMs = cssVanishMs();
    const { container, update } = renderCell({
      value: PlayerSymbol.O,
      valueColor: Color.PINK,
      valueShape: SymbolShape.HEART,
      showVanish: true,
    });
    update({ value: null });
    expect(ghost(container)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(vanishMs - 1);
    });
    expect(ghost(container)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ghost(container)).toBeNull();
  });

  it("keeps the stylesheet's vanish duration at the pinned 550ms", () => {
    expect(cssVanishMs()).toBe(550);
  });
});

describe("winning line and dimming", () => {
  it("lights a winning cell in the colour of the mark it holds", () => {
    renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.PURPLE,
      valueShape: SymbolShape.X,
      isWinningCell: true,
    });

    const el = cell();
    expect(el.className).toContain("animate-win-claim");
    expect(el.className).toContain("var(--player-color)");
    expect(el.getAttribute("style")).toContain("--player-color");
    expect(el.getAttribute("style")).toContain(COLOR_RGB[Color.PURPLE]);
  });

  it("dims occupied marks that did not win, and only those", () => {
    const { update } = renderCell({ isDimmed: true });
    expect(cell().className).not.toContain("opacity-55");

    update({
      value: PlayerSymbol.O,
      valueColor: Color.RED,
      valueShape: SymbolShape.O,
    });
    expect(cell().className).toContain("opacity-55");
  });
});

describe("next-to-remove", () => {
  it("wriggles the mark that is next to be removed", () => {
    renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
      isNextToRemove: true,
    });

    const el = cell();
    expect(el.className).toContain("animate-wiggle");
    expect(el.className).toContain("border-blue-500/70");
    expect(el.className).toContain("shadow-blue-500/30");
    expect(el.getAttribute("aria-label")).toBe(
      "Row 2 column 2, occupied by X, next to be removed",
    );
  });

  it("does not wiggle a cell that is part of the winning line", () => {
    renderCell({
      value: PlayerSymbol.X,
      valueColor: Color.BLUE,
      valueShape: SymbolShape.X,
      isNextToRemove: true,
      isWinningCell: true,
    });

    expect(cell().className).not.toContain("animate-wiggle");
  });
});

describe("hint, hover preview and disabled reason", () => {
  it("marks the hinted cell for assistive tech and pulses it", () => {
    renderCell({ isHint: true });

    expect(
      screen.getByRole("button", {
        name: "Row 2 column 2, empty, suggested move",
      }),
    ).toBeTruthy();
    expect(cell().className).toContain("animate-pulse-slow");
  });

  it("states why an unplayable cell cannot be played", () => {
    const { update } = renderCell({
      index: 0,
      isDisabled: true,
      disabledReason: "game is paused",
    });

    expect(cell().getAttribute("aria-label")).toBe(
      "Row 1 column 1, empty, game is paused",
    );
    expect((cell() as HTMLButtonElement).disabled).toBe(true);

    update({ isHint: true });
    expect(cell().getAttribute("aria-label")).toBe(
      "Row 1 column 1, empty, game is paused, suggested move",
    );
  });

  it("previews the incoming mark while hovered, and hides it otherwise", () => {
    const { update } = renderCell({
      isHovered: true,
      previewPlayer: PlayerSymbol.O,
      previewColor: Color.RED,
      previewShape: SymbolShape.O,
    });

    const preview = cell().querySelector("svg");
    expect(preview?.getAttribute("class")).toContain("opacity-30");
    expect(preview?.getAttribute("class")).toContain("scale-90");
    expect(preview?.getAttribute("class")).toContain("text-mark-red");

    update({ isHovered: false });
    expect(cell().querySelector("svg")).toBeNull();

    update({ isHovered: true, isDisabled: true });
    expect(cell().querySelector("svg")).toBeNull();
  });

  it("reports hover enter and leave to the parent", () => {
    const onHover = vi.fn();
    renderCell({ index: 4, onHover });

    fireEvent.mouseOver(cell());
    expect(onHover).toHaveBeenLastCalledWith(4);
    fireEvent.mouseOut(cell());
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
