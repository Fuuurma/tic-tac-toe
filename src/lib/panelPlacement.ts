/**
 * Where a small anchored panel goes, so it is always fully on screen.
 *
 * A panel that is simply dropped under its trigger leaves the screen as soon
 * as the trigger sits near an edge: the stats chip is at the right end of a
 * phone header, and its panel opened 14px past the right edge at 390 and
 * still clipped at 320. Since the trigger's position is not ours to control,
 * the panel has to be placed against the viewport instead of trusting the
 * anchor.
 *
 * Two rules, the same ones floating-ui applies and everyone expects:
 *
 * 1. **Flip** — below the anchor, unless that would leave the panel off the
 *    bottom and there is more room above.
 * 2. **Shift** — clamp the panel inside a gutter, so a panel anchored to a
 *    right-hand trigger is pushed left rather than cut off.
 *
 * Everything is viewport coordinates. The caller converts to whatever
 * coordinate space its anchor lives in.
 */

export interface PanelAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface PanelPlacement {
  /** Viewport x of the panel's left edge. */
  left: number;
  /** Viewport y of the panel's top edge. */
  top: number;
  placement: "below" | "above";
}

/** Breathing room between the panel and the screen edge. */
export const PANEL_GUTTER = 8;
/** Breathing room between the panel and the trigger. */
export const PANEL_GAP = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function placePanel(
  anchor: PanelAnchor,
  panel: PanelSize,
  viewport: ViewportSize,
  gutter: number = PANEL_GUTTER,
  gap: number = PANEL_GAP,
): PanelPlacement {
  const below = anchor.top + anchor.height + gap;
  const above = anchor.top - gap - panel.height;
  const fits = (top: number) =>
    top >= gutter && top + panel.height <= viewport.height - gutter;

  const placement: PanelPlacement["placement"] =
    fits(below) || !fits(above) ? "below" : "above";

  // When neither side fits (a panel taller than the screen), below wins and
  // the clamp below pins the top edge, so the panel starts at the gutter and
  // is scrolled rather than half off-screen.
  const maxTop = Math.max(gutter, viewport.height - gutter - panel.height);
  const maxLeft = Math.max(gutter, viewport.width - gutter - panel.width);

  return {
    left: clamp(anchor.left, gutter, maxLeft),
    top: clamp(placement === "below" ? below : above, gutter, maxTop),
    placement,
  };
}
