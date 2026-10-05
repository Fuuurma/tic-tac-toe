// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BackgroundPattern } from "./backgroundPattern";

/**
 * F312: the component registered its `resize` listener only inside the
 * !prefers-reduced-motion branch, so a reduced-motion user who rotated or
 * resized the window kept a canvas frozen at the initial viewport size.
 * The fix gates only pointer-driven animation on the media query — the
 * resize listener is unconditional.
 */

// jsdom gives canvas no 2d context, so the component would bail before
// wiring anything. A no-op proxy stands in for every ctx method/property.
const fake2dContext = () =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "createRadialGradient") {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;

const stubReducedMotion = (matches: boolean) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
};

const setInnerWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
};

const innerWidthDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);

describe("BackgroundPattern reduced-motion resize (F312)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (innerWidthDescriptor) {
      Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
    }
  });

  it("rebuilds the canvas on window resize under prefers-reduced-motion", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fake2dContext(),
    );
    stubReducedMotion(true);
    const { container } = render(<BackgroundPattern />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas did not mount");
    expect(canvas.width).toBeGreaterThan(0);

    setInnerWidth(640);
    window.dispatchEvent(new Event("resize"));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    expect(canvas.width).toBe(Math.round(640 * dpr));
  });

  // The control half of the same contract: the listener must still fire
  // for users without the reduced-motion preference — if the test seam
  // itself were broken, this one would fail alongside the test above.
  it("still rebuilds the canvas on resize when motion is allowed", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fake2dContext(),
    );
    stubReducedMotion(false);
    const { container } = render(<BackgroundPattern />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas did not mount");

    setInnerWidth(640);
    window.dispatchEvent(new Event("resize"));

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    expect(canvas.width).toBe(Math.round(640 * dpr));
  });

  // The other half of the contract: moving the pointer under reduced
  // motion must not start the animation loop.
  it("does not start the animation loop on pointer input under reduced motion", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fake2dContext(),
    );
    const raf = vi.spyOn(window, "requestAnimationFrame");
    stubReducedMotion(true);
    render(<BackgroundPattern />);

    window.dispatchEvent(new PointerEvent("pointermove"));

    expect(raf).not.toHaveBeenCalled();
  });
});
