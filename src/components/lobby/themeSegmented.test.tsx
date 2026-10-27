// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeSegmented } from "./themeToggle";

// The theme control used to be an icon that flipped on tap, so the current
// theme was inferred from a glyph and the two choices were never both visible.
// These cases pin what the segmented control buys: both options are always
// present, and state is stated (`aria-pressed`) rather than implied.

function pressed(): { light: boolean; dark: boolean } {
  return {
    light: screen.getByRole("button", { name: "Light" }).getAttribute("aria-pressed") === "true",
    dark: screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed") === "true",
  };
}

describe("ThemeSegmented", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("offers both options and marks exactly one as pressed", () => {
    render(<ThemeSegmented />);
    const { light, dark } = pressed();
    expect(light !== dark).toBe(true);
  });

  it("moves aria-pressed to the option that was chosen", () => {
    render(<ThemeSegmented />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(pressed()).toEqual({ light: true, dark: false });

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(pressed()).toEqual({ light: false, dark: true });
  });

  it("applies the chosen theme to the document", () => {
    render(<ThemeSegmented />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("names the group so the control is not two anonymous buttons", () => {
    render(<ThemeSegmented />);
    expect(screen.getByRole("group", { name: "Appearance" })).toBeTruthy();
  });
});
