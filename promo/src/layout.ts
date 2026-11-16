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
  /** The phone screen in the gameplay scenes. */
  phone: Box;
  endScale: number;
}

export const VERTICAL: Layout = {
  width: 1080,
  height: 1920,
  hookCaption: { x: 80, y: 190, w: 920, h: 360, kicker: 52, headline: 104, align: "left" },
  caption: { x: 80, y: 150, w: 920, h: 320, kicker: 44, headline: 88, align: "left" },
  board: { x: 60, y: 700, w: 960, h: 960 },
  phone: { x: 110, y: 520, w: 860, h: 1300 },
  endScale: 1,
};

export const SQUARE: Layout = {
  width: 1080,
  height: 1080,
  hookCaption: { x: 72, y: 72, w: 936, h: 200, kicker: 40, headline: 72, align: "left" },
  caption: { x: 72, y: 0, w: 430, h: 1080, kicker: 34, headline: 64, align: "left" },
  board: { x: 250, y: 300, w: 720, h: 720 },
  phone: { x: 540, y: 56, w: 480, h: 968 },
  endScale: 0.78,
};

/** Board crop: the 3x3 well with a little air (measured from the capture). */
export const BOARD_VIEW: View = { x: 0.025, y: 0.305, w: 0.95 };
