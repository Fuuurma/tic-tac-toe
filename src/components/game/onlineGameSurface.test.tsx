// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OnlineConnectionState, RoomIdShare } from "./onlineGameSurface";
import { COLOR_RGB, Color } from "@/game/constants";

// F344: the waiting banners consume var(--player-color) for their accent
// icons. The only definition used to be the :root blue default, so a player
// who picked any other color still saw blue accents. Each banner now scopes
// the var from the player's configured color.
describe("waiting banner player-color scope", () => {
  afterEach(cleanup);

  it("RoomIdShare scopes --player-color to the player color", () => {
    const { container } = render(
      <RoomIdShare roomId="ABCD" origin="" color={Color.RED} onCancel={vi.fn()} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--player-color")).toBe(COLOR_RGB[Color.RED]);
    // The accent icon still resolves through the var (now scoped, not root).
    expect(screen.getByText("Room ready").parentElement?.innerHTML).toContain("var(--player-color)");
  });

  it("OnlineConnectionState scopes --player-color to the player color", () => {
    const { container } = render(
      <OnlineConnectionState message="Joining room…" color={Color.RED} onCancel={vi.fn()} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--player-color")).toBe(COLOR_RGB[Color.RED]);
  });
});
