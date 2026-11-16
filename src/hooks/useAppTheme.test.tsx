// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useAppTheme } from "./useAppTheme";
import { savePreferences } from "@/lib/preferences";

// F4: with no saved preference the theme must resolve from
// prefers-color-scheme, matching what theme-init.js stamps before first
// paint — a dark-OS first-time visitor gets dark, not a light flash.

function Probe() {
  const { theme } = useAppTheme();
  return <div data-testid="theme">{theme}</div>;
}

function stubOsTheme(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? dark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

describe("useAppTheme initial theme", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.unstubAllGlobals();
  });

  it("returns dark when nothing is saved and the OS prefers dark", () => {
    stubOsTheme(true);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("theme").textContent).toBe("dark");
  });

  it("returns light when nothing is saved and the OS prefers light", () => {
    stubOsTheme(false);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("theme").textContent).toBe("light");
  });

  it("lets a saved preference win over the OS", () => {
    savePreferences({ theme: "light" });
    stubOsTheme(true);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("theme").textContent).toBe("light");
  });

  it("reads the theme-init.js stamp when matchMedia is unavailable", () => {
    // jsdom ships no matchMedia; dataset.theme is what theme-init.js wrote.
    document.documentElement.dataset.theme = "dark";
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("theme").textContent).toBe("dark");
  });
});
