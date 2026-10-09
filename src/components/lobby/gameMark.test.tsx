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
    const x = container.querySelector('[data-mark="x"]');
    expect(x?.getAttribute("fill")).toBe(`rgb(${COLOR_RGB[Color.BLUE]})`);
    const stops = container.querySelectorAll("stop");
    expect(stops.length).toBeGreaterThan(0);
    for (const stop of stops) {
      expect(stop.getAttribute("stop-color")).toBe(`rgb(${COLOR_RGB[Color.RED]})`);
    }
  });

  it("fades the O ring through gradient and knockout ids that resolve", () => {
    const { container } = render(<GameMark />);
    const ring = container.querySelector('[data-mark="o"]');
    const fill = ring?.getAttribute("stroke")?.match(/^url\(#(.+)\)$/)?.[1];
    const mask = ring?.getAttribute("mask")?.match(/^url\(#(.+)\)$/)?.[1];
    expect(fill && container.querySelector(`[id="${fill}"]`)).toBeTruthy();
    expect(mask && container.querySelector(`[id="${mask}"]`)).toBeTruthy();
  });
});
