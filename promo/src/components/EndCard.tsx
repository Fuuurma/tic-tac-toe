import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, EASE_OUT, FONTS } from "../brand";

export const URL_TEXT = "tic-tac-toe-1ou.pages.dev";

/**
 * The app's masthead as an end card: the XO mark, "Tic Tac Toe" small and
 * muted over a large Syne "Disappear" whose tail fades (DESIGN.md, Lobby),
 * then the one thing to remember, the URL. Elements arrive 60ms apart.
 */
export const EndCard: React.FC<{ scale: number }> = ({ scale }) => {
  const frame = useCurrentFrame();
  const ease = Easing.bezier(...EASE_OUT);
  const rise = (delay: number) => {
    const p = interpolate(frame, [delay, delay + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
    return { opacity: p, transform: `translateY(${(1 - p) * 30}px)` };
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.body,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40, ...rise(0) }}>
        <Img src={staticFile("brand/mark.svg")} style={{ width: 196, height: 196, borderRadius: 44, boxShadow: `0 0 0 2px ${COLORS.rim}, 0 30px 80px rgb(0 0 0 / 0.5)` }} />
        <div style={{ fontFamily: FONTS.display, lineHeight: 0.95 }}>
          <div style={{ fontSize: 60, fontWeight: 600, color: COLORS.muted, letterSpacing: "0.01em" }}>Tic Tac Toe</div>
          <div
            style={{
              fontSize: 132,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              backgroundImage: `linear-gradient(90deg, ${COLORS.text} 45%, rgb(255 255 255 / 0.28) 100%)`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              paddingBottom: 10,
            }}
          >
            Disappear
          </div>
        </div>
      </div>

      <div style={{ marginTop: 84, fontSize: 52, fontWeight: 600, color: COLORS.text, ...rise(4) }}>
        Free. No sign-up. In your browser.
      </div>

      <div
        style={{
          marginTop: 56,
          padding: "26px 48px",
          borderRadius: 22,
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: "-0.005em",
          color: COLORS.text,
          background: "linear-gradient(180deg, oklch(0.55 0.16 205 / 0.55), oklch(0.45 0.14 205 / 0.45))",
          boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.3), 0 0 0 2px oklch(0.7 0.12 205 / 0.7), 0 20px 70px oklch(0.55 0.16 205 / 0.35)`,
          ...rise(8),
        }}
      >
        {URL_TEXT}
      </div>
    </div>
  );
};
