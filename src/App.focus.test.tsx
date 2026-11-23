"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const { default: App } = await import("./App");

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
});

afterEach(cleanup);

describe("focus on game entry and exit", () => {
  it("does not take focus on first load", () => {
    render(<App />);

    const startButton = screen.getByRole("button", { name: "Start Game" });
    expect(document.activeElement).not.toBe(startButton);
  });

  it("focuses the mode heading on entry and Start Game on exit", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start Game" }));

    const heading = await screen.findByRole("heading", { name: "vs Computer" });
    await waitFor(() => expect(document.activeElement).toBe(heading));

    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));

    const startButton = await screen.findByRole("button", { name: "Start Game" });
    await waitFor(() => expect(document.activeElement).toBe(startButton));
  });

  it("does not take focus when the lobby follows onboarding", async () => {
    window.localStorage.clear();
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /skip, i know how to play/i }),
    );

    const startButton = await screen.findByRole("button", {
      name: "Start Game",
    });
    expect(document.activeElement).not.toBe(startButton);
  });
});
