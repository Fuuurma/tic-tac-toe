// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { BoardCell } from "./boardCell";

/**
 * BoardCell mounted on its own. The board suites reach these behaviours
 * through nine cells and a full game state; this file pins each contract at
 * the cell seam — the vanish ghost's lifetime against the CSS keyframe, the
 * winner/dimmed contrast, the next-to-remove wiggle, and the accessible
 * name a screen reader announces.
 */

type Props = ComponentProps<typeof BoardCell>;

function renderCell(overrides: Partial<Props> = {}) {
  const props: Props = {
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
    container: view.container,
    cell: () => within(view.container).getByRole("button"),
    update: (next: Partial<Props>) => view.rerender(<BoardCell {...props} {...next} />),
  };
}

const ghosts = (container: HTMLElement) =>
  container.querySelectorAll('[data-vanishing="true"]');

// Read from disk like palette.test.ts (cwd is the repo root, as in
// ci-dx-pins.test.ts): `?raw` on a stylesheet resolves to an empty string
// under Vitest, which would silently un-pin the timing below.
const indexCss = readFileSync(resolve("src/index.css"), "utf8");

/** The `vanish` keyframe duration in ms, from `@utility animate-vanish`. */
function cssVanishMs(): number {
  const utility = indexCss.match(/@utility\s+animate-vanish\s*\{([^}]*)\}/);
  expect(utility, "index.css should define @utility animate-vanish").not.toBeNull();
  const duration = utility![1]!.match(/animation:\s*vanish\s+([\d.]+)\s*(ms|s)\b/);
  expect(duration, "@utility animate-vanish should set a `vanish` duration").not.toBeNull();
  const amount = Number(duration![1]);
  return duration![2] === "ms" ? amount : amount * 1000;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BoardCell mark lifecycle", () => {
  it("renders a placed mark, names its shape, and refuses further clicks", () => {
    const onClick = vi.fn();
    const { container, cell, update } = renderCell({ onClick });

    expect(cell().getAttribute("aria-keyshortcuts")).toBe("5");
    expect(cell().getAttribute("aria-label")).toBe("Row 2 column 2, empty");

    update({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.HEART,
      valueColor: Color.PURPLE,
    });

    const mark = container.querySelector("svg.animate-pop-in");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("class")).toContain("text-mark-purple");
    expect(
      within(container).getByRole("button", {
        name: "Row 2 column 2, occupied by Heart",
      }),
    ).toBeTruthy();
    expect(cell().getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(cell());
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a retired mark on screen as a fading ghost when showVanish is on", () => {
    const { container, update } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.CRESCENT,
      valueColor: Color.GREEN,
      showVanish: true,
    });

    update({ value: null, valueShape: undefined, valueColor: undefined });

    const ghost = container.querySelector('[data-vanishing="true"]');
    expect(ghost).not.toBeNull();
    expect(ghost!.getAttribute("aria-hidden")).toBe("true");
    expect(ghost!.className).toContain("animate-vanish");
    // The ghost wears the colour of the mark that left, not the cell's next state.
    expect(ghost!.querySelector("svg")!.getAttribute("class")).toContain(
      "text-mark-green",
    );
  });

  it("removes a retired mark in one frame when showVanish is off", () => {
    const { container, update } = renderCell({
      value: PlayerSymbol.O,
      valueShape: SymbolShape.O,
      valueColor: Color.RED,
    });

    update({ value: null, valueShape: undefined, valueColor: undefined });

    expect(ghosts(container)).toHaveLength(0);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("clears the ghost exactly when the CSS vanish animation ends", () => {
    vi.useFakeTimers();
    const { container, update } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.BLUE,
      showVanish: true,
    });

    update({ value: null, valueShape: undefined, valueColor: undefined });
    expect(ghosts(container)).toHaveLength(1);

    // VANISH_MS is not exported; its contract is the CSS keyframe duration.
    // src/__tests__/vanishDuration.test.ts pins the two constants; this pins
    // the ghost's actual lifetime against the stylesheet, so a timeout that
    // drifts early or late fails here even if the constant still matches.
    act(() => {
      vi.advanceTimersByTime(cssVanishMs() - 1);
    });
    expect(ghosts(container)).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ghosts(container)).toHaveLength(0);
  });

  it("drops the ghost when the cell is filled again mid-fade", () => {
    vi.useFakeTimers();
    const { container, update } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.BLUE,
      showVanish: true,
    });

    update({ value: null, valueShape: undefined, valueColor: undefined });
    expect(ghosts(container)).toHaveLength(1);

    update({
      value: PlayerSymbol.O,
      valueShape: SymbolShape.O,
      valueColor: Color.RED,
    });
    expect(ghosts(container)).toHaveLength(0);
    expect(container.querySelector("svg.animate-pop-in")).not.toBeNull();
  });
});

describe("BoardCell win emphasis", () => {
  it("lights a winning cell in the colour of the mark it holds", () => {
    const { cell } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.HEART,
      valueColor: Color.PURPLE,
      isWinningCell: true,
    });

    expect(cell().className).toContain("animate-win-claim");
    const style = cell().getAttribute("style") ?? "";
    expect(style).toContain("--player-color");
    expect(style).toContain(COLOR_RGB[Color.PURPLE]);
  });

  it("keeps --player-color, the next player's hover colour, off an ordinary mark", () => {
    const { cell } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.BLUE,
    });

    const style = cell().getAttribute("style") ?? "";
    expect(style).toContain("--cell-rgb");
    expect(style).not.toContain("--player-color");
    expect(cell().className).not.toContain("animate-win-claim");
  });

  it("dims a mark that did not win so the line is the bright thing", () => {
    const { cell, update } = renderCell({
      value: PlayerSymbol.O,
      valueShape: SymbolShape.O,
      valueColor: Color.RED,
      isDimmed: true,
    });
    expect(cell().className).toContain("opacity-55");

    update({ isDimmed: false });
    expect(cell().className).not.toContain("opacity-55");
  });

  it("never dims an empty cell", () => {
    const { cell } = renderCell({ isDimmed: true });
    expect(cell().className).not.toContain("opacity-55");
  });
});

describe("BoardCell next-to-remove", () => {
  it("waggles the border of the mark that leaves next", () => {
    const { container, cell } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.RED,
      isNextToRemove: true,
    });

    expect(cell().className).toContain("border-2");
    expect(cell().className).toContain("animate-wiggle");
    expect(cell().className).toContain("border-red-500/70");
    expect(
      container.querySelector("svg.animate-pop-in")!.getAttribute("class"),
    ).toContain("animate-sos-blink");
    expect(
      within(container).getByRole("button", {
        name: "Row 2 column 2, occupied by X, next to be removed",
      }),
    ).toBeTruthy();
  });

  it("does not wiggle a staying mark, a winning cell, or an empty cell", () => {
    const staying = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.RED,
    });
    expect(staying.cell().className).not.toContain("animate-wiggle");

    const winning = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.RED,
      isNextToRemove: true,
      isWinningCell: true,
    });
    expect(winning.cell().className).not.toContain("animate-wiggle");

    const empty = renderCell({ isNextToRemove: true });
    expect(empty.cell().className).not.toContain("animate-wiggle");
  });
});

describe("BoardCell accessible name", () => {
  it("announces the hinted cell as the suggested move", () => {
    const { container } = renderCell({ isHint: true });
    const button = within(container).getByRole("button", {
      name: "Row 2 column 2, empty, suggested move",
    });
    expect(button.className).toContain("animate-pulse-slow");
  });

  it("says why an empty cell cannot be played and swallows the click", () => {
    const onClick = vi.fn();
    const { container } = renderCell({
      isDisabled: true,
      disabledReason: "waiting for the computer to move",
      onClick,
    });

    const button = within(container).getByRole("button", {
      name: "Row 2 column 2, empty, waiting for the computer to move",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps the reason and the hint together in the accessible name", () => {
    const { container } = renderCell({
      isDisabled: true,
      disabledReason: "game is paused",
      isHint: true,
    });
    expect(
      within(container).getByRole("button", {
        name: "Row 2 column 2, empty, game is paused, suggested move",
      }),
    ).toBeTruthy();
  });
});

describe("BoardCell hover", () => {
  it("previews the incoming mark while an empty cell is hovered", () => {
    const { container, update } = renderCell({
      isHovered: true,
      previewPlayer: PlayerSymbol.O,
      previewColor: Color.GREEN,
      previewShape: SymbolShape.STAR,
    });

    const preview = container.querySelector("svg.opacity-30");
    expect(preview).not.toBeNull();
    expect(preview!.getAttribute("class")).toContain("scale-90");
    expect(preview!.getAttribute("class")).toContain("text-mark-green");

    update({ isHovered: false });
    expect(container.querySelector("svg.opacity-30")).toBeNull();
  });

  it("does not preview over a mark that is already placed", () => {
    const { container } = renderCell({
      value: PlayerSymbol.X,
      valueShape: SymbolShape.X,
      valueColor: Color.BLUE,
      isHovered: true,
      previewPlayer: PlayerSymbol.O,
      previewColor: Color.GREEN,
      previewShape: SymbolShape.STAR,
    });

    // Only the placed mark renders — no second, faded svg.
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg.animate-pop-in")).not.toBeNull();
  });

  it("reports pointer and keyboard focus as hover to the board", () => {
    const onHover = vi.fn();
    const { cell } = renderCell({ onHover });

    fireEvent.mouseEnter(cell());
    expect(onHover).toHaveBeenLastCalledWith(4);
    fireEvent.mouseLeave(cell());
    expect(onHover).toHaveBeenLastCalledWith(null);
    fireEvent.focus(cell());
    expect(onHover).toHaveBeenLastCalledWith(4);
    fireEvent.blur(cell());
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
