import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./errorBoundary";
import { reportError } from "@/lib/errorReporting";

vi.mock("@/lib/errorReporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/errorReporting")>();
  return { ...actual, reportError: vi.fn() };
});

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes a caught error through reportError exactly once and never console.errors directly", () => {
    const boundary = new ErrorBoundary({ children: null });
    const error = new Error("render exploded");

    boundary.componentDidCatch(error, { componentStack: "at <Board>" });

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, {
      componentStack: "at <Board>",
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
