import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import { act, cleanup, renderHook } from "@testing-library/react";
import { resetDeviceOnlineStore, useDeviceOnline } from "./useDeviceOnline";

let teardownEnvironment: (() => unknown) | undefined;
let onLine = true;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => onLine,
  });
});

afterAll(async () => {
  await teardownEnvironment?.();
});

afterEach(() => {
  cleanup();
  resetDeviceOnlineStore();
  onLine = true;
});

describe("useDeviceOnline", () => {
  it("starts online", () => {
    const { result } = renderHook(() => useDeviceOnline());

    expect(result.current).toBe(true);
  });

  it("reads the browser flag when the first subscriber arrives", () => {
    onLine = false;

    const { result } = renderHook(() => useDeviceOnline());

    expect(result.current).toBe(false);
  });

  it("flips offline and online through window events", () => {
    const { result } = renderHook(() => useDeviceOnline());

    act(() => {
      onLine = false;
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      onLine = true;
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("gives every subscriber the same value", () => {
    const first = renderHook(() => useDeviceOnline());
    const second = renderHook(() => useDeviceOnline());

    act(() => {
      onLine = false;
      window.dispatchEvent(new Event("offline"));
    });

    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(false);
  });

  it("removes the window listeners when the last subscriber unmounts", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useDeviceOnline());
    unmount();

    const added = add.mock.calls
      .filter(([type]) => type === "online" || type === "offline")
      .map(([, listener]) => listener);
    const removed = remove.mock.calls
      .filter(([type]) => type === "online" || type === "offline")
      .map(([, listener]) => listener);

    expect(added.length).toBe(2);
    expect(removed).toEqual(added);

    add.mockRestore();
    remove.mockRestore();
  });
});
