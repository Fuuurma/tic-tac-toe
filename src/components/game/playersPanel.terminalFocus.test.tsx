"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlayersPanel } from "./playersPanel";
import { LocalBoard } from "./localBoard";
import { freshGameState, type GameState } from "@/game/logic";
import {
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  type GameMode,
} from "@/game/constants";

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

afterEach(cleanup);

const activeLocal = (gameMode: GameMode = GameModes.VS_COMPUTER): GameState => {
  const state = freshGameState();
  state.gameMode = gameMode;
  state.gameStatus = GameStatus.ACTIVE;
  state.moveCount = 5;
  state.players[PlayerSymbol.X].username = "Ada";
  state.players[PlayerSymbol.O].username = "CPU";
  state.players[PlayerSymbol.O].type = PlayerTypes.COMPUTER;
  return state;
};

const terminalLocal = (
  winner: PlayerSymbol | null,
  gameMode: GameMode = GameModes.VS_COMPUTER,
): GameState => {
  const state = activeLocal(gameMode);
  state.gameStatus = GameStatus.COMPLETED;
  state.winner = winner;
  if (winner) {
    state.winningCombination = [0, 1, 2];
    state.board[0] = winner;
    state.board[1] = winner;
    state.board[2] = winner;
  }
  return state;
};

function Game({
  state,
  panelProps,
}: {
  state: GameState;
  panelProps?: Partial<ComponentProps<typeof PlayersPanel>>;
}) {
  return (
    <>
      <PlayersPanel
        gameState={state}
        gameMode={GameModes.VS_COMPUTER}
        message=""
        onExit={vi.fn()}
        onNewGame={vi.fn()}
        {...panelProps}
      />
      <LocalBoard gameState={state} paused={false} onCellClick={vi.fn()} />
    </>
  );
}

const boardCell = () =>
  screen.getByRole("button", { name: "Row 3 column 3, empty" });
const playAgain = () => screen.getByRole("button", { name: "Play again" });

describe("PlayersPanel terminal focus — local play", () => {
  it("moves focus from the board cell to Play again when the round is won", () => {
    const { rerender } = render(<Game state={activeLocal()} />);
    const cell = boardCell();
    cell.focus();
    expect(document.activeElement).toBe(cell);

    rerender(<Game state={terminalLocal(PlayerSymbol.X)} />);

    expect(document.activeElement).toBe(playAgain());
  });

  it("moves focus to Play again when the round ends in a draw", () => {
    const { rerender } = render(<Game state={activeLocal()} />);
    const cell = boardCell();
    cell.focus();

    rerender(<Game state={terminalLocal(null)} />);

    expect(document.activeElement).toBe(playAgain());
  });

  it("moves focus to the terminal status when the panel has no restart action", () => {
    const { rerender } = render(
      <Game state={activeLocal()} panelProps={{ onNewGame: undefined }} />,
    );
    const cell = boardCell();
    cell.focus();

    rerender(
      <Game
        state={terminalLocal(PlayerSymbol.X)}
        panelProps={{ onNewGame: undefined }}
      />,
    );

    const focused = document.activeElement as HTMLElement | null;
    expect(focused).not.toBe(document.body);
    expect(focused).not.toBe(cell);
    expect(focused?.getAttribute("tabindex")).toBe("-1");
    expect(focused?.contains(screen.getByText("Ada wins!"))).toBe(true);
  });

  it("does not take focus on an already-terminal first render", () => {
    render(<Game state={terminalLocal(PlayerSymbol.X)} />);

    const heading = screen.getByRole("heading", { name: "vs Computer" });
    expect(document.activeElement).toBe(heading);
    expect(document.activeElement).not.toBe(playAgain());
  });

  it("does not take focus on an already-terminal draw with no restart action", () => {
    render(
      <Game
        state={terminalLocal(null)}
        panelProps={{ onNewGame: undefined }}
      />,
    );

    const heading = screen.getByRole("heading", { name: "vs Computer" });
    expect(document.activeElement).toBe(heading);
  });

  it("leaves focus inside an open sheet when the round ends", () => {
    const { rerender } = render(<Game state={activeLocal()} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));

    const dialog = document.querySelector("dialog[open]");
    expect(dialog).not.toBeNull();
    expect(dialog?.contains(document.activeElement)).toBe(true);
    const focusedInDialog = document.activeElement;

    rerender(<Game state={terminalLocal(PlayerSymbol.X)} />);

    expect(document.activeElement).toBe(focusedInDialog);
  });

  it("leaves focus inside a text control when the round ends", () => {
    const { rerender } = render(
      <>
        <Game state={activeLocal()} />
        <input aria-label="Note" />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Note" });
    input.focus();
    expect(document.activeElement).toBe(input);

    rerender(
      <>
        <Game state={terminalLocal(PlayerSymbol.X)} />
        <input aria-label="Note" />
      </>,
    );

    expect(document.activeElement).toBe(input);
  });

  it("keeps focus that already sits on the restart control", () => {
    const { rerender } = render(<Game state={activeLocal()} />);
    const restart = screen.getByRole("button", { name: "Start a new game" });
    restart.focus();
    expect(document.activeElement).toBe(restart);

    rerender(<Game state={terminalLocal(PlayerSymbol.X)} />);

    expect(playAgain()).toBe(restart);
    expect(document.activeElement).toBe(playAgain());
  });

  it("does not move focus when an online round ends", () => {
    const { rerender } = render(
      <Game
        state={activeLocal(GameModes.ONLINE)}
        panelProps={{ gameMode: GameModes.ONLINE, onRequestRematch: vi.fn() }}
      />,
    );
    const cell = boardCell();
    cell.focus();

    rerender(
      <Game
        state={terminalLocal(PlayerSymbol.X, GameModes.ONLINE)}
        panelProps={{ gameMode: GameModes.ONLINE, onRequestRematch: vi.fn() }}
      />,
    );

    expect(document.activeElement).toBe(cell);
  });
});
