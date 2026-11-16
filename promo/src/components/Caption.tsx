import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, EASE_IN, EASE_OUT, FONTS } from "../brand";
import type { Layout } from "../layout";

export interface Cue {
  at: number; // scene frame the headline arrives on
  text: string;
}

const ENTER = 12; // 400ms entrance
const EXIT = 7; // exits run quicker than entrances

/**
 * Kicker over a headline. The kicker holds for the scene; headlines replace
 * each other on their cues, the old one lifting out before the new one rises.
 * `still` renders the first cue already settled, so frame 0 reads as a
 * finished thumbnail.
 */
export const Caption: React.FC<{
  box: Layout["caption"];
  kicker: string;
  cues: Cue[];
  sceneFrames: number;
  still?: boolean;
  /** Frames to hold the kicker back, so it never crosses the last scene's. */
  delay?: number;
}> = ({ box, kicker, cues, sceneFrames, still, delay = 0 }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(...EASE_OUT);
  const easeIn = Easing.bezier(...EASE_IN);
  const kickerIn = still
    ? 1
    : interpolate(frame, [delay, delay + ENTER], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ease,
      });

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: box.align,
        fontFamily: FONTS.body,
      }}
    >
      <div
        style={{
          fontSize: box.kicker,
          fontWeight: 600,
          lineHeight: 1.2,
          color: COLORS.cyan,
          opacity: kickerIn,
          transform: `translateY(${(1 - kickerIn) * 16}px)`,
          marginBottom: box.kicker * 0.35,
        }}
      >
        {kicker}
      </div>
      <div style={{ position: "relative", height: box.headline * 1.05 * 2 }}>
        {cues.map((cue, i) => {
          const end = cues[i + 1]?.at ?? sceneFrames + EXIT;
          if (frame < cue.at - 1 || frame > end + EXIT) return null;
          const settled = still && i === 0;
          // A replacing headline waits for the old one to clear: two lines
          // half-faded over each other read as a smudge.
          const enter = i === 0 ? cue.at : cue.at + EXIT;
          const inP = settled ? 1 : interpolate(frame, [enter, enter + ENTER], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
          const outP = interpolate(frame, [end, end + EXIT], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeIn });
          return (
            <div
              key={cue.text}
              style={{
                position: "absolute",
                inset: 0,
                fontSize: box.headline,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.015em",
                color: COLORS.text,
                textWrap: "balance",
                opacity: inP * (1 - outP),
                transform: `translateY(${(1 - inP) * 28 - outP * 14}px)`,
              }}
            >
              {cue.text}
            </div>
          );
        })}
      </div>
    </div>
  );
};
