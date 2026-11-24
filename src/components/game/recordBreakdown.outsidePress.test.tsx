"@vitest-environment jsdom";

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AI_Difficulty, GameModes } from "@/game/constants";
import { breakdownKey, type GameStats } from "@/hooks/useGameStats";
import { RecordBreakdown } from "./recordBreakdown";

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

const renderBreakdown = (children?: React.ReactNode) => {
  render(
    <>
      <RecordBreakdown
        stats={stats({
          [breakdownKey(GameModes.VS_COMPUTER, AI_Difficulty.NORMAL)]: {
            wins: 1,
            losses: 1,
          },
        })}
        gameMode={GameModes.VS_COMPUTER}
      >
        {children}
      </RecordBreakdown>
      <div data-testid="outside" />
    </>,
  );
};

afterEach(cleanup);

describe("RecordBreakdown outside press", () => {
  it("closes a pinned breakdown when the press lands outside it", () => {
    renderBreakdown();

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();

    const outside = screen.getByTestId("outside");
    expect(outside.hasAttribute("tabindex")).toBe(false);
    fireEvent.click(outside);
    expect(document.activeElement).not.toBe(outside);
    expect(panel()).toBeNull();
  });

  it("keeps the breakdown open when the press lands inside the panel", () => {
    renderBreakdown();

    fireEvent.click(trigger());
    const open = panel();
    expect(open).not.toBeNull();

    fireEvent.click(open as HTMLElement);
    expect(panel()).not.toBeNull();
  });

  it("keeps the breakdown open when the press lands inside the trigger wrapper", () => {
    renderBreakdown("4W · 2L");

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();

    fireEvent.click(screen.getByText("4W · 2L"));
    expect(panel()).not.toBeNull();
  });

  it("still closes on Escape while pinned", () => {
    renderBreakdown();

    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(panel()).toBeNull();
  });
});
