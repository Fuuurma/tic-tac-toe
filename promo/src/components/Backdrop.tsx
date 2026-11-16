import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../brand";

/**
 * The app's living symbol field, quieted for video: outline symbols on the
 * dark page, drifting slowly, with a cyan glow behind the subject. Static
 * enough that the eye stays on the board.
 */
const SHAPES: string[] = [
  "M30 30 L70 70 M70 30 L30 70", // X
  "M50 26 A24 24 0 1 1 49.99 26", // O
  "M50 24 L76 70 L24 70 Z", // triangle
  "M29 29 H71 V71 H29 Z", // square
  "M50 22 L78 50 L50 78 L22 50 Z", // diamond
  "M50 22 L58 42 L79 42 L62 55 L68 76 L50 63 L32 76 L38 55 L21 42 L42 42 Z", // star
];

const CELL = 92;

export const Backdrop: React.FC<{ width: number; height: number; glowY: number }> = ({
  width,
  height,
  glowY,
}) => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.35) % CELL;
  const cols = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(height / CELL) + 2;
  const symbols: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * 7 + c * 3) % SHAPES.length;
      const x = c * CELL + (r % 2) * (CELL / 2) - CELL / 2;
      const y = r * CELL - drift - CELL;
      symbols.push(
        <path
          key={`${r}-${c}`}
          d={SHAPES[i]}
          transform={`translate(${x} ${y}) scale(${0.34})`}
          fill="none"
          stroke="white"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    }
  }
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${COLORS.pageTop} 0%, ${COLORS.pageBottom} 100%)` }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 42% at 50% ${glowY * 100}%, oklch(0.55 0.16 205 / 0.32), transparent 70%)`,
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute", opacity: 0.06 }}>
        {symbols}
      </svg>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgb(0 0 0 / 0.45) 100%)" }}
      />
    </AbsoluteFill>
  );
};
