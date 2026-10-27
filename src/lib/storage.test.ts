import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserStorage } from "./storage";

// One guard, four former copies. These cases pin the two environments the
// guard exists for, because a regression here is silent: every caller treats
// `null` as "do not persist", so a throw would surface as a broken save far
// from this module.

describe("getBrowserStorage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });

  it("returns window.localStorage when it is readable", () => {
    const storage = { getItem: () => null } as unknown as Storage;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage },
    });
    expect(getBrowserStorage()).toBe(storage);
  });

  it("returns null with no window (the build/SSR pass)", () => {
    Reflect.deleteProperty(globalThis, "window");
    expect(getBrowserStorage()).toBeNull();
  });

  it("returns null when the accessor itself throws (private mode, policy)", () => {
    // The throw comes from reading `window.localStorage`, not from a later
    // read — that is why the access is inside the try.
    // The window object is fine; reading `.localStorage` from it is what
    // throws. (If `window` itself were the throwing accessor, the guard's own
    // `typeof window` check would blow up before its try.)
    const throwingWindow: { localStorage: Storage } = {} as never;
    Object.defineProperty(throwingWindow, "localStorage", {
      get() {
        throw new Error("SecurityError: storage is disabled");
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: throwingWindow,
    });
    expect(getBrowserStorage()).toBeNull();
  });
});
