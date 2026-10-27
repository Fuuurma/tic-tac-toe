// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { SettingsSheet } from "./playerSettingsSheet";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
} from "@/game/constants";

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
// Model them by toggling the open attribute, which is all the dialog's
// accessibility and visibility checks depend on.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

// This sheet is the You/Opponent form. App preferences — theme, language and
// the two learning rows — are a separate surface with their own test
// (preferencesSheet.test.tsx); one dialog used to answer both questions.
describe("SettingsSheet (players)", () => {
  afterEach(cleanup);

  const renderSheet = (
    onClose = vi.fn(),
    {
      gameMode = GameModes.VS_COMPUTER,
    }: { gameMode?: typeof GameModes.VS_COMPUTER | typeof GameModes.ONLINE } = {},
  ) =>
    render(
      <SettingsSheet
        isOpen
        gameMode={gameMode}
        tab="player"
        onTabChange={vi.fn()}
        player={{
          displayName: "Ada",
          color: Color.BLUE,
          playerShape: SymbolShape.STAR,
        }}
        opponent={{
          opponentName: "Grace",
          opponentColor: Color.RED,
          opponentShape: SymbolShape.SQUARE,
          opponentType: PlayerTypes.COMPUTER,
          aiDifficulty: AI_Difficulty.NORMAL,
        }}
        onPlayerChange={vi.fn()}
        onOpponentChange={vi.fn()}
        onClose={onClose}
      />,
    );

  it("is named for players, so the two dialogs cannot be confused", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(within(dialog).getByRole("heading", { name: "Players" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
    // The app-preferences dialog owns the name "Settings".
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  });

  it("calls onClose when the Close control is pressed", () => {
    const onClose = vi.fn();
    renderSheet(onClose);

    const dialog = screen.getByRole("dialog", { name: "Players" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never offers a Start action; the lobby footer owns it", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
  });

  it("exposes the You and Opponent tabs, and no App tab", () => {
    renderSheet();

    const tablist = screen.getByRole("tablist", { name: "Settings tabs" });
    expect(within(tablist).getByRole("tab", { name: "You" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Opponent" })).toBeTruthy();
    expect(within(tablist).queryByRole("tab", { name: "App" })).toBeNull();
  });

  it("hides the Opponent tab in an online room, where identity is relay-owned", () => {
    renderSheet(vi.fn(), { gameMode: GameModes.ONLINE });

    const tablist = screen.getByRole("tablist", { name: "Settings tabs" });
    expect(within(tablist).getByRole("tab", { name: "You" })).toBeTruthy();
    expect(within(tablist).queryByRole("tab", { name: "Opponent" })).toBeNull();
  });
});
