"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SocialReactions } from "./socialReactions";
import { setLocale } from "@/i18n/language";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  cleanup();
  setLocale("en");
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const renderPanel = () =>
  render(<SocialReactions ready={false} reaction={null} send={() => true} />);

describe("SocialReactions", () => {
  it("re-renders its labels when the locale switches", () => {
    renderPanel();
    expect(screen.getByText("Reactions")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mute reactions" }),
    ).toBeTruthy();

    act(() => setLocale("es"));

    expect(screen.getByText("Reacciones")).toBeTruthy();
    expect(screen.queryByText("Reactions")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Silenciar reacciones" }),
    ).toBeTruthy();
    expect(screen.getByText(/¡Hola!/)).toBeTruthy();
  });

  it("reads as unmuted when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    renderPanel();

    const mute = screen.getByRole("button", { name: "Mute reactions" });
    expect(mute.getAttribute("aria-pressed")).toBe("false");
  });

  it("remembers the mute choice on the next mount", () => {
    const first = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Mute reactions" }));
    expect(
      screen.getByRole("button", { name: "Unmute reactions" }),
    ).toBeTruthy();
    first.unmount();

    renderPanel();
    expect(
      screen.getByRole("button", { name: "Unmute reactions" }),
    ).toBeTruthy();
  });

  it("still toggles when the mute write throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Mute reactions" }));
    expect(
      screen.getByRole("button", { name: "Unmute reactions" }),
    ).toBeTruthy();
  });
});
