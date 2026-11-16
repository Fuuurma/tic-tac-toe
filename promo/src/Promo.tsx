import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { EASE_OUT, FONTS, loadBrandFonts } from "./brand";
import { Backdrop } from "./components/Backdrop";
import { Caption } from "./components/Caption";
import { EndCard } from "./components/EndCard";
import { PhoneClip } from "./components/PhoneClip";
import { BOARD_VIEW, FULL_VIEW, type Layout } from "./layout";
import { END, HOOK, MOMENTS, ONLINE, ONLINE_FOCUS, OVERLAP, PLAY } from "./timeline";

loadBrandFonts();

/** Crossfades a scene in and out over the shared overlap. */
const Fade: React.FC<{ frames: number; fadeIn: boolean; fadeOut: boolean; children: React.ReactNode }> = ({
  frames,
  fadeIn,
  fadeOut,
  children,
}) => {
  const frame = useCurrentFrame();
  const a = fadeIn ? interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const b = fadeOut ? interpolate(frame, [frames - OVERLAP, frames], [1, 0], { extrapolateLeft: "clamp" }) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(a, b) }}>{children}</AbsoluteFill>;
};

/** Hook: the board fills the frame, then eases back as the scene ends. */
const HookBoard: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const settle = interpolate(frame, [0, HOOK.frames], [1.04, 1], { easing: Easing.bezier(...EASE_OUT) });
  return (
    <AbsoluteFill style={{ transform: `scale(${settle})` }}>
      <PhoneClip scene={HOOK} view={BOARD_VIEW} box={layout.board} radius={56} />
    </AbsoluteFill>
  );
};

/** The scene's phone rises into place as it arrives. */
const Rise: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(...EASE_OUT) });
  return <AbsoluteFill style={{ transform: `translateY(${(1 - p) * 60}px)` }}>{children}</AbsoluteFill>;
};

export const Promo: React.FC<{ layout: Layout }> = ({ layout }) => {
  const square = layout.height === layout.width;
  return (
    <AbsoluteFill style={{ fontFamily: FONTS.body }}>
      <Backdrop width={layout.width} height={layout.height} glowY={square ? 0.5 : 0.62} />

      <Sequence from={HOOK.from} durationInFrames={HOOK.frames}>
        <Fade frames={HOOK.frames} fadeIn={false} fadeOut>
          <HookBoard layout={layout} />
          <Caption
            box={layout.hookCaption}
            kicker="Tic-tac-toe"
            cues={[{ at: 0, text: "but your marks disappear." }]}
            sceneFrames={HOOK.frames}
            still
          />
        </Fade>
      </Sequence>

      <Sequence from={PLAY.from} durationInFrames={PLAY.frames}>
        <Fade frames={PLAY.frames} fadeIn fadeOut>
          <Rise>
            <PhoneClip scene={PLAY} view={layout.game.view} box={layout.game.box} radius={56} />
          </Rise>
          <Caption
            box={layout.caption}
            kicker="Play the computer"
            delay={OVERLAP}
            cues={[
              { at: OVERLAP + 3, text: "Three marks each." },
              { at: Math.max(MOMENTS.playVanish - 6, 30), text: "The oldest one fades." },
              { at: MOMENTS.playWin - 4, text: "Line up three. Win." },
            ]}
            sceneFrames={PLAY.frames}
          />
        </Fade>
      </Sequence>

      <Sequence from={ONLINE.from} durationInFrames={ONLINE.frames}>
        <Fade frames={ONLINE.frames} fadeIn fadeOut>
          <Rise>
            <PhoneClip scene={ONLINE} view={FULL_VIEW} box={layout.game.box} radius={56} follow={ONLINE_FOCUS} />
          </Rise>
          <Caption
            box={layout.caption}
            kicker="Play a friend online"
            delay={OVERLAP}
            cues={[
              { at: OVERLAP + 3, text: "Open a room." },
              { at: MOMENTS.onlineReady - 4, text: "Send the link." },
              { at: MOMENTS.onlineJoined - 2, text: "They're in. Your move." },
            ]}
            sceneFrames={ONLINE.frames}
          />
        </Fade>
      </Sequence>

      <Sequence from={END.from} durationInFrames={END.frames}>
        <Fade frames={END.frames} fadeIn fadeOut={false}>
          <EndCard scale={layout.endScale} />
        </Fade>
      </Sequence>
    </AbsoluteFill>
  );
};
