// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreferencesSheet } from "./preferencesSheet";
import { resetInstallPromptForTests } from "@/lib/installPrompt";

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

// The app preferences are their own surface, separate from the You/Opponent
// form. These cases pin that separation and the three groups it owns.
describe("PreferencesSheet", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    resetInstallPromptForTests();
  });

  const renderSheet = (props: { onReplayTutorial?: () => void } = {}) =>
    render(
      <PreferencesSheet
        isOpen
        onClose={vi.fn()}
        onHowToPlay={vi.fn()}
        onReplayTutorial={props.onReplayTutorial}
      />,
    );

  it("is the dialog named Settings", () => {
    renderSheet();
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });

  it("owns Appearance, Language and Learn", () => {
    renderSheet();
    expect(screen.getByRole("group", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "How to play" })).toBeTruthy();
  });

  it("carries no player identity controls", () => {
    renderSheet();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: "Your name" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "AI" })).toBeNull();
  });

  it("fires onHowToPlay and onReplayTutorial", () => {
    const onHowToPlay = vi.fn();
    const onReplayTutorial = vi.fn();
    render(
      <PreferencesSheet
        isOpen
        onClose={vi.fn()}
        onHowToPlay={onHowToPlay}
        onReplayTutorial={onReplayTutorial}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));

    expect(onHowToPlay).toHaveBeenCalledTimes(1);
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });

  it("omits the tutorial row when replay is not offered (mid-game)", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "Replay tutorial" })).toBeNull();
  });

  it("shows the install row only while the browser offers a prompt", async () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();

    const offer = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(offer, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    await act(async () => {
      window.dispatchEvent(offer);
    });

    expect(screen.getByRole("button", { name: "Install app" })).toBeTruthy();
  });

  it("hands the deferred prompt to the browser on tap", async () => {
    const offer = new Event("beforeinstallprompt", { cancelable: true });
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(offer, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    await act(async () => {
      window.dispatchEvent(offer);
    });

    renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    // The offer is consumed: the row goes away rather than dead-ending.
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
  });
});
