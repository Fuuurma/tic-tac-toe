import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/errorBoundary";
import { installGlobalErrorHandlers, reportError } from "@/lib/errorReporting";

vi.mock("@/lib/errorReporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/errorReporting")>();
  return { ...actual, reportError: vi.fn() };
});

describe("error reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // @ts-expect-error — installing a partial window for node test env
    globalThis.window = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // @ts-expect-error — cleaning up
    delete globalThis.window;
  });

  it("forwards componentDidCatch errors and component stack to reportError", () => {
    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("render exploded");

    boundary.componentDidCatch(error, { componentStack: "at <Board>" });

    expect(reportError).toHaveBeenCalledWith(error, {
      componentStack: "at <Board>",
    });
  });

  it("routes global errors and unhandled rejections through reportError once", () => {
    const target = globalThis.window as unknown as Window;

    installGlobalErrorHandlers(reportError);
    const firstOnError = target.onerror;
    installGlobalErrorHandlers(reportError);

    expect(target.onerror).toBe(firstOnError);
    expect(target.onunhandledrejection).toBeTypeOf("function");

    const error = new Error("script blew up");
    target.onerror?.call(target, "script blew up", "app.js", 1, 1, error);
    expect(reportError).toHaveBeenCalledWith(error, {
      source: "window.onerror",
    });

    const reason = new Error("rejected promise");
    target.onunhandledrejection?.call(
      target,
      { reason } as PromiseRejectionEvent,
    );
    expect(reportError).toHaveBeenCalledWith(reason, {
      source: "unhandledrejection",
    });
  });

  it("posts reports to VITE_ERROR_REPORT_URL when configured", async () => {
    const { reportError: report } =
      await vi.importActual<typeof import("@/lib/errorReporting")>(
        "@/lib/errorReporting",
      );
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_ERROR_REPORT_URL", "https://errors.example/ingest");

    report(new Error("kaput"), { source: "test" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://errors.example/ingest",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
