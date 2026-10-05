// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { GameMark } from "./gameMark";
import { COLOR_RGB, Color } from "@/game/constants";

afterEach(cleanup);

describe("GameMark", () => {
  it("renders the masthead in fixed X-blue / O-red brand colors", () => {
    // The logo is brand identity, not player chrome (DESIGN.md: default
    // X blue, O red) — it must not tint with the user's color picks.
    const { container } = render(<GameMark />);
    const tiles = container.querySelectorAll<HTMLElement>(
      "[style*='--mark-color']",
    );
    expect(tiles).toHaveLength(3);
    // MARKS layout: X at top-left and bottom-right, O in the center.
    expect(tiles[0].style.getPropertyValue("--mark-color").trim()).toBe(
      COLOR_RGB[Color.BLUE],
    );
    expect(tiles[1].style.getPropertyValue("--mark-color").trim()).toBe(
      COLOR_RGB[Color.RED],
    );
    expect(tiles[2].style.getPropertyValue("--mark-color").trim()).toBe(
      COLOR_RGB[Color.BLUE],
    );
  });
});
