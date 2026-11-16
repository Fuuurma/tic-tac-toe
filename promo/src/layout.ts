/** Where things sit in each cut. Boxes are in output pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A window onto the phone capture, in fractions of the 390x844 viewport. */
export interface View {
  x: number;
  y: number;
  w: number;
}

export interface Layout {
  width: number;
  height: number;
  /** Caption block: kicker over headline. */
  caption: Box & { kicker: number; headline: number; align: "left" | "center" };
  hookCaption: Box & { kicker: number; headline: number; align: "left" | "center" };
  /** The zoomed board in the hook. */
  board: Box;
  /** The game screen, cropped to the HUD and the board. */
  game: { box: Box; view: View };
  endScale: number;
}

export const VERTICAL: Layout = {
  width: 1080,
  height: 1920,
  hookCaption: { x: 80, y: 190, w: 920, h: 360, kicker: 52, headline: 104, align: "left" },
  caption: { x: 80, y: 130, w: 920, h: 300, kicker: 44, headline: 88, align: "left" },
  board: { x: 60, y: 700, w: 960, h: 960 },
  game: { box: { x: 140, y: 460, w: 800, h: 1420 }, view: { x: 0, y: 0, w: 1 } },
  endScale: 1,
};

export const SQUARE: Layout = {
  width: 1080,
  height: 1080,
  hookCaption: { x: 180, y: 60, w: 720, h: 220, kicker: 40, headline: 72, align: "left" },
  caption: { x: 72, y: 0, w: 408, h: 1080, kicker: 32, headline: 60, align: "left" },
  board: { x: 180, y: 300, w: 720, h: 720 },
  game: { box: { x: 520, y: 40, w: 520, h: 1000 }, view: { x: 0, y: 0, w: 1 } },
  endScale: 0.78,
};

/** The whole screen. */
export const FULL_VIEW: View = { x: 0, y: 0, w: 1 };

/** Board crop: the 3x3 well with a little air (measured from the capture). */
export const BOARD_VIEW: View = { x: 0.025, y: 0.305, w: 0.95 };
