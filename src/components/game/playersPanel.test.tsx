// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

describe("PlayersPanel in-play HUD economy", () => {
  const renderPanel = (state: GameState, message = "") =>
    render(
      <PlayersPanel
        gameState={state}
        gameMode={GameModes.ONLINE}
        message={message}
        onExit={vi.fn()}
        onNewGame={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
  const bar = () => screen.getByRole("toolbar", { name: "Game actions" });

  it("hides action words while playing; icons keep their accessible names", () => {
    renderPanel(activeOnlineState());

    expect(within(bar()).queryByText("Settings")).toBeNull();
    expect(within(bar()).queryByText("New game")).toBeNull();
    expect(within(bar()).queryByText("Leave")).toBeNull();
    expect(
      within(bar()).getByRole("button", { name: "Settings" }),
    ).toBeTruthy();
    expect(
      within(bar()).getByRole("button", { name: "Start a new game" }),
    ).toBeTruthy();
    expect(
      within(bar()).getByRole("button", { name: "Leave game" }),
    ).toBeTruthy();
  });

  it("brings the words back when the game ends", () => {
    renderPanel(terminalState());

    expect(within(bar()).getByText("Settings")).toBeTruthy();
    expect(within(bar()).getByText("Play again")).toBeTruthy();
  });

  it("keeps the turn line screen-reader-only unless a message shows", () => {
    renderPanel(activeOnlineState());

    const turn = screen.getByText("Host's turn");
    expect(turn.className).toMatch(/max-sm:sr-only/);

    cleanup();
    renderPanel(activeOnlineState(), "Waiting for opponent to accept rematch");
    const notice = screen.getByText("Waiting for opponent to accept rematch");
    expect(notice.className).not.toMatch(/sr-only/);
  });
});

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
    vi.useFakeTimers();
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
      .getByText("Your opponent will be notified.")
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
    // The confirmation remains in the top layer while its desktop exit
    // animation plays, then closes after the animation fallback.
    expect(dialog.open).toBe(true);
    act(() => vi.advanceTimersByTime(400));
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

  it("holds the exit-confirmation pause when the parent passes a new callback identity", () => {
    const onPauseChange = vi.fn();
    const { rerender } = render(
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

    // A parent that passes a fresh inline callback each render (App.tsx does)
    // must not release the pause the confirmation is holding.
    rerender(
      <PlayersPanel
        gameState={activeOnlineState()}
        gameMode={GameModes.ONLINE}
        message=""
        onExit={vi.fn()}
        onPauseChange={vi.fn()}
      />,
    );

    expect(onPauseChange).toHaveBeenCalledTimes(1);
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

    // F785 — the copy result reaches assistive technology: a polite status
    // announces the success (the button's accessible name never changes, so
    // the icon swap alone was silent).
    expect(
      await screen.findByText("Room code copied to clipboard"),
    ).toBeTruthy();
  });

  it("announces the copy to assistive technology (F785)", async () => {
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

    // The page carries another role="status" (the game state line); query
    // by the announcement text and pin its live-role instead.
    const announcement = await screen.findByText("Room code copied to clipboard");
    expect(announcement.getAttribute("role")).toBe("status");
    expect(announcement.getAttribute("aria-live")).toBe("polite");
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

describe("PlayersPanel room-code chip — clipboard refusal (B4)", () => {
  // The room-code chip swallowed a rejected writeText with an empty catch, so
  // the reader pressed copy and got no confirmation and no failure. The other
  // two copy affordances on this screen both report; this one now does too.
  it("tells the reader when the clipboard refused", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
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
    expect(
      await screen.findByText("Copy was unavailable. Select the code manually."),
    ).toBeTruthy();
    // And the success announcement must not appear for a failed copy.
    expect(screen.queryByText("Room code copied to clipboard")).toBeNull();
  });
});
