import { useEffect, useRef } from "react";
import { SymbolShape } from "@/game/constants";

/**
 * Full-screen repeated symbol texture over a black background.
 */

const SHAPES = Object.values(SymbolShape);
const GRID_STEP = 22;
const SYMBOL_SIZE = 8;
const SYMBOL_STROKE = 1;
const SYMBOL_COLOR = "rgba(148,163,184,0.24)";

interface GridSymbol {
  x: number;
  y: number;
  shape: SymbolShape;
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

    const drawSymbol = (symbol: GridSymbol) => {
      ctx.save();
      ctx.translate(symbol.x, symbol.y);
      ctx.rotate(symbol.rotation);
      ctx.strokeStyle = SYMBOL_COLOR;
      drawShape(ctx, symbol.shape, SYMBOL_SIZE, SYMBOL_STROKE);
      ctx.restore();
    };

    const renderSymbols = () => {
      ctx.clearRect(0, 0, width, height);
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

    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
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
