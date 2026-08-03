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
const SCRAMBLE_INTERVAL_MS = 70;
const SCRAMBLE_DISTANCE = 8;

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
    let lastScrambleAt = -Infinity;
    let lastScrambleX = -9999;
    let lastScrambleY = -9999;
    let touchRelease: number | null = null;
    const pointer = { x: -9999, y: -9999, active: false, energy: 0 };

    const drawSpotlight = () => {
      if (pointer.energy < 0.01) return;

      const radius = REVEAL_RADIUS * 1.15;
      const gradient = ctx.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        radius,
      );
      gradient.addColorStop(0, `rgba(41,121,255,${pointer.energy * 0.34})`);
      gradient.addColorStop(0.42, `rgba(56,182,255,${pointer.energy * 0.2})`);
      gradient.addColorStop(0.72, `rgba(42,252,152,${pointer.energy * 0.09})`);
      gradient.addColorStop(1, "rgba(2,6,23,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(
        pointer.x - radius,
        pointer.y - radius,
        radius * 2,
        radius * 2,
      );
    };

    const drawSymbol = (symbol: GridSymbol) => {
      const distance = Math.hypot(pointer.x - symbol.x, pointer.y - symbol.y);
      const proximity = Math.max(0, 1 - distance / REVEAL_RADIUS);
      const easedProximity = proximity * proximity * (3 - 2 * proximity);
      const highlight = easedProximity * pointer.energy;
      const [r, g, b] = COLOR_HEX[symbol.color];
      const red = Math.round(148 + (r - 148) * highlight);
      const green = Math.round(163 + (g - 163) * highlight);
      const blue = Math.round(184 + (b - 184) * highlight);
      const size = SYMBOL_SIZE * (1 + highlight * 0.42);
      const stroke = SYMBOL_STROKE * (1 + highlight * 0.4);

      ctx.save();
      ctx.translate(symbol.x, symbol.y);
      ctx.rotate(symbol.rotation);
      ctx.strokeStyle =
        highlight > 0.01
          ? `rgba(${red},${green},${blue},${0.15 + highlight * 0.84})`
          : SYMBOL_COLOR;
      ctx.shadowBlur = highlight * 18;
      ctx.shadowColor = `rgba(${r},${g},${b},${highlight * 0.92})`;
      drawShape(ctx, symbol.shape, size, stroke);
      ctx.restore();
    };

    const renderSymbols = () => {
      ctx.clearRect(0, 0, width, height);
      drawSpotlight();
      for (const symbol of symbols) {
        drawSymbol(symbol);
      }
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      symbols = buildGrid(width, height);
      renderSymbols();
    };

    const step = (time: number) => {
      raf = null;
      if (lastT === 0) lastT = time;
      const delta = Math.min(50, time - lastT);
      lastT = time;
      const target = pointer.active ? 1 : 0;
      pointer.energy += (target - pointer.energy) * Math.min(1, delta / 120);
      renderSymbols();

      if (Math.abs(target - pointer.energy) > 0.01) {
        raf = requestAnimationFrame(step);
      } else {
        pointer.energy = target;
        renderSymbols();
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

    const scrambleNearbySymbols = (time: number) => {
      const moved = Math.hypot(pointer.x - lastScrambleX, pointer.y - lastScrambleY);
      if (time - lastScrambleAt < SCRAMBLE_INTERVAL_MS || moved < SCRAMBLE_DISTANCE) {
        return;
      }

      lastScrambleAt = time;
      lastScrambleX = pointer.x;
      lastScrambleY = pointer.y;

      for (const symbol of symbols) {
        const distance = Math.hypot(pointer.x - symbol.x, pointer.y - symbol.y);
        if (distance > REVEAL_RADIUS || Math.random() > 0.34) continue;

        symbol.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        symbol.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        symbol.rotation = (Math.random() - 0.5) * 0.8;
      }
    };

    const updatePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      scrambleNearbySymbols(event.timeStamp);
      renderSymbols();
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
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReducedMotion) {
      window.addEventListener("resize", resize);
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
      if (!prefersReducedMotion) {
        window.removeEventListener("resize", resize);
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
