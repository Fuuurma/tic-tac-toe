// @vitest-environment jsdom

import { StrictMode } from "react";
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

  it("rebuilds the canvas on window resize under prefers-reduced-motion", async () => {
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

    // The rebuild is coalesced through rAF, so it lands a frame later.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    await vi.waitFor(() =>
      expect(canvas.width).toBe(Math.round(640 * dpr)),
    );
  });

  // The control half of the same contract: the listener must still fire
  // for users without the reduced-motion preference — if the test seam
  // itself were broken, this one would fail alongside the test above.
  it("still rebuilds the canvas on resize when motion is allowed", async () => {
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
    await vi.waitFor(() =>
      expect(canvas.width).toBe(Math.round(640 * dpr)),
    );
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
 * work:246 — resize used to rebuild the grid synchronously on every event
 * and reseed it from Math.random() each time: dragging a window edge
 * repainted ~1900 symbols per event AND shuffled the whole field under
 * the cursor. The contract is: rebuild at most once per frame, keep the
 * same seeded field, and skip events that changed nothing.
 */
describe("BackgroundPattern resize coalescing (work:246)", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (innerWidthDescriptor) {
      Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
    }
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

  const flush = (queue: FrameRequestCallback[]) => {
    for (const cb of queue.splice(0)) cb(performance.now());
  };

  const drawImages = (calls: Array<{ op: string; args: unknown[] }>) =>
    calls.filter((c) => c.op === "drawImage").length;

  // Each symbol starts its own subpath, so the moveTo sequence is the field's
  // fingerprint: same seed, same symbols at the same jittered positions.
  const subpaths = (calls: Array<{ op: string; args: unknown[] }>) =>
    calls.filter((c) => c.op === "moveTo").map((c) => c.args);

  it("rebuilds at most once per frame for a resize burst", () => {
    const { calls, queue } = setup();
    const before = drawImages(calls);

    setInnerWidth(800);
    window.dispatchEvent(new Event("resize"));
    setInnerWidth(700);
    window.dispatchEvent(new Event("resize"));
    setInnerWidth(640);
    window.dispatchEvent(new Event("resize"));
    flush(queue);

    // Three events, one frame: exactly one rebuild, not three.
    expect(drawImages(calls) - before).toBe(1);
    const canvas = document.querySelector("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    expect(canvas?.width).toBe(Math.round(640 * dpr));
  });

  it("keeps the same symbol field across a resize", () => {
    const { calls, queue } = setup();
    const firstGrid = subpaths(calls);

    // Paint 2 starts where paint 1 ended — slice on the call index,
    // not on the filtered subpath count.
    const paintBoundary = calls.length;
    setInnerWidth(640);
    window.dispatchEvent(new Event("resize"));
    flush(queue);

    const secondGrid = subpaths(calls.slice(paintBoundary));
    // The seed is fixed per mount: the first cells of the rebuilt field
    // are the same symbols at the same jittered positions, not a new roll.
    expect(secondGrid.length).toBeGreaterThanOrEqual(5);
    expect(secondGrid.slice(0, 5)).toEqual(firstGrid.slice(0, 5));
  });

  it("does no work for a resize event that changed nothing", () => {
    const { calls, queue } = setup();
    const before = drawImages(calls);

    window.dispatchEvent(new Event("resize"));
    flush(queue);

    expect(drawImages(calls)).toBe(before);
  });
});

/**
 * The reveal has memory: every symbol the input reaches keeps its own heat
 * and cools on its own curve, so the wake behind a cursor thins out instead
 * of being cut off. A jump is an arrival, not a sweep, and a cursor held
 * still keeps its disc without keeping the frame loop alive.
 */
type Call = { op: string; args: unknown[] };

const recordingContext = () => {
  const calls: Call[] = [];
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

/** A frame loop the test drives by hand, one `time` at a time. */
const mountWithFrames = (
  matches: (query: string) => boolean = () => false,
) => {
  const { ctx, calls } = recordingContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx,
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queue.push(cb);
    return queue.length;
  });
  render(<BackgroundPattern />);
  const frame = (time: number) => {
    const cb = queue.shift();
    if (cb) cb(time);
  };
  /** Runs frames every 16ms from `from` until `until`, as long as one is queued. */
  const idleUntil = (from: number, until: number) => {
    let time = from;
    while (queue.length > 0 && time <= until) {
      frame(time);
      time += 16;
    }
    return time;
  };
  return { calls, queue, frame, idleUntil };
};

/** Where each lit symbol starts its subpath, in canvas coordinates. */
const litPoints = (calls: Call[]) =>
  calls.filter((c) => c.op === "moveTo").map((c) => c.args as number[]);

const strokes = (calls: Call[]) =>
  calls.filter((c) => c.op === "lineTo").length;

/**
 * A ring is an arc centred exactly on the point that opened it. `O` symbols
 * also call `arc`, but their centres are jittered floats, never a tap point.
 */
const arcsAt = (calls: Call[], x: number, y: number) =>
  calls.filter((c) => c.op === "arc" && c.args[0] === x && c.args[1] === y);

const touchEvent = (
  type: string,
  touches: Array<{ x: number; y: number }>,
  changed = touches,
) => {
  const event = new Event(type);
  const toTouch = (p: { x: number; y: number }) => ({
    clientX: p.x,
    clientY: p.y,
  });
  Object.defineProperty(event, "touches", { value: touches.map(toTouch) });
  Object.defineProperty(event, "changedTouches", {
    value: changed.map(toTouch),
  });
  return event;
};

describe("BackgroundPattern wake", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps the wake lit after the pointer has moved on", () => {
    const { calls, frame } = mountWithFrames();

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 200, clientY: 300 }),
    );
    frame(16);
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 500, clientY: 300 }),
    );
    const before = calls.length;
    frame(32);

    const xs = litPoints(calls.slice(before))
      .filter(([, y]) => Math.abs(y - 300) < 30)
      .map(([x]) => x);
    // Symbols around the old position are still lit alongside the new one.
    expect(Math.min(...xs)).toBeLessThan(300);
    expect(Math.max(...xs)).toBeGreaterThan(400);
  });

  it("treats a long jump as an arrival, not a sweep", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 400 }),
    );
    frame(16);
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 900, clientY: 400 }),
    );
    const before = calls.length;
    frame(32);

    const xs = litPoints(calls.slice(before))
      .filter(([, y]) => Math.abs(y - 400) < 30)
      .map(([x]) => x);
    // The old disc is still cooling and the new one is lit...
    expect(xs.some((x) => x < 400)).toBe(true);
    expect(xs.some((x) => x > 800)).toBe(true);
    // ...but nothing was swept in between, so nothing in between is lit.
    expect(xs.filter((x) => x > 570 && x < 630)).toEqual([]);
  });

  it("fades the wake out gradually once the pointer holds still", () => {
    const { calls, frame, idleUntil } = mountWithFrames();

    // A slow drag keeps every frame's segment under the sweep cap.
    for (let i = 0; i < 8; i++) {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          clientX: 200 + i * 40,
          clientY: 300,
        }),
      );
      frame(16 * (i + 1));
    }
    const strokesFor = (atTime: number) => {
      const before = calls.length;
      frame(atTime);
      return strokes(calls.slice(before));
    };
    const justAfter = strokesFor(144);
    idleUntil(160, 400);
    const later = strokesFor(416);

    // The path behind the cursor has dissolved; the disc under it has not.
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(justAfter);
  });

  it("stops the frame loop for a parked cursor", () => {
    const { queue, idleUntil } = mountWithFrames();
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    idleUntil(16, 5000);
    expect(queue.length).toBe(0);
  });

  it("stops painting entirely once the pointer leaves", () => {
    const { calls, queue, frame, idleUntil } = mountWithFrames();
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 200, clientY: 300 }),
    );
    frame(16);

    window.dispatchEvent(new PointerEvent("pointerout"));
    // Long enough for every symbol to cool and the glow to ease out.
    idleUntil(32, 8000);

    expect(queue.length).toBe(0);
    const before = calls.length;
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: -900, clientY: -900 }),
    );
    frame(9000);
    // Off-screen input lights nothing: only the final restore happens.
    expect(strokes(calls.slice(before))).toBe(0);
  });

  it("opens a ring from a mouse click", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 300, clientY: 300 }),
    );
    frame(16);
    frame(160);

    const arcs = arcsAt(calls, 300, 300);
    expect(arcs.length).toBeGreaterThan(0);
    expect(arcs[0].args[2] as number).toBeGreaterThan(0);
  });
});

/**
 * A finger is not a cursor. It is at the glass only while it touches, it
 * hides what is under it, and it arrives as a tap — so touch has its own
 * input path (touch events, because a touch pointer is cancelled the moment
 * the browser takes the gesture for a pan) and its own look: a ring out of
 * every tap and a glow that leads the fingertip.
 */
describe("BackgroundPattern touch", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("lights the field from a dragging finger through touch events", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(touchEvent("touchstart", [{ x: 150, y: 400 }]));
    frame(16);
    window.dispatchEvent(touchEvent("touchmove", [{ x: 190, y: 380 }]));
    const before = calls.length;
    frame(32);

    expect(strokes(calls.slice(before))).toBeGreaterThan(0);
  });

  it("ignores touch pointer events, which a pan would cancel anyway", () => {
    const { queue } = mountWithFrames();
    window.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: 100,
        clientY: 100,
        pointerType: "touch",
      }),
    );
    window.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 100,
        clientY: 100,
        pointerType: "touch",
      }),
    );
    expect(queue.length).toBe(0);
  });

  it("leads the glow above the fingertip instead of hiding it under the hand", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(touchEvent("touchstart", [{ x: 200, y: 500 }]));
    const before = calls.length;
    frame(16);

    // The spotlight is filled under a translate to the aim point, which sits
    // above the contact point.
    const fills = calls.slice(before);
    const fillIndex = fills.findIndex((c) => c.op === "fillRect");
    expect(fillIndex).toBeGreaterThanOrEqual(0);
    const translate = fills
      .slice(0, fillIndex)
      .reverse()
      .find((c) => c.op === "translate")!;
    expect(translate.args[0]).toBe(200);
    expect(translate.args[1]).toBe(460);
  });

  it("answers a tap with a ring that opens from the touch point", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(touchEvent("touchstart", [{ x: 120, y: 520 }]));
    frame(16);
    frame(120);
    frame(240);

    const radii = arcsAt(calls, 120, 520).map((c) => c.args[2] as number);
    expect(radii.length).toBeGreaterThanOrEqual(2);
    expect(radii[radii.length - 1]).toBeGreaterThan(radii[0]);
  });

  it("opens one ring per finger that lands", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(
      touchEvent(
        "touchstart",
        [
          { x: 80, y: 300 },
          { x: 300, y: 300 },
        ],
        [
          { x: 80, y: 300 },
          { x: 300, y: 300 },
        ],
      ),
    );
    frame(16);
    frame(120);

    expect(arcsAt(calls, 80, 300).length).toBeGreaterThan(0);
    expect(arcsAt(calls, 300, 300).length).toBeGreaterThan(0);
  });

  it("lets go of the glow when the finger lifts, and stops the loop", () => {
    const { queue, idleUntil } = mountWithFrames();
    window.dispatchEvent(touchEvent("touchstart", [{ x: 200, y: 400 }]));
    window.dispatchEvent(touchEvent("touchend", []));
    idleUntil(16, 8000);
    expect(queue.length).toBe(0);
  });

  it("keeps lighting while one finger lifts and another stays down", () => {
    const { calls, frame } = mountWithFrames();
    window.dispatchEvent(
      touchEvent("touchstart", [
        { x: 100, y: 400 },
        { x: 300, y: 400 },
      ]),
    );
    frame(16);
    window.dispatchEvent(
      touchEvent("touchend", [{ x: 300, y: 400 }], [{ x: 100, y: 400 }]),
    );
    const before = calls.length;
    frame(32);
    // Still aiming at the finger that is down: the glow did not go dark.
    expect(strokes(calls.slice(before))).toBeGreaterThan(0);
  });

  it("greets a touch-only device with one soft ring", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { calls, frame } = mountWithFrames(
      (query) => query === "(hover: none) and (pointer: coarse)",
    );
    const welcome = [window.innerWidth / 2, window.innerHeight * 0.58] as const;
    frame(16);
    expect(arcsAt(calls, ...welcome).length).toBe(0);

    vi.advanceTimersByTime(600);
    frame(32);
    frame(200);
    expect(arcsAt(calls, ...welcome).length).toBeGreaterThan(0);
  });

  it("does not greet a device that has a cursor", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { calls, frame } = mountWithFrames(() => false);
    vi.advanceTimersByTime(2000);
    frame(16);
    frame(200);
    expect(
      arcsAt(calls, window.innerWidth / 2, window.innerHeight * 0.58).length,
    ).toBe(0);
  });

  it("starts nothing under reduced motion", () => {
    const { queue } = mountWithFrames(
      (query) => query === "(prefers-reduced-motion: reduce)",
    );
    window.dispatchEvent(touchEvent("touchstart", [{ x: 100, y: 100 }]));
    window.dispatchEvent(touchEvent("touchmove", [{ x: 120, y: 90 }]));
    expect(queue.length).toBe(0);
  });
});

/**
 * Fresh-load spotlight regression: the same-size early return in `resize`
 * used to skip the resting-layer build when the effect re-ran on an
 * already-sized canvas (StrictMode double effects in dev, HMR remounts),
 * leaving the live closure with no symbols and no spotlight gradient — the
 * pointer moved with no visible effect until a forced rebuild (theme
 * toggle). The guard may only skip rebuilds once the run has built.
 */
describe("BackgroundPattern remount init", () => {
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

  it("lights symbols after a double-mount on a same-size canvas", () => {
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
    // StrictMode re-runs the effect on the same canvas node, which keeps
    // the size the first pass set — the exact shape that skipped the build.
    render(
      <StrictMode>
        <BackgroundPattern />
      </StrictMode>,
    );
    const before = calls.length;

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 400, clientY: 320 }),
    );
    const cb = queue.shift();
    if (cb) cb(16);

    // Lit symbols are re-stroked onto the live canvas; with the skipped
    // build there is no symbol field, so nothing is ever stroked.
    const strokesAfter = calls
      .slice(before)
      .filter((c) => c.op === "lineTo").length;
    expect(strokesAfter).toBeGreaterThan(0);
    void ctx;
  });
});
