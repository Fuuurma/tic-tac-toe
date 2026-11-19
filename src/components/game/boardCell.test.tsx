// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { COLOR_RGB, Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { BoardCell } from "./boardCell";

/**
 * Direct pins for BoardCell's own contract. Every behaviour below used to be
 * reachable only through Board's nine-cell render — the vanish ghost's
 * teardown, the win/dim treatments, the next-to-remove wiggle, the hint and
 * disabled-reason names, and the hover preview are all props Board computes.
 * Mounting the cell alone puts each assertion on the seam the component
 * itself owns.
 *
 * VANISH_MS is module-private, so the ghost teardown is pinned behaviourally
 * against the `vanish` duration declared in index.css: the ghost must still
 * be mounted one millisecond before the CSS animation ends and gone when it
 * does. (src/__tests__/vanishDuration.test.ts pins the same coupling at
 * source level; this one fails if the *effective* timeout drifts.)
 */

type CellProps = React.ComponentProps<typeof BoardCell>;

// new URL("../index.css", import.meta.url) would be rewritten to the dev
// server's asset URL, not a file path — derive the directory instead.
const indexCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "index.css"),
  "utf8",
);

/** Milliseconds the `vanish` keyframe runs, parsed from @utility animate-vanish. */
function cssVanishMs(): number {
  const utility = indexCss.match(/@utility\s+animate-vanish\s*\{([^}]*)\}/);
  expect(utility, "src/index.css should define @utility animate-vanish").not.toBeNull();
  const seconds = Number(
    utility![1]!.match(/animation:\s*vanish\s+([\d.]+)s\b/)?.[1],
  );
  expect(
    Number.isFinite(seconds),
    "@utility animate-vanish should time `vanish` in seconds",
  ).toBe(true);
  return Math.round(seconds * 1000);
}

function baseProps(overrides: Partial<CellProps> = {}): CellProps {
  return {
    index: 4, // row 2, column 2 in the accessible name
    value: null,
    isNextToRemove: false,
    isWinningCell: false,
    isDisabled: false,
    isHovered: false,
    onClick: () => {},
    ...overrides,
  };
}

const ghostEl = (container: HTMLElement) =>
  container.querySelector('[data-vanishing="true"]');

/** The live mark svg carries animate-pop-in; the ghost's and the preview's do not. */
const markSvg = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("svg")).find((svg) =>
    svg.getAttribute("class")?.includes("animate-pop-in"),
  );

/** The hover preview is the only svg dimmed to opacity-30. */
const previewSvg = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("svg")).find((svg) =>
    svg.getAttribute("class")?.includes("opacity-30"),
  );

beforeAll(() => {
  // act() needs the flag, but setting it at module load leaks it to every
  // test file sharing the worker's globalThis — scope it to this suite.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
});

afterAll(() => {
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BoardCell marks", () => {
  it("renders a placed mark in its colour and names it by shape", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.HEART,
          valueColor: Color.PURPLE,
        })}
      />,
    );

    const mark = markSvg(container);
    expect(mark?.getAttribute("class")).toContain("animate-pop-in");
    expect(mark?.getAttribute("class")).toContain("text-mark-purple");

    const button = screen.getByRole("button", {
      name: "Row 2 column 2, occupied by Heart",
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("forwards clicks with the cell index only while playable", () => {
    const onClick = vi.fn();
    const { rerender } = render(<BoardCell {...baseProps({ onClick })} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(4);

    rerender(
      <BoardCell
        {...baseProps({
          onClick,
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("vanish ghost", () => {
  it("keeps a retired mark fading for exactly the CSS vanish duration", () => {
    vi.useFakeTimers();
    const vanishMs = cssVanishMs();
    const { container, rerender } = render(<BoardCell {...baseProps()} />);

    // Place, then retire the mark — the transition the ghost exists for.
    rerender(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.HEART,
          valueColor: Color.PURPLE,
          showVanish: true,
        })}
      />,
    );
    expect(markSvg(container)).toBeTruthy();

    rerender(
      <BoardCell
        {...baseProps({
          value: null,
          valueShape: undefined,
          valueColor: undefined,
          showVanish: true,
        })}
      />,
    );

    // The live mark is gone; what remains is the fading ghost span.
    expect(markSvg(container)).toBeUndefined();
    const ghost = ghostEl(container);
    expect(ghost).toBeTruthy();
    expect(ghost?.getAttribute("class")).toContain("animate-vanish");

    act(() => {
      vi.advanceTimersByTime(vanishMs - 1);
    });
    expect(ghostEl(container)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ghostEl(container)).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("carries the retired mark's shape and colour onto the ghost", () => {
    const { container, rerender } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.HEART,
          valueColor: Color.PURPLE,
          showVanish: true,
        })}
      />,
    );
    const markPath = markSvg(container)
      ?.querySelector("path")
      ?.getAttribute("d");
    expect(markPath).toBeTruthy();

    rerender(<BoardCell {...baseProps({ showVanish: true })} />);

    const ghostSvg = ghostEl(container)?.querySelector("svg");
    expect(ghostSvg?.getAttribute("class")).toContain("text-mark-purple");
    expect(ghostSvg?.querySelector("path")?.getAttribute("d")).toBe(markPath);
  });

  it("removes a retired mark in one frame when showVanish is off", () => {
    const { container, rerender } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
        })}
      />,
    );
    rerender(<BoardCell {...baseProps()} />);

    expect(ghostEl(container)).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("drops a showing ghost the moment a new mark lands", () => {
    const { container, rerender } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
          showVanish: true,
        })}
      />,
    );
    rerender(<BoardCell {...baseProps({ showVanish: true })} />);
    expect(ghostEl(container)).toBeTruthy();

    rerender(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.O,
          valueShape: SymbolShape.O,
          valueColor: Color.RED,
          showVanish: true,
        })}
      />,
    );
    expect(ghostEl(container)).toBeNull();
    expect(markSvg(container)).toBeTruthy();
  });
});

describe("winning line and dimming", () => {
  it("lights a winning cell in the mark's own colour", () => {
    render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.HEART,
          valueColor: Color.PURPLE,
          isWinningCell: true,
        })}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("animate-win-claim");
    expect(button.style.getPropertyValue("--player-color")).toBe(
      COLOR_RGB[Color.PURPLE],
    );
    expect(button.style.getPropertyValue("--cell-rgb")).toBe(
      COLOR_RGB[Color.PURPLE],
    );
    expect(button.className).not.toContain("opacity-55");
  });

  it("does not claim the player-colour token on a non-winning mark", () => {
    render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
        })}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.style.getPropertyValue("--cell-rgb")).toBe(
      COLOR_RGB[Color.BLUE],
    );
    expect(button.style.getPropertyValue("--player-color")).toBe("");
    expect(button.className).not.toContain("animate-win-claim");
  });

  it("dims a mark that is not on the winning line, keeping its colour", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.O,
          valueShape: SymbolShape.O,
          valueColor: Color.RED,
          isDimmed: true,
        })}
      />,
    );
    expect(screen.getByRole("button").className).toContain("opacity-55");
    expect(markSvg(container)?.getAttribute("class")).toContain(
      "text-mark-red",
    );
  });

  it("dims only occupied cells — an empty cell stays full weight", () => {
    render(<BoardCell {...baseProps({ isDimmed: true })} />);
    expect(screen.getByRole("button").className).not.toContain("opacity-55");
  });
});

describe("next to remove", () => {
  it("wriggles the border and blinks the mark awaiting removal", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
          isNextToRemove: true,
        })}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Row 2 column 2, occupied by X, next to be removed",
    });
    expect(button.className).toContain("animate-wiggle");
    expect(button.className).toContain("border-blue-500/70");
    expect(markSvg(container)?.getAttribute("class")).toContain(
      "animate-sos-blink",
    );
  });

  it("does not wiggle a winning cell", () => {
    render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
          isNextToRemove: true,
          isWinningCell: true,
        })}
      />,
    );
    expect(screen.getByRole("button").className).not.toContain(
      "animate-wiggle",
    );
  });
});

describe("accessible name", () => {
  it("names a hint cell as the suggested move", () => {
    render(<BoardCell {...baseProps({ index: 0, isHint: true })} />);
    const button = screen.getByRole("button", {
      name: "Row 1 column 1, empty, suggested move",
    });
    expect(button.className).toContain("animate-pulse-slow");
  });

  it("appends the disabled reason to an empty cell", () => {
    render(
      <BoardCell
        {...baseProps({
          index: 8,
          isDisabled: true,
          disabledReason: "waiting for the computer to move",
        })}
      />,
    );
    screen.getByRole("button", {
      name: "Row 3 column 3, empty, waiting for the computer to move",
    });
  });

  it("combines reason and hint in one name", () => {
    render(
      <BoardCell
        {...baseProps({
          disabledReason: "game is paused",
          isHint: true,
        })}
      />,
    );
    screen.getByRole("button", {
      name: "Row 2 column 2, empty, game is paused, suggested move",
    });
  });

  it("keeps the occupied name when a hint or reason is also set", () => {
    render(
      <BoardCell
        {...baseProps({
          value: PlayerSymbol.O,
          valueShape: SymbolShape.O,
          valueColor: Color.RED,
          isHint: true,
          disabledReason: "game is paused",
        })}
      />,
    );
    screen.getByRole("button", { name: "Row 2 column 2, occupied by O" });
  });
});

describe("hover preview", () => {
  it("renders a faded preview of the incoming mark while hovered", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          isHovered: true,
          previewPlayer: PlayerSymbol.O,
          previewColor: Color.GREEN,
          previewShape: SymbolShape.CRESCENT,
        })}
      />,
    );
    const preview = previewSvg(container);
    expect(preview?.getAttribute("class")).toContain("opacity-30");
    expect(preview?.getAttribute("class")).toContain("text-mark-green");
    // The preview is visual-only: the accessible name stays plain "empty".
    screen.getByRole("button", { name: "Row 2 column 2, empty" });
  });

  it("shows no preview when the cell is not hovered", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          previewPlayer: PlayerSymbol.O,
          previewColor: Color.GREEN,
          previewShape: SymbolShape.CRESCENT,
        })}
      />,
    );
    expect(previewSvg(container)).toBeUndefined();
  });

  it("shows no preview on an occupied cell", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          isHovered: true,
          value: PlayerSymbol.X,
          valueShape: SymbolShape.X,
          valueColor: Color.BLUE,
          previewPlayer: PlayerSymbol.O,
          previewColor: Color.GREEN,
          previewShape: SymbolShape.CRESCENT,
        })}
      />,
    );
    expect(previewSvg(container)).toBeUndefined();
  });

  it("shows no preview while the cell is disabled", () => {
    const { container } = render(
      <BoardCell
        {...baseProps({
          isHovered: true,
          isDisabled: true,
          previewPlayer: PlayerSymbol.O,
          previewColor: Color.GREEN,
          previewShape: SymbolShape.CRESCENT,
        })}
      />,
    );
    expect(previewSvg(container)).toBeUndefined();
  });

  it("reports hover through onHover on focus and blur", () => {
    const onHover = vi.fn();
    render(<BoardCell {...baseProps({ onHover })} />);
    const button = screen.getByRole("button");

    fireEvent.focus(button);
    expect(onHover).toHaveBeenCalledWith(4);
    fireEvent.blur(button);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });
});
