"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: null,
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const { default: App } = await import("./App");

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

function stepOneSecond() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  setVisibility("visible");
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe("local turn clock while the tab is hidden", () => {
  it("freezes on hide and resumes the same turn on return", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start Game" }));

    expect(screen.getAllByRole("button", { name: /empty/ })).toHaveLength(9);

    act(() => setVisibility("hidden"));
    for (let i = 0; i < 15; i += 1) stepOneSecond();

    act(() => setVisibility("visible"));
    expect(screen.getAllByRole("button", { name: /empty/ })).toHaveLength(9);

    for (let i = 0; i < 11; i += 1) stepOneSecond();
    expect(
      screen.getAllByRole("button", { name: /empty/ }).length,
    ).toBeLessThan(9);
  });
});
