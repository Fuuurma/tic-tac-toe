// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./errorBoundary";
import { reportError } from "@/lib/errorReporting";

vi.mock("@/lib/errorReporting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/errorReporting")>();
  return { ...actual, reportError: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The boundary is the app's only crash fallback: if it fails to render,
 * a recoverable child crash becomes a white screen. The contract pinned
 * here is the rendered one — role=alert carrying the err.* copy, the
 * caught error reaching reportError, and Retry clearing the boundary so
 * healthy children render again.
 */
describe("ErrorBoundary", () => {
  it("renders children untouched when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>healthy child</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("healthy child")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the fallback with role=alert when a child throws", () => {
    const Bomb = () => {
      throw new Error("render exploded");
    };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong");
    expect(alert.textContent).toContain(
      "An unexpected error occurred. Try reloading the page.",
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeTruthy();
  });

  it("reports the caught error through reportError", () => {
    const error = new Error("render exploded");
    const Bomb = () => {
      throw error;
    };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, {
      componentStack: expect.any(String),
    });
  });

  it("clears the boundary when Retry is clicked", () => {
    let shouldThrow = true;
    const Bomb = () => {
      if (shouldThrow) throw new Error("render exploded");
      return <p>child recovered</p>;
    };

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("child recovered")).toBeTruthy();
  });
});
