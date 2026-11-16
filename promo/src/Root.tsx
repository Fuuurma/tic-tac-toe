import { Composition } from "remotion";
import { SQUARE, VERTICAL } from "./layout";
import { Promo } from "./Promo";
import { FPS, TOTAL_FRAMES } from "./timeline";

export const Root: React.FC = () => (
  <>
    <Composition
      id="PromoVertical"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={VERTICAL.width}
      height={VERTICAL.height}
      defaultProps={{ layout: VERTICAL }}
    />
    <Composition
      id="PromoSquare"
      component={Promo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={SQUARE.width}
      height={SQUARE.height}
      defaultProps={{ layout: SQUARE }}
    />
  </>
);
