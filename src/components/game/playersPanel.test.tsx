// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { freshGameState, type GameState } from "@/game/logic";
import { GameModes, GameStatus, PlayerSymbol } from "@/game/constants";

// The orbs animate on canvas, which jsdom does not implement. They only
// mount mid-game (isCurrent) and are unrelated to the rematch CTA wiring
// under test here.
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// useLayoutEffect measures the panel; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(cleanup);

const terminalState = (): GameState => {
  const state = freshGameState();
  state.gameMode = GameModes.ONLINE;
  state.gameStatus = GameStatus.COMPLETED;
  state.winner = PlayerSymbol.X;
  state.moveCount = 5;
  state.players[PlayerSymbol.X].username = "Host";
  state.players[PlayerSymbol.O].username = "Guest";
  return state;
};

describe("PlayersPanel terminal rematch CTA", () => {
  it("renders a labeled Rematch button that fires onRequestRematch (host)", () => {
    const onRequestRematch = vi.fn();
    render(
      <PlayersPanel
        gameState={terminalState()}
        message=""
        onExit={vi.fn()}
        onRequestRematch={onRequestRematch}
      />,
    );

    const cta = screen.getByRole("button", { name: "Rematch" });
    fireEvent.click(cta);
    expect(onRequestRematch).toHaveBeenCalledOnce();
  });

  it("swaps the Rematch CTA for Cancel rematch while a request is pending", () => {
    const onCancelRematch = vi.fn();
    render(
      <PlayersPanel
        gameState={terminalState()}
        message="Waiting for opponent to accept rematch"
        onExit={vi.fn()}
        onCancelRematch={onCancelRematch}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Rematch" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel rematch" }));
    expect(onCancelRematch).toHaveBeenCalledOnce();
  });

  it("keeps the guest accept/decline prompt on the incoming request", () => {
    const onAcceptRematch = vi.fn();
    const onDeclineRematch = vi.fn();
    render(
      <PlayersPanel
        gameState={terminalState()}
        message="Host wants a rematch."
        onExit={vi.fn()}
        onAcceptRematch={onAcceptRematch}
        onDeclineRematch={onDeclineRematch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Accept rematch" }));
    expect(onAcceptRematch).toHaveBeenCalledOnce();
    expect(onDeclineRematch).not.toHaveBeenCalled();
  });

  it("renders no rematch CTA when no rematch handler is provided (local play)", () => {
    render(
      <PlayersPanel
        gameState={terminalState()}
        message=""
        onExit={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /rematch/i }),
    ).toBeNull();
  });

  it("shows no end-game actions while the game is active", () => {
    const active = terminalState();
    active.gameStatus = GameStatus.ACTIVE;
    active.winner = null;
    render(
      <PlayersPanel
        gameState={active}
        message=""
        onExit={vi.fn()}
        onRequestRematch={vi.fn()}
        onAcceptRematch={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /rematch/i }),
    ).toBeNull();
  });
});
