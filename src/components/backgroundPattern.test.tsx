// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { BackgroundPattern } from "./backgroundPattern";

// F312: the canvas must track viewport size for everyone. The resize listener
// used to be registered only inside the !prefersReducedMotion branch, so a
// reduced-motion user who rotated/resized kept a canvas stuck at its initial
// size. Only the pointer-driven animation stays gated on the preference.
describe("BackgroundPattern reduced-motion resize", () => {
  const realMatchMedia = window.matchMedia;
  const realGetContext = HTMLCanvasElement.prototype.getContext;
  const realInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const realInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: realMatchMedia,
    });
    HTMLCanvasElement.prototype.getContext = realGetContext;
    if (realInnerWidth) Object.defineProperty(window, "innerWidth", realInnerWidth);
    if (realInnerHeight) Object.defineProperty(window, "innerHeight", realInnerHeight);
  });

  const mockEnv = (prefersReducedMotion: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: prefersReducedMotion && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    });
    // Chainable no-op 2d context: every method returns the proxy itself so
    // createRadialGradient(...).addColorStop(...) chains don't throw.
    const ctxProxy: Record<string | symbol, unknown> = {};
    const proxy = new Proxy(ctxProxy, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return (..._args: unknown[]) => proxy;
      },
      set: (target, prop, value) => {
        target[prop] = value;
        return true;
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      proxy as unknown as CanvasRenderingContext2D,
    );
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
  };

  it("resizes the canvas under reduced-motion", () => {
    mockEnv(true);
    const { container } = render(<BackgroundPattern />);
    const canvas = container.querySelector("canvas");
    expect(canvas?.width).toBe(1024);

    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 800 });
    window.dispatchEvent(new Event("resize"));

    expect(canvas?.width).toBe(800);
  });

  it("registers resize but no pointer listeners under reduced-motion", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    mockEnv(true);
    render(<BackgroundPattern />);

    const types = addSpy.mock.calls.map((call) => call[0]);
    expect(types).toContain("resize");
    expect(types).not.toContain("pointermove");
    expect(types).not.toContain("pointerdown");
  });

  it("registers pointer listeners when motion is allowed", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    mockEnv(false);
    render(<BackgroundPattern />);

    const types = addSpy.mock.calls.map((call) => call[0]);
    expect(types).toContain("resize");
    expect(types).toContain("pointermove");
  });
});
