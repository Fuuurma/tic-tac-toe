import { describe, expect, it } from "vitest";
import { placePanel } from "./panelPlacement";

// A 390x844 phone, the screen the stats panel used to fail on: the trigger
// sits at the right end of the header, so a naive `left-0` panel ran 14px past
// the edge. These cases pin the two rules that fix it — flip and shift.
const viewport = { width: 390, height: 844 };
const panel = { width: 200, height: 132 };
const anchorAt = (left: number, top: number) => ({
  left,
  top,
  width: 24,
  height: 24,
});

describe("placePanel", () => {
  it("opens below the anchor when there is room", () => {
    const { top, placement } = placePanel(anchorAt(20, 40), panel, viewport);
    expect(placement).toBe("below");
    expect(top).toBe(40 + 24 + 6);
  });

  it("keeps a right-hand trigger's panel on screen", () => {
    // The exact failure: trigger at x=350 on a 390 viewport.
    const { left } = placePanel(anchorAt(350, 40), panel, viewport);
    expect(left).toBe(390 - 8 - panel.width);
    expect(left + panel.width).toBeLessThanOrEqual(viewport.width - 8);
  });

  it("never places the panel off the left edge", () => {
    const { left } = placePanel(anchorAt(-40, 40), panel, viewport);
    expect(left).toBe(8);
  });

  it("flips above when the bottom is crowded", () => {
    const anchor = anchorAt(20, viewport.height - 30);
    const { top, placement } = placePanel(anchor, panel, viewport);
    expect(placement).toBe("above");
    expect(top).toBe(anchor.top - 6 - panel.height);
    expect(top + panel.height).toBeLessThanOrEqual(viewport.height);
  });

  it("clamps to the gutter when the panel is taller than the screen", () => {
    const tall = { width: 200, height: 900 };
    const { top } = placePanel(anchorAt(20, 400), tall, viewport);
    expect(top).toBe(8);
  });

  it("clamps to the gutter when the panel is wider than the screen", () => {
    const wide = { width: 500, height: 100 };
    const { left } = placePanel(anchorAt(100, 40), wide, viewport);
    expect(left).toBe(8);
  });

  it("stays inside on a 320-wide screen", () => {
    const small = { width: 320, height: 568 };
    const { left } = placePanel(anchorAt(300, 20), { width: 180, height: 130 }, small);
    expect(left + 180).toBeLessThanOrEqual(320 - 8);
  });
});
