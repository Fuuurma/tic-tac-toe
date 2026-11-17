// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { registerServiceWorker } from "./serviceWorker";

/**
 * main.tsx registers the app-shell worker on every boot. The worker is a
 * production nicety, never a dependency: a dev build, a browser without
 * service workers, a refused registration or a register() that throws
 * synchronously must all leave the app running and the boot path intact.
 */

function installServiceWorker(
  impl: () => Promise<unknown> = () => Promise.resolve(),
) {
  const register = vi.fn(impl);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  return register;
}

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value: state,
  });
}

describe("registerServiceWorker", () => {
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setReadyState("loading");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "serviceWorker");
    Reflect.deleteProperty(document, "readyState");
  });

  it("registers nothing in a dev build", () => {
    vi.stubEnv("PROD", false);
    const register = installServiceWorker();

    registerServiceWorker();
    window.dispatchEvent(new Event("load"));

    expect(register).not.toHaveBeenCalled();
  });

  it("registers /sw.js once, after load", () => {
    vi.stubEnv("PROD", true);
    const register = installServiceWorker();

    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js");

    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("registers immediately when the document has already loaded", () => {
    vi.stubEnv("PROD", true);
    setReadyState("complete");
    const register = installServiceWorker();

    registerServiceWorker();

    expect(register).toHaveBeenCalledExactlyOnceWith("/sw.js");
  });

  it("reports a refused registration instead of letting it reject", async () => {
    const error = new Error("registration refused");
    vi.stubEnv("PROD", true);
    setReadyState("complete");
    installServiceWorker(() => Promise.reject(error));

    registerServiceWorker();

    await vi.waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(error, {
        source: "serviceWorker.register",
      }),
    );
  });

  it("survives a register() that throws synchronously", () => {
    const error = new Error("register blew up");
    vi.stubEnv("PROD", true);
    setReadyState("complete");
    installServiceWorker(() => {
      throw error;
    });

    expect(() => registerServiceWorker()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(error, {
      source: "serviceWorker.register",
    });
  });
});
