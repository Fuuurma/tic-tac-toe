"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { freshGameState, type GameState } from "@/game/logic";
import { GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import type { GameStats } from "@/hooks/useGameStats";
import { setLocale } from "@/i18n/language";

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

afterEach(() => {
  cleanup();
  setLocale("en");
});

const stats = (overrides: Partial<GameStats>): GameStats => ({
  totalGames: 12,
  wins: 8,
  losses: 4,
  currentWinStreak: 2,
  bestWinStreak: 10,
  breakdown: {},
  ...overrides,
});

const activeState = (): GameState => {
  const state = freshGameState();
  state.gameMode = GameModes.VS_COMPUTER;
  state.gameStatus = GameStatus.ACTIVE;
  state.moveCount = 1;
  state.players[PlayerSymbol.X].username = "Ada";
  return state;
};

const renderPanel = (gameStats: GameStats) =>
  render(
    <PlayersPanel
      gameState={activeState()}
      gameMode={GameModes.VS_COMPUTER}
      stats={gameStats}
      message=""
      onExit={vi.fn()}
    />,
  );

describe("PlayersPanel best win streak", () => {
  it("renders the best streak next to the current one", () => {
    const { container } = renderPanel(stats({}));

    expect(screen.getByText("Best 10")).toBeTruthy();
    const streak = container.querySelector(".text-amber-500");
    expect(streak).not.toBeNull();
    expect(streak!.textContent).toContain("2");
  });

  it("still shows the best after the current streak ends", () => {
    const { container } = renderPanel(
      stats({ currentWinStreak: 0, bestWinStreak: 7, wins: 5, losses: 7 }),
    );

    expect(screen.getByText("Best 7")).toBeTruthy();
    expect(container.querySelector(".text-amber-500")).toBeNull();
  });

  it("renders the best streak in Spanish", () => {
    setLocale("es");
    renderPanel(stats({}));

    expect(screen.getByText("Mejor racha: 10")).toBeTruthy();
  });

  it("adds nothing before the first recorded game", () => {
    renderPanel(
      stats({
        totalGames: 0,
        wins: 0,
        losses: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
      }),
    );

    expect(screen.queryByText(/Best \d/)).toBeNull();
    expect(screen.queryByText(/\d+ wins/)).toBeNull();
  });
});
