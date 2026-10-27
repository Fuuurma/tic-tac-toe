import { Color, SymbolShape } from "@/game/constants";

/**
 * The model behind the symbol field's reveal: a grid of symbols, each with a
 * heat that stimuli raise and time bleeds off.
 *
 * Replacing "light what is near the pointer right now" with a per-symbol heat
 * is what makes the fade read as a material rather than a timer: a symbol the
 * pointer left dissolves on its own curve, so the wake behind a hand is the
 * pointer's actual path, thinning out, instead of a fixed-length trail that
 * is cut off at the end.
 *
 * Pure and canvas-free on purpose — the painter reads `hot`, `heat`, `pushX`
 * and `pushY` and never writes them.
 */

const SHAPES = Object.values(SymbolShape);
/** Symbols carry an index into this list, so the painter can bucket by tone. */
export const COLORS = Object.values(Color);
export const GRID_STEP = 22;
// Symbols are jittered ±2.5px off their cell centre.
const JITTER = 2.5;
/** Default floor: below this a symbol is back at rest and leaves the hot list. */
const HEAT_FLOOR = 0.012;
export const MAX_RIPPLES = 4;

export interface GridSymbol {
  x: number;
  y: number;
  shape: SymbolShape;
  /** Index into `COLORS`. */
  tone: number;
  rotation: number;
  // The tilt's cosine and sine, so tracing a symbol never recomputes them.
  cos: number;
  sin: number;
}

/** A repaint region in CSS pixels, top-left anchored. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RippleSpec {
  x: number;
  y: number;
  /** Timestamp the ring opens at, in the same clock `advance` is fed. */
  now: number;
  duration: number;
  /** Radius the front reaches at the end of its life. */
  radius: number;
  /** Half-width of the lit band either side of the front. */
  band: number;
  strength: number;
}

interface Ripple extends RippleSpec {
  /** Front radius at the last `advance`. */
  r: number;
  /** Amplitude at the last `advance`: strength, thinned as the ring spreads. */
  amp: number;
}

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const smooth = (k: number) => k * k * (3 - 2 * k);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function buildGrid(
  columns: number,
  rows: number,
  seed: number,
): GridSymbol[] {
  const random = createRandom(seed);
  const symbols: GridSymbol[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = column * GRID_STEP + GRID_STEP / 2 + (random() - 0.5) * (JITTER * 2);
      const y = row * GRID_STEP + GRID_STEP / 2 + (random() - 0.5) * (JITTER * 2);
      const shape = SHAPES[Math.floor(random() * SHAPES.length)];
      const tone = Math.floor(random() * COLORS.length);
      const rotation = (random() - 0.5) * 0.8;
      symbols.push({
        x,
        y,
        shape,
        tone,
        rotation,
        cos: Math.cos(rotation),
        sin: Math.sin(rotation),
      });
    }
  }

  return symbols;
}

/**
 * `floor` is the heat below which a symbol counts as at rest: it is never
 * lit, and leaves the hot list as it cools past it. The painter passes the
 * heat it stops drawing at, so nothing it cannot show is tracked or repainted.
 */
export function createHeatField(floor = HEAT_FLOOR) {
  let columns = 0;
  let rows = 0;
  let isHot = new Uint8Array(0);
  // 1 while a stimulus refreshed the symbol this frame. A held symbol is at
  // rest, not fading, which is what lets a parked cursor stop the frame loop.
  let held = new Uint8Array(0);

  const field = {
    symbols: [] as GridSymbol[],
    heat: new Float32Array(0),
    /** Unit direction each lit symbol is pushed along, away from its stimulus. */
    pushX: new Float32Array(0),
    pushY: new Float32Array(0),
    /** Indices of symbols with any heat; everything else is at rest. */
    hot: [] as number[],
    ripples: [] as Ripple[],

    rebuild(width: number, height: number, seed: number) {
      columns = Math.ceil(width / GRID_STEP);
      rows = Math.ceil(height / GRID_STEP);
      field.symbols = buildGrid(columns, rows, seed);
      const count = field.symbols.length;
      field.heat = new Float32Array(count);
      field.pushX = new Float32Array(count);
      field.pushY = new Float32Array(count);
      isHot = new Uint8Array(count);
      held = new Uint8Array(count);
      field.hot = [];
      field.ripples = [];
    },

    /**
     * Lights every symbol within `radius` of the segment a→b. A segment, not a
     * point: a pointer that crossed 40px since the last frame lit the whole
     * crossing, so a fast flick leaves a continuous streak rather than a row
     * of separate discs.
     */
    stamp(ax: number, ay: number, bx: number, by: number, radius: number) {
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      forEachInBox(
        Math.min(ax, bx) - radius,
        Math.min(ay, by) - radius,
        Math.max(ax, bx) + radius,
        Math.max(ay, by) + radius,
        (i) => {
          const symbol = field.symbols[i];
          const along =
            lengthSquared === 0
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((symbol.x - ax) * dx + (symbol.y - ay) * dy) /
                      lengthSquared,
                  ),
                );
          const nearX = ax + along * dx;
          const nearY = ay + along * dy;
          const distance = Math.hypot(symbol.x - nearX, symbol.y - nearY);
          if (distance >= radius) return;
          const strength = smooth(1 - distance / radius);
          if (strength < floor || strength < field.heat[i]) return;
          light(i, strength, symbol.x - nearX, symbol.y - nearY, distance);
          held[i] = 1;
        },
      );
    },

    addRipple(spec: RippleSpec) {
      field.ripples.push({ ...spec, r: 0, amp: spec.strength });
      while (field.ripples.length > MAX_RIPPLES) field.ripples.shift();
    },

    /**
     * One frame of time: bleeds every hot symbol toward rest, then lets each
     * travelling ring light the symbols its front is crossing. Call the
     * pointer's `stamp` after this, so a held symbol ends the frame at full
     * strength instead of one decay step below it.
     */
    advance(now: number, dt: number, tau: number) {
      const decay = Math.exp(-dt / tau);
      const { hot, heat } = field;
      for (let k = hot.length - 1; k >= 0; k--) {
        const i = hot[k];
        heat[i] *= decay;
        held[i] = 0;
        if (heat[i] < floor) {
          heat[i] = 0;
          isHot[i] = 0;
          hot[k] = hot[hot.length - 1];
          hot.pop();
        }
      }

      for (let k = field.ripples.length - 1; k >= 0; k--) {
        const ring = field.ripples[k];
        const t = (now - ring.now) / ring.duration;
        if (t >= 1) {
          field.ripples.splice(k, 1);
          continue;
        }
        ring.r = ring.radius * easeOutCubic(Math.max(0, t));
        ring.amp = ring.strength * (1 - Math.max(0, t)) ** 1.4;
        stampRing(ring);
      }
    },

    /** True once the next frame would change nothing — the loop may stop. */
    settled() {
      if (field.ripples.length > 0) return false;
      for (const i of field.hot) if (!held[i]) return false;
      return true;
    },

    /** Box around the resting positions of every lit symbol, or null. */
    bounds(): Region | null {
      if (field.hot.length === 0) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const i of field.hot) {
        const { x, y } = field.symbols[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    },
  };

  /**
   * The grid is a regular lattice, so the symbols a box can reach are an
   * index range — no walk over the whole field to find a handful of them.
   */
  function forEachInBox(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    visit: (index: number) => void,
  ) {
    if (columns === 0 || rows === 0) return;
    const c0 = Math.max(0, Math.floor((minX - JITTER) / GRID_STEP));
    const c1 = Math.min(columns - 1, Math.floor((maxX + JITTER) / GRID_STEP));
    const r0 = Math.max(0, Math.floor((minY - JITTER) / GRID_STEP));
    const r1 = Math.min(rows - 1, Math.floor((maxY + JITTER) / GRID_STEP));
    for (let row = r0; row <= r1; row++) {
      for (let column = c0; column <= c1; column++) {
        visit(row * columns + column);
      }
    }
  }

  function light(
    i: number,
    strength: number,
    awayX: number,
    awayY: number,
    distance: number,
  ) {
    field.heat[i] = strength;
    if (distance > 0.5) {
      field.pushX[i] = awayX / distance;
      field.pushY[i] = awayY / distance;
    } else {
      // Dead centre has no "away": fall back to the symbol's own tilt so the
      // push stays deterministic instead of flickering.
      const { rotation } = field.symbols[i];
      field.pushX[i] = Math.cos(rotation);
      field.pushY[i] = Math.sin(rotation);
    }
    if (!isHot[i]) {
      isHot[i] = 1;
      field.hot.push(i);
    }
  }

  function stampRing(ring: Ripple) {
    const reach = ring.r + ring.band;
    forEachInBox(
      ring.x - reach,
      ring.y - reach,
      ring.x + reach,
      ring.y + reach,
      (i) => {
        const symbol = field.symbols[i];
        const dx = symbol.x - ring.x;
        const dy = symbol.y - ring.y;
        const distance = Math.hypot(dx, dy);
        const offset = Math.abs(distance - ring.r);
        if (offset >= ring.band) return;
        const strength = smooth(1 - offset / ring.band) * ring.amp;
        if (strength < floor || strength < field.heat[i]) return;
        light(i, strength, dx, dy, distance);
      },
    );
  }

  return field;
}

