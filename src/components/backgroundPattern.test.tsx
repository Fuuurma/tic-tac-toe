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

/**
 * The reveal follows the pointer's path, not just its position: samples are
 * laid down by distance travelled and aged out by time, so a fast flick
 * leaves a streak and a resting cursor collapses back to a halo. The span
 * cap is a performance cap — the repaint box grows with the trail.
 */
describe("BackgroundPattern gesture trail", () => {
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

  /** Drives N frames, moving the pointer by `step` px between each. */
  const run = (
    ctx: CanvasRenderingContext2D,
    queue: FrameRequestCallback[],
    frames: Array<{ x: number; y: number; time: number }>,
  ) => {
    for (const frame of frames) {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: frame.x,
          clientY: frame.y,
        }),
      );
      const cb = queue.shift();
      if (cb) cb(frame.time);
      ctx.clearRect(0, 0, 0, 0); // no-op, keeps the recorder honest
    }
  };

  const setup = () => {
    const { ctx, calls } = recordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ctx,
    );
    stubReducedMotion(false);
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      queue.push(cb);
      return queue.length;
    });
    render(<BackgroundPattern />);
    return { ctx, calls, queue };
  };

  it("paints a stroke that outlives the instant the pointer passed", () => {
    const { ctx, calls, queue } = setup();

    // Two fast frames: the pointer sweeps 300px between them.
    run(ctx, queue, [
      { x: 200, y: 300, time: 16 },
      { x: 500, y: 300, time: 32 },
    ]);

    const stroked = calls.filter((c) => c.op === "lineTo");
    expect(stroked.length).toBeGreaterThan(0);
    // More symbols lit than a single 480px-wide disc can hold: the path
    // between the two pointer positions is lit too.
    const xs = calls
      .filter((c) => c.op === "translate" && c.args[1] === 300)
      .map((c) => c.args[0] as number);
    expect(Math.max(...xs)).toBeGreaterThan(400);
    expect(Math.min(...xs)).toBeLessThan(300);
  });

  it("keeps the repaint region bounded during a full-screen flick", () => {
    const boxWidthFor = (travel: number) => {
      const { ctx, calls, queue } = setup();
      run(ctx, queue, [{ x: 400, y: 400, time: 16 }]);
      // Only the second frame's calls: the first one includes the full
      // canvas clear that resize() does.
      const before = calls.length;
      run(ctx, queue, [{ x: 400 + travel, y: 400, time: 32 }]);
      const clears = calls
        .slice(before)
        .filter((c) => c.op === "clearRect");
      return Math.max(...clears.map((c) => c.args[2] as number));
    };

    // The box is TRAIL_MAX_SPAN of travel plus the reveal radius and its
    // margin on each side, so it must NOT grow with the distance actually
    // travelled: this is the difference between a bounded repaint and the
    // full-grid redraw the component exists to avoid.
    const short = boxWidthFor(60);
    const long = boxWidthFor(900);
    expect(long).toBeLessThanOrEqual(short);
    // Bounded by the span cap plus the reveal radius and margin, not by the
    // canvas: a 900px flick must not repaint the whole viewport.
    expect(long).toBeLessThan(900);
  });

  it("collapses to a halo once the pointer stops", () => {
    const { ctx, calls, queue } = setup();

    run(ctx, queue, [
      { x: 200, y: 300, time: 16 },
      { x: 500, y: 300, time: 32 },
    ]);
    // Held still long enough for every sample but the cursor's to age out.
    const beforeIdle = calls.length;
    run(ctx, queue, [
      { x: 500, y: 300, time: 400 },
      { x: 500, y: 300, time: 800 },
    ]);
    const idle = calls.slice(beforeIdle);

    const xs = idle
      .filter((c) => c.op === "translate" && c.args[1] === 300)
      .map((c) => c.args[0] as number);
    // Only the cursor position is lit once the trail has collapsed.
    expect(xs.length).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeGreaterThan(240);
    expect(Math.max(...xs)).toBeLessThan(760);
  });

  it("stops painting entirely once the pointer leaves", () => {
    const { ctx, calls, queue } = setup();
    run(ctx, queue, [{ x: 200, y: 300, time: 16 }]);

    const before = calls.length;
    run(ctx, queue, [{ x: -900, y: -900, time: 32 }]);
    run(ctx, queue, [{ x: -900, y: -900, time: 48 }]);
    run(ctx, queue, [{ x: -900, y: -900, time: 64 }]);

    // Energy decays to zero and the trail is dropped; only the final
    // restore happens, and no symbol is re-stroked afterwards.
    const strokesAfter = calls
      .slice(before)
      .filter((c) => c.op === "lineTo").length;
    expect(strokesAfter).toBe(0);
  });
});
