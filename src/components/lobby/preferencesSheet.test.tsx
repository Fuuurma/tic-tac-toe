// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PreferencesSheet } from "./preferencesSheet";

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
});
