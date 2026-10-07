import { useEffect, useRef } from "react";
import { Color, SymbolShape } from "@/game/constants";

/**
 * Full-screen repeated symbol texture over a black background.
 */

const SHAPES = Object.values(SymbolShape);
const COLORS = Object.values(Color);
const GRID_STEP = 22;
const SYMBOL_SIZE = 8;
const SYMBOL_STROKE = 1;
const SYMBOL_COLOR = "rgba(148,163,184,0.15)";
const REVEAL_RADIUS = 240;
const SPOTLIGHT_RADIUS = REVEAL_RADIUS * 1.15;
// Symbols are stroked centred on their position and the lit ones carry an
// 18px shadow, so a repaint region needs a margin around the spotlight or
// the previous frame's spill survives the restore.
const REGION_MARGIN = SYMBOL_SIZE + 24;

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

interface GridSymbol {
  x: number;
  y: number;
  shape: SymbolShape;
  color: Color;
  rotation: number;
}

const createRandom = () => {
  let state = (Math.random() * 0x100000000) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

function buildGrid(width: number, height: number): GridSymbol[] {
  const random = createRandom();
  const columns = Math.ceil(width / GRID_STEP);
  const rows = Math.ceil(height / GRID_STEP);
  const symbols: GridSymbol[] = [];

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      symbols.push({
        x: column * GRID_STEP + GRID_STEP / 2 + (random() - 0.5) * 5,
        y: row * GRID_STEP + GRID_STEP / 2 + (random() - 0.5) * 5,
        shape: SHAPES[Math.floor(random() * SHAPES.length)],
        color: COLORS[Math.floor(random() * COLORS.length)],
        rotation: (random() - 0.5) * 0.8,
      });
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: SymbolShape,
  size: number,
  stroke: number,
) {
  const s = size / 2;
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (shape) {
    case SymbolShape.X: {
      const r = s * 0.78;
      ctx.beginPath();
      ctx.moveTo(-r, -r);
      ctx.lineTo(r, r);
      ctx.moveTo(r, -r);
      ctx.lineTo(-r, r);
      ctx.stroke();
      break;
    }
    case SymbolShape.O: {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case SymbolShape.TRIANGLE: {
      const r = s * 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.9, r * 0.75);
      ctx.lineTo(-r * 0.9, r * 0.75);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case SymbolShape.SQUARE: {
      const r = s * 0.74;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      break;
    }
    case SymbolShape.DIAMOND: {
      const r = s * 0.86;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case SymbolShape.STAR: {
      const R = s * 0.95;
      const r = s * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? R : r;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(a) * rad;
        const y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case SymbolShape.HEXAGON: {
      const r = s * 0.82;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case SymbolShape.HEART: {
      // Heart drawn in a local coordinate system centered at (0,0).
      // Scale factor keeps it visually balanced with the other shapes.
      const sc = s * 0.018;
      ctx.save();
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.bezierCurveTo(-34, 4, -34, -34, 0, -16);
      ctx.bezierCurveTo(34, -34, 34, 4, 0, 30);
      ctx.closePath();
      ctx.restore();
      ctx.stroke();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Region {
  x: number;
  y: number;
  r: number;
}

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
    let symbols: GridSymbol[] = [];
    let raf: number | null = null;
    let lastT = 0;
    let touchRelease: number | null = null;
    const pointer = { x: -9999, y: -9999, active: false, energy: 0 };
    // Region the lit spotlight last painted. Each frame restores it from the
    // base layer before repainting the new one, so the rest of the grid is
    // never re-stroked.
    let litRegion: Region | null = null;

    // Static base layer — the whole symbol grid at rest. Pointer frames copy
    // small rects back out of it instead of clearing the canvas and walking
    // every symbol again, which is what made pointer tracking expensive:
    // a full-viewport grid is ~700 symbols on a phone and ~1900 on desktop,
    // and every one of them built two rgba() strings and toggled shadow
    // state per frame. The gradient is built once per resize for the same
    // reason — `energy` is applied through globalAlpha, which is exactly
    // equivalent to the per-stop alpha it replaces.
    const base = document.createElement("canvas");
    const baseCtx = base.getContext("2d");
    if (!baseCtx) return;
    let spotlight: CanvasGradient | null = null;

    const highlightFor = (distance: number): number => {
      const proximity = Math.max(0, 1 - distance / REVEAL_RADIUS);
      const eased = proximity * proximity * (3 - 2 * proximity);
      return eased * pointer.energy;
    };

    const drawSymbol = (
      target: CanvasRenderingContext2D,
      symbol: GridSymbol,
      highlight: number,
    ) => {
      const size = SYMBOL_SIZE * (1 + highlight * 0.42);
      const stroke = SYMBOL_STROKE * (1 + highlight * 0.4);

      if (highlight <= 0.01) {
        // Resting symbol: no color math, no shadow state. This is the path
        // ~99% of the grid takes on every rebuild.
        target.save();
        target.translate(symbol.x, symbol.y);
        target.rotate(symbol.rotation);
        target.strokeStyle = SYMBOL_COLOR;
        drawShape(target, symbol.shape, size, stroke);
        target.restore();
        return;
      }

      const [r, g, b] = COLOR_HEX[symbol.color];
      target.save();
      target.translate(symbol.x, symbol.y);
      target.rotate(symbol.rotation);
      target.strokeStyle = `rgba(${Math.round(148 + (r - 148) * highlight)},${Math.round(
        163 + (g - 163) * highlight,
      )},${Math.round(184 + (b - 184) * highlight)},${0.15 + highlight * 0.84})`;
      target.shadowBlur = highlight * 18;
      target.shadowColor = `rgba(${r},${g},${b},${highlight * 0.92})`;
      drawShape(target, symbol.shape, size, stroke);
      target.restore();
    };

    const drawSpotlight = () => {
      if (!spotlight) return;
      // The gradient is cached centred on the origin, but canvas resolves
      // gradient coordinates in the user space of the fill — so translate
      // the pointer to the origin instead of rebuilding it every frame.
      ctx.save();
      ctx.translate(pointer.x, pointer.y);
      ctx.fillStyle = spotlight;
      ctx.fillRect(
        -SPOTLIGHT_RADIUS,
        -SPOTLIGHT_RADIUS,
        SPOTLIGHT_RADIUS * 2,
        SPOTLIGHT_RADIUS * 2,
      );
      ctx.restore();
    };

    // Erases one region back to the resting grid. `clearRect` is mandatory:
    // the base layer is transparent between symbols, and a transparent
    // source pixel composites as a no-op, so copying it alone would leave
    // the previous frame's spotlight tint baked in underneath.
    const restoreBase = (region: Region) => {
      const left = Math.max(0, Math.floor((region.x - region.r) * dpr));
      const top = Math.max(0, Math.floor((region.y - region.r) * dpr));
      const right = Math.min(base.width, Math.ceil((region.x + region.r) * dpr));
      const bottom = Math.min(base.height, Math.ceil((region.y + region.r) * dpr));
      const w = right - left;
      const h = bottom - top;
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(left, top, w, h);
      ctx.drawImage(base, left, top, w, h, left, top, w, h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Lights up the symbols the pointer actually reaches. Only those are
    // re-stroked; everything else in the region comes from the base copy.
    const drawLit = () => {
      drawSpotlight();
      for (const symbol of symbols) {
        const dx = pointer.x - symbol.x;
        const dy = pointer.y - symbol.y;
        const distance = Math.hypot(dx, dy);
        if (distance > REVEAL_RADIUS) continue;
        drawSymbol(ctx, symbol, highlightFor(distance));
      }
    };

    const renderFrame = () => {
      // Restore first, at full opacity and outside the globalAlpha block —
      // a half-transparent copy would leave the old frame showing through.
      if (litRegion) restoreBase(litRegion);
      litRegion = null;
      if (pointer.energy > 0.01) {
        ctx.save();
        ctx.globalAlpha = pointer.energy;
        drawLit();
        ctx.restore();
        litRegion = {
          x: pointer.x,
          y: pointer.y,
          r: SPOTLIGHT_RADIUS + REGION_MARGIN,
        };
      }
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      const deviceW = Math.round(width * dpr);
      const deviceH = Math.round(height * dpr);
      canvas.width = deviceW;
      canvas.height = deviceH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      base.width = deviceW;
      base.height = deviceH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      symbols = buildGrid(width, height);

      // Resting layer: every symbol once, no lighting.
      baseCtx.clearRect(0, 0, width, height);
      for (const symbol of symbols) drawSymbol(baseCtx, symbol, 0);

      spotlight = baseCtx.createRadialGradient(0, 0, 0, 0, 0, SPOTLIGHT_RADIUS);
      spotlight.addColorStop(0, "rgba(41,121,255,0.34)");
      spotlight.addColorStop(0.42, "rgba(56,182,255,0.2)");
      spotlight.addColorStop(0.72, "rgba(42,252,152,0.09)");
      spotlight.addColorStop(1, "rgba(2,6,23,0)");

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, deviceW, deviceH);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      litRegion = null;
    };

    const step = (time: number) => {
      raf = null;
      // First frame after a (re)start: charge it one frame of energy so the
      // spotlight lights up immediately instead of arriving a frame late.
      const delta = lastT === 0 ? 16 : Math.min(50, time - lastT);
      lastT = time;
      const target = pointer.active ? 1 : 0;
      pointer.energy += (target - pointer.energy) * Math.min(1, delta / 120);
      renderFrame();

      if (Math.abs(target - pointer.energy) > 0.01) {
        raf = requestAnimationFrame(step);
      } else if (pointer.energy !== target) {
        pointer.energy = target;
        renderFrame();
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

    // Records the pointer and lets the rAF loop draw it. Drawing here would
    // repaint the whole grid once per pointer event (60-120Hz) and again on
    // the next frame, doubling the cost for no visible gain.
    const updatePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      start();
    };

    const releasePointer = () => {
      pointer.active = false;
      start();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (touchRelease !== null) window.clearTimeout(touchRelease);
        touchRelease = window.setTimeout(() => {
          touchRelease = null;
          releasePointer();
        }, 650);
      }
    };

    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && !event.relatedTarget) releasePointer();
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (pointer.active || pointer.energy > 0.01) start();
    };

    resize();
    // F312: reduced motion gates the pointer-driven animation, never the
    // geometry — a reduced-motion user who rotates or resizes still needs
    // the canvas reflowed.
    window.addEventListener("resize", resize);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      window.addEventListener("pointermove", updatePointer, { passive: true });
      window.addEventListener("pointerdown", updatePointer, { passive: true });
      window.addEventListener("pointerup", onPointerUp, { passive: true });
      window.addEventListener("pointercancel", releasePointer);
      window.addEventListener("pointerout", onPointerOut);
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (touchRelease !== null) window.clearTimeout(touchRelease);
      window.removeEventListener("resize", resize);
      if (!prefersReducedMotion) {
        window.removeEventListener("pointermove", updatePointer);
        window.removeEventListener("pointerdown", updatePointer);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", releasePointer);
        window.removeEventListener("pointerout", onPointerOut);
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
