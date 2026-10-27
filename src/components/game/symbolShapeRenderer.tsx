import type { SymbolShape } from "@/game/constants";
import { SHAPE_GEOMETRY, toSvgPath } from "@/game/shapeGeometry";

interface SymbolShapeRendererProps {
  shape: SymbolShape;
  className?: string;
  strokeWidth?: number;
  /** A CSS colour for a thin darker edge under the stroke. For a colour too
   *  pale to clear 3:1 on its own on the light board (yellow). */
  casing?: string;
}

/** How much wider than the stroke the casing is, in viewBox units. */
const CASING_EXTRA = 3.2;

/**
 * Renders a symbol shape as crisp SVG.
 * Geometry comes from `shapeGeometry.ts`, the same source the background
 * canvas traces, drawn in a 100x100 viewBox with a `currentColor` stroke.
 * Use `text-*` or `color-*` classes on the parent to control the color.
 */
export function SymbolShapeRenderer({
  shape,
  className,
  strokeWidth = 8,
  casing,
}: SymbolShapeRendererProps) {
  const { paths, weight } = SHAPE_GEOMETRY[shape];
  const d = paths.map(toSvgPath).join(" ");
  const width = strokeWidth * weight;
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {casing && <path d={d} style={{ stroke: casing }} strokeWidth={width + CASING_EXTRA} />}
      <path d={d} />
    </svg>
  );
}
