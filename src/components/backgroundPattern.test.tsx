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

/**
 * Pointer-frame painting contract.
 *
 * Repaints are local: the resting grid lives on a base layer and a frame
 * erases its previous spotlight region before lighting the new one. Both
 * halves have bitten the real implementation — a base copy alone left the
 * old spotlight baked in (a transparent source pixel is a composite no-op),
 * and a gradient cached at the origin but filled at pointer coordinates
 * painted a hard-edged blob in the screen corner.
 */
describe("BackgroundPattern pointer repaint", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const recordingContext = () => {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const target: Record<string, unknown> = {
      createRadialGradient: () => ({ addColorStop: () => {} }),
      canvas: null,
    };
    const ctx = new Proxy(target, {
      get(t, prop) {
        if (prop in t) return t[prop as string];
        const value = (...args: unknown[]) => {
          calls.push({ op: String(prop), args });
        };
        t[prop as string] = value;
        return value;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };

  it("centers the spotlight on the pointer and erases the previous region", () => {
    const { ctx, calls } = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ctx,
    );
    stubReducedMotion(false);

    // Drive the rAF loop by hand so each frame is observable.
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      queue.push(cb);
      return queue.length;
    });

    render(<BackgroundPattern />);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 100, clientY: 120 }),
    );
    expect(queue.length).toBeGreaterThan(0);
    const firstFrame = queue.shift()!;
    firstFrame(16);

    const callsBefore = calls.length;
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 400, clientY: 320 }),
    );
    const secondFrame = queue.shift()!;
    secondFrame(32);
    const frame = calls.slice(callsBefore);

    // The spotlight is filled under a translate to the pointer, so the
    // cached origin-centred gradient lands where the pointer is.
    const translateIndex = frame.findIndex(
      (c) => c.op === "translate" && c.args[0] === 400 && c.args[1] === 320,
    );
    expect(translateIndex).toBeGreaterThanOrEqual(0);
    const fillIndex = frame.findIndex((c) => c.op === "fillRect");
    expect(fillIndex).toBeGreaterThan(translateIndex);

    // The frame that moved the spotlight cleared the old region before
    // copying the resting layer back over it.
    const clearIndex = frame.findIndex((c) => c.op === "clearRect");
    const drawIndex = frame.findIndex((c) => c.op === "drawImage");
    expect(clearIndex).toBeGreaterThanOrEqual(0);
    expect(drawIndex).toBeGreaterThan(clearIndex);
  });
});
