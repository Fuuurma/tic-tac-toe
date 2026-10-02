// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SettingsSheet } from "./playerSettingsSheet";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
} from "@/game/constants";

// The sheet header. The regression here is a layout one, so these assert on
// DOM structure rather than pixels: the grabber must not be a flex child of
// the title row, and it must be hidden from assistive tech.
describe("SettingsSheet header", () => {
  afterEach(cleanup);

  const open = () =>
    render(
      <SettingsSheet
        isOpen
        gameMode={GameModes.VS_COMPUTER}
        tab="player"
        onTabChange={vi.fn()}
        player={{
          displayName: "Ada",
          color: Color.BLUE,
          playerShape: SymbolShape.CIRCLE,
        }}
        opponent={{
          opponentName: "Grace",
          opponentColor: Color.RED,
          opponentShape: SymbolShape.SQUARE,
          opponentType: PlayerTypes.HUMAN,
          aiDifficulty: AI_Difficulty.NORMAL,
        }}
        onPlayerChange={vi.fn()}
        onOpponentChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

  const grabber = (container: HTMLElement) =>
    container.querySelector(".bg-foreground\\/20");

  it("keeps the decorative grabber out of the title row", () => {
    // The bug: the grabber was the first flex child of the justify-between
    // title row, so it consumed width and pushed the "Settings" heading
    // off-centre against the close button. It now sits in its own row above,
    // matching helpDrawer.tsx.
    const { container } = open();
    const title = screen.getByRole("heading", { name: "Settings" });
    const titleRow = title.parentElement;

    expect(titleRow).not.toBeNull();
    // The title row holds only the heading and the close control.
    expect(titleRow?.querySelector(".bg-foreground\\/20")).toBeNull();
    expect(titleRow?.className).toContain("justify-between");
    // The grabber still exists — DESIGN.md sanctions sheet grabbers — it just
    // is not inside the title row any more.
    expect(grabber(container)).not.toBeNull();
  });

  it("marks the grabber aria-hidden so it is not announced", () => {
    const { container } = open();
    const el = grabber(container);

    expect(el?.getAttribute("aria-hidden")).toBe("true");
    // A bare div with no role and no label is not in the a11y tree anyway, but
    // aria-hidden makes that explicit rather than incidental.
    expect(el?.getAttribute("role")).toBeNull();
  });

  it("still renders the close control inside the title row", () => {
    open();
    const close = screen.getByRole("button", { name: "Close" });
    const title = screen.getByRole("heading", { name: "Settings" });

    expect(close.parentElement).toBe(title.parentElement);
  });
});
