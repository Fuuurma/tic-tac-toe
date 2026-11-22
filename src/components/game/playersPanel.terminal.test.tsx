"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { freshGameState, type GameState } from "@/game/logic";
import { Color, GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
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

const terminalDraw = (): GameState => {
  const state = freshGameState();
  state.gameMode = GameModes.ONLINE;
  state.gameStatus = GameStatus.COMPLETED;
  state.winner = null;
  state.moveCount = 5;
  state.players[PlayerSymbol.X].username = "Host";
  state.players[PlayerSymbol.O].username = "Guest";
  return state;
};

const terminalWin = (): GameState => {
  const state = terminalDraw();
  state.winner = PlayerSymbol.X;
  state.players[PlayerSymbol.X].color = Color.PURPLE;
  state.players[PlayerSymbol.O].color = Color.GREEN;
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

describe("PlayersPanel winnerless terminal state", () => {
  it("announces the draw screen-reader-only and stops the timer", () => {
    renderPanel(terminalDraw());

    const draw = screen.getByText("It's a draw.");
    expect(draw.getAttribute("role")).toBe("status");
    expect(draw.className).toContain("sr-only");
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("stays neutral: no crown, no winner tint, no card claims the win", () => {
    const { container } = renderPanel(terminalDraw());

    expect(screen.getByText("It's a draw.")).toBeTruthy();
    expect(container.querySelector(".animate-crown-pop")).toBeNull();
    const again = screen.getByRole("button", { name: "Play again" });
    expect(again.getAttribute("style") ?? "").not.toContain("--glass-tint");
    for (const card of screen.getAllByRole("group")) {
      expect(card.getAttribute("aria-label")).not.toContain("winner");
    }
  });

  it("offers the same rematch action the winner card shows", () => {
    const onRequestRematch = vi.fn();
    renderPanel(terminalDraw(), { onRequestRematch });

    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    expect(onRequestRematch).toHaveBeenCalledOnce();
  });

  it("announces the draw in Spanish", () => {
    setLocale("es");
    renderPanel(terminalDraw());

    const draw = screen.getByText("Es un empate.");
    expect(draw.getAttribute("role")).toBe("status");
    expect(draw.className).toContain("sr-only");
  });

  it("stays silent on a WAITING game that has not started", () => {
    const waiting = terminalDraw();
    waiting.gameStatus = GameStatus.WAITING;
    waiting.moveCount = 0;
    renderPanel(waiting);

    expect(screen.queryByText("It's a draw.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Rematch" })).toBeNull();
  });
});

describe("PlayersPanel winner terminal state", () => {
  it("keeps the winner card: sr-only headline, crown, owner-colour tint", () => {
    const { container } = renderPanel(terminalWin());

    const headline = screen.getByText("Host wins!");
    expect(headline.getAttribute("role")).toBe("status");
    expect(headline.className).toContain("sr-only");
    expect(container.querySelector(".animate-crown-pop")).toBeTruthy();
    expect(screen.queryByText("It's a draw.")).toBeNull();

    const again = screen.getByRole("button", { name: "Play again" });
    const style = again.getAttribute("style") ?? "";
    expect(style).toContain("--glass-tint");
    expect(style).toContain("128 71 225");
  });
});
