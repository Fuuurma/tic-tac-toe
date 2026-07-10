import type { WinLineGeometry } from "./winLineGeometry";

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
