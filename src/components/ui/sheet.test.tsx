// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Sheet } from "./sheet";

/**
 * F793 — the inline Sheet renders a plain `<dialog open>` in a scrim
 * div. On a phone that presentation is a full-width fixed overlay
 * covering the game, but without modal semantics: assistive technology
 * can wander into the covered content while the sheet is up. The
 * contract pinned here: a PHONE inline sheet routes through the modal
 * path (showModal — top layer, Esc, background inert); a desktop
 * inline sheet stays embedded and non-modal.
 */

const stubPointerWidth = (phone: boolean) => {
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

beforeEach(() => {
  // jsdom lacks the dialog modal methods; the app's own tests install
  // the same fallback.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal =
      function showModal(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      };
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Sheet inline phone overlay (F793)", () => {
  it("routes a phone inline sheet through the modal path", () => {
    stubPointerWidth(true);
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    const { container } = render(
      <Sheet open onClose={() => {}} inline title="How to play" closeLabel="Close help">
        <p>Rules</p>
      </Sheet>,
    );

    expect(showModal).toHaveBeenCalled();
    // Modal path renders the bare dialog — testing-library's container
    // itself is the parent, not an inline scrim wrapper.
    expect(container.firstElementChild?.tagName).toBe("DIALOG");
  });

  it("keeps the desktop inline sheet embedded and non-modal", () => {
    stubPointerWidth(false);
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    const { container } = render(
      <Sheet open onClose={() => {}} inline title="How to play" closeLabel="Close help">
        <p>Rules</p>
      </Sheet>,
    );

    expect(showModal).not.toHaveBeenCalled();
    // Inline presentation: the dialog sits inside the scrim wrapper.
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });
});

describe("Sheet focus indicator (F809)", () => {
  it("gives the focused panel a visible keyboard focus ring", () => {
    stubPointerWidth(false);

    const { container } = render(
      <Sheet open onClose={() => {}} title="How to play" closeLabel="Close help">
        <p>Rules</p>
      </Sheet>,
    );

    // The open effect focuses the panel itself; the shared outline-none
    // base would leave keyboard users with no indicator without a
    // focus-visible ring — the same recipe the repo's other controls use.
    // ring-inset keeps it visible on the phone sheet, which sits flush
    // against the viewport edges.
    const dialog = container.querySelector("dialog");
    expect(dialog?.className).toContain("focus-visible:ring-2");
    expect(dialog?.className).toContain("focus-visible:ring-inset");
    expect(dialog?.className).toContain("focus-visible:ring-primary");
  });
});
