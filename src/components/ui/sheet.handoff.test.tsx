"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Sheet } from "./sheet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const nativeShowModal = HTMLDialogElement.prototype.showModal;
const nativeClose = HTMLDialogElement.prototype.close;
const previouslyFocused = new WeakMap<HTMLDialogElement, HTMLElement | null>();

const stubViewport = (phone: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 639px)" ? phone : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })),
  );
};

const dialogOf = (name: string): HTMLDialogElement => {
  const heading = screen.getByRole("heading", { name });
  const dialog = heading.closest("dialog");
  if (!dialog) throw new Error(`no dialog holds the ${name} heading`);
  return dialog as HTMLDialogElement;
};

const advancePastTheExitAnimation = () => {
  act(() => {
    vi.advanceTimersByTime(500);
  });
};

function SettingsWithHelp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setSettingsOpen(true)}>
        Open settings
      </button>
      <Sheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        size="auto"
      >
        <button
          type="button"
          onClick={() => {
            setSettingsOpen(false);
            setHelpOpen(true);
          }}
        >
          How to play
        </button>
      </Sheet>
      <Sheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        inline
        title="How to play"
      >
        <button type="button">Rules</button>
      </Sheet>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    previouslyFocused.set(this, document.activeElement as HTMLElement | null);
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    const previous = previouslyFocused.get(this);
    if (previous && previous.isConnected) previous.focus();
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (nativeShowModal) {
    HTMLDialogElement.prototype.showModal = nativeShowModal;
  } else {
    delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
  }
  if (nativeClose) {
    HTMLDialogElement.prototype.close = nativeClose;
  } else {
    delete (HTMLDialogElement.prototype as { close?: unknown }).close;
  }
  vi.unstubAllGlobals();
});

describe("Sheet focus handoff from a modal sheet to an inline sheet", () => {
  it("keeps the focus inside the inline sheet when the modal sheet closes", () => {
    stubViewport(false);
    render(<SettingsWithHelp />);

    const trigger = screen.getByRole("button", { name: "Open settings" });
    trigger.focus();
    fireEvent.click(trigger);

    const settingsDialog = dialogOf("Settings");
    expect(settingsDialog.open).toBe(true);

    const helpLink = screen.getByRole("button", { name: "How to play" });
    helpLink.focus();
    fireEvent.click(helpLink);

    advancePastTheExitAnimation();

    const helpDialog = dialogOf("How to play");
    expect(settingsDialog.open).toBe(false);
    expect(document.activeElement).not.toBe(trigger);
    expect(helpDialog.contains(document.activeElement)).toBe(true);
  });

  it("gives the focus back to the sheet trigger when the inline sheet closes", () => {
    stubViewport(false);
    render(<SettingsWithHelp />);

    const trigger = screen.getByRole("button", { name: "Open settings" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    advancePastTheExitAnimation();

    const helpDialog = dialogOf("How to play");
    fireEvent.keyDown(helpDialog, { key: "Escape" });
    advancePastTheExitAnimation();

    expect(document.activeElement).toBe(trigger);
  });

  it("pulls the focus back inside the inline sheet when it wandered out", () => {
    stubViewport(false);
    render(<SettingsWithHelp />);

    const trigger = screen.getByRole("button", { name: "Open settings" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    advancePastTheExitAnimation();

    const helpDialog = dialogOf("How to play");
    const closeButton = within(helpDialog).getByRole("button", { name: "Close" });
    const rulesButton = within(helpDialog).getByRole("button", { name: "Rules" });

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const forward = fireEvent.keyDown(trigger, { key: "Tab" });
    expect(forward).toBe(false);
    expect(document.activeElement).toBe(closeButton);

    trigger.focus();
    const backward = fireEvent.keyDown(trigger, { key: "Tab", shiftKey: true });
    expect(backward).toBe(false);
    expect(document.activeElement).toBe(rulesButton);

    expect(helpDialog.contains(document.activeElement)).toBe(true);
  });
});

describe("Sheet inline overlay on a phone", () => {
  it("closes once on Escape", () => {
    stubViewport(true);
    const onClose = vi.fn();

    render(
      <Sheet open onClose={onClose} inline title="How to play" closeLabel="Close help">
        <p>Rules</p>
      </Sheet>,
    );

    const dialog = dialogOf("How to play");
    expect(dialog.open).toBe(true);

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
