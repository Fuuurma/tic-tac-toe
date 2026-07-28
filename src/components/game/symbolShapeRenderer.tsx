import { SymbolShape } from "@/game/constants";

interface SymbolShapeRendererProps {
  shape: SymbolShape;
  className?: string;
  strokeWidth?: number;
}

/**
 * Renders a symbol shape as crisp SVG.
 * Each shape is drawn in a 100x100 viewBox, centered, with currentColor stroke.
 * Use `text-*` or `color-*` classes on the parent to control the color.
 */
export function SymbolShapeRenderer({
  shape,
  className,
  strokeWidth = 8,
}: SymbolShapeRendererProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {renderShape(shape, strokeWidth)}
    </svg>
  );
}

function renderShape(shape: SymbolShape, strokeWidth: number) {
  const inset = strokeWidth + 4;
  switch (shape) {
    case SymbolShape.X: {
      const barLength = 100 - 2 * inset;
      const barThickness = strokeWidth * 1.6;
      return (
        <>
          <rect
            x={inset}
            y={50 - barThickness / 2}
            width={barLength}
            height={barThickness}
            rx={barThickness / 3}
            transform="rotate(45 50 50)"
            fill="currentColor"
            stroke="none"
          />
          <rect
            x={inset}
            y={50 - barThickness / 2}
            width={barLength}
            height={barThickness}
            rx={barThickness / 3}
            transform="rotate(-45 50 50)"
            fill="currentColor"
            stroke="none"
          />
        </>
      );
    }
    case SymbolShape.O:
      return <circle cx={50} cy={50} r={50 - inset} />;
    case SymbolShape.TRIANGLE:
      return (
        <polygon
          points={`50,${inset} ${100 - inset},${100 - inset} ${inset},${100 - inset}`}
        />
      );
    case SymbolShape.SQUARE:
      return (
        <rect
          x={inset}
          y={inset}
          width={100 - inset * 2}
          height={100 - inset * 2}
          rx={6}
        />
      );
    case SymbolShape.DIAMOND:
      return (
        <polygon
          points={`50,${inset} ${100 - inset},50 50,${100 - inset} ${inset},50`}
        />
      );
    case SymbolShape.STAR: {
      const cx = 50;
      const cy = 50;
      const outerR = 50 - inset;
      const innerR = outerR * 0.4;
      const points: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return <polygon points={points.join(" ")} />;
    }
    case SymbolShape.HEXAGON: {
      const cx = 50;
      const cy = 50;
      const r = 50 - inset;
      const points: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return <polygon points={points.join(" ")} />;
    }
    default:
      return null;
  }
}
