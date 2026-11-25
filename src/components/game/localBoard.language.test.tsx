"@vitest-environment jsdom";

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocalBoard } from "./localBoard";
import { Color, GameModes, PlayerSymbol } from "@/game/constants";
import { createInitialGameState, type GameState } from "@/game/logic";
import { setLocale } from "@/i18n/language";

afterEach(() => {
  cleanup();
  setLocale("en");
});

const game = (humanSymbol: PlayerSymbol): GameState => ({
  ...createInitialGameState({
    gameMode: GameModes.VS_COMPUTER,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
    humanSymbol,
  }),
});

describe("LocalBoard language", () => {
  it("retranslates the disabled reason on a locale switch, with no state change", () => {
    const state = game(PlayerSymbol.X);
    render(<LocalBoard gameState={state} paused onCellClick={vi.fn()} />);

    const cell = () => screen.getAllByRole("button")[0] as HTMLButtonElement;
    expect(cell().getAttribute("aria-label")).toBe(
      "Row 1 column 1, empty, game is paused",
    );

    act(() => setLocale("es"));

    expect(cell().getAttribute("aria-label")).toBe(
      "Fila 1, columna 1, vacía, el juego está en pausa",
    );
    expect(cell().disabled).toBe(true);

    act(() => setLocale("en"));

    expect(cell().getAttribute("aria-label")).toBe(
      "Row 1 column 1, empty, game is paused",
    );
  });
});
