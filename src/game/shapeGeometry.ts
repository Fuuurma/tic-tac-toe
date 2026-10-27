import { SymbolShape } from "./constants";

/**
 * Every symbol, drawn once. The board and the HUD stroke these paths as SVG;
 * the background canvas traces the same commands, so a shape cannot look one
 * way on the board and another in the field behind it (it used to: the heart
 * was two different constructions and the triangle two different proportions).
 *
 * Coordinates are centerlines on a 100-unit grid, centred at 50,50, using only
 * M, L, C, A and Z so SVG and canvas read them identically. Circles and arcs
 * are true arcs, not Bézier approximations: SVG draws them exactly, and the
 * canvas hands them to `ctx.arc`, which the rasteriser has a fast path for
 * (four-curve circles ran 40% slower there). The renderer strokes
 * at 7 units with round joins, so ink reaches 3.5 units past these numbers.
 *
 * Sizing is optical, not mechanical. Every shape's longest side lands between
 * 56 and 74 units, and stroked ink stays within about ±10% of the circle's, so
 * no symbol dwarfs its opponent. The old set ran from a 60-unit X to a
 * 99-unit heart that nearly clipped its box. The triangle is nudged up so its
 * mass does not sink; the heart and crescent are centred on their bounds.
 */
export type PathCommand =
  | readonly ["M", number, number]
  | readonly ["L", number, number]
  | readonly ["C", number, number, number, number, number, number]
  /** An arc of a circle: centre, radius, then start and end angle in radians
   *  (0 points right, positive turns clockwise on screen). The pen is already
   *  at the start point. */
  | readonly ["A", number, number, number, number, number]
  | readonly ["Z"];

export type ShapePath = readonly PathCommand[];

export interface ShapeGeometry {
  paths: readonly ShapePath[];
  /** A cheaper outline of the same shape, for symbols a few pixels across (the
   *  background field). At that size a corner radius or a sixth curve segment
   *  is invisible but costs raster time on every lit frame. Only set where it
   *  pays; a test keeps it within 2 units of `paths`. */
  field?: readonly ShapePath[];
  /** Stroke width relative to the base. The X is two strokes crossing, so it
   *  is drawn heavier to carry the same weight as an outline. */
  weight: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

const arc = (cx: number, cy: number, r: number, from: number, to: number): PathCommand =>
  ["A", cx, cy, r, from, to];

const circle = (cx: number, cy: number, r: number): ShapePath => [
  ["M", round(cx + r), cy],
  arc(cx, cy, r, 0, Math.PI * 2),
  ["Z"],
];

const polygon = (points: ReadonlyArray<readonly [number, number]>): ShapePath => [
  ["M", round(points[0][0]), round(points[0][1])],
  ...points.slice(1).map(([x, y]): PathCommand => ["L", round(x), round(y)]),
  ["Z"],
];

const roundedRect = (x: number, y: number, w: number, h: number, r: number): ShapePath => [
  ["M", x + r, y],
  ["L", x + w - r, y],
  arc(x + w - r, y + r, r, -Math.PI / 2, 0),
  ["L", x + w, y + h - r],
  arc(x + w - r, y + h - r, r, 0, Math.PI / 2),
  ["L", x + r, y + h],
  arc(x + r, y + h - r, r, Math.PI / 2, Math.PI),
  ["L", x, y + r],
  arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2),
  ["Z"],
];

const triangle = (): ShapePath => {
  const side = 74;
  const height = (side * Math.sqrt(3)) / 2;
  const apex = 50 - height * 0.5 - 3;
  const base = apex + height;
  return polygon([
    [50, apex],
    [50 + side / 2, base],
    [50 - side / 2, base],
  ]);
};

const star = (): ShapePath => {
  const outer = 36;
  const inner = outer * 0.46;
  const points = Array.from({ length: 10 }, (_, i): [number, number] => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return [50 + r * Math.cos(angle), 52 + r * Math.sin(angle)];
  });
  return polygon(points);
};

const heart = (): ShapePath => [
  ["M", 50, 85],
  ["C", 22, 64, 14, 48, 14, 38],
  ["C", 14, 26, 23, 18, 33, 18],
  ["C", 41, 18, 47, 22, 50, 29],
  ["C", 53, 22, 59, 18, 67, 18],
  ["C", 77, 18, 86, 26, 86, 38],
  ["C", 86, 48, 78, 64, 50, 85],
  ["Z"],
];

/** Two cubics, fitted to `heart` (mean error 0.8 units, worst 1.6). */
const heartField = (): ShapePath => [
  ["M", 50, 85],
  ["C", -12, 46, 22, -4.9, 50, 29],
  ["C", 78, -4.9, 112, 46, 50, 85],
  ["Z"],
];

/** A crescent: a disc with a smaller disc bitten out of its right side. The
 *  pair is shifted left so the bounds, not the bite, sit on the centre. */
const crescent = (): ShapePath => {
  const outerR = 34;
  const innerR = 28;
  const offset = 19;
  const cx = 57;
  const innerCx = cx + offset;
  // Where the two circles cross, relative to the outer centre.
  const x = (offset * offset + outerR * outerR - innerR * innerR) / (2 * offset);
  const y = Math.sqrt(outerR * outerR - x * x);
  const outerAngle = Math.atan2(y, x);
  const innerAngle = Math.atan2(y, cx + x - innerCx);
  return [
    ["M", round(cx + x), round(50 - y)],
    // The long way round the outer disc, through its left edge...
    arc(cx, 50, outerR, -outerAngle, -(Math.PI * 2 - outerAngle)),
    // ...then back along the bite, through the inner disc's left edge.
    arc(innerCx, 50, innerR, innerAngle, Math.PI * 2 - innerAngle),
    ["Z"],
  ];
};

export const SHAPE_GEOMETRY: Record<SymbolShape, ShapeGeometry> = {
  [SymbolShape.X]: {
    paths: [
      [["M", 22, 22], ["L", 78, 78]],
      [["M", 78, 22], ["L", 22, 78]],
    ],
    weight: 1.25,
  },
  [SymbolShape.O]: { paths: [circle(50, 50, 34)], weight: 1 },
  [SymbolShape.TRIANGLE]: { paths: [triangle()], weight: 1 },
  [SymbolShape.SQUARE]: {
    paths: [roundedRect(21, 21, 58, 58, 10)],
    field: [
      polygon([
        [21, 21],
        [79, 21],
        [79, 79],
        [21, 79],
      ]),
    ],
    weight: 1,
  },
  [SymbolShape.DIAMOND]: {
    paths: [
      polygon([
        [50, 14],
        [86, 50],
        [50, 86],
        [14, 50],
      ]),
    ],
    weight: 1,
  },
  [SymbolShape.STAR]: { paths: [star()], weight: 1 },
  [SymbolShape.HEART]: { paths: [heart()], field: [heartField()], weight: 1 },
  [SymbolShape.CRESCENT]: { paths: [crescent()], weight: 1 },
};

const TAU = Math.PI * 2;

/** SVG path data for one subpath. SVG arcs are endpoint-based, and a full
 *  turn has no distinct endpoint, so it is written as two halves. */
export const toSvgPath = (path: ShapePath): string =>
  path
    .map((command) => {
      if (command[0] !== "A") return command.join(" ");
      const [, cx, cy, r, from, to] = command;
      const sweep = to > from ? 1 : 0;
      const turns = Math.abs(to - from) >= TAU - 1e-6 ? [from, from + (to - from) / 2, to] : [from, to];
      const parts: string[] = [];
      for (let i = 1; i < turns.length; i++) {
        const large = Math.abs(turns[i] - turns[i - 1]) > Math.PI + 1e-9 ? 1 : 0;
        const x = round(cx + r * Math.cos(turns[i]));
        const y = round(cy + r * Math.sin(turns[i]));
        parts.push(`A ${r} ${r} 0 ${large} ${sweep} ${x} ${y}`);
      }
      return parts.join(" ");
    })
    .join(" ");

/** Bounds of the stroked centerlines, sampling each curve (control points
 *  overshoot, so they would overstate the extent). */
export const shapeBounds = (geometry: Pick<ShapeGeometry, "paths">) => {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const path of geometry.paths) {
    let [px, py] = [0, 0];
    for (const command of path) {
      if (command[0] === "M" || command[0] === "L") {
        [px, py] = [command[1], command[2]];
        add(px, py);
      } else if (command[0] === "A") {
        const [, cx, cy, r, from, to] = command;
        for (let i = 0; i <= 128; i++) {
          const a = from + ((to - from) * i) / 128;
          add(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        [px, py] = [cx + r * Math.cos(to), cy + r * Math.sin(to)];
      } else if (command[0] === "C") {
        const [, x1, y1, x2, y2, x, y] = command;
        for (let i = 1; i <= 32; i++) {
          const t = i / 32;
          const u = 1 - t;
          add(
            u * u * u * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
            u * u * u * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
          );
        }
        [px, py] = [x, y];
      }
    }
  }
  return { minX, minY, maxX, maxY };
};
