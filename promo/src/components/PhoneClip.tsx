import { Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { COLORS, EASE_OUT } from "../brand";
import type { Box, View } from "../layout";
import { FPS, type Scene } from "../timeline";

const VIEWPORT = { w: 390, h: 844 };
const TAP_SEC = 0.5;
const LEAD_SEC = 0.75; // the camera sets off this long before a focus point
const MOVE_SEC = 0.55;

export interface Focus {
  t: number;
  y: number;
}

/** Screen y the camera centres on at clip time `t`, eased between points. */
function focusAt(points: Focus[], t: number): number {
  let y = points[0]?.y ?? 0.5;
  for (const p of points) {
    const start = p.t - LEAD_SEC;
    if (t < start) break;
    const k = Math.min((t - start) / MOVE_SEC, 1);
    y = y + (p.y - y) * Easing.bezier(...EASE_OUT)(k);
  }
  return y;
}

/**
 * A window onto a phone capture: `view` picks the part of the screen, `box`
 * is where it lands in the frame. Taps logged during capture are drawn as a
 * fingertip ring in the capture's own coordinates, so they stay on target at
 * any zoom.
 */
export const PhoneClip: React.FC<{ scene: Scene; view: View; box: Box; radius: number; follow?: Focus[] }> = ({
  scene,
  view: baseView,
  box,
  radius,
  follow,
}) => {
  const frame = useCurrentFrame();
  const s = box.w / (baseView.w * VIEWPORT.w);
  const srcNow = scene.srcStart + (frame / FPS) * scene.rate;
  // A box shorter than the screen pans to follow the action.
  const visible = box.h / s / VIEWPORT.h;
  const view =
    follow && visible < 1
      ? { ...baseView, y: Math.min(Math.max(focusAt(follow, srcNow) - visible / 2, 0), 1 - visible) }
      : baseView;
  const taps = scene.clip.taps.filter((t) => srcNow >= t.t - 0.05 && srcNow <= t.t + TAP_SEC);

  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        borderRadius: radius,
        overflow: "hidden",
        boxShadow: `0 0 0 2px ${COLORS.rim}, 0 50px 120px rgb(0 0 0 / 0.55), 0 0 160px oklch(0.55 0.16 205 / 0.18)`,
        background: COLORS.pageBottom,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: VIEWPORT.w * s,
          height: VIEWPORT.h * s,
          transform: `translate(${-view.x * VIEWPORT.w * s}px, ${-view.y * VIEWPORT.h * s}px)`,
        }}
      >
        <OffthreadVideo
          src={staticFile(`captures/${scene.clip.clip}.mp4`)}
          trimBefore={Math.round(scene.srcStart * FPS)}
          playbackRate={scene.rate}
          muted
          style={{ width: "100%", height: "100%" }}
        />
        {taps.map((t) => {
          const p = Math.min(Math.max((srcNow - t.t) / TAP_SEC, 0), 1);
          const grow = interpolate(p, [0, 1], [0.55, 1.35], { easing: Easing.bezier(...EASE_OUT) });
          const fade = interpolate(p, [0, 0.15, 1], [0, 0.85, 0]);
          const size = 64 * s;
          return (
            <div
              key={t.t}
              style={{
                position: "absolute",
                left: t.x * VIEWPORT.w * s - size / 2,
                top: t.y * VIEWPORT.h * s - size / 2,
                width: size,
                height: size,
                borderRadius: "50%",
                border: `${2.5 * s}px solid rgb(255 255 255 / 0.85)`,
                background: "rgb(255 255 255 / 0.08)",
                opacity: fade,
                transform: `scale(${grow})`,
              }}
            />
          );
        })}
      </div>
      {/* Glass rim: a top-lit sheen along the edge, one light source. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.22), inset 0 0 0 1px rgb(255 255 255 / 0.06)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
