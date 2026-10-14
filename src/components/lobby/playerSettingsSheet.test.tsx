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

describe("SettingsSheet", () => {
  afterEach(cleanup);

  const renderSheet = (onClose = vi.fn()) =>
    render(
      <SettingsSheet
        isOpen
        gameMode={GameModes.VS_COMPUTER}
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

  it("renders a modal dialog named Settings with a Close control in its header", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(within(dialog).getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("calls onClose when the Close control is pressed", () => {
    const onClose = vi.fn();
    renderSheet(onClose);

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes the You and Opponent tabs in a named tablist", () => {
    renderSheet();

    const tablist = screen.getByRole("tablist", { name: "Settings tabs" });
    expect(within(tablist).getByRole("tab", { name: "You" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Opponent" })).toBeTruthy();
  });
});
