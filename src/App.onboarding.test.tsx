// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";

// The canvas backdrop has nothing to say about routing and jsdom has no canvas.
vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

// Starting a game mounts the players panel, which measures itself.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const { default: App } = await import("./App");

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(cleanup);

const onWelcome = () => screen.queryByRole("button", { name: "Get started" }) !== null;
const inLobby = () => screen.queryByRole("button", { name: "Edit your player settings" }) !== null;

describe("who gets onboarding", () => {
  it("greets a visitor we hold no data on", () => {
    render(<App />);
    expect(onWelcome()).toBe(true);
    expect(inLobby()).toBe(false);
  });

  it("goes straight to the lobby for a returning player", () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
    render(<App />);
    expect(inLobby()).toBe(true);
    expect(onWelcome()).toBe(false);
  });

  it("does not stand between an invited friend and the room they were sent", () => {
    window.history.replaceState({}, "", "/?room=friday-game");
    render(<App />);
    expect(inLobby()).toBe(true);
    expect(onWelcome()).toBe(false);
    expect((screen.getByLabelText(/^Room code/) as HTMLInputElement).value).toBe("friday-game");
  });

  it("does not create an identity before the visitor has chosen one", () => {
    render(<App />);
    expect(window.localStorage.getItem(IDENTITY_STORAGE_KEYS.guestId)).toBeNull();
  });
});

describe("leaving onboarding", () => {
  it("skipping lands in the lobby and is remembered across visits", () => {
    const first = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /skip, i know how to play/i }));

    expect(inLobby()).toBe(true);
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("skipped");

    first.unmount();
    render(<App />);
    expect(inLobby()).toBe(true);
    expect(onWelcome()).toBe(false);
  });

  it("hands the lobby the player the visitor just built", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Maria" } });
    fireEvent.click(screen.getByRole("radio", { name: "Pink" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    const card = screen.getByRole("button", { name: "Edit your player settings" });
    expect(card.textContent).toContain("Maria");
  });
});

describe("replaying the practice round", () => {
  it("is offered in the lobby's help and returns to the lobby untouched", () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.displayName, "Maria");
    render(<App />);

    // One settings surface: the masthead gear opens on the App tab, where the
    // learning rows live.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));

    expect(screen.getByRole("group", { name: "Tic Tac Toe game board" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(inLobby()).toBe(true);
    expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: "Edit your player settings" }).textContent).toContain("Maria");
  });

  it("is not offered from inside a game, where it would abandon the match", () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start Game" }));

    // Mid-game the same surface is reachable, but replay is not offered from
    // it: switching to the tutorial would abandon the match.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    expect(screen.queryByRole("button", { name: "Replay tutorial" })).toBeNull();
  });
});
