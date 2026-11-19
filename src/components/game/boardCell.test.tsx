// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { BoardCell } from "./boardCell";

/**
 * BoardCell's contract used to be reachable only through a full Board: the
 * vanish ghost's lifetime is a hand-coupled pair (VANISH_MS in boardCell.tsx,
 * the `vanish` keyframe in index.css), the win/dim/wiggle classes are the
 * whole visual vocabulary of a finished line, and the aria label is the only
 * thing a screen reader gets. These cases mount the cell alone so each
 * behaviour is pinned at its own seam.
 */

type CellProps = React.ComponentProps<typeof BoardCell>;

/** A mid-board occupied X — the shape every "a mark is present" case starts from. */
const occupiedMark = {
  value: PlayerSymbol.X,
  valueShape: SymbolShape.HEART,
  valueColor: Color.PURPLE,
} satisfies Partial<CellProps>;

function makeProps(overrides: Partial<CellProps> = {}): CellProps {
  return {
    index: 4,
    value: null,
    isNextToRemove: false,
    isWinningCell: false,
    isDisabled: false,
    isHovered: false,
    onClick: vi.fn(),
    ...overrides,
  };
}

function renderCell(overrides: Partial<CellProps> = {}) {
  const props = makeProps(overrides);
  const view = render(<BoardCell {...props} />);
  return {
    ...view,
    props,
    button: view.container.querySelector("button") as HTMLButtonElement,
    update: (next: Partial<CellProps>) =>
      view.rerender(<BoardCell {...props} {...next} />),
  };
}

/** A mark that has retired but is still fading keeps this marker on its ghost span. */
const vanishing = (container: HTMLElement) =>
  container.querySelectorAll('[data-vanishing="true"]');

// `import.meta.dirname`, not `new URL(rel, import.meta.url)`: Vite rewrites
// the latter into an http://localhost asset URL that fs cannot read.
const here = import.meta.dirname;
const cellSource = () => readFileSync(join(here, "boardCell.tsx"), "utf8");
const cssSource = () => readFileSync(join(here, "..", "..", "index.css"), "utf8");

/** The `animate-vanish` utility's duration in ms — the CSS half of the pair
 *  VANISH_MS must equal. */
function cssVanishMs(): number {
  const match = cssSource().match(
    /@utility\s+animate-vanish\s*\{[^}]*?animation\s*:\s*vanish\s+([\d.]+)\s*(ms|s)/,
  );
  if (!match) throw new Error("animate-vanish duration not found in src/index.css");
  return match[2] === "ms" ? Number(match[1]) : Number(match[1]) * 1000;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("mark rendering and clicks", () => {
  it("renders a placed mark in its colour token and names the cell", () => {
    const { button, container } = renderCell(occupiedMark);
    const mark = container.querySelector("svg.animate-pop-in");
    expect(mark?.getAttribute("class")).toContain("text-mark-purple");
    const style = button.getAttribute("style") ?? "";
    expect(style).toContain("--cell-rgb");
    expect(style).toContain(COLOR_RGB[Color.PURPLE]);
    expect(button.getAttribute("aria-label")).toBe(
      "Row 2 column 2, occupied by Heart",
    );
    expect(button.getAttribute("aria-keyshortcuts")).toBe("5");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("forwards clicks on a playable cell", () => {
    const onClick = vi.fn();
    const { button } = renderCell({ onClick });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledWith(4);
  });

  it("swallows clicks on occupied and disabled cells", () => {
    const onClick = vi.fn();
    const occupied = renderCell({ ...occupiedMark, onClick });
    fireEvent.click(occupied.button);
    expect(onClick).not.toHaveBeenCalled();

    const disabled = renderCell({ isDisabled: true, onClick });
    fireEvent.click(disabled.button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("vanish ghost", () => {
  it("keeps a retired mark as a fading ghost when showVanish is on", () => {
    const { container, update } = renderCell({
      ...occupiedMark,
      showVanish: true,
    });
    expect(vanishing(container)).toHaveLength(0);

    // Board clears value, shape and colour in the same commit the mark
    // leaves — the ghost must come from what the cell USED to hold.
    update({ value: null, valueShape: undefined, valueColor: undefined });

    const ghosts = vanishing(container);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]?.getAttribute("class")).toContain("animate-vanish");
    expect(ghosts[0]?.querySelector("svg")?.getAttribute("class")).toContain(
      "text-mark-purple",
    );
    expect(container.querySelector("svg.animate-pop-in")).toBeNull();
  });

  it("removes a retired mark in a single frame when showVanish is off", () => {
    const { container, update } = renderCell(occupiedMark);
    update({ value: null, valueShape: undefined, valueColor: undefined });
    expect(vanishing(container)).toHaveLength(0);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("clears the ghost once the CSS vanish duration has played", () => {
    vi.useFakeTimers();
    const { container, update } = renderCell({
      ...occupiedMark,
      showVanish: true,
    });
    update({ value: null, valueShape: undefined, valueColor: undefined });
    expect(vanishing(container)).toHaveLength(1);

    const ms = cssVanishMs();
    act(() => {
      vi.advanceTimersByTime(ms - 1);
    });
    expect(vanishing(container)).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(vanishing(container)).toHaveLength(0);
  });

  it("drops the ghost if the cell is refilled before the fade ends", () => {
    vi.useFakeTimers();
    const { container, update } = renderCell({
      ...occupiedMark,
      showVanish: true,
    });
    update({ value: null, valueShape: undefined, valueColor: undefined });
    expect(vanishing(container)).toHaveLength(1);

    update(occupiedMark);
    expect(vanishing(container)).toHaveLength(0);
    expect(container.querySelector("svg.animate-pop-in")).not.toBeNull();
  });
});

describe("winning line and dimming", () => {
  it("lights a winning cell in the winner's colour via --player-color", () => {
    const { button } = renderCell({ ...occupiedMark, isWinningCell: true });
    const cls = button.getAttribute("class") ?? "";
    expect(cls).toContain("animate-win-claim");
    const style = button.getAttribute("style") ?? "";
    expect(style).toContain("--cell-rgb");
    expect(style).toContain("--player-color");
    expect(style).toContain(COLOR_RGB[Color.PURPLE]);
  });

  it("does not set the next-player colour override on an ordinary mark", () => {
    const { button } = renderCell(occupiedMark);
    const style = button.getAttribute("style") ?? "";
    expect(style).toContain("--cell-rgb");
    expect(style).not.toContain("--player-color");
  });

  it("dims non-winning marks to half opacity, and only real marks", () => {
    const dimmed = renderCell({ ...occupiedMark, isDimmed: true });
    expect(dimmed.button.getAttribute("class")).toContain("opacity-55");

    const fullWeight = renderCell(occupiedMark);
    expect(fullWeight.button.getAttribute("class")).not.toContain("opacity-55");

    const emptyDimmed = renderCell({ isDimmed: true });
    expect(emptyDimmed.button.getAttribute("class")).not.toContain("opacity-55");
  });
});

describe("next-to-remove wiggle", () => {
  it("wiggles the cell border and blinks the mark", () => {
    const { button, container } = renderCell({
      ...occupiedMark,
      isNextToRemove: true,
    });
    const cls = button.getAttribute("class") ?? "";
    expect(cls).toContain("animate-wiggle");
    expect(cls).toContain("border-2");
    expect(
      container.querySelector("svg.animate-pop-in")?.getAttribute("class"),
    ).toContain("animate-sos-blink");
  });

  it("never wiggles a winning cell", () => {
    const { button } = renderCell({
      ...occupiedMark,
      isNextToRemove: true,
      isWinningCell: true,
    });
    const cls = button.getAttribute("class") ?? "";
    expect(cls).not.toContain("animate-wiggle");
    expect(cls).toContain("animate-win-claim");
  });
});

describe("accessible name", () => {
  it("announces a hinted empty cell as a suggested move", () => {
    const { button } = renderCell({ isHint: true });
    expect(button.getAttribute("aria-label")).toBe(
      "Row 2 column 2, empty, suggested move",
    );
  });

  it("appends the disabled reason to an unplayable cell", () => {
    const { button } = renderCell({
      isDisabled: true,
      disabledReason: "waiting for the computer to move",
    });
    expect(button.getAttribute("aria-label")).toBe(
      "Row 2 column 2, empty, waiting for the computer to move",
    );
  });

  it("keeps reason and hint together when both apply", () => {
    const { button } = renderCell({
      isDisabled: true,
      disabledReason: "game is paused",
      isHint: true,
    });
    expect(button.getAttribute("aria-label")).toBe(
      "Row 2 column 2, empty, game is paused, suggested move",
    );
  });

  it("announces a mark that is next to be removed", () => {
    const { button } = renderCell({
      value: PlayerSymbol.O,
      valueShape: SymbolShape.CRESCENT,
      valueColor: Color.GREEN,
      isNextToRemove: true,
    });
    expect(button.getAttribute("aria-label")).toBe(
      "Row 2 column 2, occupied by Crescent, next to be removed",
    );
  });
});

describe("hover preview", () => {
  const previewProps = {
    isHovered: true,
    previewPlayer: PlayerSymbol.O,
    previewColor: Color.GREEN,
    previewShape: SymbolShape.CRESCENT,
  } satisfies Partial<CellProps>;

  it("shows the pending mark as a translucent ghost while hovered", () => {
    const { container } = renderCell(previewProps);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    const cls = svgs[0]?.getAttribute("class") ?? "";
    expect(cls).toContain("opacity-30");
    expect(cls).toContain("scale-90");
    expect(cls).not.toContain("animate-pop-in");
    expect(cls).toContain("text-mark-green");
  });

  it("withholds the preview on a disabled cell", () => {
    const { container } = renderCell({ ...previewProps, isDisabled: true });
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("does not preview over an occupied cell", () => {
    const { container } = renderCell({ ...previewProps, ...occupiedMark });
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    const cls = svgs[0]?.getAttribute("class") ?? "";
    expect(cls).toContain("animate-pop-in");
    expect(cls).not.toContain("opacity-30");
  });
});

describe("vanish timing contract", () => {
  it("keeps VANISH_MS equal to the animate-vanish duration in index.css", () => {
    const declared = cellSource().match(/const\s+VANISH_MS\s*=\s*(\d+)/);
    expect(declared).not.toBeNull();
    expect(Number(declared?.[1])).toBe(cssVanishMs());
  });
});
