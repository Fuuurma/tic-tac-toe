interface WinLineGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const COMBO_GEOMETRY: Record<string, WinLineGeometry> = {
  "0,1,2": { x1: 16.67, y1: 16.67, x2: 83.33, y2: 16.67 },
  "3,4,5": { x1: 16.67, y1: 50, x2: 83.33, y2: 50 },
  "6,7,8": { x1: 16.67, y1: 83.33, x2: 83.33, y2: 83.33 },
  "0,3,6": { x1: 16.67, y1: 16.67, x2: 16.67, y2: 83.33 },
  "1,4,7": { x1: 50, y1: 16.67, x2: 50, y2: 83.33 },
  "2,5,8": { x1: 83.33, y1: 16.67, x2: 83.33, y2: 83.33 },
  "0,4,8": { x1: 16.67, y1: 16.67, x2: 83.33, y2: 83.33 },
  "2,4,6": { x1: 83.33, y1: 16.67, x2: 16.67, y2: 83.33 },
};

export const buildWinLineGeometry = (
  combination: readonly [number, number, number],
): WinLineGeometry | null => {
  const key = combination.join(",");
  return COMBO_GEOMETRY[key] ?? null;
};

export function WinLine({ geometry }: { geometry: WinLineGeometry }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-2 sm:inset-3"
    >
      <line
        x1={geometry.x1}
        y1={geometry.y1}
        x2={geometry.x2}
        y2={geometry.y2}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset="0"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        className="text-emerald-500 animate-draw-line"
      />
    </svg>
  );
}
