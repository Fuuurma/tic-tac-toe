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
import { createInitialGameState, makeMove, type GameState } from "@/game/logic";

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

const afterMove = (state: GameState, index: number): GameState => {
  const next = makeMove(state, index);
  if (!next) throw new Error(`move ${index} should be legal`);
  return next;
};

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
    expect(firstCell().disabled).toBe(false);
    expect(firstCell().getAttribute("aria-disabled")).toBe("true");
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

  it("keeps the keyboard player's cell through the computer's reply", () => {
    const onCellClick = vi.fn();
    const humanTurn = game(PlayerSymbol.X);
    const { rerender } = render(
      <LocalBoard gameState={humanTurn} paused={false} onCellClick={onCellClick} />,
    );

    const cells = screen.getAllByRole("button") as HTMLButtonElement[];
    cells[0].focus();
    expect(document.activeElement).toBe(cells[0]);

    const computerTurn = afterMove(humanTurn, 0);
    rerender(
      <LocalBoard gameState={computerTurn} paused={false} onCellClick={onCellClick} />,
    );

    expect(cells[0].disabled).toBe(false);
    expect(cells[0].getAttribute("aria-disabled")).toBe("true");
    cells[0].blur();
    cells[0].focus();
    expect(document.activeElement).toBe(cells[0]);

    fireEvent.click(cells[1]);
    fireEvent.keyDown(cells[1], { key: "2" });
    expect(onCellClick).not.toHaveBeenCalled();

    const humanTurnAgain = afterMove(computerTurn, 4);
    rerender(
      <LocalBoard gameState={humanTurnAgain} paused={false} onCellClick={onCellClick} />,
    );

    expect(document.activeElement).toBe(cells[0]);
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(cells[1]);

    fireEvent.click(cells[1]);
    expect(onCellClick).toHaveBeenCalledWith(1);
  });
});
