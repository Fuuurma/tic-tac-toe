"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { freshGameState, type GameState } from "@/game/logic";
import { GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import { setLocale } from "@/i18n/language";

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
  setLocale("en");
  cleanup();
});

const forfeitedWin = (): GameState => {
  const state = freshGameState();
  state.gameMode = GameModes.ONLINE;
  state.gameStatus = GameStatus.COMPLETED;
  state.winner = PlayerSymbol.X;
  state.forfeited = true;
  state.moveCount = 4;
  state.players[PlayerSymbol.X].username = "Host";
  state.players[PlayerSymbol.O].username = "Guest";
  return state;
};

const earnedWin = (): GameState => {
  const state = forfeitedWin();
  delete state.forfeited;
  return state;
};

const renderPanel = (
  state: GameState,
  props: Partial<ComponentProps<typeof PlayersPanel>> = {},
) =>
  render(
    <PlayersPanel
      gameState={state}
      gameMode={GameModes.ONLINE}
      message=""
      onExit={vi.fn()}
      onNewGame={vi.fn()}
      {...props}
    />,
  );

describe("PlayersPanel forfeit terminal state", () => {
  it("announces the forfeit instead of an earned win, with no crown", () => {
    const { container } = renderPanel(forfeitedWin());

    const headline = screen.getByText("You won - opponent left");
    expect(headline.getAttribute("role")).toBe("status");
    expect(headline.className).toContain("sr-only");
    expect(screen.queryByText("Host wins!")).toBeNull();
    expect(container.querySelector(".animate-crown-pop")).toBeNull();
  });

  it("names who left on the visible line", () => {
    renderPanel(forfeitedWin());

    const left = screen.getByText("Guest left the game");
    expect(left.getAttribute("role")).toBe("status");
    expect(left.className).not.toContain("sr-only");
  });

  it("names the departed player whichever side survived", () => {
    const state = forfeitedWin();
    state.winner = PlayerSymbol.O;
    renderPanel(state);

    expect(screen.getByText("You won - opponent left")).toBeTruthy();
    expect(screen.getByText("Host left the game")).toBeTruthy();
  });

  it("keeps the earned-win headline and crown when forfeited is absent", () => {
    const { container } = renderPanel(earnedWin());

    const headline = screen.getByText("Host wins!");
    expect(headline.getAttribute("role")).toBe("status");
    expect(headline.className).toContain("sr-only");
    expect(container.querySelector(".animate-crown-pop")).toBeTruthy();
    expect(screen.queryByText("You won - opponent left")).toBeNull();
    expect(screen.queryByText("Guest left the game")).toBeNull();
  });

  it("renders the forfeit copy in Spanish", () => {
    setLocale("es");
    renderPanel(forfeitedWin());

    expect(screen.getByText("Has ganado - tu rival se ha ido")).toBeTruthy();
    expect(screen.getByText("Guest ha salido de la partida")).toBeTruthy();
    expect(screen.queryByText("You won - opponent left")).toBeNull();
  });
});
