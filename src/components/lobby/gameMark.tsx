import { useId } from "react";
import { COLOR_RGB, Color } from "@/game/constants";

// Brand mark, not player chrome: an X-blue / O-red "XO" lockup (DESIGN.md),
// fixed no matter which colors the players picked. The X knocks a clean gap
// out of the O, and the O fades out toward the wordmark the same way
// "Disappear" does. Side by side, never concentric: an X inside a ring reads
// as a close button.
const X_RGB = COLOR_RGB[Color.BLUE];
const O_RGB = COLOR_RGB[Color.RED];

const X_CX = 14;
const O_CX = 33;

// Both diagonals of an X centered at (X_CX, 24) in the 48-unit viewBox.
function xBars(halfLength: number, thickness: number) {
  return [45, -45].map((angle) => (
    <rect
      key={angle}
      x={X_CX - halfLength}
      y={24 - thickness / 2}
      width={halfLength * 2}
      height={thickness}
      rx={thickness / 2.4}
      transform={`rotate(${angle} ${X_CX} 24)`}
    />
  ));
}

export function GameMark() {
  // useId output can carry characters that break `url(#…)` references.
  const id = `game-mark${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fadeId = `${id}-fade`;
  const knockoutId = `${id}-knockout`;

  return (
    <div
      aria-hidden="true"
      className="glass-cell grid size-14 shrink-0 place-items-center rounded-xl shadow-lg max-[360px]:hidden"
    >
      <svg viewBox="0 0 48 48" className="size-11">
        <defs>
          <linearGradient id={fadeId} gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="47" y2="0">
            <stop offset="0" stopColor={`rgb(${O_RGB})`} />
            <stop offset="1" stopColor={`rgb(${O_RGB})`} stopOpacity="0.1" />
          </linearGradient>
          {/* Default mask bounds hug the circle without its stroke and clip it. */}
          <mask id={knockoutId} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
            <rect width="48" height="48" fill="#fff" />
            <g fill="#000">{xBars(12.5, 11)}</g>
          </mask>
        </defs>
        <circle
          data-mark="o"
          cx={O_CX}
          cy="24"
          r="11"
          fill="none"
          stroke={`url(#${fadeId})`}
          strokeWidth="6"
          mask={`url(#${knockoutId})`}
        />
        <g data-mark="x" fill={`rgb(${X_RGB})`}>
          {xBars(11.5, 7)}
        </g>
      </svg>
    </div>
  );
}
