// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AI_Difficulty, GameModes } from "@/game/constants";
import { breakdownKey, type GameStats } from "@/hooks/useGameStats";
import { RecordBreakdown } from "./recordBreakdown";

/**
 * The record breakdown is reachable two ways on purpose: hover for
 * pointer users, click (pinned) for touch, where hover never fires. Both
 * paths must open the same panel, and a pinned panel must never be left
 * stranded over the board.
 */

const stats = (breakdown: GameStats["breakdown"]): GameStats => ({
  totalGames: 6,
  wins: 4,
  losses: 2,
  currentWinStreak: 0,
  bestWinStreak: 3,
  breakdown,
});

const trigger = () => screen.getByRole("button", { name: "Show record breakdown" });
const panel = () => screen.queryByRole("group", { name: /record by mode/i });

afterEach(cleanup);

describe("RecordBreakdown", () => {
  it("stays closed until the trigger is hovered or pressed", () => {
    render(
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
            wins: 4,
            losses: 2,
          },
        })}
        gameMode={GameModes.VS_COMPUTER}
      />,
    );

    expect(panel()).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");

    fireEvent.mouseEnter(trigger().parentElement!);
    expect(panel()).not.toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("opens on click alone, so a touch device is not locked out", () => {
    render(
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.NORMAL)]: {
            wins: 1,
            losses: 1,
          },
        })}
        gameMode={GameModes.VS_COMPUTER}
      />,
    );

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
  });

  it("lists one row per difficulty with its own tally", () => {
    render(
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: {
            wins: 4,
            losses: 2,
          },
        })}
        gameMode={GameModes.VS_COMPUTER}
      />,
    );

    fireEvent.click(trigger());
    const panelEl = panel()!;
    expect(panelEl.textContent).toContain("Easy");
    expect(panelEl.textContent).toContain("Normal");
    expect(panelEl.textContent).toContain("Hard");
    expect(panelEl.textContent).toContain("4W");
    expect(panelEl.textContent).toContain("2L");
    // A difficulty never played reads as empty instead of a bare 0-0.
    expect(panelEl.textContent).toContain("No games");
  });

  it("closes on click again and on Escape while pinned", () => {
    render(
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.EASY)]: {
            wins: 1,
            losses: 0,
          },
        })}
        gameMode={GameModes.VS_COMPUTER}
      />,
    );

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    fireEvent.click(trigger());
    expect(panel()).toBeNull();

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(panel()).toBeNull();
  });

  // The trigger is a real button, so Enter and Space activate it natively:
  // keyboard users get the same panel without a focus-only open path.
  it("exposes the panel through a labelled button for keyboard users", () => {
    render(
      <RecordBreakdown
        stats={stats({
          [GameModes.ONLINE]: { wins: 2, losses: 1 },
        })}
        gameMode={GameModes.ONLINE}
      />,
    );

    expect(trigger().tagName).toBe("BUTTON");
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(panel()!.textContent).toContain("Online");
  });

  it("renders no trigger at all when there is nothing to break down", () => {
    render(<RecordBreakdown stats={stats({})} gameMode={undefined} />);
    expect(trigger()).toBeDefined();
    fireEvent.click(trigger());
    // No mode and no record means no rows, so no empty panel over the board.
    expect(panel()).toBeNull();
  });
});
describe("RecordBreakdown placement", () => {
  // The panel is measured and placed against the viewport, because the trigger
  // is the last thing in a phone header: a `left-0` panel ran 14px off the
  // right edge at 390. These cases prove the wiring, not the arithmetic —
  // `placePanel` owns the rules and is covered on its own.
  const rect = { top: 800, left: 350, width: 24, height: 24, right: 374, bottom: 824, x: 350, y: 800, toJSON: () => ({}) };

  function withGeometry({ panelWidth = 200, panelHeight = 140, viewport = { width: 390, height: 900 } } = {}) {
    const rectSpy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rect as DOMRect);
    const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(panelWidth);
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(panelHeight);
    const vw = vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(viewport.width);
    const vh = vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(viewport.height);
    return () => [rectSpy, width, height, vw, vh].forEach((spy) => spy.mockRestore());
  }

  const openPanel = () => {
    render(
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.HARD)]: { wins: 4, losses: 2 },
          [breakdownKey(GameModes.VS_FRIEND)]: { wins: 2, losses: 1 },
        })}
        gameMode={GameModes.VS_COMPUTER}
      />,
    );
    fireEvent.click(trigger());
    return panel() as HTMLElement;
  };

  it("flips above the trigger when the bottom of the screen is crowded", () => {
    const restore = withGeometry();
    const el = openPanel();
    // 800 + 24 + 6 = 830 below would end at 970 in a 900 viewport; above is
    // 654. The offset is anchor-relative, so 654 - 800.
    expect(el.style.top).toBe("-146px");
    restore();
  });

  it("shifts left instead of hanging off the right edge", () => {
    const restore = withGeometry();
    const el = openPanel();
    // A 200px panel from x=350 on a 390 viewport starts at 182, not 350.
    expect(el.style.left).toBe("-168px");
    expect(el.style.top).toBe("-146px");
    restore();
  });

  it("is invisible until it has been measured", () => {
    render(
      <RecordBreakdown
        stats={stats({ [breakdownKey(GameModes.VS_FRIEND)]: { wins: 1, losses: 0 } })}
        gameMode={GameModes.VS_FRIEND}
      />,
    );
    fireEvent.click(trigger());
    // With no layout in jsdom the panel still gets a clamped position rather
    // than a raw 0,0 flash.
    expect((panel() as HTMLElement).className).not.toContain("invisible");
  });
});

describe("RecordBreakdown on a touch screen", () => {
  // A touch tap fires a synthetic mouseenter with no matching mouseleave, so a
  // hover-driven panel latched open and the second tap could not close it.
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  const stubHover = (canHoverPointer: boolean) => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("hover") ? canHoverPointer : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  };

  it("ignores hover when the pointer is coarse", () => {
    stubHover(false);
    render(
      <RecordBreakdown
        stats={stats({ [breakdownKey(GameModes.VS_FRIEND)]: { wins: 1, losses: 0 } })}
        gameMode={GameModes.VS_FRIEND}
      />,
    );
    fireEvent.mouseEnter(trigger().parentElement as HTMLElement);
    expect(panel()).toBeNull();
    // A tap still works.
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
  });

  it("opens on hover when the pointer is fine", () => {
    stubHover(true);
    render(
      <RecordBreakdown
        stats={stats({ [breakdownKey(GameModes.VS_FRIEND)]: { wins: 1, losses: 0 } })}
        gameMode={GameModes.VS_FRIEND}
      />,
    );
    fireEvent.mouseEnter(trigger().parentElement as HTMLElement);
    expect(panel()).not.toBeNull();
  });
});
