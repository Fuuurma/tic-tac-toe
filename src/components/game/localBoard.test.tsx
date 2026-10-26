// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LocalBoard } from "./localBoard";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { createInitialGameState, type GameState } from "@/game/logic";

afterEach(cleanup);

const game = (humanSymbol: PlayerSymbol, overrides: Partial<GameState> = {}): GameState => ({
  ...createInitialGameState({
    gameMode: GameModes.VS_COMPUTER,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    humanSymbol,
  }),
  ...overrides,
});

const firstCell = () => screen.getAllByRole("button")[0] as HTMLButtonElement;

describe("LocalBoard", () => {
  it("lets the human play on their own turn", () => {
    const onCellClick = vi.fn();
    render(<LocalBoard gameState={game(PlayerSymbol.X)} paused={false} onCellClick={onCellClick} />);

    expect(firstCell().disabled).toBe(false);
    fireEvent.click(firstCell());
    expect(onCellClick).toHaveBeenCalledWith(0);
  });

  it("locks the board and says why, for each reason a cell can be dead", () => {
    // X moves first, so a human O is waiting on the computer.
    const { rerender } = render(
      <LocalBoard gameState={game(PlayerSymbol.O)} paused={false} onCellClick={vi.fn()} />,
    );
    expect(firstCell().disabled).toBe(true);
    expect(firstCell().getAttribute("aria-label")).toContain("waiting for the computer to move");

    rerender(<LocalBoard gameState={game(PlayerSymbol.X)} paused onCellClick={vi.fn()} />);
    expect(firstCell().disabled).toBe(true);
    expect(firstCell().getAttribute("aria-label")).toContain("game is paused");

    rerender(
      <LocalBoard
        gameState={game(PlayerSymbol.X, { gameStatus: GameStatus.COMPLETED, winner: PlayerSymbol.X })}
        paused={false}
        onCellClick={vi.fn()}
      />,
    );
    expect(firstCell().disabled).toBe(true);
    expect(firstCell().getAttribute("aria-label")).toContain("game is over");
  });

  it("does not treat a friend game as waiting on a computer", () => {
    render(
      <LocalBoard
        gameState={game(PlayerSymbol.O, { gameMode: GameModes.VS_FRIEND, players: {
          ...game(PlayerSymbol.O).players,
          [PlayerSymbol.X]: { ...game(PlayerSymbol.O).players[PlayerSymbol.X], type: "HUMAN" },
        } })}
        paused={false}
        onCellClick={vi.fn()}
      />,
    );
    expect(firstCell().disabled).toBe(false);
  });
});
