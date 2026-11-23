import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "@/components/errorBoundary";
import { reportError } from "@/lib/errorReporting";

vi.mock("@/lib/errorReporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/errorReporting")>();
  return { ...actual, reportError: vi.fn() };
});

describe("ErrorBoundary reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hands a caught error to the reporter exactly once", () => {
    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("render exploded");

    boundary.componentDidCatch(error, { componentStack: "at <Board>" });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, {
      componentStack: "at <Board>",
    });
  });

  it("does not log the caught error itself", () => {
    const boundary = new ErrorBoundary({ children: null });

    boundary.componentDidCatch(new Error("render exploded"), {
      componentStack: "at <Board>",
    });

    expect(console.error).not.toHaveBeenCalled();
  });

  it("still renders the fallback copy", () => {
    const boundary = new ErrorBoundary({ children: null });
    Object.assign(boundary, {
      state: { hasError: true, error: new Error("render exploded") },
    });

    const html = renderToStaticMarkup(boundary.render());

    expect(html).toContain("Something went wrong");
    expect(html).toContain("An unexpected error occurred");
    expect(html).toContain("Try again");
    expect(html).toContain("Reload page");
  });
});
