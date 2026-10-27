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

  const renderSheet = (
    onClose = vi.fn(),
    { canEditIdentity = true, tab = "player" as const, onHowToPlay = vi.fn(), onReplayTutorial } = {} as {
      canEditIdentity?: boolean;
      tab?: "player" | "opponent" | "app";
      onHowToPlay?: () => void;
      onReplayTutorial?: () => void;
    },
  ) =>
    render(
      <SettingsSheet
        isOpen
        gameMode={GameModes.VS_COMPUTER}
        tab={tab}
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
        canEditIdentity={canEditIdentity}
        onHowToPlay={onHowToPlay}
        onReplayTutorial={onReplayTutorial}
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

  it("offers no Done action; in-game edits apply live and phones dismiss by gesture", () => {
    renderSheet();

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(within(dialog).queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("exposes the You, Opponent and App tabs in a named tablist", () => {
    renderSheet();

    const tablist = screen.getByRole("tablist", { name: "Settings tabs" });
    expect(within(tablist).getByRole("tab", { name: "You" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "Opponent" })).toBeTruthy();
    expect(within(tablist).getByRole("tab", { name: "App" })).toBeTruthy();
  });

  it("opens the App tab with the app preferences and the two learning rows", () => {
    renderSheet(vi.fn(), { tab: "app" });

    // Appearance and Language are named groups whose row holds the control.
    expect(screen.getByRole("group", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "How to play" })).toBeTruthy();
  });

  it("fires onHowToPlay and onReplayTutorial from the App tab", () => {
    const onHowToPlay = vi.fn();
    const onReplayTutorial = vi.fn();
    renderSheet(vi.fn(), { tab: "app", onHowToPlay, onReplayTutorial });

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));

    expect(onHowToPlay).toHaveBeenCalledTimes(1);
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });

  it("gives a guest no identity tabs and no tab strip at all", () => {
    // A guest in an online room cannot edit identity (the host assigns the
    // symbols), but theme, language and help are local to them.
    renderSheet(vi.fn(), { canEditIdentity: false, tab: "app" });

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: "Your name" })).toBeNull();
    expect(screen.getByRole("group", { name: "Appearance" })).toBeTruthy();
  });

  it("never offers a Start action; the lobby footer owns it", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
  });
});
