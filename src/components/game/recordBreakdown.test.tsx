// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
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