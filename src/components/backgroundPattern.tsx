import { useEffect, useRef } from "react";
import { Color, SymbolShape } from "@/game/constants";
import {
  COLORS,
  createHeatField,
  type GridSymbol,
  type Region,
  type RippleSpec,
} from "./backgroundField";

/**
 * Full-screen repeated symbol texture over a black background.
 *
 * The field answers input with light that has memory: every symbol the input
 * reaches heats up and then cools on its own curve (see backgroundField.ts).
 * A mouse is a spotlight that drags a wake. A finger is not a cursor — it is
 * at the glass only while it touches, it covers what is under it, and it
 * arrives as a tap — so touch gets its own vocabulary: a ring that travels
 * out of every tap, and a glow that leads the fingertip instead of hiding
 * under it.
 */

const SYMBOL_SIZE = 8;
const SYMBOL_STROKE = 1;

type Ink = readonly [r: number, g: number, b: number, a: number];
const INK_DARK: Ink = [148, 163, 184, 0.15];
const INK_LIGHT: Ink = [71, 85, 105, 0.22];
const PEAK_ALPHA = 0.99;

// How far a fully lit symbol is pushed off its resting spot. The field bends
// around the light like glass under a lens, and settles back as it cools.
const PUSH = 7;
// Half-width of the box that holds a resting symbol, rotation and stroke
// included. Smaller than half a grid cell, so clearing one never touches
// its neighbour.
const FOOTPRINT = SYMBOL_SIZE * 0.75;
// Symbols are stroked centred on their position and the lit ones carry a
// halo and a push, so a repaint region needs a margin around what is lit or
// the previous frame's spill survives the restore.
const REGION_MARGIN = SYMBOL_SIZE + 24 + PUSH;
// Lit symbols are drawn in batches, one path and one stroke per (tone, heat
// level). A frame that lights a thousand symbols is then ~100 strokes, not a
// thousand: per-symbol save/rotate/stroke/restore was the whole cost of the
// reveal, and a lit symbol's heat only needs to be this fine to fade smoothly.
const LEVELS = 12;
// Below this heat a symbol is not drawn at all: it already looks like it
// does at rest to within a fraction of an alpha step, and the long cold tail
// of a wake is most of the symbols on screen after a fast sweep. Heat is
// remapped (see `visualHeat`) so a symbol at the floor draws exactly as it
// rests, which is what keeps the fade from popping where it stops.
const DRAW_FLOOR = 0.18;
// Above this visual heat a symbol also carries a halo: the same path stroked
// once more, wider and fainter. A blurred shadow per symbol cost more than
// the symbol, and a batch of scattered symbols would blur one huge mask; the
// halo is also the costliest stroke, so only the hot core gets one.
const HALO_HEAT = 0.7;
// A stimulus that jumped further than this since the last frame did not
// travel, it arrived (a new touch, a window re-entry). Stamping the gap would
// light a band across the screen nobody swept.
const MAX_SEGMENT = 120;
const ENERGY_ATTACK_MS = 110;

interface Reveal {
  /** Reach of the lit disc around the stimulus. */
  radius: number;
  /** Cooling time constant, ms: how long the wake takes to dissolve. */
  tau: number;
  /** Px the glow sits above the contact point. */
  lead: number;
}

// A cursor is a point you can see past, on a screen with room for a 240px
// disc. A 240px radius on a 390px phone is the whole width, and the finger
// that made it hides the middle, so touch reaches less, lingers longer (a
// finger moves slower, the wake is the show) and leads the fingertip by
// roughly the height of the thumb pad.
const MOUSE_REVEAL: Reveal = { radius: 240, tau: 200, lead: 0 };
const TOUCH_REVEAL: Reveal = { radius: 150, tau: 340, lead: 40 };
const SPOTLIGHT_SCALE = 1.15;

type RippleKind = Omit<RippleSpec, "x" | "y" | "now">;
const CLICK_RIPPLE: RippleKind = {
  duration: 800,
  radius: 260,
  band: 40,
  strength: 0.8,
};
const TAP_RIPPLE: RippleKind = {
  duration: 1000,
  radius: 320,
  band: 48,
  strength: 1,
};
// Touch has no hover, so nothing tells a first-time visitor the field
// answers to them. One soft ring on arrival is the hint.
const WELCOME_RIPPLE: RippleKind = {
  duration: 1700,
  radius: 320,
  band: 52,
  strength: 0.95,
};
const WELCOME_DELAY_MS = 500;
const RING_COLOR = "56,182,255";

const COLOR_HEX: Record<Color, [number, number, number]> = {
  [Color.BLUE]: [59, 130, 246],
  [Color.GREEN]: [34, 197, 94],
  [Color.YELLOW]: [234, 179, 8],
  [Color.ORANGE]: [249, 115, 22],
  [Color.RED]: [239, 68, 68],
  [Color.PINK]: [236, 72, 153],
  [Color.PURPLE]: [168, 85, 247],
  [Color.GRAY]: [107, 114, 128],
};

interface LitStyle {
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
const buildLitStyles = (rest: Ink): LitStyle[] => {
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
const visualHeat = (heat: number) =>
  heat > DRAW_FLOOR ? (heat - DRAW_FLOOR) / (1 - DRAW_FLOOR) : 0;

const inkStyle = ([r, g, b, a]: Ink) => `rgba(${r},${g},${b},${a})`;
const inkForTheme = () =>
  document.documentElement.dataset.theme === "dark" ? INK_DARK : INK_LIGHT;

const unionOf = (a: Region | null, b: Region): Region => {
  if (!a) return b;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
};

const padded = (box: Region, pad: number): Region => ({
  x: box.x - pad,
  y: box.y - pad,
  w: box.w + pad * 2,
  h: box.h + pad * 2,
});

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

// Star and hexagon vertices are unit directions; only the radius changes with
// the symbol's size.
const STAR_UNIT: Array<[number, number]> = Array.from({ length: 10 }, (_, i) => {
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return [Math.cos(a), Math.sin(a)];
});
const HEXAGON_UNIT: Array<[number, number]> = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 6;
  return [Math.cos(a), Math.sin(a)];
});

/** Adds one symbol to the current path; the caller strokes. */
function traceShape(
  ctx: CanvasRenderingContext2D,
  shape: SymbolShape,
  size: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
) {
  const s = size / 2;
  switch (shape) {
    case SymbolShape.X: {
      const r = s * 0.78;
      move(ctx, cx, cy, cos, sin, -r, -r);
      line(ctx, cx, cy, cos, sin, r, r);
      move(ctx, cx, cy, cos, sin, r, -r);
      line(ctx, cx, cy, cos, sin, -r, r);
      break;
    }
    case SymbolShape.O: {
      // A circle has no tilt. The moveTo starts the subpath at the arc's own
      // start point, so the arc does not join the previous symbol with a line.
      const r = s * 0.8;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      break;
    }
    case SymbolShape.TRIANGLE: {
      const r = s * 0.9;
      move(ctx, cx, cy, cos, sin, 0, -r);
      line(ctx, cx, cy, cos, sin, r * 0.9, r * 0.75);
      line(ctx, cx, cy, cos, sin, -r * 0.9, r * 0.75);
      ctx.closePath();
      break;
    }
    case SymbolShape.SQUARE: {
      const r = s * 0.74;
      move(ctx, cx, cy, cos, sin, -r, -r);
      line(ctx, cx, cy, cos, sin, r, -r);
      line(ctx, cx, cy, cos, sin, r, r);
      line(ctx, cx, cy, cos, sin, -r, r);
      ctx.closePath();
      break;
    }
    case SymbolShape.DIAMOND: {
      const r = s * 0.86;
      move(ctx, cx, cy, cos, sin, 0, -r);
      line(ctx, cx, cy, cos, sin, r, 0);
      line(ctx, cx, cy, cos, sin, 0, r);
      line(ctx, cx, cy, cos, sin, -r, 0);
      ctx.closePath();
      break;
    }
    case SymbolShape.STAR: {
      const outer = s * 0.95;
      const inner = s * 0.42;
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const [ux, uy] = STAR_UNIT[i];
        if (i === 0) move(ctx, cx, cy, cos, sin, ux * radius, uy * radius);
        else line(ctx, cx, cy, cos, sin, ux * radius, uy * radius);
      }
      ctx.closePath();
      break;
    }
    case SymbolShape.HEXAGON: {
      const r = s * 0.82;
      for (let i = 0; i < 6; i++) {
        const [ux, uy] = HEXAGON_UNIT[i];
        if (i === 0) move(ctx, cx, cy, cos, sin, ux * r, uy * r);
        else line(ctx, cx, cy, cos, sin, ux * r, uy * r);
      }
      ctx.closePath();
      break;
    }
    case SymbolShape.HEART: {
      // The heart is authored in a 68-unit box centred on the origin; the
      // scale keeps it visually balanced with the other shapes.
      const k = s * 0.018;
      move(ctx, cx, cy, cos, sin, 0, 30 * k);
      curve(ctx, cx, cy, cos, sin, -34 * k, 4 * k, -34 * k, -34 * k, 0, -16 * k);
      curve(ctx, cx, cy, cos, sin, 34 * k, -34 * k, 34 * k, 4 * k, 0, 30 * k);
      ctx.closePath();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BackgroundPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    // Set once the resting layer has been built in THIS effect run. The
    // same-size early return below is a repaint optimisation, never an
    // initialisation skip: a remount (StrictMode double effects, HMR)
    // reuses an already-sized canvas with empty closure state, and
    // skipping the build leaves the spotlight permanently dead until the
    // next forced rebuild (theme toggle).
    let built = false;
    let raf: number | null = null;
    let lastT = 0;
    let welcomeTimer: number | null = null;
    // Where the stimulus is, and where it was last frame: the segment between
    // them is what gets stamped, so a flick lights its whole path.
    const aim = {
      x: -9999,
      y: -9999,
      fromX: -9999,
      fromY: -9999,
      active: false,
      touch: false,
    };
    // Glow of the soft tint under the stimulus. Symbols carry their own heat;
    // this is only the gradient, and it is what the rest of the loop eases.
    let energy = 0;
    // Rings asked for by input, opened on the next frame so their clock is
    // the frame clock rather than an event timestamp from before it.
    const pendingRipples: Array<{ at: [number, number]; kind: RippleKind }> = [];
    // Region the lit layer last painted. Each frame restores it from the
    // base layer before repainting the new one, so the rest of the grid is
    // never re-stroked.
    let litRegion: Region | null = null;
    const field = createHeatField(DRAW_FLOOR);
    const buckets: number[][] = Array.from(
      { length: COLORS.length * LEVELS },
      () => [],
    );

    // Static base layer — the whole symbol grid at rest. Pointer frames copy
    // small rects back out of it instead of clearing the canvas and walking
    // every symbol again, which is what made pointer tracking expensive:
    // a full-viewport grid is ~700 symbols on a phone and ~1900 on desktop.
    // The gradients are built once per resize for the same reason — `energy`
    // is applied through globalAlpha, which is exactly equivalent to the
    // per-stop alpha it replaces.
    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;
    let restInk = inkForTheme();
    let litStyles = buildLitStyles(restInk);
    let mouseSpotlight: CanvasGradient | null = null;
    let touchSpotlight: CanvasGradient | null = null;

    // The symbol field is decor, not data: the seed is fixed for the life
    // of the effect so a resize reflows the SAME field. Re-rolling it on
    // every event made the whole background shuffle under a window drag.
    const gridSeed = (Math.random() * 0x100000000) >>> 0;

    const drawSpotlight = (gradient: CanvasGradient, radius: number) => {
      // The gradient is cached centred on the origin, but canvas resolves
      // gradient coordinates in the user space of the fill — so translate
      // the pointer to the origin instead of rebuilding it every frame.
      ctx.save();
      ctx.translate(aim.x, aim.y);
      ctx.globalAlpha = energy;
      ctx.fillStyle = gradient;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    };

    // The front of a ring, and a wide faint band behind it that reads as the
    // crest of a wave on glass. The symbols it passes do the real lighting;
    // this only draws the line the eye follows.
    const drawRipples = () => {
      for (const ring of field.ripples) {
        if (ring.r < 1) continue;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.lineWidth = ring.band * 1.2;
        ctx.strokeStyle = `rgba(${RING_COLOR},${0.06 * ring.amp})`;
        ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${RING_COLOR},${0.3 * ring.amp})`;
        ctx.stroke();
      }
    };

    // Every lit symbol, bucketed by (tone, heat level) and stroked once per
    // bucket. A halo goes under the crisp stroke for the hot ones.
    const drawLit = () => {
      const { symbols, heat, pushX, pushY } = field;
      for (const bucket of buckets) bucket.length = 0;
      for (const i of field.hot) {
        const lit = visualHeat(heat[i]);
        if (lit === 0) continue;
        const level = Math.min(LEVELS, Math.ceil(lit * LEVELS));
        buckets[symbols[i].tone * LEVELS + level - 1].push(i);
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let b = 0; b < buckets.length; b++) {
        const bucket = buckets[b];
        if (bucket.length === 0) continue;
        const style = litStyles[b];
        ctx.beginPath();
        for (const i of bucket) {
          const symbol = symbols[i];
          const lit = visualHeat(heat[i]);
          traceShape(
            ctx,
            symbol.shape,
            style.size,
            symbol.x + pushX[i] * lit * PUSH,
            symbol.y + pushY[i] * lit * PUSH,
            symbol.cos,
            symbol.sin,
          );
        }
        if (style.halo) {
          ctx.lineWidth = style.haloWidth;
          ctx.strokeStyle = style.halo;
          ctx.stroke();
        }
        ctx.lineWidth = style.width;
        ctx.strokeStyle = style.crisp;
        ctx.stroke();
      }
    };

    const drawResting = (target: CanvasRenderingContext2D, symbols: GridSymbol[]) => {
      target.lineCap = "round";
      target.lineJoin = "round";
      target.lineWidth = SYMBOL_STROKE;
      target.strokeStyle = inkStyle(restInk);
      target.beginPath();
      for (const symbol of symbols) {
        traceShape(target, symbol.shape, SYMBOL_SIZE, symbol.x, symbol.y, symbol.cos, symbol.sin);
      }
      target.stroke();
    };

    // Erases one region back to the resting grid. `clearRect` is mandatory:
    // the base layer is transparent between symbols, and a transparent
    // source pixel composites as a no-op, so copying it alone would leave
    // the previous frame's spotlight tint baked in underneath.
    const restoreBase = (region: Region) => {
      const left = Math.max(0, Math.floor(region.x * dpr));
      const top = Math.max(0, Math.floor(region.y * dpr));
      const right = Math.min(base.width, Math.ceil((region.x + region.w) * dpr));
      const bottom = Math.min(base.height, Math.ceil((region.y + region.h) * dpr));
      const w = right - left;
      const h = bottom - top;
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(left, top, w, h);
      ctx.drawImage(base, left, top, w, h, left, top, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // One box around everything the lit layer will touch this frame. The
    // box is bounded by the viewport and shrinks to nothing as the field
    // cools, so a parked or idle page never repaints.
    const litBounds = (spotlightRadius: number): Region | null => {
      let box: Region | null = null;
      const cells = field.bounds();
      if (cells) box = padded(cells, REGION_MARGIN);
      if (energy > 0.01) {
        box = unionOf(box, {
          x: aim.x - spotlightRadius,
          y: aim.y - spotlightRadius,
          w: spotlightRadius * 2,
          h: spotlightRadius * 2,
        });
      }
      for (const ring of field.ripples) {
        const reach = ring.r + ring.band * 1.2;
        box = unionOf(box, {
          x: ring.x - reach,
          y: ring.y - reach,
          w: reach * 2,
          h: reach * 2,
        });
      }
      return box;
    };

    const paint = () => {
      // Restore first, at full opacity and outside any globalAlpha block —
      // a half-transparent copy would leave the old frame showing through.
      if (litRegion) restoreBase(litRegion);
      litRegion = null;
      const reveal = aim.touch ? TOUCH_REVEAL : MOUSE_REVEAL;
      const spotlightRadius = reveal.radius * SPOTLIGHT_SCALE;
      const bounds = litBounds(spotlightRadius);
      if (!bounds) return;

      // A pushed symbol has left its spot, so the resting copy the restore
      // just blitted there has to go, or every lit symbol trails a faint
      // twin. Clear every footprint before painting anything on top: it has
      // to precede the tint and the rings too, or the hole it leaves shows
      // as a dark square in them, and a pushed neighbour can reach into the
      // next cell, so it has to precede every lit symbol as well.
      const { symbols, heat } = field;
      for (const i of field.hot) {
        if (visualHeat(heat[i]) === 0) continue;
        const { x, y } = symbols[i];
        ctx.clearRect(x - FOOTPRINT, y - FOOTPRINT, FOOTPRINT * 2, FOOTPRINT * 2);
      }
      const gradient = aim.touch ? touchSpotlight : mouseSpotlight;
      if (gradient && energy > 0.01) drawSpotlight(gradient, spotlightRadius);
      drawRipples();
      drawLit();
      litRegion = bounds;
    };

    const resize = (force = false) => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      const deviceW = Math.round(width * dpr);
      const deviceH = Math.round(height * dpr);
      // A same-size resize (scroll chrome, spurious event) must not pay
      // the full-grid repaint it used to trigger — but only once this run
      // has built the layer at least once (see `built` above).
      if (!force && built && canvas.width === deviceW && canvas.height === deviceH) return;
      canvas.width = deviceW;
      canvas.height = deviceH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      base.width = deviceW;
      base.height = deviceH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.rebuild(width, height, gridSeed);

      // Resting layer: every symbol once, no lighting.
      baseCtx.clearRect(0, 0, width, height);
      drawResting(baseCtx, field.symbols);

      const tint = (reveal: Reveal) => {
        const gradient = baseCtx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          reveal.radius * SPOTLIGHT_SCALE,
        );
        gradient.addColorStop(0, "rgba(41,121,255,0.34)");
        gradient.addColorStop(0.42, "rgba(56,182,255,0.2)");
        gradient.addColorStop(0.72, "rgba(42,252,152,0.09)");
        gradient.addColorStop(1, "rgba(2,6,23,0)");
        return gradient;
      };
      mouseSpotlight = tint(MOUSE_REVEAL);
      touchSpotlight = tint(TOUCH_REVEAL);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, deviceW, deviceH);
      ctx.drawImage(base, 0, 0, deviceW, deviceH);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      litRegion = null;
      built = true;
    };

    const step = (time: number) => {
      raf = null;
      // First frame after a (re)start: charge it one frame of time so the
      // reveal lights up immediately instead of arriving a frame late.
      const delta = lastT === 0 ? 16 : Math.min(50, time - lastT);
      lastT = time;
      const reveal = aim.touch ? TOUCH_REVEAL : MOUSE_REVEAL;

      if (pendingRipples.length > 0) {
        for (const { at, kind } of pendingRipples.splice(0)) {
          field.addRipple({ x: at[0], y: at[1], now: time, ...kind });
        }
      }
      // Cool first, stamp after: a symbol the stimulus is still holding
      // ends the frame at full strength, not one cooling step below it.
      field.advance(time, delta, reveal.tau);
      if (aim.active) {
        // Stamp every frame rather than only on move events: a cursor held
        // still must keep its disc lit, and the wake behind it must keep
        // cooling, both of which only happen if this runs each frame.
        const travelled = Math.hypot(aim.x - aim.fromX, aim.y - aim.fromY);
        if (travelled > MAX_SEGMENT) {
          aim.fromX = aim.x;
          aim.fromY = aim.y;
        }
        field.stamp(aim.fromX, aim.fromY, aim.x, aim.y, reveal.radius);
        aim.fromX = aim.x;
        aim.fromY = aim.y;
      }
      const target = aim.active ? 1 : 0;
      energy +=
        (target - energy) *
        (1 - Math.exp(-delta / (target ? ENERGY_ATTACK_MS : reveal.tau)));
      paint();

      if (!field.settled() || Math.abs(target - energy) > 0.01) {
        raf = requestAnimationFrame(step);
      } else if (energy !== target) {
        energy = target;
        paint();
      }
    };

    const start = () => {
      if (raf === null && !document.hidden) {
        lastT = 0;
        raf = requestAnimationFrame(step);
      }
    };

    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    // Records the stimulus and lets the rAF loop draw it. Drawing here would
    // repaint the lit region once per input event (60-120Hz) and again on
    // the next frame, doubling the cost for no visible gain.
    const aimAt = (x: number, y: number, touch: boolean) => {
      const lead = (touch ? TOUCH_REVEAL : MOUSE_REVEAL).lead;
      const aimY = y - lead;
      // A new gesture arrives, it does not travel from wherever the last one
      // ended.
      if (!aim.active || aim.touch !== touch) {
        aim.fromX = x;
        aim.fromY = aimY;
      }
      aim.x = x;
      aim.y = aimY;
      aim.touch = touch;
      aim.active = true;
      start();
    };

    const release = () => {
      aim.active = false;
      start();
    };

    const ripple = (x: number, y: number, kind: RippleKind) => {
      pendingRipples.push({ at: [x, y], kind });
      start();
    };

    // Mouse and pen ride pointer events. Touch does not: the browser cancels
    // a touch pointer the moment it decides the gesture is a pan, so a
    // dragging finger would light the field for one frame and then go dark.
    // Touch events keep arriving through the scroll.
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      aimAt(event.clientX, event.clientY, false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      aimAt(event.clientX, event.clientY, false);
      ripple(event.clientX, event.clientY, CLICK_RIPPLE);
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && !event.relatedTarget) release();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType !== "touch") release();
    };

    const onTouchStart = (event: TouchEvent) => {
      const finger = event.touches[0];
      if (!finger) return;
      aimAt(finger.clientX, finger.clientY, true);
      for (const touch of Array.from(event.changedTouches)) {
        ripple(touch.clientX, touch.clientY, TAP_RIPPLE);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      const finger = event.touches[0];
      if (finger) aimAt(finger.clientX, finger.clientY, true);
    };

    // A lifted finger is not the end of the gesture while another is down.
    const onTouchEnd = (event: TouchEvent) => {
      const finger = event.touches[0];
      if (finger) aimAt(finger.clientX, finger.clientY, true);
      else release();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (aim.active || !field.settled() || energy > 0.01) start();
    };

    // The first paint is synchronous; later resize events are coalesced
    // through rAF so a drag burst costs one rebuild per frame, not one
    // per event (each rebuild re-strokes the whole resting grid).
    resize();
    let resizeRaf: number | null = null;
    const queueResize = () => {
      if (resizeRaf !== null) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        resize();
      });
    };
    // F312: reduced motion gates the pointer-driven animation, never the
    // geometry — a reduced-motion user who rotates or resizes still needs
    // the canvas reflowed.
    window.addEventListener("resize", queueResize);
    const themeObserver = new MutationObserver(() => {
      const nextInk = inkForTheme();
      if (nextInk === restInk) return;
      restInk = nextInk;
      litStyles = buildLitStyles(restInk);
      resize(true);
      if (aim.active || energy > 0.01) start();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Capture, so a control that stops propagation (a sheet's drag handle,
    // a dialog) still leaves the field answering its taps. Passive, so none
    // of it can ever hold up a scroll.
    const listen = { passive: true, capture: true } as const;
    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", onPointerMove, listen);
      window.addEventListener("pointerdown", onPointerDown, listen);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("pointerout", onPointerOut);
      window.addEventListener("touchstart", onTouchStart, listen);
      window.addEventListener("touchmove", onTouchMove, listen);
      window.addEventListener("touchend", onTouchEnd, listen);
      window.addEventListener("touchcancel", onTouchEnd, listen);
      document.addEventListener("visibilitychange", onVisibility);
      if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
        welcomeTimer = window.setTimeout(() => {
          welcomeTimer = null;
          ripple(width / 2, height * 0.58, WELCOME_RIPPLE);
        }, WELCOME_DELAY_MS);
      }
    }

    return () => {
      stop();
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      if (welcomeTimer !== null) window.clearTimeout(welcomeTimer);
      window.removeEventListener("resize", queueResize);
      themeObserver.disconnect();
      if (!prefersReducedMotion) {
        window.removeEventListener("pointermove", onPointerMove, listen);
        window.removeEventListener("pointerdown", onPointerDown, listen);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("pointerout", onPointerOut);
        window.removeEventListener("touchstart", onTouchStart, listen);
        window.removeEventListener("touchmove", onTouchMove, listen);
        window.removeEventListener("touchend", onTouchEnd, listen);
        window.removeEventListener("touchcancel", onTouchEnd, listen);
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
