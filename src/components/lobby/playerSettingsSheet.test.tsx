// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { OpponentSummaryCard, SettingsSheet, type SettingsTab } from "./playerSettingsSheet";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
  type GameMode,
  type PlayerType,
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

interface SheetOptions {
  gameMode?: GameMode;
  tab?: SettingsTab;
  opponentType?: PlayerType;
  aiDifficulty?: AI_DifficultyType;
}

const sheetElement = ({
  gameMode = GameModes.VS_COMPUTER,
  tab = "player",
  opponentType = PlayerTypes.COMPUTER,
  aiDifficulty = AI_Difficulty.NORMAL,
  onClose = vi.fn(),
}: SheetOptions & { onClose?: () => void } = {}) => (
  <SettingsSheet
    isOpen
    gameMode={gameMode}
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
      opponentType,
      aiDifficulty,
    }}
    onPlayerChange={vi.fn()}
    onOpponentChange={vi.fn()}
    onClose={onClose}
  />
);

const renderSheet = (onClose = vi.fn(), options: SheetOptions = {}) =>
  render(sheetElement({ ...options, onClose }));

// This sheet is the You/Opponent form. App preferences — theme, language and
// the two learning rows — are a separate surface with their own test
// (preferencesSheet.test.tsx); one dialog used to answer both questions.
describe("SettingsSheet (players)", () => {
  afterEach(cleanup);

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

describe("SettingsSheet opponent tab", () => {
  afterEach(cleanup);

  const renderOpponentTab = (options: SheetOptions = {}) =>
    render(sheetElement({ ...options, tab: "opponent" }));

  it("offers no opponent-type selector; the game mode owns it", () => {
    renderOpponentTab();

    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).queryByRole("radiogroup", { name: "Opponent type" }),
    ).toBeNull();
    expect(within(dialog).queryByRole("radio", { name: "AI" })).toBeNull();
    expect(within(dialog).queryByRole("radio", { name: "Human" })).toBeNull();
    expect(within(dialog).queryByText("Plays as")).toBeNull();
  });

  it.each([PlayerTypes.COMPUTER, PlayerTypes.HUMAN])(
    "keeps name and appearance controls for the %s opponent",
    (opponentType) => {
      renderOpponentTab({ opponentType });

      const dialog = screen.getByRole("dialog", { name: "Players" });
      expect(
        within(dialog).getByRole("textbox", { name: "Opponent name" }),
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", { name: "Opponent color" }),
      ).toBeTruthy();
      expect(
        within(dialog).getByRole("button", { name: "Opponent symbol" }),
      ).toBeTruthy();
    },
  );

  it("offers the difficulty picker to the computer opponent", () => {
    renderOpponentTab({ opponentType: PlayerTypes.COMPUTER });

    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).getByRole("radiogroup", { name: "AI difficulty" }),
    ).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: "Hard" })).toBeTruthy();
  });

  it("hides the difficulty picker from the human opponent", () => {
    renderOpponentTab({ opponentType: PlayerTypes.HUMAN });

    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).queryByRole("radiogroup", { name: "AI difficulty" }),
    ).toBeNull();
  });

  it("restores the difficulty selection when the opponent is computer again", () => {
    const { rerender } = render(
      sheetElement({
        gameMode: GameModes.VS_FRIEND,
        tab: "opponent",
        opponentType: PlayerTypes.HUMAN,
        aiDifficulty: AI_Difficulty.HARD,
      }),
    );
    expect(
      screen.queryByRole("radiogroup", { name: "AI difficulty" }),
    ).toBeNull();

    rerender(
      sheetElement({
        gameMode: GameModes.VS_COMPUTER,
        tab: "opponent",
        opponentType: PlayerTypes.COMPUTER,
        aiDifficulty: AI_Difficulty.HARD,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Players" });
    expect(
      within(dialog).getByRole("radio", { name: "Hard" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});

// F343: the opponent glyph chip carried a trailing text-white after the
// COLOR_MARK_TEXT lookup, so light chips (green/yellow/orange) rendered
// white-on-light. The lookup is now the only text-color source, matching
// the player card.
describe("OpponentSummaryCard glyph contrast", () => {
  afterEach(cleanup);

  const renderCard = (opponentColor: Color) =>
    render(
      <OpponentSummaryCard
        opponentName="Grace"
        opponentColor={opponentColor}
        opponentShape={SymbolShape.SQUARE}
        opponentType={PlayerTypes.HUMAN}
        onEdit={vi.fn()}
      />,
    );

  const glyphChip = (container: HTMLElement) =>
    container.querySelector('span[aria-hidden="true"]');

  it("uses dark glyph text on a light chip", () => {
    const { container } = renderCard(Color.YELLOW);
    const chip = glyphChip(container);

    expect(chip?.className).toContain("text-neutral-950");
    expect(chip?.className).not.toContain("text-white");
  });

  it("keeps white glyph text on a dark chip", () => {
    const { container } = renderCard(Color.RED);
    const chip = glyphChip(container);

    expect(chip?.className).toContain("text-white");
  });
});
