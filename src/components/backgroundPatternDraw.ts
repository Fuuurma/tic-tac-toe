import { Color, SymbolShape } from "@/game/constants";
import { PALETTE, hexToRgb } from "@/game/palette";
import { SHAPE_GEOMETRY } from "@/game/shapeGeometry";
import { COLORS } from "./backgroundField";

/**
 * How a field symbol is drawn: the compiled shape ops, the per-(tone, heat
 * level) stroke styles, the theme ink and the tracer that turns one symbol
 * into path commands on a 2D context.
 *
 * Pure primitives — backgroundPatternEngine.ts owns the canvas layers, the
 * frame loop and the input that decides what gets drawn.
 */

export const SYMBOL_SIZE = 8;
export const SYMBOL_STROKE = 1;

export type Ink = readonly [r: number, g: number, b: number, a: number];
const INK_DARK: Ink = [148, 163, 184, 0.15];
const INK_LIGHT: Ink = [71, 85, 105, 0.22];
const PEAK_ALPHA = 0.99;

// Lit symbols are drawn in batches, one path and one stroke per (tone, heat
// level). A frame that lights a thousand symbols is then ~100 strokes, not a
// thousand: per-symbol save/rotate/stroke/restore was the whole cost of the
// reveal, and a lit symbol's heat only needs to be this fine to fade smoothly.
export const LEVELS = 12;
// Below this heat a symbol is not drawn at all: it already looks like it
// does at rest to within a fraction of an alpha step, and the long cold tail
// of a wake is most of the symbols on screen after a fast sweep. Heat is
// remapped (see `visualHeat`) so a symbol at the floor draws exactly as it
// rests, which is what keeps the fade from popping where it stops.
export const DRAW_FLOOR = 0.18;
// Above this visual heat a symbol also carries a halo: the same path stroked
// once more, wider and fainter. A blurred shadow per symbol cost more than
// the symbol, and a batch of scattered symbols would blur one huge mask; the
// halo is also the costliest stroke, so only the hot core gets one.
const HALO_HEAT = 0.7;

const COLOR_HEX = Object.fromEntries(
  Object.entries(PALETTE).map(([color, { chip }]) => [color, hexToRgb(chip)]),
) as Record<Color, [number, number, number]>;

export interface LitStyle {
  size: number;
  width: number;
  crisp: string;
  halo: string | null;
  haloWidth: number;
}

/**
 * One style per (tone, heat level), indexed `tone * LEVELS + level - 1`. Heat
 * mixes from the theme's resting ink toward the symbol's own colour, so a
 * symbol cooling out of the reveal lands on the ink it will rest in instead
 * of popping to it.
 */
export const buildLitStyles = (rest: Ink): LitStyle[] => {
  const styles: LitStyle[] = [];
  for (const color of COLORS) {
    const [r, g, b] = COLOR_HEX[color];
    for (let level = 1; level <= LEVELS; level++) {
      const heat = level / LEVELS;
      const width = SYMBOL_STROKE * (1 + heat * 0.4);
      const mix = (from: number, to: number) => Math.round(from + (to - from) * heat);
      styles.push({
        size: SYMBOL_SIZE * (1 + heat * 0.5),
        width,
        crisp: `rgba(${mix(rest[0], r)},${mix(rest[1], g)},${mix(rest[2], b)},${
          rest[3] + (PEAK_ALPHA - rest[3]) * heat
        })`,
        halo: heat > HALO_HEAT ? `rgba(${r},${g},${b},${0.2 * heat})` : null,
        haloWidth: width + 7 * heat,
      });
    }
  }
  return styles;
};

/** Heat as drawn: 0 at the floor, 1 at full heat; null when not drawn. */
export const visualHeat = (heat: number) =>
  heat > DRAW_FLOOR ? (heat - DRAW_FLOOR) / (1 - DRAW_FLOOR) : 0;

export const inkStyle = ([r, g, b, a]: Ink) => `rgba(${r},${g},${b},${a})`;
export const inkForTheme = () =>
  document.documentElement.dataset.theme === "dark" ? INK_DARK : INK_LIGHT;

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// The shapes are traced in absolute coordinates, rotated by hand, rather than
// through ctx.translate/rotate: that keeps many symbols in ONE path, which is
// what lets a batch stroke them in a single call. The helpers take their
// transform as arguments instead of closing over it, so tracing allocates
// nothing per symbol.
const move = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  x: number,
  y: number,
) => ctx.moveTo(cx + x * cos - y * sin, cy + x * sin + y * cos);

const line = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  x: number,
  y: number,
) => ctx.lineTo(cx + x * cos - y * sin, cy + x * sin + y * cos);

const curve = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
) =>
  ctx.bezierCurveTo(
    cx + x1 * cos - y1 * sin,
    cy + x1 * sin + y1 * cos,
    cx + x2 * cos - y2 * sin,
    cy + x2 * sin + y2 * cos,
    cx + x3 * cos - y3 * sin,
    cy + x3 * sin + y3 * cos,
  );

// The symbols come from the same geometry the board strokes as SVG
// (src/game/shapeGeometry.ts), compiled once into a flat op list so tracing a
// symbol stays a tight loop with no per-symbol allocation. Coordinates are
// stored centred on the origin, in the geometry's 100-unit grid.
const OP_MOVE = 0;
const OP_LINE = 1;
const OP_CURVE = 2;
const OP_CLOSE = 3;
const OP_ARC = 4;
const OP_CIRCLE = 5;

/** The geometry's grid is 100 units with the circle at 68 across; a field
 *  symbol's `size` is that circle's diameter plus a little. */
const GRID_PER_SIZE = 85;

const COMPILED_SHAPES = Object.fromEntries(
  Object.entries(SHAPE_GEOMETRY).map(([shape, geometry]) => {
    const ops: number[] = [];
    let circleOpen = false;
    // Symbols here are a few pixels across, so use the cheaper outline.
    for (const path of geometry.field ?? geometry.paths) {
      for (const command of path) {
        switch (command[0]) {
          case "M":
            ops.push(OP_MOVE, command[1] - 50, command[2] - 50);
            break;
          case "L":
            ops.push(OP_LINE, command[1] - 50, command[2] - 50);
            break;
          case "C":
            ops.push(
              OP_CURVE,
              command[1] - 50,
              command[2] - 50,
              command[3] - 50,
              command[4] - 50,
              command[5] - 50,
              command[6] - 50,
            );
            break;
          case "A":
            if (command[5] - command[4] >= Math.PI * 2 - 1e-6 && ops[ops.length - 3] === OP_MOVE) {
              // A whole circle replaces the move before it: the rasteriser's
              // fast circle path needs the pen to start at (cx + r, cy) and
              // an arc from angle 0, exactly as the old hand-traced O did.
              ops.length -= 3;
              ops.push(OP_CIRCLE, command[1] - 50, command[2] - 50, command[3]);
              circleOpen = true;
            } else {
              ops.push(OP_ARC, command[1] - 50, command[2] - 50, command[3], command[4], command[5]);
            }
            break;
          case "Z":
            if (!circleOpen) ops.push(OP_CLOSE);
            circleOpen = false;
            break;
        }
      }
    }
    return [shape, Float64Array.from(ops)];
  }),
) as Record<SymbolShape, Float64Array>;

/** Adds one symbol to the current path; the caller strokes. */
export function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: SymbolShape,
  size: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
) {
  const ops = COMPILED_SHAPES[shape];
  const k = size / GRID_PER_SIZE;
  // Arcs keep their centre and radius, so the symbol's tilt is just an offset
  // on both angles. Taken lazily: most shapes have no arc.
  let tilt = NaN;
  for (let i = 0; i < ops.length; ) {
    switch (ops[i]) {
      case OP_MOVE:
        move(ctx, cx, cy, cos, sin, ops[i + 1] * k, ops[i + 2] * k);
        i += 3;
        break;
      case OP_LINE:
        line(ctx, cx, cy, cos, sin, ops[i + 1] * k, ops[i + 2] * k);
        i += 3;
        break;
      case OP_CURVE:
        curve(
          ctx, cx, cy, cos, sin,
          ops[i + 1] * k, ops[i + 2] * k,
          ops[i + 3] * k, ops[i + 4] * k,
          ops[i + 5] * k, ops[i + 6] * k,
        );
        i += 7;
        break;
      case OP_CIRCLE: {
        const x = ops[i + 1] * k;
        const y = ops[i + 2] * k;
        const r = ops[i + 3] * k;
        const px = cx + x * cos - y * sin;
        const py = cy + x * sin + y * cos;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
        i += 4;
        break;
      }
      case OP_ARC: {
        if (Number.isNaN(tilt)) tilt = Math.atan2(sin, cos);
        const x = ops[i + 1] * k;
        const y = ops[i + 2] * k;
        const from = ops[i + 4] + tilt;
        const to = ops[i + 5] + tilt;
        ctx.arc(cx + x * cos - y * sin, cy + x * sin + y * cos, ops[i + 3] * k, from, to, to < from);
        i += 6;
        break;
      }
      default:
        ctx.closePath();
        i += 1;
    }
  }
}
