// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { freshGameState, type GameState } from "@/game/logic";
import { GameModes, GameStatus, PlayerSymbol, PlayerTypes, AI_Difficulty } from "@/game/constants";

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

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

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

const activeOnlineState = (): GameState => {
  const state = freshGameState();
  state.gameMode = GameModes.ONLINE;
  state.gameStatus = GameStatus.ACTIVE;
  state.moveCount = 1;
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

describe("PlayersPanel confirmation lifecycle", () => {
  it("unpauses and discards an exit confirmation when the online game ends", () => {
    const onPauseChange = vi.fn();
    const onExit = vi.fn();
    const { rerender } = render(
      <PlayersPanel
        gameState={activeOnlineState()}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={onExit}
        onPauseChange={onPauseChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    const dialog = screen
      .getByText("Leave the room? Your opponent will be notified.")
      .closest("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(onPauseChange).toHaveBeenLastCalledWith(true);

    rerender(
      <PlayersPanel
        gameState={terminalState()}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={onExit}
        onPauseChange={onPauseChange}
      />,
    );
    expect(dialog.open).toBe(false);
    expect(onPauseChange).toHaveBeenLastCalledWith(false);

    const freshGame = activeOnlineState();
    freshGame.moveCount = 0;
    rerender(
      <PlayersPanel
        gameState={freshGame}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={onExit}
        onPauseChange={onPauseChange}
      />,
    );
    rerender(
      <PlayersPanel
        gameState={activeOnlineState()}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={onExit}
        onPauseChange={onPauseChange}
      />,
    );

    expect(dialog.open).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
  });

  it("releases an exit-confirmation pause when the panel unmounts", () => {
    const onPauseChange = vi.fn();
    const { unmount } = render(
      <PlayersPanel
        gameState={activeOnlineState()}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={vi.fn()}
        onPauseChange={onPauseChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(onPauseChange).toHaveBeenLastCalledWith(true);

    unmount();

    expect(onPauseChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps an exit-confirmation pause when the callback identity changes", () => {
    const firstPauseChange = vi.fn();
    const nextPauseChange = vi.fn();
    const props = {
      gameState: activeOnlineState(),
      gameMode: GameModes.ONLINE,
      message: "",
      onExit: vi.fn(),
    };
    const { rerender } = render(
      <PlayersPanel {...props} onPauseChange={firstPauseChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    const dialog = screen
      .getByText("Leave the room? Your opponent will be notified.")
      .closest("dialog") as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(firstPauseChange).toHaveBeenLastCalledWith(true);

    rerender(<PlayersPanel {...props} onPauseChange={nextPauseChange} />);

    expect(dialog.open).toBe(true);
    expect(firstPauseChange).not.toHaveBeenLastCalledWith(false);
    expect(nextPauseChange).not.toHaveBeenCalled();
  });
});

describe("PlayersPanel room-code chip", () => {
  it("copies the room code to the clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const state = terminalState();
    state.gameStatus = GameStatus.ACTIVE;
    state.winner = null;
    render(
      <PlayersPanel
        gameState={state}
        message=""
        roomCode="AB3XK9"
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Room code AB3XK9, click to copy" }),
    );

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("AB3XK9"));
  });
});

describe("PlayersPanel AI difficulty label", () => {
  const vsComputerState = (): GameState => {
    const state = freshGameState();
    state.gameMode = GameModes.VS_COMPUTER;
    state.gameStatus = GameStatus.ACTIVE;
    state.players[PlayerSymbol.O].type = PlayerTypes.COMPUTER;
    state.players[PlayerSymbol.O].username = "CPU";
    return state;
  };

  it("labels the computer card with the tier passed by App (F578: the creation tier)", () => {
    render(
      <PlayersPanel
        gameState={vsComputerState()}
        aiDifficulty={AI_Difficulty.HARD}
        message=""
        onExit={vi.fn()}
      />,
    );

    expect(screen.queryByText("(Hard)")).not.toBeNull();
  });

  it("labels no card without a difficulty (friend games pass undefined)", () => {
    render(<PlayersPanel gameState={vsComputerState()} message="" onExit={vi.fn()} />);

    expect(screen.queryByText("(Hard)")).toBeNull();
  });
});
