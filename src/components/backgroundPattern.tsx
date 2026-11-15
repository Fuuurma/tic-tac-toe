import { useEffect, useRef } from "react";
import { mountBackgroundPattern } from "./backgroundPatternEngine";

/**
 * Full-screen repeated symbol texture over a black background.
 *
 * The canvas shell only — the field machine (layers, frame loop, pointer and
 * touch input) lives in backgroundPatternEngine.ts, and the symbol drawing
 * primitives in backgroundPatternDraw.ts.
 */
export function BackgroundPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountBackgroundPattern(canvas);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
